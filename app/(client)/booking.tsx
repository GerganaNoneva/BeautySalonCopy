import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Clock, Send, Bell, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import NotificationsModal from '@/components/NotificationsModal';
import NotificationBadge from '@/components/NotificationBadge';
import ScheduleViewModal from '@/components/ScheduleViewModal';
import TimeSuggestionModal from '@/components/TimeSuggestionModal';
import { useLocalSearchParams } from 'expo-router';

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

type TimeSlot = {
  time: string;
  date: string;
  endTime?: string;
};

type AppointmentRequest = {
  id: string;
  client_id: string;
  service_id: string;
  requested_date: string;
  requested_time: string;
  client_message: string;
  status: string;
  suggested_date?: string | null;
  suggested_start_time?: string | null;
  suggested_end_time?: string | null;
  services: {
    name: string;
  };
};

export default function ClientBookingScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceOrPromotion | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [message, setMessage] = useState('');
  const [showNextSlotsModal, setShowNextSlotsModal] = useState(false);
  const [nextSlots, setNextSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showScheduleView, setShowScheduleView] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [workingHours, setWorkingHours] = useState<any>(null);
  const [showTimeSuggestionModal, setShowTimeSuggestionModal] = useState(false);
  const [timeSuggestionData, setTimeSuggestionData] = useState<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const formButtonsRef = useRef<View>(null);

  // Function to scroll to show buttons above keyboard
  const scrollToShowButtons = () => {
    if (!isKeyboardVisible) return;

    setTimeout(() => {
      if (formButtonsRef.current && scrollViewRef.current) {
        formButtonsRef.current.measureLayout(
          scrollViewRef.current as any,
          (x, y, width, height) => {
            // Calculate scroll position so buttons are at bottom above keyboard
            const screenHeight = Dimensions.get('window').height;
            const keyboardHeight = 300; // Approximate keyboard height
            const visibleHeight = screenHeight - keyboardHeight - 100; // header height

            // Scroll so the bottom of buttons is at the bottom of visible area
            const scrollY = y + height - visibleHeight + 20;

            scrollViewRef.current?.scrollTo({
              y: Math.max(0, scrollY),
              animated: true
            });
          },
          () => {
          }
        );
      }
    }, 100);
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Keyboard visibility listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (params.selectedServiceId && (services.length > 0 || promotions.length > 0)) {
      const service = services.find(s => s.id === params.selectedServiceId);
      const promotion = promotions.find(p => p.id === params.selectedServiceId);
      const selected = service ? { ...service, type: 'service' as const } : promotion ? { ...promotion, type: 'promotion' as const } : null;
      if (selected) {
        setSelectedService(selected);
        setShowBookingForm(true);
        findAvailableSlots(selected);
      }
    }
  }, [params.selectedServiceId, services, promotions]);

  useEffect(() => {
    if (params.prefillDate && params.prefillStartTime && params.prefillEndTime) {
      setSelectedSlot({
        date: params.prefillDate as string,
        time: params.prefillStartTime as string,
        endTime: params.prefillEndTime as string
      });
      setShowBookingForm(true);
    }
  }, [params.prefillDate, params.prefillStartTime, params.prefillEndTime]);

  // Real-time subscription for appointment requests
  useEffect(() => {
    if (!user?.id) return;

    const requestsChannel = supabase
      .channel('client_booking_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_requests',
          filter: `client_id=eq.${user.id}`,
        },
        (payload) => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
    };
  }, [user?.id]);

  // Real-time subscription for services
  useEffect(() => {
    const servicesChannel = supabase
      .channel('client_services_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services',
        },
        (payload) => {
          loadServices();
        }
      )
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(servicesChannel);
    };
  }, []);

  // Real-time subscription for promotions
  useEffect(() => {
    const promotionsChannel = supabase
      .channel('client_promotions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promotions',
        },
        (payload) => {
          loadPromotions();
        }
      )
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(promotionsChannel);
    };
  }, []);

  const loadData = async () => {
    await Promise.all([loadRequests(), loadServices(), loadPromotions(), loadWorkingHours()]);
    setLoading(false);
  };

  const loadWorkingHours = async () => {
    try {
      const { data: workingHoursData, error: workingHoursError } = await supabase
        .from('salon_info')
        .select('working_hours_json')
        .maybeSingle();

      if (workingHoursError) {
        console.error('❌ Booking: Error loading working hours:', workingHoursError);
        return null;
      }


      // Default working hours if not configured
      const defaultWorkingHours = {
        monday: { start: '09:00', end: '18:00', closed: false },
        tuesday: { start: '09:00', end: '18:00', closed: false },
        wednesday: { start: '09:00', end: '18:00', closed: false },
        thursday: { start: '09:00', end: '18:00', closed: false },
        friday: { start: '09:00', end: '18:00', closed: false },
        saturday: { start: '09:00', end: '18:00', closed: false },
        sunday: { start: '09:00', end: '18:00', closed: true },
      };

      const workingHoursJson = workingHoursData?.working_hours_json || defaultWorkingHours;
      setWorkingHours(workingHoursJson);

      return workingHoursJson;
    } catch (error) {
      console.error('❌ Error loading working hours:', error);
      return null;
    }
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('appointment_requests')
        .select(`
          id,
          client_id,
          service_id,
          requested_date,
          requested_time::text,
          client_message,
          status,
          created_at,
          updated_at,
          suggested_date,
          suggested_start_time::text,
          suggested_end_time::text,
          services(name)
        `)
        .eq('client_id', user?.id)
        .in('status', ['pending', 'rejected', 'changed'])
        .eq('hidden_by_client', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as any);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('❌ Error loading services:', error);
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
      setPromotions(data || []);
    } catch (error) {
      console.error('❌ Error loading promotions:', error);
    }
  };

  const findAvailableSlots = async (service: ServiceOrPromotion) => {
    setLoadingSlots(true);
    try {
      // ALWAYS reload working hours to ensure we have the latest data
      const currentWorkingHours = await loadWorkingHours();
      if (!currentWorkingHours) {
        console.error('❌ Failed to load working hours!');
        Alert.alert('Грешка', 'Не успяхме да заредим работното време на салона');
        return;
      }


      const slots: TimeSlot[] = [];
      const today = new Date();

      for (let dayOffset = 0; dayOffset < 30 && slots.length < 10; dayOffset++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + dayOffset);
        const dateStr = checkDate.toISOString().split('T')[0];

        const daySlots = await getAvailableSlotsForDay(dateStr, service.duration_minutes, currentWorkingHours);
        slots.push(...daySlots);

        if (slots.length >= 10) break;
      }

      setAvailableSlots(slots.slice(0, 10));
      // Don't auto-select first slot - let user choose
      if (slots.length === 0) {
        console.warn('⚠️ No available slots found!');
        Alert.alert('Внимание', 'Няма налични свободни часове в следващите 30 дни. Моля, свържете се със салона директно.');
      }
    } catch (error) {
      console.error('❌ Error finding slots:', error);
      Alert.alert('Грешка', 'Възникна грешка при търсенето на свободни часове');
    } finally {
      setLoadingSlots(false);
    }
  };

  const getAvailableSlotsForDay = async (date: string, durationMinutes: number, currentWorkingHours: any): Promise<TimeSlot[]> => {

    // Use provided working hours
    if (!currentWorkingHours) {
      console.error('❌ Working hours not provided!');
      return [];
    }


  // Parse the incoming date string (YYYY-MM-DD) as a local date to avoid timezone shifts
  // e.g. new Date('2025-10-27') can be parsed as UTC which may shift the day in local time.
  const checkDate = new Date(date + 'T00:00:00');
    const today = new Date();
    const isToday = checkDate.toDateString() === today.toDateString();
    const currentMinutes = isToday ? today.getHours() * 60 + today.getMinutes() : 0;

  const dayOfWeek = checkDate.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
  const dayHours = currentWorkingHours[dayName];


    if (!dayHours || dayHours.closed) {
      return [];
    }

    // Load both confirmed appointments and pending requests
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('appointment_date', date)
      .neq('status', 'cancelled');

    const { data: pendingRequests } = await supabase
      .from('appointment_requests')
      .select('requested_time, services(duration_minutes)')
      .eq('requested_date', date)
      .eq('status', 'pending');


    const slots: TimeSlot[] = [];
    const [startHour, startMinute] = dayHours.start.split(':').map(Number);
    const [endHour, endMinute] = dayHours.end.split(':').map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    for (let totalMinutes = startTotalMinutes; totalMinutes + durationMinutes <= endTotalMinutes; totalMinutes += 30) {
      if (isToday && totalMinutes <= currentMinutes) {
        continue;
      }

      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      // Check if slot conflicts with existing appointments
      const hasAppointmentConflict = existingAppointments?.some((apt) => {
        const aptStartMinutes = timeToMinutes(apt.start_time);
        const aptEndMinutes = timeToMinutes(apt.end_time);
        const slotEndMinutes = totalMinutes + durationMinutes;

        return (
          (totalMinutes >= aptStartMinutes && totalMinutes < aptEndMinutes) ||
          (slotEndMinutes > aptStartMinutes && slotEndMinutes <= aptEndMinutes) ||
          (totalMinutes <= aptStartMinutes && slotEndMinutes >= aptEndMinutes)
        );
      });

      // Check if slot conflicts with pending requests
      const hasPendingRequestConflict = pendingRequests?.some((req: any) => {
        const reqStartMinutes = timeToMinutes(req.requested_time);
        const reqEndMinutes = reqStartMinutes + (req.services?.[0]?.duration_minutes || 0);
        const slotEndMinutes = totalMinutes + durationMinutes;

        return (
          (totalMinutes >= reqStartMinutes && totalMinutes < reqEndMinutes) ||
          (slotEndMinutes > reqStartMinutes && slotEndMinutes <= reqEndMinutes) ||
          (totalMinutes <= reqStartMinutes && slotEndMinutes >= reqEndMinutes)
        );
      });

      const isAvailable = !hasAppointmentConflict && !hasPendingRequestConflict;

      if (isAvailable) {
        slots.push({ time: timeStr, date });
      }
    }

    return slots;
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getAvailableMinutes = () => {
    if (!selectedSlot?.endTime) return null;
    const startMinutes = timeToMinutes(selectedSlot.time);
    const endMinutes = timeToMinutes(selectedSlot.endTime);
    return endMinutes - startMinutes;
  };

  const getFilteredServices = (): ServiceOrPromotion[] => {
    const availableMinutes = getAvailableMinutes();

    const servicesWithType: ServiceOrPromotion[] = services.map(s => ({ ...s, type: 'service' as const }));
    const promotionsWithType: ServiceOrPromotion[] = promotions.map(p => ({ ...p, type: 'promotion' as const }));

    const combined = [...servicesWithType, ...promotionsWithType];

    if (!availableMinutes) return combined;
    return combined.filter(item => item.duration_minutes <= availableMinutes);
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + durationMinutes;
    const hours = Math.floor(endMinutes / 60);
    const minutes = endMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const handleServiceSelect = async (service: ServiceOrPromotion) => {
    if (selectedSlot?.endTime) {
      const availableMinutes = getAvailableMinutes();
      if (availableMinutes && service.duration_minutes > availableMinutes) {
        Alert.alert(
          'Недостатъчно време',
          'В графика няма достатъчно свободно време за тази услуга. Моля, изберете друга услуга или час.'
        );
        return;
      }
    }

    setSelectedService(service);
    if (!selectedSlot) {
      await findAvailableSlots(service);
    }
  };

  const showNext10Slots = async () => {
    if (!selectedService) return;

    setLoadingSlots(true);
    try {
      // ALWAYS reload working hours to ensure we have the latest data
      const currentWorkingHours = await loadWorkingHours();
      if (!currentWorkingHours) {
        console.error('❌ Failed to load working hours!');
        Alert.alert('Грешка', 'Не успяхме да заредим работното време на салона');
        return;
      }

      const slots: TimeSlot[] = [];
      const today = new Date();

      for (let dayOffset = 0; dayOffset < 60 && slots.length < 10; dayOffset++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + dayOffset);
        const dateStr = checkDate.toISOString().split('T')[0];

        const daySlots = await getAvailableSlotsForDay(dateStr, selectedService.duration_minutes, currentWorkingHours);
        slots.push(...daySlots);

        if (slots.length >= 10) break;
      }

      setNextSlots(slots.slice(0, 10));
      setShowNextSlotsModal(true);
    } catch (error) {
      console.error('Error loading next slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleScheduleSlotSelect = (date: string, time: string) => {
    setSelectedSlot({ date, time });
  };

  const submitBookingRequest = async () => {

    if (!selectedService || !selectedSlot) {
      Alert.alert('Грешка', 'Моля, изберете услуга и час');
      return;
    }

    if (selectedService.name === 'Други' && !message.trim()) {
      Alert.alert('Грешка', 'Моля, опишете желаната услуга в полето за съобщение');
      return;
    }

    try {

      const requestedTime = selectedSlot.time.length === 5
        ? `${selectedSlot.time}:00`
        : selectedSlot.time;

      const insertData: any = {
        client_id: user?.id,
        requested_date: selectedSlot.date,
        requested_time: requestedTime,
        client_message: message || '',
      };

      // Add service_id or promotion_id based on type
      if (selectedService.type === 'service') {
        insertData.service_id = selectedService.id;
      } else {
        insertData.promotion_id = selectedService.id;
      }


      // Check if client already has a request for this date and time
      const { data: existingRequest, error: checkError } = await supabase
        .from('appointment_requests')
        .select('id, requested_time, services(name), promotions(name)')
        .eq('client_id', user?.id)
        .eq('requested_date', selectedSlot.date)
        .eq('requested_time', requestedTime)
        .not('status', 'in', '(rejected)')
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing requests:', checkError);
      }

      if (existingRequest) {
        const serviceName = existingRequest.services?.name || existingRequest.promotions?.name || 'Неизвестна услуга';
        Alert.alert(
          'Вече има заявка',
          `Вече имате заявка за ${new Date(selectedSlot.date + 'T00:00:00').toLocaleDateString('bg-BG')} в ${requestedTime.substring(0, 5)}\n\nУслуга: ${serviceName}\n\nМоля, изберете друг час или изчакайте текущата заявка да бъде обработена.`
        );
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('appointment_requests')
        .insert(insertData)
        .select();


      if (error) {
        console.error('Insert error:', error);
        throw error;
      }

      // Database trigger automatically creates notification for admin
      // No need to manually insert notification here

      setMessage('');
      setShowBookingForm(false);
      setSelectedService(null);
      setSelectedSlot(null);
      setAvailableSlots([]);
      loadRequests();
      Alert.alert('Успех', 'Вашата заявка е изпратена! Очаквайте потвърждение.');
    } catch (error: any) {
      console.error('Error in submitBookingRequest:', error);
      Alert.alert('Грешка', `Неуспешно изпращане на заявката: ${error.message || 'Неизвестна грешка'}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'approved':
        return theme.colors.success;
      case 'pending':
        return theme.colors.warning;
      case 'changed':
        return '#FFB800';
      case 'cancelled':
      case 'rejected':
        return theme.colors.error;
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Потвърдена';
      case 'approved':
        return 'Одобрена';
      case 'pending':
        return 'В очакване';
      case 'cancelled':
        return 'Отказана';
      case 'rejected':
        return 'Отхвърлена';
      case 'completed':
        return 'Завършена';
      case 'changed':
        return 'Променена';
      default:
        return status;
    }
  };

  const handleCancelRequest = (requestId: string) => {
    setCancellingRequestId(requestId);
    setShowCancelModal(true);
  };

  const confirmCancelRequest = async () => {
    if (!cancellingRequestId) return;

    try {
      // Get request details BEFORE deletion
      const request = requests.find(r => r.id === cancellingRequestId);

      // Delete the request
      const { error } = await supabase
        .from('appointment_requests')
        .delete()
        .eq('id', cancellingRequestId);

      if (error) throw error;

      // Notify admin about cancellation
      if (request) {
        try {
          await supabase.rpc('notify_admin', {
            p_title: 'Клиент отмени заявка',
            p_body: `Клиент отмени заявка за ${request.services.name} на ${new Date(request.requested_date).toLocaleDateString('bg-BG')} в ${request.requested_time.slice(0, 5)}${cancelReason.trim() ? `. Причина: ${cancelReason}` : ''}`,
            p_type: 'booking_cancelled',
            p_data: {
              request_id: cancellingRequestId,
              cancel_reason: cancelReason || null,
            }
          });
        } catch (notifError) {
          console.error('Error sending cancellation notification:', notifError);
          // Don't fail the whole operation if notification fails
        }
      }

      setShowCancelModal(false);
      setCancelReason('');
      setCancellingRequestId(null);
      await loadData();
      Alert.alert('Успех', 'Заявката е отменена');
    } catch (err) {
      console.error('Error cancelling request:', err);
      Alert.alert('Грешка', 'Неуспешна отмяна на заявката');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      Alert.alert(
        'Потвърждение',
        'Сигурни ли сте, че искате да изтриете тази заявка?',
        [
          { text: 'Отказ', style: 'cancel' },
          {
            text: 'Изтрий',
            style: 'destructive',
            onPress: async () => {

              const { data, error } = await supabase
                .from('appointment_requests')
                .update({ hidden_by_client: true })
                .eq('id', requestId)
                .eq('client_id', user?.id)
                .select();

              if (error) throw error;


              await loadData();
              Alert.alert('Успех', 'Заявката е изчистена');
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error deleting request:', err);
      Alert.alert('Грешка', 'Неуспешно изтриване на заявката');
    }
  };

  const handleClearAllRejected = async () => {
    try {
      const rejectedRequests = requests.filter(r => r.status === 'rejected');

      if (rejectedRequests.length === 0) {
        Alert.alert('Информация', 'Няма отхвърлени заявки за изтриване');
        return;
      }

      Alert.alert(
        'Потвърждение',
        `Сигурни ли сте, че искате да изтриете всички ${rejectedRequests.length} отхвърлени заявки?`,
        [
          { text: 'Отказ', style: 'cancel' },
          {
            text: 'Изтрий',
            style: 'destructive',
            onPress: async () => {

              const { data: hiddenData, error } = await supabase
                .from('appointment_requests')
                .update({ hidden_by_client: true })
                .eq('client_id', user?.id)
                .eq('status', 'rejected')
                .eq('hidden_by_client', false)
                .select();

              if (error) {
                console.error('❌ Error hiding rejected requests:', error);
                throw error;
              }


              await loadData();
              Alert.alert('Успех', `Изчистени ${hiddenData?.length || 0} отхвърлени заявки`);
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error clearing rejected requests:', err);
      Alert.alert('Грешка', 'Неуспешно изтриване на заявките');
    }
  };

  // Get rejected requests for the clear button
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Заяви час</Text>
            <Text style={styles.headerSubtitle}>URBAN Beauty</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <NotificationBadge size={24} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView ref={scrollViewRef} style={styles.content}>
          {!showBookingForm && (
            <TouchableOpacity
              style={styles.newBookingButton}
              onPress={() => setShowBookingForm(true)}
            >
              <LinearGradient
                colors={theme.gradients.secondary}
                style={styles.newBookingGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Calendar size={24} color={theme.colors.surface} />
                <Text style={styles.newBookingText}>Нова заявка за час</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {showBookingForm && (
            <View style={styles.bookingForm}>
              <Text style={styles.formTitle}>Заяви час</Text>

              {!selectedService ? (
                <View>
                  <Text style={styles.label}>Изберете услуга или промоция</Text>
                  {selectedSlot && selectedSlot.endTime && (
                    <View style={styles.prefilledSlotInfo}>
                      <Calendar size={18} color={theme.colors.primary} />
                      <Text style={styles.prefilledSlotText}>
                        Избран час: {new Date(selectedSlot.date).toLocaleDateString('bg-BG')} от {selectedSlot.time} до {selectedSlot.endTime}
                      </Text>
                    </View>
                  )}
                  {selectedSlot && !selectedSlot.endTime && (
                    <View style={styles.prefilledSlotInfo}>
                      <Calendar size={18} color={theme.colors.primary} />
                      <Text style={styles.prefilledSlotText}>
                        Избран час: {new Date(selectedSlot.date).toLocaleDateString('bg-BG')} в {selectedSlot.time}
                      </Text>
                    </View>
                  )}
                  {getFilteredServices().map((service) => (
                    <TouchableOpacity
                      key={service.id}
                      style={styles.serviceCard}
                      onPress={() => handleServiceSelect(service)}
                    >
                      <View style={styles.serviceInfo}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        <Text style={styles.serviceDetails}>
                          {service.duration_minutes} мин • {service.price} лв
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.formButton, styles.cancelButton]}
                    onPress={() => {
                      setShowBookingForm(false);
                      setSelectedSlot(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Отказ</Text>
                  </TouchableOpacity>
                </View>
              ) : loadingSlots ? (
                <View style={styles.loadingSlots}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Търсене на свободни часове...</Text>
                </View>
              ) : !selectedSlot && availableSlots.length === 0 ? (
                <View>
                  <Text style={styles.noSlotsText}>
                    Няма налични свободни часове за тази услуга
                  </Text>
                  <TouchableOpacity
                    style={[styles.formButton, styles.cancelButton]}
                    onPress={() => {
                      setSelectedService(null);
                      setShowBookingForm(false);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Назад</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.selectedServiceText}>
                    {selectedService.name} • {selectedService.duration_minutes} мин
                  </Text>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.scheduleViewButton}
                      onPress={() => setShowScheduleView(true)}
                    >
                      <Calendar size={18} color={theme.colors.surface} />
                      <Text style={styles.scheduleViewButtonText}>
                        Виж графика
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.nextSlotsButton}
                      onPress={showNext10Slots}
                      disabled={loadingSlots}
                    >
                      <Text style={styles.nextSlotsButtonText}>
                        Следващи 10 часа
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {selectedSlot && selectedService && (
                    <>
                      <Text style={styles.label}>Избран час</Text>
                      <View style={styles.selectedSlotCard}>
                        <Calendar size={20} color={theme.colors.primary} />
                        <Text style={styles.slotText}>
                          {new Date(selectedSlot.date).toLocaleDateString('bg-BG')} от{' '}
                          {selectedSlot.time} до {calculateEndTime(selectedSlot.time, selectedService.duration_minutes)}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>
                      {selectedService?.name === 'Други' ? 'Опишете желаната услуга (задължително)' : 'Съобщение (опционално)'}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder={selectedService?.name === 'Други' ? 'Моля, опишете каква услуга желаете...' : 'Специални пожелания...'}
                      placeholderTextColor={theme.colors.textMuted}
                      value={message}
                      onChangeText={setMessage}
                      onFocus={() => {
                        // Wait for keyboard to show, then scroll
                        setTimeout(() => {
                          scrollToShowButtons();
                        }, 400);
                      }}
                      onContentSizeChange={() => {
                        // When text area expands, maintain scroll position to keep buttons visible
                        scrollToShowButtons();
                      }}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View ref={formButtonsRef} style={styles.formButtons} collapsable={false}>
                    <TouchableOpacity
                      style={[styles.formButton, styles.cancelButton]}
                      onPress={() => {
                        setSelectedService(null);
                        setSelectedSlot(null);
                        setMessage('');
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Назад</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.formButton}
                      onPress={() => {
                        submitBookingRequest();
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={theme.gradients.primary}
                        style={styles.submitButtonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Send size={18} color={theme.colors.surface} />
                        <Text style={styles.submitButtonText}>Изпрати</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.appointmentsList}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Заявки</Text>
              {rejectedRequests.length > 0 && (
                <TouchableOpacity
                  style={styles.clearRejectedButton}
                  onPress={handleClearAllRejected}
                >
                  <Text style={styles.clearRejectedText}>Изчисти всички отхвърлени</Text>
                </TouchableOpacity>
              )}
            </View>
            {requests.length === 0 ? (
              <Text style={styles.emptyText}>Няма заявки</Text>
            ) : (
              requests.map((request) => (
                <View key={request.id} style={styles.appointmentCard}>
                  <View style={styles.appointmentHeader}>
                    <Text style={styles.serviceName}>{request.services.name}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(request.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {getStatusText(request.status)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.dateInfo}>
                    <Calendar size={18} color={theme.colors.textLight} />
                    <Text style={styles.dateText}>
                      {new Date(request.requested_date).toLocaleDateString('bg-BG')} в{' '}
                      {request.requested_time.slice(0, 5)}
                    </Text>
                  </View>
                  {request.client_message && (
                    <Text style={styles.clientMessage}>{request.client_message}</Text>
                  )}
                  {request.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.cancelRequestButton}
                      onPress={() => handleCancelRequest(request.id)}
                    >
                      <X size={16} color={theme.colors.surface} />
                      <Text style={styles.cancelRequestButtonText}>Отмени заявка</Text>
                    </TouchableOpacity>
                  )}
                  {request.status === 'rejected' && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDeleteRequest(request.id)}
                    >
                      <X size={16} color={theme.colors.surface} />
                      <Text style={styles.deleteButtonText}>Изтрий</Text>
                    </TouchableOpacity>
                  )}
                  {request.status === 'changed' && request.suggested_date && request.suggested_start_time && request.suggested_end_time && (
                    <TouchableOpacity
                      style={styles.suggestTimeBadgeButton}
                      onPress={async () => {
                        // Отваряме модала
                        setTimeSuggestionData({
                          request_id: request.id,
                          suggested_date: request.suggested_date,
                          suggested_start_time: request.suggested_start_time,
                          suggested_end_time: request.suggested_end_time,
                          service_id: request.service_id,
                          service_name: request.services?.name || '',
                        });
                        setShowTimeSuggestionModal(true);

                        // Маркираме уведомлението като прочетено
                        await supabase
                          .from('notifications')
                          .update({ is_read: true })
                          .eq('user_id', user?.id)
                          .eq('type', 'time_suggestion')
                          .contains('data', { request_id: request.id });
                      }}
                    >
                      <Clock size={16} color={theme.colors.surface} />
                      <Text style={styles.suggestTimeBadgeText}>Предложен друг час</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showNextSlotsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNextSlotsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Следващи 10 свободни часа</Text>
              <TouchableOpacity onPress={() => setShowNextSlotsModal(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {nextSlots.map((slot, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.slotOption}
                  onPress={() => {
                    setSelectedSlot(slot);
                    setShowNextSlotsModal(false);
                  }}
                >
                  <Calendar size={18} color={theme.colors.primary} />
                  <Text style={styles.slotOptionText}>
                    {new Date(slot.date).toLocaleDateString('bg-BG')} в {slot.time}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {selectedService && (
        <ScheduleViewModal
          visible={showScheduleView}
          onClose={() => setShowScheduleView(false)}
          onSelectSlot={handleScheduleSlotSelect}
          serviceDuration={selectedService.duration_minutes}
        />
      )}

      <TimeSuggestionModal
        visible={showTimeSuggestionModal}
        onClose={() => {
          setShowTimeSuggestionModal(false);
          setTimeSuggestionData(null);
          // Презареждаме данните за да видим че заявката е изтрита
          loadData();
        }}
        suggestionData={timeSuggestionData}
      />

      {/* Cancel Request Modal */}
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
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowCancelModal(false);
              setCancelReason('');
            }}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.cancelModalContent}>
                <View style={styles.cancelModalHeader}>
                  <Text style={styles.cancelModalTitle}>Отмяна на заявка</Text>
                  <TouchableOpacity onPress={() => {
                    setShowCancelModal(false);
                    setCancelReason('');
                  }}>
                    <X size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.cancelModalSubtitle}>
                  Причината за отмяна е опционална. Ако желаете, можете да споделите защо отменяте заявката:
                </Text>

                <TextInput
                  style={styles.cancelReasonInput}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder="Причина (опционално)..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={styles.confirmCancelButton}
                  onPress={confirmCancelRequest}
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
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
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
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
  },
  notificationButton: {
    padding: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingTop: theme.spacing.lg,
  },
  newBookingButton: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  newBookingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  newBookingText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
  },
  bookingForm: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  formTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  serviceCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  serviceDetails: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    marginTop: theme.spacing.xs,
  },
  loadingSlots: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  noSlotsText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textLight,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  selectedServiceText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  scheduleViewButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  scheduleViewButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  nextSlotsButton: {
    flex: 1,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextSlotsButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  selectedSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  slotText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  formButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  submitButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  appointmentsList: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  clearRejectedButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  clearRejectedText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  cancelRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  cancelRequestButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  deleteButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  suggestTimeBadgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: '#FFB800',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  suggestTimeBadgeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  appointmentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  dateText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  timeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  clientMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  slotOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  slotOptionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  prefilledSlotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  prefilledSlotText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  cancelModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
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
