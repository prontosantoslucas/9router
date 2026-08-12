-- Clinic Agent — schema SQLite
-- Roda automaticamente na inicialização se as tabelas não existirem.

-- ============================================================
-- Conversas por contato (chatId = telefone/whatsapp id)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  chat_id       TEXT PRIMARY KEY,          -- phone: 5511987654321 ou webchat:uuid
  channel       TEXT NOT NULL,             -- 'whatsapp' | 'webchat'
  patient_name  TEXT,                      -- nome coletado durante conversa
  patient_phone TEXT,                      -- número secundário se diferente
  patient_email TEXT,
  status        TEXT DEFAULT 'active',     -- active | pending_human | closed
  metadata      TEXT DEFAULT '{}',         -- JSON: preferências, tags, notas curtas
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_seen ON conversations(last_seen_at);

-- ============================================================
-- Histórico de mensagens
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id       TEXT NOT NULL,
  role          TEXT NOT NULL,             -- 'user' | 'assistant' | 'system' | 'tool'
  content       TEXT NOT NULL,
  tool_name     TEXT,                      -- se role=tool: schedule_appointment, save_note, etc.
  tool_args     TEXT,                      -- JSON dos args
  tool_result   TEXT,                      -- JSON do resultado
  reviewed_by   TEXT,                      -- se AGENT_MODE=test: 'auto-approved' | 'human:<name>' | 'human-edited'
  created_at    TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES conversations(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at);

-- ============================================================
-- Notas — info importante por paciente, salva pelo agente via save_note
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id    TEXT NOT NULL,
  category   TEXT NOT NULL,               -- 'clinical' | 'preference' | 'restriction' | 'general'
  content    TEXT NOT NULL,
  source     TEXT DEFAULT 'agent',        -- 'agent' | 'human'
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES conversations(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_notes_chat ON notes(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);

-- ============================================================
-- Agendamentos criados pelo agente
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id              TEXT NOT NULL,
  google_event_id      TEXT,                       -- id do evento no Google Calendar
  patient_name         TEXT NOT NULL,
  patient_phone        TEXT,
  service              TEXT NOT NULL,              -- serviço agendado
  scheduled_at         TEXT NOT NULL,              -- ISO datetime
  duration_minutes     INTEGER DEFAULT 30,
  status               TEXT DEFAULT 'confirmed',   -- confirmed | canceled | completed | no_show
  reminder_sent_at     TEXT,                       -- workers setam quando manda lembrete
  notes                TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES conversations(chat_id)
);

CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at, status);

-- ============================================================
-- OAuth tokens (Google Calendar)
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider     TEXT PRIMARY KEY,           -- 'google'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at   TEXT,
  scope        TEXT,
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- Config runtime (chave/valor persistente — coisas que mudam sem redeploy)
-- ============================================================
CREATE TABLE IF NOT EXISTS runtime_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
