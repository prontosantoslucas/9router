import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../types';

const CHAT_HISTORY_KEY = '@lucas_chat_history_v1';

export const storageService = {
  async getChatHistory(): Promise<ChatMessage[]> {
    try {
      const data = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.warn('Erro ao carregar histórico local:', err);
      return [];
    }
  },

  async saveChatHistory(messages: ChatMessage[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    } catch (err) {
      console.warn('Erro ao salvar histórico local:', err);
    }
  },

  async clearChatHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
    } catch (err) {
      console.warn('Erro ao limpar histórico local:', err);
    }
  },
};
