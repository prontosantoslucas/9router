import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useAuth } from '../_layout';

export default function TabsLayout() {
  const { logout } = useAuth();

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
        name="brain"
        options={{
          title: '2º Cérebro Notion',
          tabBarLabel: '2º Cérebro',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <Ionicons name="journal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
