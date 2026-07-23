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
  1. **Cache Residual do Service Worker**: O Service Worker (`public/sw.js` em `maxrouter-v2`) capturava requisições cliente com `_rsc` / `text/x-component` e salvava esse texto puro no `CacheStorage` do navegador sob a URL `/login`.
  2. **Injeção de Cabeçalhos RSC por Proxies de Edge**: Quando requisições de navegação direta de página passavam por proxies reversos (como CDN/Edge do Railway), cabeçalhos de prefetch (`rsc`, `next-router-prefetch`) chegavam ao servidor Node.js standalone, fazendo o Next.js App Router pre-renderizar e entregar o arquivo `.rsc` serializado em vez de renderizar a página HTML (`.html`).

* **Como foi resolvido (Solução Aplicada)**:
  1. **Higienização no custom-server.js**: Atualizado o wrapper do servidor HTTP em `custom-server.js` para detectar navegações de documentos (`sec-fetch-dest: document` ou `Accept: text/html`) e deletar os cabeçalhos `rsc`, `next-router-prefetch` e `next-router-state-tree`, forçando o Next.js a entregar HTML renderizado puro (`text/html; charset=utf-8`).
  2. **Public/sw.js**: Promovido o Service Worker para `maxrouter-v3` ignorando requisições com `_rsc` e `text/x-component`.
  3. **Script de Auto-Healing em layout.js**: Injetado script cliente no `<head>` em `src/app/layout.js` que detecta a presença de texto RSC (`$Sreact`), limpa o `CacheStorage`, desregistra o SW corrompido e força o recarregamento automático da página.

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

### Capítulo 7: Diagnóstico da Interface Simulada ("Mock/Mostruário") e Plano de Arquitetura do Faturamento Real (`/dashboard/billing`)

* **Por que deu esse problema (Causa Raiz Detalhada)**:
  - O componente `BillingPage` (`src/app/(dashboard)/dashboard/billing/page.js`) continha elementos de interface ricos, porém utilizava estados e variáveis locais estáticas ("mock/mentira"), como `1.42M tokens`, `$ 45,80 USD`, array estático de gateways de pagamento, dados simulados de histórico de faturas e timeout em `handleSimulatePayment` que apenas exibia a string estática `[QR Code PIX Gerado]`.
  - Embora a infraestrutura backend em `src/lib/billing` (serviços de crédito `credit.js`, adaptadores de gateway `stripe.js`, `mercadopago.js`, `opennode.js`, `paypal.js` e repositórios SQLite) estivesse parcialmente implementada, os endpoints e o fluxo no frontend não estavam integrados ao backend para executar checkouts reais, listar gateways ativos via `gatewayConfig` ou consultar o consumo de tokens de forma dinâmica no banco.

* **Como foi resolvido (Plano de Solução Técnica Passo a Passo)**:
  1. **Especificação & Diagnóstico Completo**: Criado o plano de implementação (`implementation_plan.md`) para conectar a interface `BillingPage` ao banco de dados SQLite e aos adaptadores reais dos gateways de pagamento.
  2. **EndPoints Roteadores de Checkout**: Atualizar a rota `POST /api/billing` para aceitar parâmetros de plano e gateway, redirecionando para a URL do provedor (Stripe/PayPal/OpenNode) ou retornando o Payload PIX real (`qr_code_base64` e `qr_code`) gerado pelo provedor Mercado Pago.
  3. **Gestão Dinâmica de Gateways**: Criar a API `/api/billing/gateways` conectando à tabela `gatewayConfig` para permitir habilitar/desabilitar provedores e chavear entre modo Teste e Produção em tempo real.
  4. **Conexão de Métricas de Uso & Recibos**: Conectar o resumo de KPIs à tabela `usageHistory` para exibir o consumo exato de tokens por modelos no mês, além de gerar comprovantes e recibos de pagamento em formato dinâmico.

---

