import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useNotifications } from '@/contexts/NotificationsContext';
import { theme } from '@/constants/theme';

type MessageBadgeProps = {
  size?: number;
  color?: string;
};

export default function MessageBadge({ size = 24, color = theme.colors.surface }: MessageBadgeProps) {
  const { notifications } = useNotifications();

  // Derive unread message notifications from the shared notifications array
  const unreadCount = notifications.filter((n) => n.type === 'new_message' && n.is_read !== true).length;

  console.log('MessageBadge: Unread count (derived) =', unreadCount);

  return (
    <View style={styles.container}>
      <MessageCircle size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text
            style={styles.badgeText}
            numberOfLines={1}
            allowFontScaling={false}
            ellipsizeMode="tail"
          >
            {unreadCount > 99 ? '99+' : String(unreadCount)}
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
