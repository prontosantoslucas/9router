import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, Text } from 'react-native';
import { useAuth } from '../_layout';
import { apiService } from '../../src/services/api';

// Badge com contagem de notificações pendentes — polling em segundo plano
// (foreground do app). Alimenta o ícone da tab "Insights".
// chatId resolvido via apiService.getChatId() (cache + fetch de /api/auth/me).
function InsightsBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        right: -6,
        top: -3,
        backgroundColor: '#ef4444',
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
      }}
    >
      <Text style={{ color: 'white', fontSize: 10, fontWeight: '700' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const chatId = await apiService.getChatId();
      const data = await apiService.getPendingNotifications(chatId, 30);
      if (!cancelled) setPendingCount(data.count);
    }
    poll();
    const t = setInterval(poll, 60_000); // check badge 1x/min
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0b0f17' },
        headerTitleStyle: { color: '#f8fafc', fontWeight: '700', fontSize: 17 },
        headerTintColor: '#818cf8',
        tabBarStyle: {
          backgroundColor: '#141c2c',
          borderTopColor: '#233047',
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#818cf8',
        tabBarInactiveTintColor: '#64748b',
        headerRight: () => (
          <TouchableOpacity
            onPress={logout}
            style={{ marginRight: 16 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="log-out-outline" size={22} color="#64748b" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat Lucas',
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarLabel: 'Insights',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <View>
              <Ionicons name="flash" size={size} color={color} />
              <InsightsBadge count={pendingCount} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="brain"
        options={{
          title: '2º Cérebro',
          tabBarLabel: '2º Cérebro',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="journal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
