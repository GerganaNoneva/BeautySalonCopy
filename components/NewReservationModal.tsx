import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ChevronDown, Send, User, Clock } from 'lucide-react-native';
import { theme } from '../constants/theme';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NewReservationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedDate: Date;
  selectedTime: string;
  workingHours: {
    start: string;
    end: string;
    closed: boolean;
  };
  appointments: Array<{
    start_time: string;
    end_time: string;
  }>;
}

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
};

type Promotion = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  description: string;
};

type ServiceOrPromotion = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  type: 'service' | 'promotion';
  description?: string;
};

type Client = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  isUnregistered?: boolean;
};

const normalizePhoneNumber = (phoneNumber: string): string => {
  // Remove all whitespace and special characters except + and digits
  let cleaned = phoneNumber.replace(/[\s\-()]/g, '');

  // If starts with 0, replace with +359
  if (cleaned.startsWith('0')) {
    cleaned = '+359' + cleaned.substring(1);
  }

  return cleaned;
};

const formatDateWithWeekday = (date: Date): string => {
  const weekday = date.toLocaleDateString('bg-BG', { weekday: 'long' });
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);

  // Capitalize first letter of weekday
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return `${capitalizedWeekday}, ${day}.${month}.${year}г.`;
};

export default function NewReservationModal({
  visible,
  onClose,
  onConfirm,
  selectedDate,
  selectedTime,
  workingHours,
  appointments,
}: NewReservationModalProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const notesFieldRef = React.useRef<View>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceOrPromotion | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClientMode, setNewClientMode] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startTime, setStartTime] = useState(selectedTime);
  const [endTime, setEndTime] = useState('');
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [endTimeOptions, setEndTimeOptions] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      resetForm();
      loadData();
      // Фиксиран начален час
      setStartTime(selectedTime);

      // Изчисляваме края на свободното време до следваща резервация
      const startMinutes = timeToMinutes(selectedTime);
      const nextOccupied = findNextOccupiedSlot(startMinutes);
      const [endHour, endMinute] = workingHours.end.split(':').map(Number);
      const workingEndMinutes = endHour * 60 + endMinute;
      const slotEndMinutes = nextOccupied !== null ? Math.min(nextOccupied, workingEndMinutes) : workingEndMinutes;

      // Генерираме опциите за краен час (от +30 мин до края на свободното време)
      const endOptions: string[] = [];
      for (let mins = startMinutes + 30; mins <= slotEndMinutes; mins += 30) {
        const hour = Math.floor(mins / 60);
        const minute = mins % 60;
        endOptions.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
      setEndTimeOptions(endOptions);
      setEndTime('');
    }
  }, [visible, selectedTime]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadServices(), loadPromotions(), loadClients()]);
    setLoading(false);
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      // Add type field to each service
      const servicesWithType = (data || []).map(s => ({ ...s, type: 'service' }));
      setServices(servicesWithType);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      // Add type field to each promotion
      const promotionsWithType = (data || []).map(p => ({ ...p, type: 'promotion' }));
      setPromotions(promotionsWithType);
    } catch (error) {
      console.error('Error loading promotions:', error);
    }
  };

  const loadClients = async () => {
    try {
      const [registeredResult, unregisteredResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .neq('role', 'admin')
          .order('full_name'),
        supabase
          .from('unregistered_clients')
          .select('id, full_name, email, phone')
          .order('full_name')
      ]);

      if (registeredResult.error) throw registeredResult.error;
      if (unregisteredResult.error) throw unregisteredResult.error;

      const allClients = [
        ...(registeredResult.data || []).map(c => ({ ...c, isUnregistered: false })),
        ...(unregisteredResult.data || []).map(c => ({ ...c, isUnregistered: true }))
      ];

      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const findNextOccupiedSlot = (afterMinutes: number): number | null => {
    const sortedAppointments = [...appointments]
      .map(apt => ({
        start: timeToMinutes(apt.start_time),
        end: timeToMinutes(apt.end_time)
      }))
      .sort((a, b) => a.start - b.start);

    for (const apt of sortedAppointments) {
      if (apt.start > afterMinutes) {
        return apt.start;
      }
    }
    return null;
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const validateTimes = () => {
    if (!startTime || !endTime) {
      Alert.alert('Грешка', 'Моля, изберете начален и краен час');
      return false;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      Alert.alert('Грешка', 'Крайният час трябва да е след началния');
      return false;
    }

    const durationMinutes = endMinutes - startMinutes;
    if (durationMinutes < 15) {
      Alert.alert('Грешка', 'Минималната продължителност е 15 минути');
      return false;
    }

    return true;
  };

  const createReservation = async () => {
    if (!selectedService) {
      Alert.alert('Грешка', 'Моля, изберете услуга');
      return;
    }

    if (!newClientMode && !selectedClient) {
      Alert.alert('Грешка', 'Моля, изберете клиент или създайте нов');
      return;
    }

    if (newClientMode && (!newClientName || !newClientName.trim())) {
      Alert.alert('Грешка', 'Моля, въведете име на клиент');
      return;
    }

    if (!endTime) {
      Alert.alert('Грешка', 'Моля, изберете краен час');
      return;
    }

    if (!validateTimes()) {
      return;
    }

    let clientId = selectedClient?.id;
    let isUnregistered = selectedClient?.isUnregistered || false;

    if (newClientMode) {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('No authenticated user');
        }

        const normalizedPhone = newClientPhone && newClientPhone.trim()
          ? normalizePhoneNumber(newClientPhone.trim())
          : null;

        const { data: newClient, error: insertError } = await supabase
          .from('unregistered_clients')
          .insert({
            full_name: newClientName.trim(),
            phone: normalizedPhone,
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!newClient?.id) throw new Error('No client ID returned');

        clientId = newClient.id;
        isUnregistered = true;
      } catch (error: any) {
        Alert.alert('Грешка', `Неуспешно създаване на клиент: ${error.message || 'Неизвестна грешка'}`);
        return;
      }
    }

    if (!clientId) {
      Alert.alert('Грешка', 'Моля, изберете или въведете клиент');
      return;
    }

    try {
      setLoading(true);
      // Use local date format to match schedule.tsx
      const localDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      );
      const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      const { data: existingAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id, start_time, end_time, profiles!appointments_client_id_fkey(full_name), services(name)')
        .eq('appointment_date', dateStr);

      if (checkError) throw checkError;

      if (existingAppointments && existingAppointments.length > 0) {
        for (const apt of existingAppointments) {
          const aptStartMinutes = timeToMinutes(apt.start_time);
          const aptEndMinutes = timeToMinutes(apt.end_time);

          const hasOverlap =
            (startMinutes >= aptStartMinutes && startMinutes < aptEndMinutes) ||
            (endMinutes > aptStartMinutes && endMinutes <= aptEndMinutes) ||
            (startMinutes <= aptStartMinutes && endMinutes >= aptEndMinutes);

          if (hasOverlap) {
            const aptProfile = Array.isArray(apt.profiles) ? apt.profiles[0] : apt.profiles;
            const aptService = Array.isArray(apt.services) ? apt.services[0] : apt.services;

            Alert.alert(
              'Припокриване',
              `Вече има резервация от ${apt.start_time.substring(0, 5)} до ${apt.end_time.substring(0, 5)}\n\n` +
                `Клиент: ${aptProfile?.full_name || 'Неизвестен'}\n` +
                `Услуга: ${aptService?.name || 'Неизвестна'}\n\n` +
                `Моля, изберете друг час.`
            );
            setLoading(false);
            return;
          }
        }
      }

      const appointmentData: any = {
        appointment_date: dateStr,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
        status: 'confirmed',
      };

      // Add service_id or promotion_id based on type
      if (selectedService.type === 'service') {
        appointmentData.service_id = selectedService.id;
      } else if (selectedService.type === 'promotion') {
        appointmentData.promotion_id = selectedService.id;
      }

      if (isUnregistered) {
        appointmentData.unregistered_client_id = clientId;
      } else {
        appointmentData.client_id = clientId;
      }

      const { data: insertedAppointment, error } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      if (error) {
        console.error('Insert error:', error);
        let errorMessage = 'Неуспешно създаване на резервация';

        if (error.message) {
          errorMessage += '\n\nГрешка: ' + error.message;
        }

        if (error.code === 'PGRST301') {
          errorMessage += '\n\nВъзможна причина: Липсват права за създаване на резервация.';
        } else if (error.code === '23505') {
          errorMessage += '\n\nВъзможна причина: Вече съществува резервация за този час.';
        } else if (error.code === '23503') {
          errorMessage += '\n\nВъзможна причина: Невалиден клиент или услуга.';
        }

        Alert.alert('Грешка при създаване', errorMessage);
        setLoading(false);
        return;
      }

      if (!insertedAppointment) {
        Alert.alert('Грешка', 'Резервацията е създадена, но няма върнати данни.');
        setLoading(false);
        return;
      }

      // Database trigger automatically creates notification, no manual insert needed

      Alert.alert('Успех', 'Резервацията е създадена успешно');
      onConfirm();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating reservation:', error);
      Alert.alert('Грешка', 'Неуспешно създаване на резервация');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedService(null);
    setSelectedClient(null);
    setNewClientMode(false);
    setNewClientName('');
    setNewClientPhone('');
    setSearchQuery('');
    setStartTime(selectedTime);
    setEndTime('');
    setNotes('');
  };

  const filteredClients = clients.filter(
    (client) =>
      client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.phone && client.phone.includes(searchQuery))
  );

  // Auto scroll when newClientMode changes or search is focused
  useEffect(() => {
    if (newClientMode || searchQuery) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [newClientMode, searchQuery]);

  // Auto scroll when keyboard appears
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        // Don't auto scroll if notes field is focused - it handles its own scrolling
        if (focusedField !== 'notes') {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setFocusedField(null);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [focusedField]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.overlay}>
        <View style={[styles.modalContainer, { paddingBottom: keyboardVisible ? 4 : Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Нова резервация</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Дата:</Text>
              <Text style={[styles.infoText, styles.dateText]}>
                {formatDateWithWeekday(selectedDate)}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Часове</Text>
            <View style={styles.timeRow}>
              <View style={[styles.timeField, styles.lockedField]}>
                <Clock size={16} color={theme.colors.textMuted} />
                <Text style={styles.timeText}>{startTime}</Text>
              </View>
              <Text style={styles.timeSeparator}>-</Text>
              <TouchableOpacity
                style={styles.timeField}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Clock size={16} color={theme.colors.primary} />
                <Text style={[styles.timeText, !endTime && styles.placeholderText]}>
                  {endTime || 'Краен'}
                </Text>
                <ChevronDown size={16} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {startTime && endTime && (
              <Text style={styles.durationText}>
                {`${Math.round((timeToMinutes(endTime) - timeToMinutes(startTime)))} мин`}
              </Text>
            )}

            <Text style={styles.sectionTitle}>Услуга или промоция</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowServicePicker(true)}
            >
              <Text style={[styles.dropdownButtonText, !selectedService && styles.placeholderText]}>
                {selectedService ? selectedService.name : 'Избери услуга или промоция'}
              </Text>
              <ChevronDown size={20} color={theme.colors.text} />
            </TouchableOpacity>
            {selectedService && (
              <Text style={styles.serviceDetails}>
                {`${selectedService.duration_minutes} мин • ${selectedService.price} лв`}
              </Text>
            )}

            <View ref={notesFieldRef} onLayout={() => {}}>
              <Text style={styles.sectionTitle}>Бележки (опционално)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Допълнителна информация..."
                placeholderTextColor={theme.colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                onFocus={() => {
                  setFocusedField('notes');
                  setTimeout(() => {
                    notesFieldRef.current?.measureLayout(
                      scrollViewRef.current as any,
                      (x, y) => {
                        scrollViewRef.current?.scrollTo({ y: y - 20, animated: true });
                      },
                      () => {}
                    );
                  }, 100);
                }}
              />
            </View>

            <Text style={styles.sectionTitle}>Клиент</Text>
            <View style={styles.clientModeToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, !newClientMode && styles.toggleButtonActive]}
                onPress={() => setNewClientMode(false)}
              >
                <Text
                  style={[styles.toggleText, !newClientMode && styles.toggleTextActive]}
                >
                  Съществуващ
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, newClientMode && styles.toggleButtonActive]}
                onPress={() => setNewClientMode(true)}
              >
                <Text style={[styles.toggleText, newClientMode && styles.toggleTextActive]}>
                  Нов клиент
                </Text>
              </TouchableOpacity>
            </View>

            {newClientMode ? (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Име"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newClientName}
                  onChangeText={setNewClientName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Телефон"
                  placeholderTextColor={theme.colors.textMuted}
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                  keyboardType="phone-pad"
                />
              </View>
            ) : (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Търсене на клиент..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <ScrollView style={styles.clientsList} nestedScrollEnabled>
                  {searchQuery && filteredClients.length === 0 ? (
                    <Text style={styles.noResultsText}>Няма клиент с това име или номер</Text>
                  ) : (
                    filteredClients.map((client) => (
                      <TouchableOpacity
                        key={client.id}
                        style={[
                          styles.clientCard,
                          selectedClient?.id === client.id && styles.clientCardSelected,
                        ]}
                        onPress={() => setSelectedClient(client)}
                      >
                        <Text style={styles.clientName}>{client.full_name}</Text>
                        {client.phone && (
                          <Text style={styles.clientDetails}>{client.phone}</Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View style={[styles.actions, { marginTop: keyboardVisible ? 2 : theme.spacing.sm }]}>
            <TouchableOpacity
              style={[styles.cancelBtn, { paddingVertical: keyboardVisible ? 6 : theme.spacing.sm }]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Отказ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={createReservation}
              disabled={loading}
            >
              <LinearGradient
                colors={theme.gradients.primary}
                style={[styles.submitGradient, { paddingVertical: keyboardVisible ? 6 : theme.spacing.sm }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <>
                    <Send size={18} color={theme.colors.surface} />
                    <Text style={styles.submitText}>Създай</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showServicePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowServicePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowServicePicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Изберете услуга или промоция</Text>
              <TouchableOpacity onPress={() => setShowServicePicker(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {services.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.pickerItem,
                    selectedService?.id === service.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedService({ ...service, type: 'service' });
                    setShowServicePicker(false);
                  }}
                >
                  <Text style={styles.pickerItemName}>{service.name}</Text>
                  <Text style={styles.pickerItemDetails}>
                    {`${service.duration_minutes} мин • ${service.price} лв`}
                  </Text>
                </TouchableOpacity>
              ))}
              {promotions.map((promotion) => (
                <TouchableOpacity
                  key={promotion.id}
                  style={[
                    styles.pickerItem,
                    selectedService?.id === promotion.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedService({ ...promotion, type: 'promotion' });
                    setShowServicePicker(false);
                  }}
                >
                  <Text style={styles.pickerItemName}>{promotion.name}</Text>
                  <Text style={styles.pickerItemDetails}>
                    {`${promotion.duration_minutes} мин • ${promotion.price} лв`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showEndTimePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndTimePicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowEndTimePicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Изберете краен час</Text>
              <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {endTimeOptions.map((time: string) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.pickerItem,
                    endTime === time && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setEndTime(time);
                    setShowEndTimePicker(false);
                  }}
                >
                  <Text style={styles.pickerItemName}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '90%',
    paddingTop: theme.spacing.lg,
    paddingLeft: theme.spacing.lg,
    paddingRight: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  infoLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dateText: {
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  lockedField: {
    backgroundColor: '#e8e8e8',
  },
  dropdownButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    flex: 1,
  },
  placeholderText: {
    color: theme.colors.textMuted,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  timeField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  timeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
  },
  timeSeparator: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.xs,
  },
  durationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  durationText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '500',
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  serviceDetails: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
    paddingLeft: theme.spacing.sm,
    marginTop: -theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  clientModeToggle: {
    flexDirection: 'row',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  toggleButton: {
    flex: 1,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  toggleTextActive: {
    color: theme.colors.surface,
  },
  clientsList: {
    maxHeight: 200,
  },
  clientCard: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: theme.spacing.xs,
  },
  clientCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.accentLight,
  },
  clientName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  clientDetails: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textLight,
  },
  noResultsText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  submitBtn: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
  },
  submitText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.accentLight,
  },
  pickerItemName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  pickerItemDetails: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
});