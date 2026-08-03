export type BrainCategory =
  | 'Conversas Profundas'
  | 'Planos'
  | 'Metas'
  | 'Pontos Importantes'
  | 'Viradas de Chave'
  | 'Memórias'
  | 'Ideias Não Trabalhadas';

export const BRAIN_CATEGORIES: BrainCategory[] = [
  'Conversas Profundas',
  'Planos',
  'Metas',
  'Pontos Importantes',
  'Viradas de Chave',
  'Memórias',
  'Ideias Não Trabalhadas',
];

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  imageUri?: string;
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
}

export interface NotionNote {
  id: string;
  title: string;
  category: BrainCategory | string;
  createdTime?: string;
  contentSnippet?: string;
  url?: string;
}

export interface SaveNoteInput {
  title: string;
  content: string;
  category: BrainCategory;
}

export interface LoginResponse {
  success?: boolean;
  error?: string;
  remainingBeforeLock?: number;
}
