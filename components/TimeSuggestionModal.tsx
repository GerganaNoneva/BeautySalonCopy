import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type TimeSuggestionModalProps = {
  visible: boolean;
  onClose: () => void;
  suggestionData: {
    request_id: string;
    suggested_date: string;
    suggested_start_time: string;
    suggested_end_time: string;
    service_id: string;
    service_name: string;
  } | null;
};

export default function TimeSuggestionModal({
  visible,
  onClose,
  suggestionData,
}: TimeSuggestionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!suggestionData || !user) return;

    try {
      setLoading(true);

      const { request_id, suggested_date, suggested_start_time, suggested_end_time, service_id, service_name } = suggestionData;

      // Създаваме резервация
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          client_id: user.id,
          service_id: service_id,
          appointment_date: suggested_date,
          start_time: suggested_start_time,
          end_time: suggested_end_time,
          status: 'confirmed',
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;

      // Изтриваме заявката (вместо да променяме статуса)
      // Добавяме и client_id филтър за да сме сигурни че RLS работи правилно
      console.log(`🗑️ Attempting to delete request ${request_id} for client ${user.id}`);

      const { data: deleteData, error: deleteError } = await supabase
        .from('appointment_requests')
        .delete()
        .eq('id', request_id)
        .eq('client_id', user.id)
        .select();

      if (deleteError) {
        console.error('❌ Грешка при изтриване на заявката:', deleteError);
        console.error('❌ Error details:', JSON.stringify(deleteError, null, 2));
        throw deleteError;
      }

      console.log('✅ Заявката е изтрита успешно');
      console.log('✅ Deleted data:', deleteData);

      // Маркираме уведомлението като прочетено
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'time_suggestion')
        .contains('data', { request_id });

      // Изпращаме уведомление на админа за новата резервация
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (adminUsers && adminUsers.length > 0) {
        const notificationBody = `${service_name} на ${new Date(suggested_date + 'T00:00:00').toLocaleDateString('bg-BG')} от ${suggested_start_time.substring(0, 5)} до ${suggested_end_time.substring(0, 5)}`;

        for (const admin of adminUsers) {
          await supabase.from('notifications').insert({
            user_id: admin.id,
            type: 'new_appointment',
            title: 'Нова резервация от предложение',
            body: notificationBody,
            data: {
              appointment_id: appointment.id,
              date: suggested_date,
              start_time: suggested_start_time,
              end_time: suggested_end_time,
              service_name: service_name,
            },
          });
        }
      }

      Alert.alert('Успех', 'Резервацията е създадена успешно!');
      onClose();
    } catch (error) {
      console.error('Error accepting time suggestion:', error);
      Alert.alert('Грешка', 'Неуспешно създаване на резервацията');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!suggestionData || !user) return;

    Alert.alert(
      'Потвърждение',
      'Сигурни ли сте, че искате да откажете това предложение? Заявката ще бъде изтрита.',
      [
        { text: 'Назад', style: 'cancel' },
        {
          text: 'Откажи',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // Изтриваме заявката
              // Добавяме и client_id филтър за да сме сигурни че RLS работи правилно
              console.log(`� Marking request ${suggestionData.request_id} as rejected for client ${user.id}`);

              const { data: deleteData, error: deleteError } = await supabase
                .from('appointment_requests')
                .delete()
                .eq('id', suggestionData.request_id)
                .eq('client_id', user.id)
                .select();

              if (deleteError) {
                console.error('❌ Грешка при изтриване на заявката:', deleteError);
                console.error('❌ Error details:', JSON.stringify(deleteError, null, 2));
                throw deleteError;
              }

              console.log('✅ Заявката е изтрита успешно');
              console.log('✅ Deleted data:', deleteData);

              // Маркираме уведомлението като прочетено
              await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user.id)
                .eq('type', 'time_suggestion')
                .contains('data', { request_id: suggestionData.request_id });

              // Уведомяваме админите, че клиентът е отказал предложението
              try {
                const { data: adminUsers } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('role', 'admin');

                if (adminUsers && adminUsers.length > 0) {
                  const notificationBody = `Клиентът отказа предложението за ${suggestionData.service_name} на ${new Date(suggestionData.suggested_date + 'T00:00:00').toLocaleDateString('bg-BG')} от ${suggestionData.suggested_start_time.substring(0,5)} до ${suggestionData.suggested_end_time.substring(0,5)}`;

                  for (const admin of adminUsers) {
                    await supabase.from('notifications').insert({
                      user_id: admin.id,
                      type: 'booking_rejected',
                      title: 'Клиент отказа предложен час',
                      body: notificationBody,
                      data: {
                        request_id: suggestionData.request_id,
                        client_id: user.id,
                      },
                    });
                  }
                }
              } catch (err) {
                console.error('Error notifying admins about rejection:', err);
              }

              Alert.alert('Готово', 'Предложението е отказано и заявката е изтрита');
              onClose();
            } catch (error) {
              console.error('Error rejecting time suggestion:', error);
              Alert.alert('Грешка', 'Неуспешно отказване на предложението');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!suggestionData) return null;

  // Проверяваме дали всички необходими данни са налични
  if (!suggestionData.suggested_date || !suggestionData.suggested_start_time || !suggestionData.suggested_end_time) {
    console.error('❌ Missing suggestion data:', suggestionData);
    return null;
  }

  const formattedDate = new Date(suggestionData.suggested_date + 'T00:00:00').toLocaleDateString('bg-BG', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const startTime = suggestionData.suggested_start_time.substring(0, 5);
  const endTime = suggestionData.suggested_end_time.substring(0, 5);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Предложен алтернативен час</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Calendar size={20} color={theme.colors.primary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Дата:</Text>
                  <Text style={styles.infoValue}>{formattedDate}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Clock size={20} color={theme.colors.primary} />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Час:</Text>
                  <Text style={styles.infoValue}>
                    {startTime} - {endTime}
                  </Text>
                </View>
              </View>

              <View style={styles.serviceInfo}>
                <Text style={styles.serviceLabel}>Услуга:</Text>
                <Text style={styles.serviceName}>{suggestionData.service_name}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.rejectButton]}
                onPress={handleReject}
                disabled={loading}
              >
                <XCircle size={20} color={theme.colors.surface} />
                <Text style={styles.buttonText}>Откажи</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.acceptButton]}
                onPress={handleAccept}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <>
                    <CheckCircle size={20} color={theme.colors.surface} />
                    <Text style={styles.buttonText}>Приеми</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.luxury,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  content: {
    padding: theme.spacing.lg,
  },
  infoSection: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  serviceInfo: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  serviceLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  serviceName: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
  },
  acceptButton: {
    backgroundColor: theme.colors.success,
  },
  buttonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
});
