import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type AppointmentBadgeProps = {
  size?: number;
  color?: string;
};

export default function AppointmentBadge({ size = 24, color = theme.colors.surface }: AppointmentBadgeProps) {
  const { user } = useAuth();
  const [appointmentsCount, setAppointmentsCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;

    loadAppointmentsCount();

    // Real-time subscription for appointments
    const appointmentsChannel = supabase
      .channel('appointment_badge_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          loadAppointmentsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
    };
  }, [user?.id]);

  const loadAppointmentsCount = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, start_time')
        .eq('client_id', user.id)
        .eq('status', 'confirmed')
        .gte('appointment_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      // Filter out appointments older than 30 minutes before scheduled time
      const now = new Date();
      const filteredAppointments = (data || []).filter((appointment) => {
        // Parse appointment date and time
        const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.start_time}`);

        // Subtract 30 minutes from appointment time
        const thresholdTime = new Date(appointmentDateTime.getTime() - 30 * 60 * 1000);

        // Show only if threshold time is in the future
        return thresholdTime > now;
      });

      setAppointmentsCount(filteredAppointments.length);
    } catch (error) {
      console.error('Error loading appointments count:', error);
    }
  };

  return (
    <View style={styles.container}>
      <CheckCircle size={size} color={color} />
      {appointmentsCount > 0 && (
        <View style={styles.badge}>
          <Text
            style={styles.badgeText}
            numberOfLines={1}
            allowFontScaling={false}
            ellipsizeMode="tail"
          >
            {appointmentsCount > 99 ? '99+' : String(appointmentsCount)}
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
    backgroundColor: theme.colors.success,
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
