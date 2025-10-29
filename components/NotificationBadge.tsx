import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useNotifications } from '@/contexts/NotificationsContext';
import { theme } from '@/constants/theme';

type NotificationBadgeProps = {
  size?: number;
  color?: string;
};

export default function NotificationBadge({ size = 24, color = theme.colors.surface }: NotificationBadgeProps) {
  const { unreadCount } = useNotifications();

  // Use unreadCount from context which is calculated from DB count (not limited to 50)
  console.log('🔔 NotificationBadge RENDER: unreadCount =', unreadCount);

  const display = unreadCount > 99 ? '99+' : String(unreadCount);
  const digitCount = display.length;

  // Make the badge a bit wider for multi-digit numbers to avoid ellipsizing.
  const dynamicBadgeStyle = {
    minWidth: digitCount === 1 ? 24 : digitCount === 2 ? 32 : 44,
    height: digitCount === 1 ? 20 : 22,
    paddingHorizontal: digitCount === 1 ? 6 : digitCount === 2 ? 8 : 10,
  } as const;

  return (
    <View style={styles.container}>
      <Bell size={size} color={color} />
      {unreadCount > 0 && (
        <View style={[styles.badge, dynamicBadgeStyle]}>
          <Text
            style={styles.badgeText}
            numberOfLines={1}
            allowFontScaling={false}
            ellipsizeMode="clip"
          >
            {display}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 30,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    overflow: 'visible',
    zIndex: 999,
    elevation: 6,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  badgeText: {
    color: theme.colors.surface,
    fontSize: 9,
    fontWeight: '700',
    includeFontPadding: false,
    textAlign: 'center',
    lineHeight: 10,
  },
});