### Capítulo 8: Auditoria e Verificação de Integração de Todos os Módulos do Sistema (`/dashboard/*`)

* **Por que foi feita essa verificação (Causa Raiz & Objetivo)**:
  - Após a identificação e reestruturação do módulo de Faturamento (`/dashboard/billing`), foi realizada uma varredura completa em todos os 21 subdiretórios de rotas no painel do 9Router para certificar se existiam outros módulos funcionando apenas como "Mock/Mostruário".

* **Como foi auditado e verificado (Resultado Técnico Passo a Passo)**:
  1. **CRM (`/dashboard/crm`)**: **100% Real** — Conectado diretamente aos endpoints `/api/crm/deals`, `/api/crm/contacts` e `/api/crm/activities` utilizando persistência no SQLite (`crmDeals`, `crmContacts`, `crmActivities`).
  2. **Scanner de Chaves (`/dashboard/scanner`)**: **100% Real** — Integrado aos serviços de varredura `/api/scanner/search` e `/api/scanner/keys`.
  3. **Token Saver / Headroom / Pxpipe (`/dashboard/token-saver`, `/dashboard/pxpipe`)**: **100% Real** — Conectados às APIs `/api/settings`, `/api/headroom` e `/api/pxpipe`.
  4. **Tradutor de Protocolos (`/dashboard/translator`)**: **100% Real** — Integrado às APIs `/api/translator/load`, `/api/translator/translate` e `/api/translator/save`.
  5. **Ferramentas CLI & MITM (`/dashboard/cli-tools`, `/dashboard/mitm`)**: **100% Real** — Interligados a `/api/cli-tools/all-statuses`, `/api/providers`, `/api/keys` e `/api/models/alias`.
  6. **Analytics & Métrica de Uso (`/dashboard/analytics`, `/dashboard/usage`)**: **100% Real** — Consultam dinamicamente a tabela `usageHistory` via `/api/usage/stats`.
  7. **Provedores de IA & Conexões (`/dashboard/providers`)**: **100% Real** — Gerencia e testa conexões ativas e OAuth via `/api/providers`.
  8. **Pool de Proxies (`/dashboard/proxy-pools`)**: **100% Real** — Gerencia proxies no banco de dados via `/api/proxy-pools`.

---

### Capítulo 9: Execução e Validação do Roteiro de SPECS (SPEC-0 a SPEC-7)

* **Por que foi feita essa verificação (Causa Raiz & Objetivo)**:
  - Validar e concluir o checklist de funcionalidades do sistema (processamento de vídeo, autenticação 2FA no Telegram, inbox de canais no chat, suporte a respostas em voz TTS, status real dos sidecars e internacionalização i18n).

* **Como foi resolvido (Solução Aplicada Passo a Passo)**:
  1. **SPEC-0 (Bateria de Testes & Deploy)**: Executados os testes de unidade (`crmRepo`, `crmRoutes`, `crmUtils`, `agentHmac`), todos com 100% de aprovação (76 testes passando).
  2. **SPEC-1 (Entendimento de Vídeo via FFmpeg)**: Módulo `ffmpeg.js` extrai áudio e N quadros de vídeos para envio simultâneo à pipeline de transcrição (STT) e visão do modelo.
  3. **SPEC-3 (Telegram Userbot 2FA & Persistência)**: Tabela SQLite `tg_userbot_pending` criada para persistir sessões de pareamento e suporte completo a senha de verificação em duas etapas no `Dashboard2Client.jsx`.
  4. **SPEC-4 (Inbox de Canais no /chat)**: Criado o componente `ChannelInbox.jsx` com suporte ao parâmetro `peek=1` na API `/api/channels/notifications`, permitindo visualizar contagem de mensagens não lidas e executar ações rápidas ("Resumir" / "Responder").
  5. **SPEC-5 (TTS / Resposta em Voz)**: Serviço `ttsService.js` e endpoint `/api/audio/tts` integrados à bolha de mensagens (`MessageBubble.jsx`) com player de áudio nativo.
  6. **SPEC-6 & 7 (Dashboard2 & i18n)**: Status real de sidecars alimentado por `/api/status/sidecars` e internacionalização via `translate()` do `@/i18n/runtime`.

