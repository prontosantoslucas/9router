import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { apiService } from '../../src/services/api';

type CallStatus = 'OFF' | 'LISTENING' | 'THINKING' | 'SPEAKING';

interface LiveMessage {
  id: string;
  sender: 'user' | 'lucas';
  text: string;
  timestamp: string;
}

// ── Parâmetros do VAD (detecção de voz) ─────────────────────────────────
// Usa o metering do expo-av (dBFS): -60 ≈ silêncio, 0 ≈ som muito alto.
const VOICE_THRESHOLD_DB = -35;        // acima disso = fala detectada
const MIN_SPEECH_MS = 350;             // ignora ruídos curtos (< 350ms de fala)
const SILENCE_TO_SEND_MS = 1100;       // silêncio após fala → envia o trecho
const MAX_CHUNK_MS = 18000;            // chunk de segurança (nunca passa de 18s)

// Limpa markdown/emojis/URLs para a voz não ler "asterisco, hashtag, emoji".
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' Código omitido. ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' link ')
    .replace(/[*_~#>|]/g, '')
    .replace(/^[-•]\s*/gm, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F0FF}\u{200D}]/gu, '')
    .trim();
}

export default function LiveScreen() {
  useKeepAwake();

  const [status, setStatus] = useState<CallStatus>('OFF');
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [activeModel, setActiveModel] = useState<string>('meueulucas (Superbrain)');
  const [level, setLevel] = useState(0);          // 0..1 do microfone (metering)
  const [speechActive, setSpeechActive] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const scrollRef = useRef<ScrollView>(null);

  // Estado da gravação (refs — não disparam re-render)
  const recordingRef = useRef<Audio.Recording | null>(null);
  const statusRef = useRef<CallStatus>('OFF');
  const mutedRef = useRef(false);
  const speechStartRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const setStatusBoth = useCallback((s: CallStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const setMutedBoth = useCallback((m: boolean) => {
    mutedRef.current = m;
    setIsMuted(m);
  }, []);

  // Loop de animação do orbe
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
        Animated.timing(glowAnim, { toValue: 1, duration: duration / 2, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: duration / 2, useNativeDriver: true }),
      ])
    );

    pulseLoop.start();
    glowLoop.start();
    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [status]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const addLog = (sender: 'user' | 'lucas', text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { id: Math.random().toString(), sender, text, timestamp: time }]);
  };

  // ── Gravação + VAD ─────────────────────────────────────────────────────

  const stopRecording = async (): Promise<Audio.Recording | null> => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return null;
    try {
      await rec.stopAndUnloadAsync();
    } catch {}
    return rec;
  };

  const startRecording = async (): Promise<boolean> => {
    if (recordingRef.current) return true;
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        return false;
      }
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {},
        isMeteringEnabled: true,
      });
      rec.setOnRecordingStatusUpdate((s) => {
        if (!s.isRecording) return;
        const db = s.metering ?? -60;
        const normalized = Math.max(0, Math.min(1, (db + 60) / 55));
        setLevel(normalized);

        const talking = db > VOICE_THRESHOLD_DB;
        if (talking) {
          setSpeechActive(true);
          if (speechStartRef.current === null) speechStartRef.current = s.durationMillis;
          silenceStartRef.current = null;
        } else {
          setSpeechActive(false);
          if (speechStartRef.current !== null) {
            const spokeMs = s.durationMillis - speechStartRef.current;
            if (spokeMs >= MIN_SPEECH_MS) {
              if (silenceStartRef.current === null) silenceStartRef.current = s.durationMillis;
              const silentMs = s.durationMillis - silenceStartRef.current;
              if (silentMs >= SILENCE_TO_SEND_MS) {
                speechStartRef.current = null;
                silenceStartRef.current = null;
                processChunk();
              }
            }
          }
        }
        // Chunk de segurança: gravação muito longa sem pausa
        if (s.durationMillis >= MAX_CHUNK_MS) {
          speechStartRef.current = null;
          silenceStartRef.current = null;
          processChunk();
        }
      });
      await rec.startAsync();
      recordingRef.current = rec;
      return true;
    } catch (err: any) {
      console.warn('[Live] falha ao iniciar gravação:', err?.message);
      recordingRef.current = null;
      return false;
    }
  };

  const processChunk = useCallback(async () => {
    // Lê via função — evita narrowing de tipo no useRef (TS2367)
    const current = (): CallStatus => statusRef.current;
    if (busyRef.current || current() === 'OFF') return;
    busyRef.current = true;
    try {
      const rec = await stopRecording();
      if (!rec || mutedRef.current) {
        if (current() !== 'OFF' && !mutedRef.current) await startRecording();
        return;
      }
      const uri = rec.getURI();
      if (!uri) return;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || !info.size || info.size < 500) {
        if (current() !== 'OFF') await startRecording();
        return;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setStatusBoth('THINKING');
      const text = await apiService.transcribeAudio(base64, 'audio/m4a', 'audio.m4a');
      if (!text) {
        setStatusBoth('LISTENING');
        await startRecording();
        return;
      }

      addLog('user', text);
      Haptics.selectionAsync();

      const res = await apiService.sendMessage(text, undefined, true);
      const answerText = res.response || 'Entendido, estou processando aqui!';
      if (res.model) setActiveModel(res.model);

      addLog('lucas', answerText);
      setStatusBoth('SPEAKING');

      await speakText(cleanTextForSpeech(answerText), () => {
        setStatusBoth('LISTENING');
        setLevel(0);
        if (!mutedRef.current) startRecording();
      });
    } catch (err: any) {
      console.warn('[Live] erro no ciclo de voz:', err?.message);
      addLog('lucas', `Desculpe, tive um problema na ligação: ${err.message}`);
      setStatusBoth('LISTENING');
      if (!mutedRef.current) await startRecording();
    } finally {
      busyRef.current = false;
    }
  }, [setStatusBoth]);

  // ── TTS ────────────────────────────────────────────────────────────────

  const soundRef = useRef<Audio.Sound | null>(null);

  const speakText = async (text: string, onEnd?: () => void) => {
    let completed = false;
    const handleEnd = () => {
      if (!completed) {
        completed = true;
        if (onEnd) onEnd();
      }
    };

    try {
      const ttsData = await apiService.synthesizeTts(text);
      if (ttsData && ttsData.base64) {
        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          } catch {}
          soundRef.current = null;
        }
        const uri = `data:${ttsData.mimeType || 'audio/mpeg'};base64,${ttsData.base64}`;
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (playbackStatus) => {
            if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
              handleEnd();
            }
          }
        );
        soundRef.current = sound;
        return;
      }
    } catch (err: any) {
      console.warn('[Live] TTS backend falhou, usando voz local:', err?.message);
    }

    try {
      Speech.stop();
      Speech.speak(text, {
        language: 'pt-BR',
        rate: 1.05,
        onDone: handleEnd,
        onError: handleEnd,
      });
    } catch {
      handleEnd();
    }
  };

  const stopSpeech = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    try {
      Speech.stop();
    } catch {}
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // ── Controle da chamada ────────────────────────────────────────────────

  const toggleCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (status !== 'OFF') {
      // Encerrar
      setStatusBoth('OFF');
      setSpeechActive(false);
      setLevel(0);
      busyRef.current = true;
      await stopSpeech();
      await stopRecording();
      busyRef.current = false;
    } else {
      // Iniciar
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      setStatusBoth('LISTENING');
      const ok = await startRecording();
      if (!ok) {
        setStatusBoth('OFF');
        addLog('lucas', 'Sem permissão de microfone. Libere o acesso nas configurações do sistema.');
      }
    }
  };

  const handleQuickPrompt = async (prompt: string) => {
    if (statusRef.current === 'OFF') {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: true });
      setStatusBoth('LISTENING');
    }
    if (busyRef.current) return;
    busyRef.current = true;
    await stopRecording();
    addLog('user', prompt);
    setStatusBoth('THINKING');
    try {
      const res = await apiService.sendMessage(prompt, undefined, true);
      const answerText = res.response || 'Entendido!';
      if (res.model) setActiveModel(res.model);
      addLog('lucas', answerText);
      setStatusBoth('SPEAKING');
      await speakText(cleanTextForSpeech(answerText), () => {
        setStatusBoth('LISTENING');
        setLevel(0);
        if (!mutedRef.current) startRecording();
      });
    } catch (err: any) {
      addLog('lucas', `Desculpe, tive um problema: ${err.message}`);
      setStatusBoth('LISTENING');
      if (!mutedRef.current) await startRecording();
    } finally {
      busyRef.current = false;
    }
  };

  // Limpeza ao desmontar
  useEffect(() => {
    return () => {
      stopSpeech();
      stopRecording();
    };
  }, []);

  const getOrbColor = () => {
    switch (status) {
      case 'LISTENING': return '#818cf8';
      case 'THINKING': return '#c084fc';
      case 'SPEAKING': return '#38bdf8';
      default: return '#334155';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'LISTENING': return speechActive ? '🟢 Escutando você...' : '🎙️ Aguardando sua voz...';
      case 'THINKING': return '⚡ Processando com meueulucas...';
      case 'SPEAKING': return '🔊 Lucas falando...';
      default: return '⚪ Chamada encerrada';
    }
  };

  // Barras de nível do microfone (animadas pelo metering real)
  const levelBars = [0, 1, 2, 3, 4, 5];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header compacto */}
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Ionicons name="sparkles" size={13} color="#818cf8" style={{ marginRight: 5 }} />
          <Text style={styles.headerBadgeText} numberOfLines={1}>
            {activeModel}
          </Text>
        </View>
      </View>

      {/* Orbe + nível de voz */}
      <View style={styles.orbContainer}>
        <Animated.View
          style={[styles.orbGlow, { backgroundColor: getOrbColor(), opacity: glowAnim, transform: [{ scale: pulseAnim }] }]}
        />
        <Animated.View style={[styles.orbCore, { borderColor: getOrbColor(), transform: [{ scale: pulseAnim }] }]}>
          <Ionicons
            name={status === 'OFF' ? 'mic-off' : status === 'SPEAKING' ? 'volume-high' : 'mic'}
            size={40}
            color={getOrbColor()}
          />
        </Animated.View>

        <View style={styles.levelMeter}>
          {levelBars.map((i) => {
            const active = status === 'LISTENING' && level > (i + 0.5) / levelBars.length;
            const mid = status === 'LISTENING' && speechActive && level > (i + 1) / levelBars.length;
            return (
              <View
                key={i}
                style={[
                  styles.levelBar,
                  { height: 8 + i * 5 },
                  (active || mid) && { backgroundColor: getOrbColor() },
                  !active && !mid && { backgroundColor: '#334155' },
                ]}
              />
            );
          })}
        </View>

        <Text style={[styles.statusText, { color: status === 'OFF' ? '#94a3b8' : '#f8fafc' }]}>
          {getStatusText()}
        </Text>
      </View>

      {/* Transcrição */}
      <View style={styles.transcriptContainer}>
        <Text style={styles.transcriptHeader}>Transcrição da Ligação</Text>
        <ScrollView ref={scrollRef} style={styles.transcriptScroll} contentContainerStyle={{ paddingBottom: 12 }}>
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>
              Inicie a ligação e fale naturalmente. O Lucas escuta, responde em voz e retoma a escuta
              automaticamente quando termina de falar.
            </Text>
          ) : (
            messages.map((msg) => (
              <View key={msg.id} style={[styles.msgBubble, msg.sender === 'user' ? styles.userBubble : styles.lucasBubble]}>
                <Text style={styles.msgSender}>
                  {msg.sender === 'user' ? 'Você' : 'Lucas'} · {msg.timestamp}
                </Text>
                <Text style={styles.msgText}>{msg.text}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Atalhos rápidos (scroll horizontal — não corta texto) */}
      <View style={styles.quickPromptsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptsContent}>
          <TouchableOpacity style={styles.quickChip} onPress={() => handleQuickPrompt('Lucas, qual é a minha prioridade de hoje?')}>
            <Text style={styles.quickChipText}>🎯 Prioridade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickChip} onPress={() => handleQuickPrompt('Lucas, me dê uma dica rápida de foco!')}>
            <Text style={styles.quickChipText}>⚡ Dica Foco</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickChip} onPress={() => handleQuickPrompt('Lucas, o que temos de notas no segundo cérebro?')}>
            <Text style={styles.quickChipText}>🧠 2º Cérebro</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Controles */}
      <View style={styles.controlsBar}>
        <TouchableOpacity
          style={[styles.iconButton, isMuted && styles.iconButtonActive]}
          onPress={() => {
            setMutedBoth(!isMuted);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={isMuted ? '#ef4444' : '#94a3b8'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.callButton, status !== 'OFF' ? styles.callButtonEnd : styles.callButtonStart]}
          onPress={toggleCall}
        >
          <Ionicons name={status !== 'OFF' ? 'call' : 'call-outline'} size={26} color="#ffffff" />
          <Text style={styles.callButtonText}>
            {status !== 'OFF' ? 'Encerrar Ligação' : 'Iniciar Chamada de Voz'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    alignItems: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3730a3',
    maxWidth: '90%',
  },
  headerBadgeText: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: '600',
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    height: 148,
  },
  orbGlow: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  orbCore: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  levelMeter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 36,
    marginTop: 8,
    gap: 4,
  },
  levelBar: {
    width: 5,
    borderRadius: 3,
    backgroundColor: '#334155',
  },
  statusText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  transcriptContainer: {
    flex: 1,
    backgroundColor: '#141c2c',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#233047',
  },
  transcriptHeader: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  transcriptScroll: {
    flex: 1,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 18,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  msgBubble: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '88%',
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
    marginVertical: 8,
  },
  quickPromptsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    paddingBottom: 14,
    gap: 12,
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    height: 52,
    borderRadius: 26,
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
    fontSize: 15,
    fontWeight: '700',
  },
});