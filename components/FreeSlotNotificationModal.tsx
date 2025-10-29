import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Bell, Calendar, Clock, Search, CheckSquare, ChevronDown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';

type Client = {
  id: string;
  full_name: string;
  phone: string;
};

type FreeSlotNotificationModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  startTime: string;
};

export default function FreeSlotNotificationModal({
  visible,
  onClose,
  selectedDate,
  startTime,
}: FreeSlotNotificationModalProps) {
  const [endTime, setEndTime] = useState(() => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + 30;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [availableEndTimes, setAvailableEndTimes] = useState<string[]>([]);
  const [workingHoursEnd, setWorkingHoursEnd] = useState<string>('20:00');

  useEffect(() => {
    if (visible) {
      loadClients();
      loadWorkingHours();
    }
  }, [visible]);

  useEffect(() => {
    if (startTime) {
      generateAvailableEndTimes();
    }
  }, [startTime, workingHoursEnd]);

  const loadWorkingHours = async () => {
    try {
      const { data, error } = await supabase
        .from('salon_info')
        .select('working_hours_json')
        .maybeSingle();

      if (error) throw error;

      if (data?.working_hours_json) {
        const dayOfWeek = selectedDate.getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayHours = data.working_hours_json[dayNames[dayOfWeek]];

        if (dayHours && !dayHours.closed) {
          setWorkingHoursEnd(dayHours.end);
        }
      }
    } catch (error) {
      console.error('Error loading working hours:', error);
    }
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const generateAvailableEndTimes = async () => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes + 30;

    const dateStr = selectedDate.toISOString().split('T')[0];
    const { data: appointments } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('appointment_date', dateStr)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });

    const nextAppointmentAfterStart = appointments?.find(apt => {
      const aptStartMinutes = timeToMinutes(apt.start_time);
      return aptStartMinutes >= startTotalMinutes;
    });

    let maxEndMinutes: number;
    if (nextAppointmentAfterStart) {
      maxEndMinutes = timeToMinutes(nextAppointmentAfterStart.start_time);
    } else {
      const [endHours, endMinutes] = workingHoursEnd.split(':').map(Number);
      maxEndMinutes = endHours * 60 + endMinutes;
    }

    const times: string[] = [];

    for (let minutes = startTotalMinutes; minutes <= maxEndMinutes; minutes += 30) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      times.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    }

    setAvailableEndTimes(times);

    if (times.length > 0 && !times.includes(endTime)) {
      setEndTime(times[0]);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'client')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setClients(data || []);

      const allIds = new Set((data || []).map(c => c.id));
      setSelectedClients(allIds);
      setSelectAll(true);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const toggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
    setSelectAll(newSelected.size === clients.length);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedClients(new Set());
      setSelectAll(false);
    } else {
      const allIds = new Set(filteredClients.map(c => c.id));
      setSelectedClients(allIds);
      setSelectAll(true);
    }
  };

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sendNotifications = async () => {
    console.log('sendNotifications called, selected clients:', selectedClients.size);

    if (selectedClients.size === 0) {
      Alert.alert('Грешка', 'Моля, изберете поне един клиент');
      return;
    }

    try {
      setLoading(true);
      console.log('Sending notifications...');

      const dateStr = selectedDate.toLocaleDateString('bg-BG');
      const notifications = Array.from(selectedClients).map((clientId) => ({
        user_id: clientId,
        type: 'free_slot',
        title: 'Свободен час!',
        body: `${dateStr} между ${startTime} и ${endTime}`,
        data: {
          date: selectedDate.toISOString().split('T')[0],
          start_time: startTime,
          end_time: endTime,
        },
      }));

      console.log('Notifications to send:', notifications);

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Supabase error:', notifError);
        throw notifError;
      }

      console.log('Notifications sent successfully');
      Alert.alert(
        'Успех',
        `Уведомленията са изпратени до ${selectedClients.size} клиента!`
      );
      onClose();
    } catch (error) {
      console.error('Error sending notifications:', error);
      Alert.alert('Грешка', 'Неуспешно изпращане на уведомления');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => {
            if (showEndTimePicker) {
              setShowEndTimePicker(false);
            }
          }}
        >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalContainer}>
            <View style={styles.header}>
              <Text style={styles.title}>Уведоми за свободен час</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

          <View style={styles.infoRow}>
            <Calendar size={18} color={theme.colors.primary} />
            <Text style={styles.infoText}>
              {selectedDate.toLocaleDateString('bg-BG')}
            </Text>
          </View>

          <View style={styles.timeInputs}>
            <View style={styles.timeInput}>
              <Text style={styles.label}>Начален час</Text>
              <View style={styles.timeDisplay}>
                <Clock size={18} color={theme.colors.primary} />
                <Text style={styles.timeText}>{startTime}</Text>
              </View>
            </View>

            <View style={styles.timeInput}>
              <Text style={styles.label}>Краен час</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowEndTimePicker(!showEndTimePicker)}
              >
                <Clock size={18} color={theme.colors.primary} />
                <Text style={styles.timeText}>{endTime}</Text>
                <ChevronDown size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
              {showEndTimePicker && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={styles.dropdownScroll} showsVerticalScrollIndicator={true}>
                    {availableEndTimes.map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.dropdownItem,
                          time === endTime && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setEndTime(time);
                          setShowEndTimePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            time === endTime && styles.dropdownItemTextSelected,
                          ]}
                        >
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Търси клиент..."
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <View style={styles.selectAllRow}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={toggleSelectAll}
            >
              <CheckSquare
                size={20}
                color={selectAll ? theme.colors.primary : theme.colors.textMuted}
                fill={selectAll ? theme.colors.primary : 'transparent'}
              />
              <Text style={styles.selectAllText}>Избери всички</Text>
            </TouchableOpacity>
            <Text style={styles.selectedCount}>
              {selectedClients.size} / {clients.length}
            </Text>
          </View>

          <ScrollView style={styles.clientsList} showsVerticalScrollIndicator={false}>
            {filteredClients.map((client) => (
              <TouchableOpacity
                key={client.id}
                style={styles.clientItem}
                onPress={() => toggleClient(client.id)}
              >
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{client.full_name}</Text>
                  {client.phone && (
                    <Text style={styles.clientPhone}>{client.phone}</Text>
                  )}
                </View>
                <Switch
                  value={selectedClients.has(client.id)}
                  onValueChange={() => toggleClient(client.id)}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.surface}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Отказ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={sendNotifications}
              disabled={loading || selectedClients.size === 0}
            >
              <LinearGradient
                colors={theme.gradients.secondary}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <>
                    <Bell size={18} color={theme.colors.surface} />
                    <Text style={styles.submitText}>Уведоми</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    width: '100%',
    height: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  timeInputs: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    zIndex: 10,
  },
  timeInput: {
    flex: 1,
    position: 'relative',
    zIndex: 10,
  },
  label: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginBottom: 4,
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
    minHeight: 36,
  },
  timeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.sm,
    minHeight: 36,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 150,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  dropdownScroll: {
    maxHeight: 150,
  },
  dropdownItem: {
    paddingVertical: 8,
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
  },
  dropdownItemTextSelected: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    zIndex: 1,
    minHeight: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 6,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectAllText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  selectedCount: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  clientsList: {
    flex: 1,
    marginBottom: theme.spacing.sm,
    zIndex: 1,
  },
  clientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: 4,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  clientPhone: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  submitBtn: {
    flex: 1,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.sm,
    minHeight: 40,
  },
  submitText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.surface,
  },
});