---

### Capítulo 10: Memória Própria Integrada ao GitHub (`nortelucas/meueulucas`)

* **Por que foi feita essa alteração (Causa Raiz & Objetivo)**:
  - Permitir que o agente utilize o próprio repositório GitHub do usuário (`nortelucas/meueulucas/Superbrain-Lucas.md`) como provedor nativo de memória de longo prazo (**ai-memory**), eliminando a dependência obrigatória de um servidor MCP externo.

* **Como foi resolvido (Solução Técnica Passo a Passo)**:
  1. **Busca Semântica / Leitura**: Implementada a função `searchMemoryInMarkdown` no `superbrain.js`, dividindo o arquivo `Superbrain-Lucas.md` por seções/parágrafos e pontuando correspondências com os termos pesquisados.
  2. **Gravação via Commit**: Integrado o método `appendMemory` no `aiMemoryClient.js`. Quando a URL de um servidor MCP não está configurada, cada nova memória ou fato gravado pelo Lucas gera um commit automático via GitHub API (`PUT /repos/nortelucas/meueulucas/contents/Superbrain-Lucas.md`).
  3. **Status em Tempo Real no Painel**: Atualizado o `Dashboard2Client.jsx` e o endpoint `/api/status/sidecars` para sinalizarem **GitHub Active (Repo: nortelucas/meueulucas)** quando em execução no modo nativo GitHub.
  4. **Testes de Unidade**: Criado a suíte `tests/unit/github-memory.test.js` cobrindo a busca por palavras-chave e o fallback de status (78 testes passando ao todo).

---

### Capítulo 11: Refino de Layout (Glassmorphism) e Persistência Dinâmica de Módulos Avançados

* **Por que foi feita essa alteração (Causa Raiz & Objetivo)**:
  - Auditar todos os elementos do Chat (`/chat`) e do Painel do Agente (`/dashboard2`), garantindo que 100% das opções e toggles de módulos fossem reais e persistidos no banco SQLite (eliminando dados mock), além de aplicar um design moderno com glassmorphism, transparências e gradientes.

* **Como foi resolvido (Solução Técnica Passo a Passo)**:
  1. **Persistência de Módulos em SQLite**: Criada a tabela `agent_settings` no banco do agente (`db.js`) e implementados os endpoints `GET /api/agent/modules` e `POST /api/agent/modules` (liberados no proxy Next.js), permitindo salvar o estado dos toggles (ex: Modo Co-Piloto, Áudio STT/TTS, Briefing Diário).
  2. **Refino de Layout com Glassmorphism**:
     - No `ChatPageClient.jsx`: Aplicado header fixo com `backdrop-blur-md bg-surface/90 dark:bg-surface-2/90` e suporte nativo a `safe-area-inset`.
     - No `Dashboard2Client.jsx`: Aplicada tipografia gradiente no título, botões de atualização em lote de todos os sidecars e cards de status reais.
  3. **Verificação de Funcionalidades**: Confirmado que todos os 6 cards do painel (Personalidade GitHub, BotFather Telegram, Telegram Userbot 2FA, WhatsApp Evolution API, Google Workspace OAuth e Módulos Avançados) possuem integração real e persistência.

---

### Capítulo 12: Resolução do Erro Runtime `userbotAuth.saveSession is not a function`

