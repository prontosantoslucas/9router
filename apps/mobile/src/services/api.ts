import * as SecureStore from 'expo-secure-store';
import { NotionNote, SaveNoteInput } from '../types';

const TOKEN_KEY = 'lucas_auth_token';
const DEFAULT_BASE_URL = 'https://maxrouter-prod.up.railway.app';

let customBaseUrl = DEFAULT_BASE_URL;

export const apiService = {
  setBaseUrl(url: string) {
    customBaseUrl = url.replace(/\/$/, '');
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
  },

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Cookie'] = `auth_token=${token}`;
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${customBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      ...options,
      headers,
    });

    // Capturar Set-Cookie se retornado no login
    const setCookieHeader = res.headers.get('set-cookie');
    if (setCookieHeader && setCookieHeader.includes('auth_token=')) {
      const match = setCookieHeader.match(/auth_token=([^;]+)/);
      if (match && match[1]) {
        await this.setToken(match[1]);
      }
    }

    const contentType = res.headers.get('content-type') || '';
    let data: any = {};
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { text: await res.text() };
    }

    if (!res.ok) {
      if (res.status === 401) {
        // Token inválido/expirado
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
    imageBase64?: string
  ): Promise<{ response: string; model?: string }> {
    const payload: any = { message };
    if (imageBase64) {
      payload.image = imageBase64;
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
};
