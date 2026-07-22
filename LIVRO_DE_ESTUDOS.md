# 📚 Livro de Estudos Técnicos & Manual de Soluções — 9Router

Documento de estudo e registro técnico incremental sobre a arquitetura do **9Router**, diagnósticos de causa raiz e resoluções aplicadas.

---

## 1. Arquitetura Geral do Sistema

* **Frontend**: Next.js 16 (App Router) com React 19, Tailwind CSS v4 e Lucide/Material Symbols.
* **Orquestrador de IA (Agente Lucas)**: Processo Node.js independente executando Express na pasta `apps/agent` na porta interna `3717`.
* **Proxy de Comunicação**: O arquivo Next.js `src/app/api/agent/[[...path]]/route.js` intercepta requisições web para `/api/agent/*`, valida autenticação JWT e assina as chamadas via HMAC SHA-256 (`X-9R-Agent-Auth`) antes de reencaminhar para o loopback `127.0.0.1:3717`.
* **Persistência de Dados**: Banco de dados SQLite (`data.sqlite`) gerenciado com fallback automático entre `better-sqlite3` e `node:sqlite`.

---

## 2. Registro de Problemas, Causas Raízes e Soluções (Capítulos de Estudo)

### Capítulo 1: Erro 502 Bad Gateway no Chat do Agente Lucas (`loopback indisponível`)

* **Por que deu esse problema (Causa Raiz)**:
  1. No container Docker do deploy no Railway, o builder do Next.js Standalone exportava apenas dependências da camada web. As dependências do subprocesso `apps/agent` (`express`, `cors`, `telegraf`, `telegram`, `googleapis`, `better-sqlite3`, etc.) não eram copiadas para a imagem final `runner`, fazendo o agente crashar no boot.
  2. O arquivo `config.js` do agente priorizava `process.env.PORT` antes de `process.env.AGENT_PORT`. Como o Railway injetava a variável global `PORT=20128`, o agente tentava subir na mesma porta da aplicação web, resultando em colisão `EADDRINUSE`.

* **Como foi resolvido (Solução Aplicada)**:
  1. **Dockerfile**: Ajustado o estágio `runner` para copiar a pasta `apps/agent` e executar `npm install --prefix apps/agent --omit=dev`.
  2. **config.js**: Alterada a resolução da porta em `config.js` para priorizar `process.env.AGENT_PORT` (`3717`).
  3. **runner-start.sh**: Exportação explícita de `AGENT_PORT=3717` no script de inicialização do container.

---

### Capítulo 2: Renderização de Texto Puro RSC (`1:"$Sreact.fragment"...`) ao Acessar Páginas

* **Por que deu esse problema (Causa Raiz)**:
  - O Service Worker (`public/sw.js`) da versão `maxrouter-v2` capturava requisições do Next.js App Router feitas durante a navegação do cliente (que possuem cabeçalhos `_rsc` e `text/x-component`) e armazenava esse payload de texto bruto no `CacheStorage` sob a URL da página (ex: `/login`). Ao recarregar ou navegar diretamente para a URL, o Service Worker devolvia o arquivo de texto RSC gravado no cache em vez de buscar o documento HTML real.

* **Como foi resolvido (Solução Aplicada)**:
  1. **Public/sw.js**: Promovido o Service Worker para `maxrouter-v3` adicionando uma regra estrita que ignora totalmente qualquer requisição contendo parâmetros `_rsc` ou cabeçalhos `text/x-component`.
  2. **Navegação HTML Direta**: Definido que requisições do tipo `navigate` (`text/html`) buscam o documento sempre diretamente da rede.
  3. **Script de Auto-Healing no layout.js**: Injetado um script no `<head>` em `src/app/layout.js` que detecta se o navegador exibiu um payload RSC bruto (`$Sreact`), desregistra automaticamente os Service Workers corrompidos antigos, limpa o `CacheStorage` e força o recarregamento limpo do HTML.

---

### Capítulo 3: Erro 404 (Not Found) no QR Code do WhatsApp Evolution API

