/**
 * AUTOMAÇÃO PCSC - VERSÃO 1.0 (SEQUENCIAMENTO DE CÓPIAS)
 * Novidade: Implementa sufixo sequencial (_copia1, _copia2...) para arquivos duplicados.
 */

const ID_PASTA_SCANNER = 'COLE_AQUI_O_ID_DA_PASTA_SCANNER';
const ID_PASTA_RECIBOS = 'COLE_AQUI_O_ID_DA_PASTA_RECIBOS';



// APENAS 3 TIPOS PERMITIDOS (REGRA ESTRITA)
const TIPOS_PERMITIDOS = {
  "TERMODEOBJETO": "TOTE",
  "TERMODEENTREGA": "TE",
  "OFICIO": "R_OF"
};

async function executarAutomacaoScanner() {
  await carregarBibliotecaPDF();
  const pastaScanner = DriveApp.getFolderById(ID_PASTA_SCANNER);
  const pastaRecibos = DriveApp.getFolderById(ID_PASTA_RECIBOS);
  const arquivos = pastaScanner.getFilesByType(MimeType.PDF);

  if (!arquivos.hasNext()) {
    Logger.log("Scanner vazio (QAP).");
    return;
  }

  while (arquivos.hasNext()) {
    const arq = arquivos.next();
    Logger.log(`>>> PERÍCIA: ${arq.getName()}`);
    try {
      await processarPDFEstrito(arq, pastaRecibos);
      arq.setTrashed(true);
      Logger.log("Processo concluído.");
    } catch (e) {
      Logger.log(`[ERRO] ${e.toString()}`);
    }
  }
}

async function processarPDFEstrito(arquivoPDF, pastaDestino) {
  const bytes = new Uint8Array(arquivoPDF.getBlob().getBytes());
  const pdfDoc = await PDFLib.PDFDocument.load(bytes);
  const total = pdfDoc.getPageCount();

  let buffer = [];
  let meta = null;

  for (let i = 0; i < total; i++) {
    // 1. OCR
    Utilities.sleep(1000); 
    let textoPagina = "";
    let tentativas = 0;
    while (tentativas < 2) {
      textoPagina = await ocrV3(pdfDoc, i);
      if (textoPagina !== "") break;
      Utilities.sleep(2000); 
      tentativas++;
    }

    const textoLimpo = limpar(textoPagina);
    const tipoDetectado = identificarTipoEstrito(textoLimpo);
    const todosIDs = extrairTodosNumeros(textoLimpo);
    
    Logger.log(`[PÁG ${i+1}] Tipo: ${tipoDetectado} | IDs: OF=${todosIDs.oficio||'-'} PCSC=${todosIDs.pcsc||'-'} APF=${todosIDs.apf||'-'}`);

    // 2. Regra de Negócio
    const dadosFinais = decidirMetadadosEstrito(tipoDetectado, todosIDs);
    
    // 3. Separação (Capa vs Anexo)
    let mudouNumero = false;
    if (meta && dadosFinais.processo !== "SEM_NUMERO" && dadosFinais.processo !== meta.processo) {
      mudouNumero = true;
    }
    
    const ehCapa = (dadosFinais.tipo !== "DOC_NAO_IDENTIFICADO" && tipoDetectado !== null) || mudouNumero;

    if (ehCapa) {
      if (buffer.length > 0) {
        if (meta && meta.processo === dadosFinais.processo && meta.tipo === dadosFinais.tipo) {
           buffer.push(i);
        } else {
           await salvarFinal(pdfDoc, buffer, meta, pastaDestino);
           buffer = [];
           meta = dadosFinais;
           buffer.push(i);
           Logger.log(`  -> NOVA CAPA: ${meta.tipo} -> ${meta.processo}`);
        }
      } else {
        meta = dadosFinais;
        buffer.push(i);
        Logger.log(`  -> INÍCIO: ${meta.tipo}`);
      }
    } else {
      if (buffer.length === 0 && !meta) meta = dadosFinais;
      if (meta.processo === "SEM_NUMERO" && dadosFinais.processo !== "SEM_NUMERO") {
        meta.processo = dadosFinais.processo;
      }
      buffer.push(i);
    }
  }

  if (buffer.length > 0) {
    await salvarFinal(pdfDoc, buffer, meta, pastaDestino);
  }
}

