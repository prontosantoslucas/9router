import * as SecureStore from 'expo-secure-store';
import { NotionNote, SaveNoteInput } from '../types';

const TOKEN_KEY = 'lucas_auth_token';
const CHAT_ID_KEY = 'lucas_chat_id';
const SERVER_URL_KEY = 'lucas_server_url';
const DEFAULT_BASE_URL = 'https://maxrouter.up.railway.app';

let customBaseUrl = DEFAULT_BASE_URL;

// Tenta carregar a URL do servidor persistida
try {
  SecureStore.getItemAsync(SERVER_URL_KEY).then((saved) => {
    if (saved && saved.trim()) {
      customBaseUrl = saved.trim().replace(/\/$/, '');
    }
  }).catch(() => {});
} catch {}

export const apiService = {
  async setBaseUrl(url: string) {
    customBaseUrl = url.trim().replace(/\/$/, '');
    try {
      await SecureStore.setItemAsync(SERVER_URL_KEY, customBaseUrl);
    } catch {}
  },

  getBaseUrl() {
    return customBaseUrl;
  },


  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async removeToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(CHAT_ID_KEY);
  },

  // ChatId unificado — igual ao que o webchat usa após login.
  // Puxado de /api/auth/me e cacheado localmente pra reuso rápido.
  async getChatId(): Promise<string> {
    try {
      const cached = await SecureStore.getItemAsync(CHAT_ID_KEY);
      if (cached) return cached;
    } catch {}
    try {
      const data: any = await this.request('/api/auth/me', { method: 'GET' });
      if (data?.chatId) {
        await SecureStore.setItemAsync(CHAT_ID_KEY, data.chatId);
        return data.chatId;
      }
    } catch {}
    return 'user:anonymous';
  },

  async refreshChatId(): Promise<string> {
    // Força re-fetch (usar após login/logout)
    try { await SecureStore.deleteItemAsync(CHAT_ID_KEY); } catch {}
    return this.getChatId();
  },

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const cleanBase = customBaseUrl.replace(/\/+$/, '');
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanPath}`;

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        headers,
      });
    } catch (fetchErr: any) {
      console.warn(`[API] Erro de rede ao chamar ${url}:`, fetchErr.message);
      throw new Error(`Falha de conexão com ${cleanBase}: ${fetchErr.message || 'Network request failed'}`);
    }

    const contentType = res.headers.get('content-type') || '';
    let data: any = {};
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      data = { text: await res.text().catch(() => '') };
    }

    if (!res.ok) {
      if (res.status === 401) {
        await this.removeToken();
      }
      const errorMessage = data.error || data.message || `Erro HTTP ${res.status}`;
      const error: any = new Error(errorMessage);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data as T;
  },

  // ──────── API DE AUTENTICAÇÃO ────────
  async login(password: string): Promise<{ success: boolean; token?: string }> {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });

    if (data.token) {
      await this.setToken(data.token);
      // Re-fetch chatId — depende do token novo pra derivar hash correto
      await this.refreshChatId();
    }
    return { success: true, token: data.token };
  },

  async checkAuthStatus(): Promise<boolean> {
    try {
      const token = await this.getToken();
      if (!token) return false;
      const res = await this.request('/api/auth/status', { method: 'GET' });
      return !!(res && (res.authenticated || res.user || res.success));
    } catch {
      return false;
    }
  },

  // ──────── API DE CHAT ────────
  async sendMessage(
    message: string,
    imageBase64?: string,
    liveMode?: boolean
  ): Promise<{ response: string; model?: string }> {
    const payload: any = { message };
    if (imageBase64) {
      payload.image = imageBase64;
    }
    if (liveMode) {
      payload.liveMode = true;
    }

    const data = await this.request('/api/agent/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      response: data.response || data.text || data.content || (typeof data === 'string' ? data : JSON.stringify(data)),
      model: data.model,
    };
  },

  // ──────── API DE SÍNTESE DE VOZ REAL (TTS) ────────
  async synthesizeTts(text: string, voice?: string): Promise<{ base64: string; mimeType: string }> {
    const data = await this.request('/api/agent/audio/tts', {
      method: 'POST',
      body: JSON.stringify({ text, voice }),
    });
    return data;
  },

  // ──────── API DE TRANSCRIÇÃO DE VOZ (STT — Groq Whisper) ────────
  async transcribeAudio(base64: string, mimeType = 'audio/m4a', filename = 'audio.m4a'): Promise<string> {
    const data = await this.request('/api/agent/audio/transcribe', {
      method: 'POST',
      body: JSON.stringify({ base64, mimeType, filename }),
    });
    return (data?.text || '').trim();
  },

  // ──────── API DE NOTION / 2º CÉREBRO ────────
  async listNotes(): Promise<NotionNote[]> {
    try {
      const data = await this.request('/api/agent/notion/list', { method: 'GET' });
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.notes)) return data.notes;
      if (data && Array.isArray(data.pages)) return data.pages;
      return [];
    } catch (err) {
      console.warn('Erro ao listar notas:', err);
      return [];
    }
  },

  async saveNote(input: SaveNoteInput): Promise<{ success: boolean; pageId?: string }> {
    const data = await this.request('/api/agent/notion/save', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        category: input.category,
      }),
    });
    return { success: true, pageId: data.id || data.pageId };
  },

  // ──────── API DE NOTIFICAÇÕES PROATIVAS ────────
  // Insights matutinos, alertas de vaga, mensagens agendadas — tudo que o
  // agent gera espontaneamente enquanto o app está fechado ou dormindo.
  async getPendingNotifications(chatId: string, limit = 30): Promise<{
    count: number;
    items: Array<{
      id: string;
      source: string;
      tag: string | null;
      priority: number;
      body: string;
      created_at: number;
      delivered: boolean;
    }>;
  }> {
    try {
      const data = await this.request(
        `/api/agent/notifications/pending?chatId=${encodeURIComponent(chatId)}&limit=${limit}`,
        { method: 'GET' }
      );
      return {
        count: data?.count ?? 0,
        items: Array.isArray(data?.items) ? data.items : [],
      };
    } catch (err) {
      console.warn('getPendingNotifications erro:', err);
      return { count: 0, items: [] };
    }
  },

  async markNotificationRead(id: string, chatId: string): Promise<boolean> {
    try {
      await this.request('/api/agent/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ id, chatId }),
      });
      return true;
    } catch { return false; }
  },
};
