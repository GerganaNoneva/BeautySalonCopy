import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Calendar, Clock } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FreeSlot = {
  date: Date;
  startTime: string;
  endTime: string;
  dateStr: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectSlot: (slot: FreeSlot) => void;
};

export default function NextFreeTimeSlotsModal({ visible, onClose, onSelectSlot }: Props) {
  const insets = useSafeAreaInsets();
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadFreeSlots();
    }
  }, [visible]);

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.substring(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };

  const loadFreeSlots = async () => {
    setLoading(true);
    try {
      const freeHours: FreeSlot[] = [];
      const today = new Date();
      const now = new Date();

      // Look ahead up to 30 days
      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + dayOffset);

        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

        // Get working hours for this day
        const { data: salonData } = await supabase
          .from('salon_info')
          .select('working_hours_json')
          .maybeSingle();

        if (!salonData?.working_hours_json) continue;

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = dayNames[currentDate.getDay()];
        const dayHours = salonData.working_hours_json[dayOfWeek];

        if (!dayHours || dayHours.closed) continue;

        const workingHours = {
          start: dayHours.start || '09:00',
          end: dayHours.end || '18:00',
          closed: dayHours.closed || false,
        };

        // Get appointments for this day
        const { data: appointments } = await supabase
          .from('appointments')
          .select('start_time::text, end_time::text')
          .eq('appointment_date', dateStr)
          .neq('status', 'cancelled');

        // Generate time slots and group into hours
        const [startHour, startMinute] = workingHours.start.split(':').map(Number);
        const [endHour, endMinute] = workingHours.end.split(':').map(Number);
        const startTotalMinutes = startHour * 60 + startMinute;
        const endTotalMinutes = endHour * 60 + endMinute;

        // Collect all free 30-min slots
        const freeSlots: string[] = [];
        for (let totalMinutes = startTotalMinutes; totalMinutes < endTotalMinutes; totalMinutes += 30) {
          const hour = Math.floor(totalMinutes / 60);
          const minute = totalMinutes % 60;
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

          // Skip if in the past (compare with current time)
          const slotDateTime = new Date(currentDate);
          slotDateTime.setHours(hour, minute, 0, 0);

          if (slotDateTime <= now) continue;

          // Check if slot is occupied
          const isOccupied = (appointments || []).some((apt) => {
            const aptStartMinutes = timeToMinutes(apt.start_time);
            const aptEndMinutes = timeToMinutes(apt.end_time);
            return totalMinutes >= aptStartMinutes && totalMinutes < aptEndMinutes;
          });

          if (!isOccupied) {
            freeSlots.push(timeStr);
          }
        }

        // Group consecutive free slots into blocks
        let i = 0;
        while (i < freeSlots.length) {
          const blockStart = freeSlots[i];
          let j = i + 1;

          // Find the end of this consecutive block
          while (j < freeSlots.length) {
            const prevMinutes = timeToMinutes(freeSlots[j - 1]);
            const currMinutes = timeToMinutes(freeSlots[j]);

            // Check if current slot is exactly 30 minutes after previous
            if (currMinutes === prevMinutes + 30) {
              j++;
            } else {
              break;
            }
          }

          // We have a block from freeSlots[i] to freeSlots[j-1]
          // The end time is 30 minutes after the last slot in the block
          const lastSlotMinutes = timeToMinutes(freeSlots[j - 1]);
          const endMinutes = lastSlotMinutes + 30;
          const endHour = Math.floor(endMinutes / 60);
          const endMin = endMinutes % 60;
          const endTimeStr = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

          const newSlot = {
            date: new Date(currentDate),
            startTime: blockStart,
            endTime: endTimeStr,
            dateStr,
          };

          freeHours.push(newSlot);

          // If we found 10 free blocks, stop
          if (freeHours.length === 10) {
            setFreeSlots(freeHours);
            setLoading(false);
            return;
          }

          // Move to the next block
          i = j;
        }
      }

      // Return whatever free hours we found (even if less than 10)
      setFreeSlots(freeHours);
    } catch (error) {
      console.error('Error loading free slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const weekday = date.toLocaleDateString('bg-BG', { weekday: 'short' });
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${weekday}, ${day}.${month}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (date: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Днес';
    if (isTomorrow(date)) return 'Утре';
    return formatDate(date);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { marginBottom: Math.max(insets.bottom + 40, 60) }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBadge}>
                <Calendar size={20} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.title}>Следващи свободни часове</Text>
                <Text style={styles.subtitle}>Изберете период за резервация</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Търсене на свободни часове...</Text>
            </View>
          ) : freeSlots.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Calendar size={48} color={theme.colors.textMuted} />
              </View>
              <Text style={styles.emptyText}>Няма свободни блокове</Text>
              <Text style={styles.emptySubtext}>в следващите 30 дни</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.slotsList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.slotsListContent}
            >
              {freeSlots.map((slot, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.slotCard,
                    index === 0 && styles.firstSlotCard,
                  ]}
                  onPress={() => {
                    onSelectSlot(slot);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.slotNumber}>
                    <Text style={styles.slotNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.slotInfo}>
                    <View style={styles.dateInfo}>
                      <Calendar size={16} color={theme.colors.primary} />
                      <Text style={styles.dateText}>{getDateLabel(slot.date)}</Text>
                    </View>
                    <View style={styles.timeInfo}>
                      <Clock size={18} color={theme.colors.surface} />
                      <Text style={styles.timeText}>{slot.startTime}</Text>
                      <Text style={[styles.timeText, { fontSize: theme.fontSize.md }]}>—</Text>
                      <Text style={styles.timeText}>{slot.endTime}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    ...theme.shadows.luxury,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary + '20',
    backgroundColor: theme.colors.primary + '08',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    color: theme.colors.textMuted,
  },
  closeButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
  loadingContainer: {
    padding: theme.spacing.xxl * 1.5,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: theme.spacing.xxl * 1.5,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.border + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  slotsList: {
    minHeight: 400,
    maxHeight: 600,
  },
  slotsListContent: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  slotCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
    overflow: 'visible',
  },
  firstSlotCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  slotNumber: {
    position: 'absolute',
    top: -10,
    left: theme.spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  slotNumberText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  slotInfo: {
    gap: theme.spacing.sm,
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '30',
    marginBottom: theme.spacing.xs,
  },
  dateText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timeText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.surface,
    letterSpacing: 0.3,
  },
});
