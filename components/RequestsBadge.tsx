import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/constants/theme';

type RequestsBadgeProps = {
  size?: number;
  color?: string;
};

export default function RequestsBadge({ size = 24, color = theme.colors.surface }: RequestsBadgeProps) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const loadPendingCount = async () => {
    if (!user) return;

    try {
      console.log('RequestsBadge: Loading pending requests count for user:', user.id);

      const { count, error } = await supabase
        .from('appointment_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) {
        console.error('RequestsBadge: Error loading pending count:', error);
        throw error;
      }

      console.log('RequestsBadge: Pending count =', count);
      setPendingCount(count || 0);
    } catch (error) {
      console.error('RequestsBadge: Error loading pending requests count:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadPendingCount();

      const channelName = `requests_badge_${user.id}_${Math.random().toString(36).substring(7)}`;
      console.log('RequestsBadge: Subscribing to channel:', channelName);

      const subscription = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointment_requests',
          },
          (payload) => {
            console.log('RequestsBadge: Received update:', payload.eventType, payload);
            loadPendingCount();
          }
        )
        .subscribe((status) => {
          console.log('RequestsBadge: Subscription status:', status);
        });

      return () => {
        console.log('RequestsBadge: Unsubscribing from channel:', channelName);
        subscription.unsubscribe();
      };
    }
  }, [user]);

  return (
    <View style={styles.container}>
      <Calendar size={size} color={color} />
      {pendingCount > 0 && (
        <View style={styles.badge}>
          <Text
            style={styles.badgeText}
            numberOfLines={1}
            allowFontScaling={false}
            ellipsizeMode="tail"
          >
            {pendingCount > 99 ? '99+' : pendingCount}
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
    backgroundColor: theme.colors.warning,
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
