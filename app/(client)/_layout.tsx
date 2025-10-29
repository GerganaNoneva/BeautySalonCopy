import { Tabs } from 'expo-router';
import { Image, DollarSign, User, Info } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import MessageBadge from '@/components/MessageBadge';
import AppointmentBadge from '@/components/AppointmentBadge';
import RequestsBadge from '@/components/RequestsBadge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ClientLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom + 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Резервации',
          tabBarIcon: ({ size, color }) => <AppointmentBadge size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="booking"
        options={{
          title: 'Заяви час',
          tabBarIcon: ({ size, color }) => <RequestsBadge size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Съобщения',
          tabBarIcon: ({ size, color }) => <MessageBadge size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Галерия',
          tabBarIcon: ({ size, color }) => <Image size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pricing"
        options={{
          title: 'Ценоразпис',
          tabBarIcon: ({ size, color }) => <DollarSign size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="info"
        options={{
          title: 'Инфо',
          tabBarIcon: ({ size, color }) => <Info size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профил',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