* **Por que deu esse problema (Causa Raiz)**:
  - O componente do painel enviava uma chamada `POST /api/agent/evolution/instance`. O proxy Next.js limpava o prefixo `/agent` e enviava `POST http://127.0.0.1:3717/api/evolution/instance`. Como o servidor Express em `apps/agent/src/index.js` não tinha essa rota mapeada, respondia com erro 404. Além disso, a UI tentava exibir o texto `[QR Code do WhatsApp]` em vez de instanciar a tag `<img>`.

* **Como foi resolvido (Solução Aplicada)**:
  1. **apps/agent/src/index.js**: Adicionado o endpoint `app.all(["/api/evolution/instance", "/api/agent/evolution/instance"], ...)` integrado ao `qrCodeService.getQrCode()`.
  2. **Dashboard2Client.jsx**: Atualizado a manipulador para extrair strings/base64 de imagens e renderizar a tag `<img src={waQrCode} />` com fallback dinâmico em tempo real.

---

### Capítulo 4: Mensagem "Nenhum modelo disponível" no Chat

* **Por que deu esse problema (Causa Raiz)**:
  - A função `getPriorityList()` em `models.js` dependia da variável de ambiente `MODEL_RANKING`. Quando essa variável não estava configurada no `.env`, o ranking retornava um array vazio (`[]`). Se a busca dinâmica de modelos do backend demorasse a responder no boot, o orquestrador ficava com 0 modelos e lançava exceção.

* **Como foi resolvido (Solução Aplicada)**:
  1. **config.js & models.js**: Definido um `DEFAULT_RANKING` robusto contendo os modelos padrão (`opencode/gemini-2.5-flash`, `opencode/claude-3-5-haiku`, `opencode/gpt-4o-mini`, `gemini-2.5-flash`, `gpt-4o-mini`, etc.).
  2. **Resiliência em Fallback**: Atualizada a lógica de `getPriorityList()` para nunca retornar uma lista vazia, garantindo que o chat sempre consiga se comunicar com o roteador de IA.

---

### Capítulo 5: Reformulação Completa do Módulo de Faturamento (`/dashboard/billing`)

* **Por que deu esse problema (Causa Raiz)**:
  - A página de billing antiga era um MVP básico contendo apenas tabelas genéricas, sem seletor de planos, sem simulador de checkout, sem recarga de saldo e sem design responsivo.

* **Como foi resolvido (Solução Aplicada)**:
  1. **Design System Moderno**: Reconstruída a página inteira em [page.js](file:///c:/Users/user/Documents/GitHub/9router/src/app/(dashboard)/dashboard/billing/page.js) com 5 abas interativas (*Visão Geral*, *Planos & Preços*, *Chaves de API & Saldo*, *Histórico & Faturas*, *Gateways de Pagamento*).
  2. **Recursos Adicionados**:
     - Cards de KPI com barra de consumo de tokens em tempo real.
     - Seletor de cobrança Mensal/Anual com desconto de 20%.
     - Modal de Checkout simulado com geração de QR Code PIX ("Copia e Cola").
     - Modal de recarga rápida de saldo ($10, $25, $50, $100).
     - Gerenciador de chaves pagas e emissão de recibos em PDF.

---

### Capítulo 6: Autenticação MTProto do Telegram Userbot (Conta Pessoal)

* **Por que deu esse problema (Causa Raiz)**:
  - O fluxo MTProto do GramJS é nativamente bloqueante/interativo, exigindo adaptação para se adequar ao fluxo em 2 etapas da Web HTTP (`start-auth` → `complete-auth`).

* **Como foi resolvido (Solução Aplicada)**:
  1. **userbotAuth.js**: Criado o fluxo HTTP de duas etapas. A primeira envia o código OTP e salva o cliente temporário em um `Map` com expiração em 5 minutos. A segunda valida o código, gera a `StringSession` e salva as credenciais no diretório persistente (`~/.9router/agent/telegram-userbot.json`).
  2. **userbotListener.js**: Cliente de longa duração que escuta eventos `NewMessage` filtrados exclusivamente para DMs privadas 1:1, repassando as mensagens para o Lucas e enviando as respostas de volta pela própria conta pessoal.

---

*Este livro de estudos é atualizado continuamente a cada novo recurso, depuração ou aprimoramento do 9Router.*
