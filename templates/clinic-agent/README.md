# Clinic Agent — Template MaxRouter

Base autônoma do agente de IA para clínicas. É o **template** que você replica pra cada cliente novo (Odonto, Estética, Vet).

## O que vem incluído

- **Agente IA** conectado ao gateway 9router (usa OAuth free tier — Gemini CLI por padrão)
- **WhatsApp Business** via Evolution API
- **Google Calendar** — cria evento de agendamento sozinho
- **Chat Web** — cliente pode testar/monitorar no navegador
- **Notas automáticas** — agente detecta info importante e salva por conversa
- **Memória por cliente/paciente** — persistente entre conversas
- **Questionário de onboarding** — cliente responde, o agente aprende sobre negócio

## Como deployar pra um cliente novo

### 1. Fork/clone essa pasta

```bash
cp -r templates/clinic-agent clientes/clinica-<nome>
cd clientes/clinica-<nome>
```

### 2. Cliente responde `setup/QUESTIONARIO.md`

Manda o arquivo pro cliente preencher (Notion/Google Docs/WhatsApp). Ele responde as ~30 perguntas sobre:
- Info da clínica (endereço, horários, telefone)
- Serviços + preços
- Convênios aceitos
- Público-alvo e tom de voz
- Fluxo de agendamento
- Perguntas frequentes
- O que o agente NUNCA deve fazer

### 3. Você preenche `setup/memoria-inicial.md`

Com base nas respostas, cria a memória inicial do agente (existe um template pronto em `setup/memoria-template.md`). É esse arquivo que vira o "contexto do sistema" do agente.

### 4. Configura env vars

Copia `.env.example` → `.env` e preenche:
- `ROUTER_API_KEY` (do gateway 9router — cria em `/dashboard/endpoint` do MaxRouter)
- `EVOLUTION_URL` + `EVOLUTION_TOKEN` + `EVOLUTION_INSTANCE` (WhatsApp)
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI`
- `CLINIC_NAME`, `CLINIC_PHONE` (branding no chat web)

### 5. Sobe no Contabo/Railway

```bash
npm install
npm start
```

Ou via Docker: `docker compose up -d`

### 6. Cliente conecta o WhatsApp

QR code aparece em `http://seu-servidor/setup/whatsapp` — cliente escaneia com WhatsApp Business.

### 7. Cliente autoriza Google Calendar

`http://seu-servidor/setup/google` → login → autorizar.

### 8. Ao vivo

Depois disso, mensagens no WhatsApp da clínica são respondidas pelo agente em ~3s. Você acompanha as conversas em `http://seu-servidor/dashboard`.

## Estrutura

```
clinic-agent/
├── setup/
│   ├── QUESTIONARIO.md         # ← cliente responde
│   ├── memoria-template.md     # ← você preenche
│   └── memoria-inicial.md      # ← gerada por você a partir do questionário
├── src/
│   ├── index.js                # entry point (Express server)
│   ├── config.js               # carrega .env
│   ├── channels/
│   │   ├── evolution.js        # WhatsApp Business API
│   │   └── webchat.js          # WebSocket pro chat web
│   ├── integrations/
│   │   └── googleCalendar.js   # OAuth + criar/consultar eventos
│   ├── agent/
│   │   ├── llm.js              # chama gateway 9router (OpenAI-compatible)
│   │   ├── prompt.js           # monta system prompt a partir da memória
│   │   └── tools.js            # schedule_appointment, check_availability, save_note
│   ├── db/
│   │   ├── schema.sql          # tabelas SQLite
│   │   └── db.js               # wrapper better-sqlite3
│   └── notes/
│       └── autoNote.js         # detecta info importante e salva
├── web/
│   ├── index.html              # dashboard + chatweb
│   └── setup.html              # onboarding do cliente (QR WhatsApp + Google OAuth)
├── package.json
├── docker-compose.yml
└── .env.example
```

## Workers de background (v3 + v4)

Rodam automaticamente no boot (`WORKERS_ENABLED=true`):

- **v3 — Lembrete 24h antes** (`src/workers/reminder.js`): checa a cada 15min
  consultas confirmadas dentro da janela de `REMINDER_HOURS_BEFORE` horas que
  ainda não receberam lembrete, e manda WhatsApp pedindo confirmação. É
  transacional (paciente tem consulta marcada), então envia em qualquer modo.

- **v4 — Reativação de inativos / LTV recovery** (`src/workers/reengagement.js`):
  checa a cada 6h pacientes silenciosos e manda mensagem escalando o apelo por
  tier. `REENGAGE_TIERS=15,30,60` → 15 dias (check-in leve), 30 dias (oferta
  suave), 60+ dias (último toque com condição especial). Cada tier envia 1x.
  Quem volta a falar reseta e pode ser reativado num ciclo futuro. Quem tem
  consulta futura marcada não é reativado. **Só dispara em `AGENT_MODE=prod`**
  (LGPD — comunicação ativa). Paciente que responde SAIR/PARAR vira
  `opted_out` e não recebe mais nada.

## Roadmap

**v2:** Integração CRM (RD Station, HubSpot free) — colunas prontas no schema
(`crm_synced_at`, `crm_object_id`), falta o conector.

## Preço sugerido

- **Setup R$ 1.997** (você configura + treina o agente com os dados do questionário)
- **R$ 297/mês** (hospedagem + manutenção + ajustes de prompt)

Ver `docs/PRECIFICACAO.md` (pendente).
