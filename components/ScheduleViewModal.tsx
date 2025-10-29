import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import ScheduleDatePicker from './ScheduleDatePicker';

type TimeSlot = {
  time: string;
  isAvailable: boolean;
  isPast: boolean;
};

type ScheduleViewModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectSlot: (date: string, time: string) => void;
  serviceDuration: number;
};

export default function ScheduleViewModal({
  visible,
  onClose,
  onSelectSlot,
  serviceDuration,
}: ScheduleViewModalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingHours, setWorkingHours] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      loadWorkingHours();
    }
  }, [visible]);

  useEffect(() => {
    if (workingHours) {
      loadSchedule();
    }
  }, [selectedDate, workingHours]);

  const loadWorkingHours = async () => {
    try {
      console.log('🔍 ScheduleViewModal: Loading working hours from salon_info...');
      const { data, error } = await supabase
        .from('salon_info')
        .select('working_hours_json')
        .maybeSingle();

      if (error) {
        console.error('❌ ScheduleViewModal: Error loading working hours:', error);
      }

      console.log('📅 ScheduleViewModal: Working hours from DB:', JSON.stringify(data?.working_hours_json, null, 2));

      if (data?.working_hours_json) {
        setWorkingHours(data.working_hours_json);
      } else {
        console.warn('⚠️  ScheduleViewModal: No working hours found in database');
      }
    } catch (error) {
      console.error('Error loading working hours:', error);
    }
  };

  const loadSchedule = async () => {
    setLoading(true);
    try {
      console.log('ScheduleViewModal: Loading schedule for date:', selectedDate);
      console.log('ScheduleViewModal: Service duration:', serviceDuration);

      if (!serviceDuration || serviceDuration === 0) {
        console.error('ScheduleViewModal: Invalid service duration!', serviceDuration);
        setTimeSlots([]);
        setLoading(false);
        return;
      }

      const dateStr = formatLocalDate(selectedDate);
      const dayOfWeek = selectedDate.getDay();

      console.log('ScheduleViewModal: Loading schedule for:', dateStr);
      console.log('ScheduleViewModal: Selected date object:', selectedDate);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayHours = workingHours[dayNames[dayOfWeek]];

      console.log('ScheduleViewModal: Day hours:', dayHours);

      if (!dayHours || dayHours.closed) {
        console.log('ScheduleViewModal: Salon is closed on this day');
        setTimeSlots([]);
        return;
      }

      // Load both confirmed appointments and pending requests
      const { data: appointments } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('appointment_date', dateStr)
        .neq('status', 'cancelled');

      const { data: pendingRequests } = await supabase
        .from('appointment_requests')
        .select('requested_time, services(duration_minutes)')
        .eq('requested_date', dateStr)
        .eq('status', 'pending');

      console.log(`ScheduleViewModal: Found ${appointments?.length || 0} appointments and ${pendingRequests?.length || 0} pending requests`);

      const slots: TimeSlot[] = [];
      const [startHour, startMinute] = dayHours.start.split(':').map(Number);
      const [endHour, endMinute] = dayHours.end.split(':').map(Number);

      const startTotalMinutes = startHour * 60 + startMinute;
      const endTotalMinutes = endHour * 60 + endMinute;

      console.log('ScheduleViewModal: Start minutes:', startTotalMinutes, 'End minutes:', endTotalMinutes);
      console.log('ScheduleViewModal: Service duration:', serviceDuration);

      const now = new Date();
      const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const isToday = currentDate.getTime() === selectedDateOnly.getTime();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      for (let totalMinutes = startTotalMinutes; totalMinutes + serviceDuration <= endTotalMinutes; totalMinutes += 30) {
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        // Check if slot is in the past
        const isPast = selectedDateOnly < currentDate || (isToday && totalMinutes < currentMinutes);

        // Check if slot conflicts with existing appointments
        const hasAppointmentConflict = appointments?.some((apt) => {
          const aptStartMinutes = timeToMinutes(apt.start_time);
          const aptEndMinutes = timeToMinutes(apt.end_time);
          const slotEndMinutes = totalMinutes + serviceDuration;

          return (
            (totalMinutes >= aptStartMinutes && totalMinutes < aptEndMinutes) ||
            (slotEndMinutes > aptStartMinutes && slotEndMinutes <= aptEndMinutes) ||
            (totalMinutes <= aptStartMinutes && slotEndMinutes >= aptEndMinutes)
          );
        });

        // Check if slot conflicts with pending requests
        const hasPendingRequestConflict = pendingRequests?.some((req) => {
          const reqStartMinutes = timeToMinutes(req.requested_time);
          const reqEndMinutes = reqStartMinutes + (req.services?.duration_minutes || 0);
          const slotEndMinutes = totalMinutes + serviceDuration;

          return (
            (totalMinutes >= reqStartMinutes && totalMinutes < reqEndMinutes) ||
            (slotEndMinutes > reqStartMinutes && slotEndMinutes <= reqEndMinutes) ||
            (totalMinutes <= reqStartMinutes && slotEndMinutes >= reqEndMinutes)
          );
        });

        const isAvailable = !isPast && !hasAppointmentConflict && !hasPendingRequestConflict;

        slots.push({ time: timeStr, isAvailable, isPast });
      }

      console.log('ScheduleViewModal: Generated slots:', slots.length);
      console.log('ScheduleViewModal: Available slots:', slots.filter(s => s.isAvailable).length);

      setTimeSlots(slots);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (date: Date): string => {
    const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${dayName}, ${day}.${month}.${year}г.`;
  };

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleSlotPress = (slot: TimeSlot) => {
    if (slot.isPast) {
      return;
    }
    if (slot.isAvailable) {
      const dateStr = formatLocalDate(selectedDate);
      console.log('ScheduleViewModal: Selected slot for date:', dateStr, 'time:', slot.time);
      onSelectSlot(dateStr, slot.time);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={theme.gradients.primary}
            style={styles.modalHeader}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.modalTitle}>Графика</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.surface} />
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.dateNavigation}>
            <TouchableOpacity onPress={handlePreviousDay} style={styles.navButton}>
              <ChevronLeft size={24} color={theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateDisplay}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={20} color={theme.colors.primary} />
              <Text style={styles.dateText}>
                {formatDate(selectedDate)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNextDay} style={styles.navButton}>
              <ChevronRight size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : timeSlots.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Салонът е затворен в този ден</Text>
            </View>
          ) : (
            <ScrollView style={styles.slotsContainer} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: theme.colors.success }]} />
                  <Text style={styles.legendText}>Свободен</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: theme.colors.error }]} />
                  <Text style={styles.legendText}>Зает</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#757575' }]} />
                  <Text style={styles.legendText}>Изминал</Text>
                </View>
              </View>

              <View style={styles.slotsGrid}>
                {(() => {
                  console.log('ScheduleViewModal: Rendering', timeSlots.length, 'slots');
                  return null;
                })()}
                {timeSlots.map((slot, index) => {
                  let backgroundColor, borderColor, textColor;

                  if (slot.isPast) {
                    backgroundColor = '#75757520';
                    borderColor = '#757575';
                    textColor = '#757575';
                  } else if (slot.isAvailable) {
                    backgroundColor = theme.colors.success + '20';
                    borderColor = theme.colors.success;
                    textColor = theme.colors.success;
                  } else {
                    backgroundColor = theme.colors.error + '20';
                    borderColor = theme.colors.error;
                    textColor = theme.colors.error;
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.slotCard,
                        {
                          backgroundColor,
                          borderColor,
                        },
                      ]}
                      onPress={() => handleSlotPress(slot)}
                      disabled={!slot.isAvailable || slot.isPast}
                    >
                      <Text style={[styles.slotTime, { color: textColor }]}>
                        {slot.time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        <ScheduleDatePicker
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelectDate={(date) => {
            // Нормализираме датата за local timezone като използваме UTC компонентите
            const normalizedDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
            console.log('ScheduleViewModal - Original date:', date);
            console.log('ScheduleViewModal - Normalized date:', normalizedDate);
            console.log('ScheduleViewModal - Formatted date:', formatLocalDate(normalizedDate));
            setSelectedDate(normalizedDate);
            setShowDatePicker(false);
          }}
          workingHours={workingHours}
          allowAnyDate={true}
          serviceDuration={serviceDuration}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '90%',
    height: '80%',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.surface,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  dateNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  navButton: {
    padding: theme.spacing.sm,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textTransform: 'capitalize',
  },
  loadingContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  slotsContainer: {
    flex: 1,
    minHeight: 200,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.sm,
  },
  legendText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: theme.spacing.md,
    justifyContent: 'flex-start',
  },
  slotCard: {
    width: '30%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    marginRight: '3%',
  },
  slotTime: {
    fontSize: 16,
    fontWeight: '600',
  },
});