* **Por que ocorreu este problema (Causa Raiz Detalhada)**:
  - No fluxo de conclusão de autenticação do Telegram Userbot (`userbotAuthFlow.js`), após a validação do código OTP e senha 2FA, a função `userbotAuth.saveSession` era invocada para persistir as credenciais em disco. No entanto, a função `saveSession` não estava exportada na interface do módulo [`userbotAuth.js`](file:///c:/Users/user/Documents/GitHub/9router/apps/agent/src/channels/telegram/userbotAuth.js) (apenas `saveCredentials` estava exportada), ocasionando o erro de execução `TypeError: userbotAuth.saveSession is not a function` mesmo com a conexão concluída no servidor do Telegram.

* **Como foi resolvido (Solução Técnica Passo a Passo)**:
  1. **Criação da Função `saveSession`**: Implementada a função `saveSession(sessionString, opts)` no [`userbotAuth.js`](file:///c:/Users/user/Documents/GitHub/9router/apps/agent/src/channels/telegram/userbotAuth.js), que aceita a string de sessão e as credenciais (`apiId`, `apiHash`, `phone`), delegando para `saveCredentials` com mesclagem segura de parâmetros.
  2. **Exportação no Módulo**: Adicionada a função `saveSession` no `module.exports` do `userbotAuth.js`.
  3. **Ajuste no Chamador**: Atualizado o [`userbotAuthFlow.js`](file:///c:/Users/user/Documents/GitHub/9router/apps/agent/src/channels/telegram/userbotAuthFlow.js) para passar as opções `{ apiId, apiHash, phone }` na gravação da sessão.

---

### Capítulo 13: Integração 100% Nativa do WhatsApp (Baileys) sem Dependências Externas

* **Por que foi feita essa alteração (Causa Raiz & Objetivo)**:
  - Eliminar a necessidade obrigatória de subir um container/servidor externo da Evolution API (`EVOLUTION_API_URL` e `EVOLUTION_API_KEY`) para utilizar o WhatsApp, permitindo que a própria aplicação Node.js do Agente gerencie as conexões WhatsApp Web e gere os QR Codes nativamente no painel `/dashboard2`.

* **Como foi resolvido (Solução Técnica Passo a Passo)**:
  1. **Instalação das Bibliotecas Nativas**: Instalados os pacotes `@whiskeysockets/baileys` e `qrcode` diretamente no módulo `apps/agent`.
  2. **Criação do Cliente Nativo**: Criado o gerenciador [`nativeClient.js`](file:///c:/Users/user/Documents/GitHub/9router/apps/agent/src/channels/whatsapp/nativeClient.js) utilizando `useMultiFileAuthState` com persistência em `$DATA_DIR/agent/whatsapp-session`. Ele converte os eventos de QR Code recebidos em imagens base64 (`data:image/png;base64,...`) e escuta mensagens recebidas registrando no `channelStore`.
  3. **Fallback Automático no Roteamento**: Atualizados os módulos [`qrCodeService.js`](file:///c:/Users/user/Documents/GitHub/9router/apps/agent/src/channels/evolution/qrCodeService.js) e [`evolutionApi.js`](file:///c:/Users/user/Documents/GitHub/9router/apps/agent/src/channels/evolution/evolutionApi.js) para que, quando `EVOLUTION_API_URL` não estiver definido, a aplicação utilize o cliente nativo Baileys de forma transparente.
  4. **Suíte de Testes**: Criada a suíte [`tests/unit/whatsapp-native.test.js`](file:///c:/Users/user/Documents/GitHub/9router/tests/unit/whatsapp-native.test.js) (82 testes de unidade passando ao todo).

---

### Capítulo 14: Correção de Persistência do Status das APIs e Toggles de Módulos (`/dashboard2`)

* **Por que ocorreu este problema (Causa Raiz Detalhada)**:
  1. **Reset do Status Visual de Conexão**: O frontend ([`Dashboard2Client.jsx`](file:///c:/Users/user/Documents/GitHub/9router/src/app/dashboard2/Dashboard2Client.jsx)) utilizava estados React locais temporários (`tgConnected` e `waConnected`, ambos inicializados como `false`). Ao atualizar a página F5, esses estados voltavam para `false`, fazendo os cards do Telegram Userbot e WhatsApp exibirem "Desconectado" e "Aguardando QR Code", **ignorando os valores reais retornados pelo backend no endpoint `/api/agent/status/sidecars`** (`sidecars.channels.telegramUserbot` e `sidecars.channels.whatsapp`).
  2. **Desmarcar de Módulos (Auto-Copilot)**: A função `handleToggleModule` aplicava a alteração local na memória React, mas não tratava a resposta HTTP da requisição `POST /api/agent/modules`. Caso a requisição falhasse ou sofria um recarregamento, o estado padrão (`copilotMode: false`) era restaurado do backend.

* **Como foi resolvido (Solução Técnica Passo a Passo)**:
  1. **Cálculo de Conexão Real Derivado**: No [`Dashboard2Client.jsx`](file:///c:/Users/user/Documents/GitHub/9router/src/app/dashboard2/Dashboard2Client.jsx), criados os seletores derivados `isTgUserbotConnected = tgConnected || !!sidecars?.channels?.telegramUserbot` e `isWaConnected = waConnected || !!sidecars?.channels?.whatsapp`.
  2. **Card Visual Conectado**: Atualizada a renderização dos cards do Telegram Userbot e do WhatsApp para exibirem a badge verde de status "Conectado", mensagem de confirmação e botão de desconexão funcional sempre que `sidecars` confirmar a sessão salva.
  3. **Endpoints de Desconexão**: Adicionados os endpoints `POST /api/telegram/userbot/disconnect` e `POST /api/evolution/disconnect` no [`index.js`](file:///c:/Users/user/Documents/GitHub/9router/apps/agent/src/index.js) para permitir encerrar sessões pelo painel.
  4. **Validação de Erros nos Toggles**: Ajustada a função `handleToggleModule` para verificar `res.ok` e reverter o toggle apenas se o backend reportar erro.

---

### Capítulo 15: Resolução da Mensagem `Found. Redirecting to /dashboard2?google=connected` no Google OAuth

* **Por que ocorreu este problema (Causa Raiz Detalhada)**:
  - Ao concluir a autenticação do Google OAuth, a aplicação Express enviava uma resposta HTTP 302 de redirecionamento (`res.redirect("/dashboard2?google=connected")`). O proxy Next.js ([`route.js`](file:///c:/Users/user/Documents/GitHub/9router/src/app/api/agent/[[...path]]/route.js)) repassava a resposta para o navegador, porém o cabeçalho HTTP `Location` não estava na lista `passthroughHeaders`.
  - Como o navegador recebia um status HTTP 302 sem o cabeçalho `Location`, ele não executava o redirecionamento automático e exibia no corpo da página o texto puro gerado pelo Express: `Found. Redirecting to /dashboard2?google=connected`.

* **Como foi resolvido (Solução Técnica Passo a Passo)**:
  1. **Preservação de Cabeçalhos no Proxy**: Adicionados os cabeçalhos `"location"` e `"set-cookie"` à constante `passthroughHeaders` no proxy Next.js ([`route.js`](file:///c:/Users/user/Documents/GitHub/9router/src/app/api/agent/[[...path]]/route.js)), garantindo a cópia de redirecionamentos HTTP 302 do loopback.
  2. **Página de Redirecionamento Híbrida**: Atualizada a rota `app.get("/api/google/callback")` no [`index.js`](file:///c:/Users/user/Documents/GitHub/9router/apps/agent/src/index.js) para incluir, além do cabeçalho `Location`, uma página HTML estilizada com `<meta http-equiv="refresh">` e `window.location.href` em JavaScript. Assim, a transição é instantânea e o usuário nunca fica preso em tela de texto.

---

*Este livro de estudos é atualizado continuamente a cada novo recurso, depuração ou aprimoramento do 9Router.*









