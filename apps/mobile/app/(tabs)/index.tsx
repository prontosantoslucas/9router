import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ScrollView,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Markdown from 'react-native-markdown-display';
import { apiService } from '../../src/services/api';
import { storageService } from '../../src/services/storage';
import { ChatMessage, BRAIN_CATEGORIES, BrainCategory } from '../../src/types';

const QUICK_PROMPTS = [
  {
    icon: 'bulb-outline',
    title: 'Virada de Chave',
    prompt: 'Tive um insight hoje sobre nossa arquitetura e quero estruturar no Notion.',
    category: 'Viradas de Chave' as BrainCategory,
  },
  {
    icon: 'rocket-outline',
    title: 'Definir Meta',
    prompt: 'Me ajude a definir os objetivos e metas para as próximas 2 semanas.',
    category: 'Metas' as BrainCategory,
  },
  {
    icon: 'code-slash-outline',
    title: 'Plano Técnico',
    prompt: 'Quero desenhar o plano de ação técnico para o novo recurso.',
    category: 'Planos' as BrainCategory,
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Conversa Profunda',
    prompt: 'Vamos fazer um brainstorm profundo sobre os próximos passos da startup.',
    category: 'Conversas Profundas' as BrainCategory,
  },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Modal de Ação da Mensagem (Long Press estilo ChatGPT)
  const [selectedMsgForAction, setSelectedMsgForAction] = useState<ChatMessage | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);

  // Modal para Salvar no 2º Cérebro Notion
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<BrainCategory>('Conversas Profundas');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const saved = await storageService.getChatHistory();
    setMessages(saved);
  };

  const triggerHaptic = (type: 'light' | 'medium' | 'success' = 'light') => {
    try {
      if (type === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const pickImage = async (useCamera: boolean) => {
    triggerHaptic('light');
    try {
      let result;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão necessária', 'Permita o acesso à câmera.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          base64: true,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão necessária', 'Permita o acesso às fotos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          base64: true,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setSelectedImageBase64(result.assets[0].base64 || null);
      }
    } catch (err) {
      console.warn('Erro ao selecionar foto:', err);
    }
  };

  const handleSend = async (customText?: string) => {
    const text = (customText || inputMessage).trim();
    if (!text && !selectedImage) return;

    triggerHaptic('medium');

    const userMsgId = Date.now().toString();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: text || '(Anexo de imagem)',
      imageUri: selectedImage || undefined,
      timestamp: Date.now(),
      status: 'sending',
    };

    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInputMessage('');
    const base64ToSend = selectedImageBase64;
    setSelectedImage(null);
    setSelectedImageBase64(null);
    setSending(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await apiService.sendMessage(text, base64ToSend || undefined);

      triggerHaptic('success');

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: response.response,
        timestamp: Date.now(),
      };

      const finalMessages = updatedMessages.map((m) =>
        m.id === userMsgId ? { ...m, status: 'sent' as const } : m
      );
      finalMessages.push(agentMsg);

      setMessages(finalMessages);
      await storageService.saveChatHistory(finalMessages);
    } catch (err: any) {
      console.warn('Erro ao enviar no chat:', err);
      const errorMessages = updatedMessages.map((m) =>
        m.id === userMsgId ? { ...m, status: 'error' as const } : m
      );
      const errorAgentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `⚠️ **Conexão interrompida**: ${err.message || 'Não foi possível se comunicar com o backend.'}`,
        timestamp: Date.now(),
      };
      errorMessages.push(errorAgentMsg);
      setMessages(errorMessages);
      await storageService.saveChatHistory(errorMessages);
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleLongPressMessage = (msg: ChatMessage) => {
    triggerHaptic('medium');
    setSelectedMsgForAction(msg);
    setActionModalVisible(true);
  };

  const handleActionShare = async () => {
    if (!selectedMsgForAction) return;
    setActionModalVisible(false);
    try {
      await Share.share({ message: selectedMsgForAction.text });
    } catch {}
  };

  const handleOpenSaveModal = () => {
    if (!selectedMsgForAction) return;
    setActionModalVisible(false);

    const cleanSnippet = selectedMsgForAction.text
      .replace(/[*#_`]/g, '')
      .trim();
    const titleText = cleanSnippet.slice(0, 45) + (cleanSnippet.length > 45 ? '...' : '');

    setNoteTitle(titleText);
    setNoteContent(selectedMsgForAction.text);
    setNoteCategory('Conversas Profundas');
    setSaveModalVisible(true);
  };

  const handleSaveToBrain = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;

    setSavingNote(true);
    try {
      await apiService.saveNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        category: noteCategory,
      });

      triggerHaptic('success');
      setSaveModalVisible(false);
      Alert.alert('Salvo no Notion! 🚀', `Nota adicionada à categoria "${noteCategory}".`);
    } catch (err: any) {
      Alert.alert('Erro no salvamento', err.message || 'Não foi possível integrar com o Notion.');
    } finally {
      setSavingNote(false);
    }
  };

  const clearChat = async () => {
    triggerHaptic('light');
    Alert.alert('Limpar Conversa', 'Deseja apagar todo o histórico de mensagens?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await storageService.clearChatHistory();
          setMessages([]);
        },
      },
    ]);
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';

    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.agentRow]}>
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Ionicons name="sparkles" size={14} color="#818cf8" />
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.88}
          onLongPress={() => handleLongPressMessage(item)}
          style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}
        >
          {item.imageUri && (
            <Image source={{ uri: item.imageUri }} style={styles.chatImage} resizeMode="cover" />
          )}

          {isUser ? (
            <Text style={styles.userText}>{item.text}</Text>
          ) : (
            <Markdown style={markdownStyles}>{item.text}</Markdown>
          )}

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isUser && item.status === 'sending' && (
              <ActivityIndicator size="small" color="#94a3b8" style={{ marginLeft: 6 }} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header bar com modelo e limpar chat */}
      <View style={styles.headerBar}>
        <View style={styles.statusGroup}>
          <View style={styles.statusDot} />
          <Text style={styles.modelName}>Lucas 3.6 Pro</Text>
          <View style={styles.brainPill}>
            <Ionicons name="hardware-chip-outline" size={12} color="#818cf8" />
            <Text style={styles.brainPillText}>2º Cérebro</Text>
          </View>
        </View>

        {messages.length > 0 && (
          <TouchableOpacity onPress={clearChat} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      {/* Se não houver mensagens: Tela de boas-vindas estilo ChatGPT */}
      {messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.welcomeContainer}>
          <View style={styles.welcomeLogoBg}>
            <Ionicons name="sparkles" size={38} color="#6366f1" />
          </View>
          <Text style={styles.welcomeTitle}>Olá! Como posso ajudar?</Text>
          <Text style={styles.welcomeSubtitle}>
            Sou seu agente de IA integrado ao seu 2º Cérebro no Notion.
          </Text>

          <View style={styles.promptsGrid}>
            {QUICK_PROMPTS.map((qp, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.promptCard}
                activeOpacity={0.75}
                onPress={() => handleSend(qp.prompt)}
              >
                <View style={styles.promptCardHeader}>
                  <Ionicons name={qp.icon as any} size={20} color="#818cf8" />
                  <Text style={styles.promptCardTag}>{qp.category}</Text>
                </View>
                <Text style={styles.promptCardTitle}>{qp.title}</Text>
                <Text style={styles.promptCardDesc} numberOfLines={2}>
                  {qp.prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {/* Digitação / Resposta do Agente */}
      {sending && (
        <View style={styles.thinkingContainer}>
          <ActivityIndicator size="small" color="#6366f1" />
          <Text style={styles.thinkingText}>Lucas está processando...</Text>
        </View>
      )}

      {/* Preview de imagem anexada */}
      {selectedImage && (
        <View style={styles.imagePreviewPill}>
          <Image source={{ uri: selectedImage }} style={styles.previewThumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle}>Imagem pronta para envio</Text>
            <Text style={styles.previewSub}>O agente analisará o conteúdo visual</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedImage(null)}>
            <Ionicons name="close-circle" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Input Bar minimalista estilo ChatGPT */}
      <View style={styles.inputWrapper}>
        <View style={styles.inputCapsule}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() =>
              Alert.alert('Anexar Imagem', 'Selecione a origem da imagem:', [
                { text: 'Câmera', onPress: () => pickImage(true) },
                { text: 'Galeria de Fotos', onPress: () => pickImage(false) },
                { text: 'Cancelar', style: 'cancel' },
              ])
            }
          >
            <Ionicons name="add-circle-outline" size={26} color="#94a3b8" />
          </TouchableOpacity>

          <TextInput
            style={styles.inputField}
            placeholder="Pergunte ao Lucas ou anote algo..."
            placeholderTextColor="#64748b"
            multiline
            value={inputMessage}
            onChangeText={setInputMessage}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!inputMessage.trim() && !selectedImage) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={!inputMessage.trim() && !selectedImage}
          >
            <Ionicons name="arrow-up" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de Ações da Mensagem (Estilo Bottom Sheet) */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.actionModalOverlay}
          activeOpacity={1}
          onPress={() => setActionModalVisible(false)}
        >
          <View style={styles.actionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Opções da Mensagem</Text>

            <TouchableOpacity style={styles.sheetOption} onPress={handleOpenSaveModal}>
              <View style={[styles.sheetIconBg, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Ionicons name="journal-outline" size={20} color="#818cf8" />
              </View>
              <View style={styles.sheetTextGroup}>
                <Text style={styles.sheetOptionText}>Salvar no 2º Cérebro Notion</Text>
                <Text style={styles.sheetOptionSub}>Transforma este insight em uma nota categorizada</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOption} onPress={handleActionShare}>
              <View style={[styles.sheetIconBg, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <Ionicons name="share-outline" size={20} color="#38bdf8" />
              </View>
              <View style={styles.sheetTextGroup}>
                <Text style={styles.sheetOptionText}>Compartilhar Texto</Text>
                <Text style={styles.sheetOptionSub}>Enviar para outros aplicativos</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={() => setActionModalVisible(false)}
            >
              <Text style={styles.sheetCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Salvar no Notion */}
      <Modal visible={saveModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="journal" size={22} color="#6366f1" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Salvar no Notion</Text>
              </View>
              <TouchableOpacity onPress={() => setSaveModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Título da Nota</Text>
            <TextInput
              style={styles.modalInput}
              value={noteTitle}
              onChangeText={setNoteTitle}
            />

            <Text style={styles.fieldLabel}>Categoria no Notion</Text>
            <View style={styles.categoryGrid}>
              {BRAIN_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.catChip,
                    noteCategory === cat && styles.catChipActive,
                  ]}
                  onPress={() => setNoteCategory(cat)}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      noteCategory === cat && styles.catChipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setSaveModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, savingNote && styles.btnDisabled]}
                onPress={handleSaveToBrain}
                disabled={savingNote}
              >
                {savingNote ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Confirmar & Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#161f30',
    backgroundColor: '#0b0f17',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  modelName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 10,
  },
  brainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  brainPillText: {
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  clearBtn: {
    padding: 4,
  },
  welcomeContainer: {
    padding: 24,
    alignItems: 'center',
  },
  welcomeLogoBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 28,
    maxWidth: 280,
  },
  promptsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  promptCard: {
    width: '48%',
    backgroundColor: '#141c2c',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e2d45',
  },
  promptCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  promptCardTag: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  promptCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  promptCardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  agentRow: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    padding: 14,
  },
  userBubble: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: '#161f30',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#233047',
  },
  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
  },
  chatImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  thinkingText: {
    color: '#818cf8',
    fontSize: 12,
    marginLeft: 8,
  },
  imagePreviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161f30',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#233047',
  },
  previewThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  previewTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  previewSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
  inputWrapper: {
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    paddingTop: 6,
    backgroundColor: '#0b0f17',
  },
  inputCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161f30',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#233047',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attachBtn: {
    padding: 6,
  },
  inputField: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
    maxHeight: 110,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#141c2c',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#233047',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2d45',
  },
  sheetIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sheetTextGroup: {
    flex: 1,
  },
  sheetOptionText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  sheetOptionSub: {
    color: '#94a3b8',
    fontSize: 12,
  },
  sheetCloseBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetCloseText: {
    color: '#64748b',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#141c2c',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#233047',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#0b0f17',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#233047',
    padding: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0b0f17',
    borderWidth: 1,
    borderColor: '#233047',
    marginRight: 6,
    marginBottom: 6,
  },
  catChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  catChipText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

const markdownStyles = {
  body: { color: '#f8fafc', fontSize: 15, lineHeight: 22 },
  paragraph: { marginVertical: 4 },
  code_inline: { backgroundColor: '#0b0f17', color: '#38bdf8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  code_block: { backgroundColor: '#0b0f17', padding: 12, borderRadius: 10, color: '#38bdf8', borderWidth: 1, borderColor: '#233047', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  link: { color: '#818cf8', textDecorationLine: 'underline' as const },
  list_item: { marginVertical: 2 },
};