// ============================================================================
// LOGICA DE SALVAMENTO SEQUENCIAL (NOVA)
// ============================================================================
async function salvarFinal(doc, pgs, d, pasta) {
  const n = await PDFLib.PDFDocument.create();
  (await n.copyPages(doc, pgs)).forEach(pg => n.addPage(pg));
  
  let nomeBase = "";

  // 1. Definição do Nome Base
  if (d.tipo === "R_OF" && d.processo.includes("OF_")) {
    nomeBase = `R_OF_${d.processo.replace("OF_", "")}`;
  }
  else if (d.tipo === "TE" && d.processo.includes("APF")) {
    nomeBase = `TE_${d.processo}`;
  } 
  else if (d.tipo === "TOTE") {
    nomeBase = `TOTE_${d.processo}`;
  }
  else {
    nomeBase = `${d.tipo}_${d.processo}`;
  }

  // 2. Algoritmo de Sequenciamento (_copia1, _copia2...)
  let nomeFinal = `${nomeBase}.pdf`;
  let contador = 1;

  // Enquanto existir um arquivo com este nome, incrementa o contador
  while (pasta.getFilesByName(nomeFinal).hasNext()) {
    Logger.log(`[ALERTA] ${nomeFinal} existe. Tentando sequencial ${contador}...`);
    nomeFinal = `${nomeBase}_copia${contador}.pdf`;
    contador++;
  }
  
  // 3. Criação do Arquivo
  pasta.createFile(Utilities.newBlob(await n.save(), MimeType.PDF, nomeFinal));
  Logger.log(`[SALVO COM SUCESSO] ${nomeFinal}`);
}

// ============================================================================
// MATRIZ DE DECISÃO ESTRITA
// ============================================================================
function extrairTodosNumeros(txt) {
  let res = { pcsc: null, apf: null, oficio: null };
  const mAPF = txt.match(/APF.*?([\d\.]+)/);
  if (mAPF) res.apf = `APF_${mAPF[1].replace(/^\.+|\.+$/g, "")}`;
  const mPCSC = txt.match(/PCSC.*?(\d[\d\.]*)\/(\d{4})/);
  if (mPCSC) res.pcsc = `PCSC_${mPCSC[1].replace(/\./g, "")}_${mPCSC[2]}`;
  const mOF = txt.match(/OFICIO.*?(\d+).*?(\d{4})/);
  if (mOF) res.oficio = `OF_${mOF[1]}_${mOF[2]}`;
  return res;
}

function identificarTipoEstrito(txt) {
  if (txt.includes("TERMODEOBJETO")) return "TOTE";
  if (txt.includes("TERMODEENTREGA")) return "TE";
  if (txt.includes("OFICIO") && txt.match(/OFICIO.*?(\d+)/)) return "R_OF";
  return null;
}

function decidirMetadadosEstrito(tipoBruto, ids) {
  let d = { tipo: "DOC_NAO_IDENTIFICADO", processo: "SEM_NUMERO" };

  if (tipoBruto === "TOTE") {
    d.tipo = "TOTE";
    d.processo = ids.pcsc || ids.oficio || ids.apf || "SEM_NUMERO";
    return d;
  }
  if (tipoBruto === "TE") {
    d.tipo = "TE";
    d.processo = ids.apf || ids.pcsc || "SEM_NUMERO";
    return d;
  }
  if (tipoBruto === "R_OF") {
     d.tipo = "R_OF";
     d.processo = ids.oficio || "SEM_NUMERO";
     if (d.processo === "SEM_NUMERO" && ids.pcsc) {
        d.tipo = "TOTE";
        d.processo = ids.pcsc;
     }
     return d;
  }
  
  // Fallback (se a capa não foi lida direito)
  if (!tipoBruto) {
    if (ids.oficio && !ids.pcsc) { d.tipo = "R_OF"; d.processo = ids.oficio; }
    else if (ids.pcsc) { d.tipo = "TOTE"; d.processo = ids.pcsc; } 
    else if (ids.apf) { d.tipo = "TE"; d.processo = ids.apf; } 
  }
  return d;
}

// ============================================================================
// AUXILIARES
// ============================================================================
function limpar(t) {
  if (!t) return "";
  return t.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").replace(/[^\w\d\.\/\-]/g, "");
}

async function ocrV3(doc, idx) {
  try {
    const n = await PDFLib.PDFDocument.create();
    const [p] = await n.copyPages(doc, [idx]);
    n.addPage(p);
    const b = Utilities.newBlob(await n.save(), MimeType.PDF, "b.pdf");
    const r = { name: "ocr", mimeType: MimeType.GOOGLE_DOCS };
    const f = Drive.Files.create(r, b, { ocrLanguage: 'pt' });
    Utilities.sleep(500);
    const t = DocumentApp.openById(f.id).getBody().getText();
    Drive.Files.remove(f.id);
    return t;
  } catch (e) { return ""; }
}

async function carregarBibliotecaPDF() {
  if (typeof PDFLib === 'undefined') 
    eval(UrlFetchApp.fetch("https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js").getContentText());
}