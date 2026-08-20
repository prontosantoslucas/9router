import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';

import { apiService } from '../src/services/api';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState(apiService.getBaseUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!password.trim()) {
      setErrorMsg('Por favor, informe a senha de acesso.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      if (serverUrl.trim()) {
        await apiService.setBaseUrl(serverUrl.trim());
      }
      await login(password.trim());
    } catch (err: any) {
      console.warn('Erro de autenticação:', err);
      if (err.data && err.data.error) {
        let msg = err.data.error;
        if (err.data.remainingBeforeLock !== undefined) {
          msg += ` (${err.data.remainingBeforeLock} tentativa(s) restante(s))`;
        }
        setErrorMsg(msg);
      } else if (err.status === 429) {
        setErrorMsg('Acesso temporariamente suspenso devido a múltiplas tentativas.');
      } else {
        setErrorMsg(err.message || 'Falha ao autenticar. Verifique sua conexão e a URL do servidor.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          {/* Marca */}
          <View style={styles.brandRow}>
            <View style={styles.iconRing}>
              <Ionicons name="sparkles" size={30} color="#6366f1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Agente Lucas</Text>
              <Text style={styles.subtitle}>Assistente Pessoal & 2º Cérebro Notion</Text>
            </View>
          </View>

          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#ef4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {showServerConfig && (
            <View style={styles.inputBox}>
              <Ionicons name="globe-outline" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="https://maxrouter.up.railway.app"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                value={serverUrl}
                onChangeText={(txt: string) => setServerUrl(txt)}
              />
            </View>
          )}

          <View style={styles.inputBox}>
            <Ionicons name="key-outline" size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Digite sua senha de acesso"
              placeholderTextColor="#64748b"
              secureTextEntry
              autoFocus
              value={password}
              onChangeText={(txt: string) => {
                setPassword(txt);
                if (errorMsg) setErrorMsg(null);
              }}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Text style={styles.buttonText}>Acessar o App</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowServerConfig(!showServerConfig)}
            style={{ marginTop: 16, alignItems: 'center' }}
          >
            <Text style={{ color: '#64748b', fontSize: 12 }}>
              {showServerConfig ? 'Ocultar URL do Servidor' : `Servidor: ${serverUrl}`}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#141c2c',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#233047',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b0f17',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#233047',
    paddingHorizontal: 14,
    marginBottom: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#6366f1',
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});