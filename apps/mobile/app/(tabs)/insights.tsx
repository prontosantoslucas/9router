import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../src/services/api';

type Item = {
  id: string;
  source: string;
  tag: string | null;
  priority: number;
  body: string;
  created_at: number;
  delivered: boolean;
};

// ChatId puxado de /api/auth/me (mesmo do webchat) — cacheado no
// SecureStore. Cross-device: qualquer notificação gerada pra este user
// aparece aqui, independente do canal que a criou.

function relativeTime(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function sourceLabel(source: string, tag: string | null): { icon: any; label: string; color: string } {
  if (tag?.startsWith('daily-insight')) return { icon: 'sunny', label: 'insight', color: '#fbbf24' };
  if (source === 'job_alert') return { icon: 'briefcase', label: 'vaga', color: '#22c55e' };
  if (source === 'proactive') return { icon: 'flash', label: 'agent', color: '#818cf8' };
  return { icon: 'notifications', label: source, color: '#94a3b8' };
}

export default function InsightsScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    const data = await apiService.getPendingNotifications(id, 50);
    setItems(data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiService.getChatId().then((id) => {
      if (cancelled) return;
      setChatId(id);
      load(id);
    });
    // Polling em foreground a cada 45s. Não é push real (foreground-only),
    // mas capta insights matutinos e alertas em janela razoável.
    const t = setInterval(() => {
      apiService.getChatId().then((id) => { if (!cancelled) load(id); });
    }, 45_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [load]);

  async function markRead(item: Item) {
    if (!chatId) return;
    await apiService.markNotificationRead(item.id, chatId);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const id = chatId || (await apiService.getChatId());
    await load(id);
    setRefreshing(false);
  }, [load, chatId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#818cf8" size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="notifications-off-outline" size={48} color="#334155" />
        <Text style={styles.emptyTitle}>Sem novidades</Text>
        <Text style={styles.emptyText}>
          O agent gera insights matutinos, alertas de vaga e mensagens agendadas.
          Aparecem aqui quando têm algo pra você.
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={16} color="#818cf8" />
          <Text style={styles.refreshBtnText}>Puxar de novo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      style={styles.list}
      contentContainerStyle={{ paddingVertical: 8 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />
      }
      renderItem={({ item }) => {
        const meta = sourceLabel(item.source, item.tag);
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.metaRow}>
                <Ionicons name={meta.icon} size={14} color={meta.color} />
                <Text style={[styles.metaText, { color: meta.color }]}>{meta.label}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaTime}>{relativeTime(item.created_at)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => markRead(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="checkmark-circle-outline" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#0b0f17' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#0b0f17',
  },
  emptyTitle: { color: '#e2e8f0', fontSize: 17, fontWeight: '600', marginTop: 16 },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#141c2c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#233047',
  },
  refreshBtnText: { color: '#818cf8', fontSize: 13, fontWeight: '500' },
  card: {
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 14,
    backgroundColor: '#141c2c',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#233047',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaDot: { color: '#334155', fontSize: 11 },
  metaTime: { color: '#64748b', fontSize: 11 },
  body: { color: '#e2e8f0', fontSize: 14, lineHeight: 20 },
});
