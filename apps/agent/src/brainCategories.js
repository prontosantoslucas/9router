const config = require("./config");

// Duas estruturas no Notion, cada uma com sua "família" de categorias. Fonte
// única — orchestrator.js (captura automática) e tools/index.js (notion_save
// manual) importam daqui, pra nunca divergir uma da outra.
//  - segundo cérebro original (config.NOTION_DATABASE_ID): conversas/insights.
//  - "Cérebro Inteligente" (config.NOTION_SECOND_DATABASE_ID): rastreador
//    pessoal pré-existente (Agenda/Tarefas/Financeiro/...) que o usuário já
//    tinha no Notion antes desta integração.
// "Metas" existe nas duas com sentidos diferentes (meta de vida discutida em
// conversa vs. item do rastreador pessoal) — por isso "label" (o que o
// classificador LLM e o enum da tool veem) é distinto mesmo quando
// "categoria" (o título real da página no Notion, usado pra buscar/criar)
// colide entre as duas famílias.
// `db` é uma função (não um valor fixo) pra sempre ler o config atual em
// tempo de chamada — reflete qualquer setConfig()/setSecondDatabase() feito
// depois do boot, sem precisar recarregar este módulo.
const BRAIN_ENTRIES = [
  { label: "Conversas Profundas", categoria: "Conversas Profundas", db: () => config.NOTION_DATABASE_ID },
  { label: "Planos", categoria: "Planos", db: () => config.NOTION_DATABASE_ID },
  { label: "Metas (discutida em conversa)", categoria: "Metas", db: () => config.NOTION_DATABASE_ID },
  { label: "Pontos Importantes", categoria: "Pontos Importantes", db: () => config.NOTION_DATABASE_ID },
  { label: "Viradas de Chave", categoria: "Viradas de Chave", db: () => config.NOTION_DATABASE_ID },
  { label: "Memórias", categoria: "Memórias", db: () => config.NOTION_DATABASE_ID },
  { label: "Ideias Não Trabalhadas", categoria: "Ideias Não Trabalhadas", db: () => config.NOTION_DATABASE_ID },
  { label: "Agenda", categoria: "Agenda", db: () => config.NOTION_SECOND_DATABASE_ID },
  { label: "Anotações", categoria: "Anotações", db: () => config.NOTION_SECOND_DATABASE_ID },
  { label: "Metas (rastreador pessoal)", categoria: "Metas", db: () => config.NOTION_SECOND_DATABASE_ID },
  { label: "Tarefas", categoria: "Tarefas", db: () => config.NOTION_SECOND_DATABASE_ID },
  { label: "Alimentação", categoria: "Alimentação", db: () => config.NOTION_SECOND_DATABASE_ID },
  { label: "Financeiro", categoria: "Financeiro", db: () => config.NOTION_SECOND_DATABASE_ID },
  { label: "Atalhos", categoria: "Atalhos", db: () => config.NOTION_SECOND_DATABASE_ID },
];

const BRAIN_ENTRY_BY_LABEL = new Map(BRAIN_ENTRIES.map((e) => [e.label, e]));
const BRAIN_LABELS = BRAIN_ENTRIES.map((e) => e.label);

module.exports = { BRAIN_ENTRIES, BRAIN_ENTRY_BY_LABEL, BRAIN_LABELS };
