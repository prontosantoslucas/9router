import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { apiService } from '../../src/services/api';

type CallStatus = 'OFF' | 'LISTENING' | 'THINKING' | 'SPEAKING';

interface LiveMessage {
  id: string;
  sender: 'user' | 'lucas';
  text: string;
  timestamp: string;
}

export default function LiveScreen() {
  useKeepAwake(); // Mantém a tela acesa durante o Modo Live de ligação

  const [status, setStatus] = useState<CallStatus>('OFF');
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [currentSpeechText, setCurrentSpeechText] = useState('');
  const [activeModel, setActiveModel] = useState<string>('meueulucas (Superbrain)');

  // Animação de pulso do Orbe Reativo
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const scrollRef = useRef<ScrollView>(null);

  // Loop de animação contínua do orbe
  useEffect(() => {
    if (status === 'OFF') {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.3);
      return;
    }

    let duration = 2000;
    if (status === 'THINKING') duration = 800;
    if (status === 'SPEAKING') duration = 1200;

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: status === 'SPEAKING' ? 1.25 : 1.15,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    glowLoop.start();

    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [status]);

  // Autoscroll para o final do histórico da ligação
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, currentSpeechText]);

  // Iniciar / Encerrar Chamada de Voz Continuada
  const toggleCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (status !== 'OFF') {
      setStatus('OFF');
      stopSpeech();
      addLog('system', 'Chamada em Modo Live encerrada.');
    } else {
      setStatus('LISTENING');
      addLog('system', 'Ligação iniciada com Lucas (Superbrain meueulucas conectado).');
      simulateVoiceInput('Olá Lucas, como você está hoje?');
    }
  };

  const addLog = (sender: 'user' | 'lucas' | 'system', text: string) => {
    if (sender === 'system') return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: Math.random().toString(), sender, text, timestamp: time }]);
  };

  // Simula a escuta continuada da voz do usuário e envio instantâneo para o backend
  const simulateVoiceInput = async (spokenText: string) => {
    if (status === 'OFF') return;

    setStatus('LISTENING');
    addLog('user', spokenText);
    Haptics.selectionAsync();

    // Transição para pensamento/processamento da IA
    setStatus('THINKING');

    try {
      const res = await apiService.sendMessage(spokenText, undefined, true);
      const answerText = res.response || 'Entendido, estou processando aqui!';
      if (res.model) setActiveModel(res.model);

      addLog('lucas', answerText);
      setStatus('SPEAKING');

      // Reproduzir áudio (Síntese vocal TTS)
      speakText(answerText, () => {
        // Ao finalizar de falar, retorna automaticamente ao estado de escuta continuada
        setStatus((prevStatus) => (prevStatus !== 'OFF' ? 'LISTENING' : 'OFF'));
      });
    } catch (err: any) {
      addLog('lucas', `Desculpe, tive um problema na ligação: ${err.message}`);
      setStatus('LISTENING');
    }
  };

  // Síntese de fala (Text-to-Speech) no navegador / dispositivo
  const speakText = (text: string, onEnd?: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utterance);
    } else {
      // Simulação mobile nativa de duração de fala baseada no número de palavras
      const words = text.split(' ').length;
      const durationMs = Math.max(1500, words * 280);
      setTimeout(() => {
        if (onEnd) onEnd();
      }, durationMs);
    }
  };

  const stopSpeech = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Prompts rápidos para disparar na ligação com um toque
  const handleQuickPrompt = (prompt: string) => {
    if (status === 'OFF') {
      setStatus('LISTENING');
    }
    simulateVoiceInput(prompt);
  };

  const getOrbColor = () => {
    switch (status) {
      case 'LISTENING':
        return '#818cf8'; // Azul/Violeta Elétrico
      case 'THINKING':
        return '#c084fc'; // Roxo Neon de Alto Desempenho
      case 'SPEAKING':
        return '#38bdf8'; // Ciano Veloce
      default:
        return '#334155'; // Apagado / Slated
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'LISTENING':
        return '🟢 Escutando fala do Lucas...';
      case 'THINKING':
        return '⚡ Processando com meueulucas...';
      case 'SPEAKING':
        return '🔊 Lucas Falando...';
      default:
        return '⚪ Chamada Encerrada';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header com indicador do repositório meueulucas */}
      <View style={styles.headerBadge}>
        <Ionicons name="sparkles" size={14} color="#818cf8" style={{ marginRight: 6 }} />
        <Text style={styles.headerBadgeText}>Personalidade Ativa: nortelucas/meueulucas</Text>
      </View>

      {/* ÁREA CENTRAL DO ORBE REATIVO */}
      <View style={styles.orbContainer}>
        {/* Anel Externo de Brilho */}
        <Animated.View
          style={[
            styles.orbGlow,
            {
              backgroundColor: getOrbColor(),
              opacity: glowAnim,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Orbe Principal */}
        <Animated.View
          style={[
            styles.orbCore,
            {
              borderColor: getOrbColor(),
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <Ionicons
            name={status === 'OFF' ? 'mic-off' : status === 'SPEAKING' ? 'volume-high' : 'mic'}
            size={48}
            color={getOrbColor()}
          />
        </Animated.View>

        {/* Status Text da Chamada */}
        <Text style={[styles.statusText, { color: status === 'OFF' ? '#94a3b8' : '#f8fafc' }]}>
          {getStatusText()}
        </Text>
      </View>

      {/* HISTÓRICO DA CONVERSA EM TEMPO REAL */}
      <View style={styles.transcriptContainer}>
        <Text style={styles.transcriptHeader}>Transcrição da Ligação ao Vivo</Text>
        <ScrollView
          ref={scrollRef}
          style={styles.transcriptScroll}
          contentContainerStyle={{ paddingBottom: 16 }}
        >
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>
              Inicie a ligação para conversar continuamente com sua IA usando voz em tempo real.
            </Text>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.msgBubble,
                  msg.sender === 'user' ? styles.userBubble : styles.lucasBubble,
                ]}
              >
                <Text style={styles.msgSender}>
                  {msg.sender === 'user' ? 'Você' : 'Lucas'} · {msg.timestamp}
                </Text>
                <Text style={styles.msgText}>{msg.text}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* ATALHOS RÁPIDOS DE VOZ */}
      <View style={styles.quickPromptsRow}>
        <TouchableOpacity
          style={styles.quickChip}
          onPress={() => handleQuickPrompt('Lucas, qual é a minha prioridade de hoje?')}
        >
          <Text style={styles.quickChipText}>🎯 Prioridade</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickChip}
          onPress={() => handleQuickPrompt('Lucas, me dê uma dica rápida de foco!')}
        >
          <Text style={styles.quickChipText}>⚡ Dica Foco</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickChip}
          onPress={() => handleQuickPrompt('Lucas, o que temos de notas no segundo cérebro?')}
        >
          <Text style={styles.quickChipText}>🧠 2º Cérebro</Text>
        </TouchableOpacity>
      </View>

      {/* PAINEL DE CONTROLES DA LIGAÇÃO */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.iconButton, isMuted && styles.iconButtonActive]}
          onPress={() => {
            setIsMuted(!isMuted);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={24}
            color={isMuted ? '#ef4444' : '#94a3b8'}
          />
        </TouchableOpacity>

        {/* Botão Principal de Ligação */}
        <TouchableOpacity
          style={[styles.callButton, status !== 'OFF' ? styles.callButtonEnd : styles.callButtonStart]}
          onPress={toggleCall}
        >
          <Ionicons
            name={status !== 'OFF' ? 'call' : 'call-outline'}
            size={28}
            color="#ffffff"
          />
          <Text style={styles.callButtonText}>
            {status !== 'OFF' ? 'Encerrar Ligação' : 'Iniciar Chamada de Voz'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
    paddingTop: 12,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3730a3',
    marginBottom: 8,
  },
  headerBadgeText: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: '600',
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    height: 180,
  },
  orbGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  orbCore: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#141c2c',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#818cf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  statusText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  transcriptContainer: {
    flex: 1,
    backgroundColor: '#141c2c',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#233047',
  },
  transcriptHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  transcriptScroll: {
    flex: 1,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
  msgBubble: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#3730a3',
    alignSelf: 'flex-end',
  },
  lucasBubble: {
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
  },
  msgSender: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  msgText: {
    color: '#f8fafc',
    fontSize: 14,
    lineHeight: 19,
  },
  quickPromptsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  quickChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickChipText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '500',
  },
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconButtonActive: {
    backgroundColor: '#450a0a',
    borderColor: '#991b1b',
  },
  callButton: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  callButtonStart: {
    backgroundColor: '#4f46e5',
  },
  callButtonEnd: {
    backgroundColor: '#dc2626',
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
