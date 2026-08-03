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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
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
        setErrorMsg('Falha ao autenticar. Verifique sua conexão e senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <View style={styles.iconRing}>
          <Ionicons name="sparkles" size={42} color="#6366f1" />
        </View>

        <Text style={styles.title}>Agente Lucas</Text>
        <Text style={styles.subtitle}>Assistente Pessoal & 2º Cérebro Notion</Text>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <View style={styles.inputBox}>
          <Ionicons name="key-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Digite sua senha de acesso"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={(txt: string) => {
              setPassword(txt);
              if (errorMsg) setErrorMsg(null);
            }}
            onSubmitEditing={handleLogin}
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#141c2c',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: '#233047',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 26,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#233047',
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 54,
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
    height: 54,
    borderRadius: 16,
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
