import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Clock, X, Phone } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationsModal from '@/components/NotificationsModal';
import NotificationBadge from '@/components/NotificationBadge';
import { useLocalSearchParams } from 'expo-router';

type Appointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  services: {
    name: string;
    duration_minutes: number;
    price: number;
  } | null;
  notes: string | null;
};

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const highlightAppointmentId = params.highlightAppointmentId;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const appointmentRefs = useRef<{ [key: string]: View | null }>({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadAppointments();

      // Real-time subscription for appointments
      const appointmentsChannel = supabase
        .channel('client_appointments_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `client_id=eq.${user.id}`,
          },
          (payload) => {
            loadAppointments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(appointmentsChannel);
      };
    }
  }, [user?.id]);

  // Handle highlight effect when coming from notification
  useEffect(() => {
    if (highlightAppointmentId && typeof highlightAppointmentId === 'string' && appointments.length > 0) {
      setHighlightedId(highlightAppointmentId);

      // Scroll to the highlighted appointment with longer delay to ensure refs are ready
      setTimeout(() => {
        const appointmentRef = appointmentRefs.current[highlightAppointmentId];

        if (appointmentRef && scrollViewRef.current) {
          appointmentRef.measureLayout(
            scrollViewRef.current as any,
            (x, y) => {
              const scrollToY = Math.max(0, y - 100);
              scrollViewRef.current?.scrollTo({ y: scrollToY, animated: true });
            },
            () => {}
          );
        }
      }, 500);

      // Animate the highlight
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.delay(2000),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start(() => {
        setHighlightedId(null);
      });
    }
  }, [highlightAppointmentId, appointments]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          status,
          notes,
          services (
            name,
            duration_minutes,
            price
          )
        `)
        .eq('client_id', user?.id)
        .eq('status', 'confirmed')
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });

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

      setAppointments(filteredAppointments);
    } catch (error) {
      console.error('Error loading appointments:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на резервации');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const handleCancelAppointment = (appointmentId: string) => {
    setCancellingAppointmentId(appointmentId);
    setShowCancelModal(true);
  };

  const confirmCancelAppointment = async () => {
    if (!cancelReason.trim()) {
      Alert.alert('Внимание', 'Моля, въведете причина за отмяна на резервацията');
      return;
    }

    if (!cancellingAppointmentId) return;

    try {
      // Get appointment details before deleting
      const { data: appointment } = await supabase
        .from('appointments')
        .select('appointment_date, start_time, services(name)')
        .eq('id', cancellingAppointmentId)
        .single();

      // Delete appointment
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', cancellingAppointmentId);

      if (error) throw error;

      // Send notification to admin using server function (bypasses RLS)
      if (appointment) {
        const { data: notificationId, error: notifError } = await supabase.rpc(
          'notify_admin_about_cancellation',
          {
            p_appointment_id: cancellingAppointmentId,
            p_cancel_reason: cancelReason,
            p_appointment_date: appointment.appointment_date,
            p_start_time: appointment.start_time,
            p_service_name: appointment.services?.name || 'Услуга',
          }
        );

        if (notifError) {
          console.error('Error sending notification to admin:', notifError);
        }
      }

      Alert.alert('Успех', 'Резервацията е отменена');
      setShowCancelModal(false);
      setCancelReason('');
      setCancellingAppointmentId(null);
      loadAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      Alert.alert('Грешка', 'Неуспешна отмяна на резервация');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${dayName}, ${day}.${month}.${year}г.`;
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Моите резервации</Text>
            <Text style={styles.headerSubtitle}>
              {appointments.length} предстоящи
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <NotificationBadge size={24} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Зареждане...</Text>
          </View>
        ) : appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Няма предстоящи резервации</Text>
            <Text style={styles.emptySubtext}>
              Заяви час от раздел "Заяви час"
            </Text>
          </View>
        ) : (
          appointments.map((appointment) => {
            const isHighlighted = highlightedId === appointment.id;
            const backgroundColor = isHighlighted
              ? highlightAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [theme.colors.surface, theme.colors.champagne],
                })
              : theme.colors.surface;

            return (
              <View
                key={appointment.id}
                ref={(ref) => appointmentRefs.current[appointment.id] = ref}
                collapsable={false}
              >
                <Animated.View
                  style={[styles.appointmentCard, { backgroundColor }]}
                >
                  <View style={styles.appointmentHeader}>
                <View style={styles.dateContainer}>
                  <Calendar size={20} color={theme.colors.primary} />
                  <Text style={styles.dateText}>
                    {formatDate(appointment.appointment_date)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancelAppointment(appointment.id)}
                >
                  <X size={20} color={theme.colors.error} />
                </TouchableOpacity>
              </View>

              <View style={styles.appointmentDetails}>
                <View style={styles.detailRow}>
                  <Clock size={18} color={theme.colors.textMuted} />
                  <Text style={styles.detailText}>
                    {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                  </Text>
                </View>

                <Text style={styles.serviceName}>
                  {appointment.services?.name || 'Услуга'}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={styles.durationText}>
                    {appointment.services?.duration_minutes || 0} мин
                  </Text>
                  <Text style={styles.priceText}>
                    {appointment.services?.price || 0} лв
                  </Text>
                </View>

                {appointment.notes && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>Бележки:</Text>
                    <Text style={styles.notesText}>{appointment.notes}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.cancelButtonLarge}
                onPress={() => handleCancelAppointment(appointment.id)}
              >
                <X size={18} color={theme.colors.surface} />
                <Text style={styles.cancelButtonText}>Отмени резервация</Text>
              </TouchableOpacity>
                </Animated.View>
              </View>
            );
          })
        )}
      </ScrollView>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.cancelModal}>
            <View style={styles.cancelModalHeader}>
              <Text style={styles.cancelModalTitle}>Отмяна на резервация</Text>
              <TouchableOpacity onPress={() => {
                setShowCancelModal(false);
                setCancelReason('');
              }}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.cancelModalSubtitle}>
              Моля, опишете причината за отмяна на резервацията:
            </Text>

            <TextInput
              style={styles.cancelReasonInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Въведете причина..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={confirmCancelAppointment}
            >
              <LinearGradient
                colors={['#E53935', '#C62828']}
                style={styles.confirmCancelGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.confirmCancelText}>Потвърди отмяната</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalBackButton}
              onPress={() => {
                setShowCancelModal(false);
                setCancelReason('');
              }}
            >
              <Text style={styles.cancelModalBackText}>Назад</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.surface,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
  },
  notificationButton: {
    position: 'relative',
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 3,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: theme.spacing.lg,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  appointmentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cancelButton: {
    padding: theme.spacing.xs,
  },
  appointmentDetails: {
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginVertical: theme.spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  notesContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  cancelButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: 400,
  },
  cancelModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  cancelModalSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  cancelReasonInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 100,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmCancelButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  confirmCancelGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  cancelModalBackButton: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  cancelModalBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
});
