import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, ChevronDown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
};

type BookFreeSlotModalProps = {
  visible: boolean;
  onClose: () => void;
  date: string; // ISO format YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
};

export default function BookFreeSlotModal({
  visible,
  onClose,
  date,
  startTime,
  endTime,
}: BookFreeSlotModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showServicePicker, setShowServicePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      loadServices();
    }
  }, [visible]);

  useEffect(() => {
    if (services.length > 0 && startTime && endTime) {
      filterServicesByDuration();
    }
  }, [services, startTime, endTime]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на услугите');
    }
  };

  const filterServicesByDuration = () => {
    // Calculate available duration in minutes
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    const availableDuration = endTotalMinutes - startTotalMinutes;

    console.log('Available duration:', availableDuration, 'minutes');

    // Filter services that fit within the available duration
    const filtered = services.filter(service => service.duration_minutes <= availableDuration);

    console.log('Filtered services:', filtered.length, 'out of', services.length);
    setAvailableServices(filtered);
  };

  const handleBookAppointment = async () => {
    if (!selectedService || !user) {
      Alert.alert('Грешка', 'Моля изберете услуга');
      return;
    }

    try {
      setLoading(true);

      // Check if client already has a request for this date and time
      const { data: existingRequest, error: checkError } = await supabase
        .from('appointment_requests')
        .select('id, requested_time, services(name), promotions(name)')
        .eq('client_id', user.id)
        .eq('requested_date', date)
        .eq('requested_time', startTime)
        .not('status', 'in', '(rejected)')
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing requests:', checkError);
      }

      if (existingRequest) {
        const serviceName = existingRequest.services?.name || existingRequest.promotions?.name || 'Неизвестна услуга';
        Alert.alert(
          'Вече има заявка',
          `Вече имате заявка за ${new Date(date + 'T00:00:00').toLocaleDateString('bg-BG')} в ${startTime.substring(0, 5)}\n\nУслуга: ${serviceName}\n\nМоля, изберете друг час или изчакайте текущата заявка да бъде обработена.`
        );
        setLoading(false);
        return;
      }

      // Create appointment request
      const { error: requestError } = await supabase
        .from('appointment_requests')
        .insert({
          client_id: user.id,
          service_id: selectedService.id,
          requested_date: date,
          requested_time: startTime,
          status: 'pending',
          client_message: '',
        });

      if (requestError) throw requestError;

      // Notify admin
      const { data: adminUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (adminUsers && adminUsers.length > 0) {
        const notificationBody = `Нова заявка за ${selectedService.name} на ${new Date(date + 'T00:00:00').toLocaleDateString('bg-BG')} в ${startTime}`;

        for (const admin of adminUsers) {
          await supabase.from('notifications').insert({
            user_id: admin.id,
            type: 'new_booking_request',
            title: 'Нова заявка за час',
            body: notificationBody,
            data: {
              date: date,
              time: startTime,
              service_name: selectedService.name,
            },
          });
        }
      }

      Alert.alert('Успех', 'Заявката е изпратена успешно!');
      onClose();
    } catch (error) {
      console.error('Error creating appointment request:', error);
      Alert.alert('Грешка', 'Неуспешно създаване на заявката');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = date ? new Date(date + 'T00:00:00').toLocaleDateString('bg-BG', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }) : '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Свободен час</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.infoSection}>
              <Text style={styles.infoText}>
                {formattedDate}
              </Text>
              <Text style={styles.infoText}>
                {startTime} - {endTime}
              </Text>
            </View>

            <Text style={styles.promptText}>
              Ако искате да заявите час изберете услуга:
            </Text>

            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowServicePicker(!showServicePicker)}
              disabled={loading || availableServices.length === 0}
            >
              <Text style={[
                styles.dropdownButtonText,
                !selectedService && styles.placeholderText
              ]}>
                {selectedService ? selectedService.name : 'Избери услуга'}
              </Text>
              <ChevronDown size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            {showServicePicker && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={true}>
                  {availableServices.map((service) => (
                    <TouchableOpacity
                      key={service.id}
                      style={[
                        styles.dropdownItem,
                        selectedService?.id === service.id && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedService(service);
                        setShowServicePicker(false);
                      }}
                    >
                      <View>
                        <Text style={[
                          styles.dropdownItemText,
                          selectedService?.id === service.id && styles.dropdownItemTextSelected,
                        ]}>
                          {service.name}
                        </Text>
                        <Text style={styles.dropdownItemSubtext}>
                          {service.duration_minutes} мин • {service.price} лв
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {availableServices.length === 0 && services.length > 0 && (
              <Text style={styles.warningText}>
                Няма услуги, които да се събират в този времеви диапазон
              </Text>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Откажи</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!selectedService || loading) && styles.submitButtonDisabled
                ]}
                onPress={handleBookAppointment}
                disabled={!selectedService || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <Text style={styles.submitButtonText}>Заяви час</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxWidth: 380,
    ...theme.shadows.luxury,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  content: {
    padding: theme.spacing.md,
  },
  infoSection: {
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  promptText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    minHeight: 40,
  },
  dropdownButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  placeholderText: {
    color: theme.colors.textMuted,
  },
  dropdownMenu: {
    maxHeight: 160,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  dropdownScroll: {
    maxHeight: 160,
  },
  dropdownItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: theme.colors.accentLight,
  },
  dropdownItemText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: 2,
  },
  dropdownItemTextSelected: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  dropdownItemSubtext: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  warningText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.warning,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  submitButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.surface,
  },
});
