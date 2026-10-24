# 🚔 Automação para Renomeação de Ofícios e Termos de Entrega e Termo de Objeto em Trâmite Eletrônico (SGPE)

## 📋 Descrição do Projeto
Ferramenta desenvolvida em **Google Apps Script (GAS)** para automatizar o fluxo de arquivamento de documentos. O script atua como um agente de triagem digital: monitora uma pasta de entrada (Scanner), aplica Reconhecimento Óptico de Caracteres (OCR), identifica o tipo documental, realiza o fracionamento de PDFs multipáginas e renomeia os arquivos conforme as diretrizes.

**Versão Atual:** 1.0

## ✨ Funcionalidades (Inteligência Forense)
- **Classificação Estrita:** Identifica e categoriza estritamente três tipos documentais:
  - `TOTE` (Termo de Objeto em Trâmite Eletrônico)
  - `TE` (Termo de Entrega)
  - `R_OF` (Ofícios)
- **Extração Híbrida de Identificadores:** Captura autuações nos padrões `PCSC` e `APF`, tolerando variações de pontuação.
- **Corte Inteligente (Split):** Separa documentos distintos escaneados em um mesmo arquivo PDF, identificando a quebra de página por contexto.
- **Sequenciamento de Cópias:** Sistema *anti-sobrescrita* que adiciona sufixos sequenciais (`_copia1`, `_copia2`) para arquivos com nomes idênticos, preservando a evidência original.
- **Estabilização de API:** Controle de requisições (*Rate Limit*) com pausas táticas (`Utilities.sleep`) para evitar bloqueios nos servidores do Google.

## ⚙️ Pré-requisitos Técnicos
- Conta corporativa no Google Workspace (Drive Institucional).
- Acesso ao Google Apps Script.
- Permissão para ativação da **Drive API v3**.

## 🚀 Guia de Instalação e Configuração

### Fase 1: Preparação do Google Drive
1. Crie duas pastas em seu Google Drive:
   - `01_Scanner` (Pasta receptora do equipamento de digitalização).
   - `02_Recibos` (Pasta de destino dos arquivos processados).
2. Acesse cada pasta pelo navegador e copie o **ID da pasta** (a sequência alfanumérica presente na URL após `/folders/`).

### Fase 2: Implantação do Código
1. Acesse [script.google.com](https://script.google.com/) e clique em **Novo Projeto**.
2. Cole o conteúdo do arquivo `AutomacaoScanner.js` no editor.
3. Nas linhas 6 e 7 do código, insira os IDs das pastas criadas na Fase 1:
   ```javascript
   const ID_PASTA_SCANNER = 'COLE_AQUI_O_ID_DA_PASTA_SCANNER';
   const ID_PASTA_RECIBOS = 'COLE_AQUI_O_ID_DA_PASTA_RECIBOS';