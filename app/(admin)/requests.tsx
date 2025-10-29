import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckSquare, XSquare, Calendar, Clock, ChevronDown } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalSearchParams } from 'expo-router';
import NotificationsModal from '@/components/NotificationsModal';
import NotificationBadge from '@/components/NotificationBadge';
import ScheduleDatePicker from '@/components/ScheduleDatePicker';
import FreeTimeSlotsModal from '@/components/FreeTimeSlotsModal';

type AppointmentRequest = {
  id: string;
  client_id: string;
  service_id: string;
  requested_date: string;
  requested_time: string;
  client_message: string;
  status: string;
  created_at: string;
  suggested_date?: string | null;
  suggested_start_time?: string | null;
  suggested_end_time?: string | null;
  profiles: {
    full_name: string;
    phone: string;
  };
  services: {
    name: string;
    duration_minutes: number;
  };
};

type ConflictingAppointment = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  profiles?: {
    full_name: string;
    phone: string;
  };
  unregistered_clients?: {
    full_name: string;
    phone: string;
  };
  services: {
    name: string;
  };
};

export default function RequestsScreen() {
  console.log('🟢 ADMIN REQUESTS: Component loaded - NEW VERSION with real-time');
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const requestsListRef = useRef<FlatList>(null);
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AppointmentRequest | null>(null);
  const [conflictingAppointment, setConflictingAppointment] = useState<ConflictingAppointment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [conflictReason, setConflictReason] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
  const [showFreeTimeSlotsModal, setShowFreeTimeSlotsModal] = useState(false);
  const [suggestedDate, setSuggestedDate] = useState<Date | null>(null);
  const [suggestedWorkingHours, setSuggestedWorkingHours] = useState<any>(null);
  const [showSuggestFormModal, setShowSuggestFormModal] = useState(false);
  const [suggestedStartTime, setSuggestedStartTime] = useState<string>('');
  const [suggestedEndTime, setSuggestedEndTime] = useState<string>('');
  const [suggestedSlotEnd, setSuggestedSlotEnd] = useState<string>(''); // Крайният час на избрания слот
  const [suggestedStartTimeOptions, setSuggestedStartTimeOptions] = useState<string[]>([]);
  const [suggestedEndTimeOptions, setSuggestedEndTimeOptions] = useState<string[]>([]);
  const [showSuggestedStartTimePicker, setShowSuggestedStartTimePicker] = useState(false);
  const [showSuggestedEndTimePicker, setShowSuggestedEndTimePicker] = useState(false);

  useEffect(() => {
    loadRequests();

    // Real-time subscription for appointment requests
    const requestsChannel = supabase
      .channel('appointment_requests_changes')
      .on('system', { event: '*' }, (payload) => {
        console.log('Admin Requests: System event:', payload);
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_requests',
        },
        (payload) => {
          console.log("🔴 ADMIN REQUESTS REAL-TIME EVENT:", payload.eventType, payload.new);
          console.log('Appointment request change:', payload);
          loadRequests();
        }
      )
      .subscribe((status) => {
        console.log('🟢 Admin Requests: Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(requestsChannel);
    };
  }, []);

  // Handle navigation from notifications
  useEffect(() => {
    if (params.highlightRequestId) {
      setHighlightRequestId(params.highlightRequestId as string);
      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightRequestId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [params.highlightRequestId]);

  // Scroll to highlighted request
  useEffect(() => {
    if (highlightRequestId && requests.length > 0) {
      const index = requests.findIndex(r => r.id === highlightRequestId);
      if (index !== -1) {
        setTimeout(() => {
          requestsListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5
          });
        }, 500);
      }
    }
  }, [highlightRequestId, requests]);

  const loadRequests = async () => {
    console.log('📋 loadRequests() STARTED...');
    try {
      setLoading(true);
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
          suggested_date,
          suggested_start_time::text,
          suggested_end_time::text,
          profiles(full_name, phone),
          services(name, duration_minutes)
        `)
        .in('status', ['pending', 'rejected', 'changed'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('📋 loadRequests() - Fetched data:', data?.length, 'requests');
      if (data && data.length > 0) {
        console.log('📋 All request statuses:', data.map(r => ({ id: r.id, status: r.status })));
      }

      setRequests((data || []) as any);
      console.log('📋 loadRequests() COMPLETED - State updated!');
    } catch (err) {
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (request: AppointmentRequest) => {
    try {
      console.log('🔍 Checking for conflicts before approving request...');
      console.log('Request details:', {
        date: request.requested_date,
        time: request.requested_time,
        duration: request.services.duration_minutes,
        service: request.services.name
      });

      // Check for conflicts FIRST before doing anything
      const endTime = calculateEndTime(
        request.requested_time,
        request.services.duration_minutes
      );

      const timeToMinutes = (timeStr: string): number => {
        const [hours, minutes] = timeStr.substring(0, 5).split(':').map(Number);
        return hours * 60 + minutes;
      };

      const requestStartMinutes = timeToMinutes(request.requested_time);
      const requestEndMinutes = timeToMinutes(endTime);

      console.log('Request time range:', {
        startMinutes: requestStartMinutes,
        endMinutes: requestEndMinutes,
        startTime: request.requested_time,
        endTime: endTime
      });

      // Query for conflicting appointments with full details
      const { data: conflictingAppointments, error: conflictError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time::text,
          end_time::text,
          profiles(full_name, phone),
          unregistered_clients(full_name, phone),
          services(name)
        `)
        .eq('appointment_date', request.requested_date)
        .neq('status', 'cancelled');

      if (conflictError) {
        console.error('❌ Error querying appointments:', conflictError);
        throw conflictError;
      }

      console.log('Found existing appointments:', conflictingAppointments?.length || 0);
      if (conflictingAppointments && conflictingAppointments.length > 0) {
        console.log('Existing appointments:', conflictingAppointments);
      }

      // Check if any appointment overlaps
      const hasConflict = (conflictingAppointments || []).some((apt) => {
        const aptStartMinutes = timeToMinutes(apt.start_time);
        const aptEndMinutes = timeToMinutes(apt.end_time);

        // Check for any overlap
        const overlaps = (
          (requestStartMinutes >= aptStartMinutes && requestStartMinutes < aptEndMinutes) ||
          (requestEndMinutes > aptStartMinutes && requestEndMinutes <= aptEndMinutes) ||
          (requestStartMinutes <= aptStartMinutes && requestEndMinutes >= aptEndMinutes)
        );

        if (overlaps) {
          console.log('⚠️ CONFLICT DETECTED with appointment:', {
            aptStart: apt.start_time,
            aptEnd: apt.end_time,
            aptStartMinutes,
            aptEndMinutes
          });
        }

        return overlaps;
      });

      if (hasConflict) {
        console.log('❌ Conflict found! Showing conflict modal...');

        // Find the specific conflicting appointment
        const conflictingApt = (conflictingAppointments || []).find((apt) => {
          const aptStartMinutes = timeToMinutes(apt.start_time);
          const aptEndMinutes = timeToMinutes(apt.end_time);
          return (
            (requestStartMinutes >= aptStartMinutes && requestStartMinutes < aptEndMinutes) ||
            (requestEndMinutes > aptStartMinutes && requestEndMinutes <= aptEndMinutes) ||
            (requestStartMinutes <= aptStartMinutes && requestEndMinutes >= aptEndMinutes)
          );
        });

        // Show conflict modal - DO NOT approve!
        setSelectedRequest(request);
        setConflictingAppointment((conflictingApt || null) as any);
        setShowConflictModal(true);
        return; // STOP HERE - do not proceed with approval
      }

      console.log('✅ No conflicts found. Proceeding with approval...');
      // No conflict, proceed with approval
      await approveRequestAndCreateAppointment(request);
    } catch (err) {
      console.error('❌ Error in handleApproveRequest:', err);
      Alert.alert('Грешка', 'Неуспешно одобряване на заявката');
    }
  };

  const approveRequestAndCreateAppointment = async (request: AppointmentRequest) => {
    try {
      const endTime = calculateEndTime(
        request.requested_time,
        request.services.duration_minutes
      );

      const { error: appointmentError } = await supabase.from('appointments').insert({
        client_id: request.client_id,
        service_id: request.service_id,
        appointment_date: request.requested_date,
        start_time: request.requested_time,
        end_time: endTime,
        status: 'confirmed',
      });

      if (appointmentError) throw appointmentError;

      const { error: updateError } = await supabase
        .from('appointment_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Note: Notification is created automatically by database trigger when appointment is inserted

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('type', 'new_booking_request')
        .contains('data', { request_id: request.id });

      loadRequests();
      Alert.alert('Успех', 'Заявката е одобрена и резервацията е създадена');
    } catch (err) {
      console.error('Error approving request:', err);
      Alert.alert('Грешка', 'Неуспешно одобряване на заявката');
    }
  };

  const handleSuggestTime = (request: AppointmentRequest) => {
    setSelectedRequest(request);
    setSuggestedDate(null);
    setSuggestedStartTime('');
    setSuggestedEndTime('');
    setShowScheduleDatePicker(true);
  };

  const handleDateSelectForSuggestion = async (date: Date) => {
    // Нормализираме датата
    const normalizedDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    setSuggestedDate(normalizedDate);

    // Зареждаме работното време за избраната дата
    await loadWorkingHoursForSuggestion(normalizedDate);

    // Отваряме модала със слотове
    setShowFreeTimeSlotsModal(true);
  };

  const loadWorkingHoursForSuggestion = async (date: Date) => {
    try {
      const { data, error } = await supabase
        .from('salon_info')
        .select('working_hours_json')
        .maybeSingle();

      if (error) throw error;

      if (data?.working_hours_json) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = dayNames[date.getDay()];
        const dayHours = data.working_hours_json[dayOfWeek];

        if (dayHours) {
          setSuggestedWorkingHours({
            start: dayHours.start || '09:00',
            end: dayHours.end || '18:00',
            closed: dayHours.closed || false,
          });
        }
      }
    } catch (error) {
      console.error('Error loading working hours for suggestion:', error);
    }
  };


  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleSelectSlot = (slotStart: string, slotEnd: string) => {
    if (!selectedRequest) return;

    // Помощна функция за добавяне на минути към час
    const addMinutes = (timeStr: string, mins: number) => {
      const [h, m] = timeStr.split(':').map(Number);
      const total = h * 60 + m + mins;
      const nh = Math.floor(total / 60);
      const nm = total % 60;
      return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
    };

    // Запазваме крайния час на избрания слот
    setSuggestedSlotEnd(slotEnd);

    // Генерираме опции за начален час от началото до края - продължителност
    const startOptions: string[] = [];
    const slotStartMinutes = timeToMinutes(slotStart);
    const slotEndMinutes = timeToMinutes(slotEnd);
    const serviceDuration = selectedRequest.services.duration_minutes;

    for (let mins = slotStartMinutes; mins + serviceDuration <= slotEndMinutes; mins += 30) {
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;
      startOptions.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }

    setSuggestedStartTimeOptions(startOptions);
    setSuggestedStartTime(startOptions[0] || slotStart);

    // Генерираме опции за краен час - започваме от +30 мин след началния час до края на слота
    const firstStartMinutes = timeToMinutes(startOptions[0] || slotStart);
    const endOptions: string[] = [];
    for (let mins = firstStartMinutes + 30; mins <= slotEndMinutes; mins += 30) {
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;
      endOptions.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    }

    setSuggestedEndTimeOptions(endOptions);

    // Автоматично задаваме крайния час на базата на продължителността на услугата
    const autoEndTime = addMinutes(startOptions[0] || slotStart, serviceDuration);
    setSuggestedEndTime(autoEndTime);

    setShowSuggestFormModal(true);
  };

  const handleSuggestedStartTimeChange = (newStartTime: string) => {
    setSuggestedStartTime(newStartTime);

    // Актуализираме опциите за краен час - започваме от +30 мин след началния час до края на слота
    if (selectedRequest && suggestedSlotEnd) {
      const startMinutes = timeToMinutes(newStartTime);
      const slotEndMinutes = timeToMinutes(suggestedSlotEnd);

      const endOptions: string[] = [];
      for (let mins = startMinutes + 30; mins <= slotEndMinutes; mins += 30) {
        const hour = Math.floor(mins / 60);
        const minute = mins % 60;
        endOptions.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
      setSuggestedEndTimeOptions(endOptions);

      // Автоматично задаваме крайния час на базата на продължителността на услугата
      const autoEndMinutes = startMinutes + selectedRequest.services.duration_minutes;
      const autoEndTime = `${Math.floor(autoEndMinutes / 60).toString().padStart(2, '0')}:${(autoEndMinutes % 60).toString().padStart(2, '0')}`;

      // Проверяваме дали автоматичният краен час е в рамките на слота
      if (autoEndMinutes <= slotEndMinutes) {
        setSuggestedEndTime(autoEndTime);
      } else if (endOptions.length > 0) {
        // Ако не е в рамките, задаваме последната възможна опция
        setSuggestedEndTime(endOptions[endOptions.length - 1]);
      }
    }
  };

  const confirmSuggestTime = async () => {
    if (!selectedRequest || !suggestedDate || !suggestedStartTime || !suggestedEndTime) {
      Alert.alert('Грешка', 'Моля, изберете дата и часове');
      return;
    }

    try {
      // Форматираме датата правилно без да използваме toISOString (за да избегнем timezone проблеми)
      const year = suggestedDate.getFullYear();
      const month = String(suggestedDate.getMonth() + 1).padStart(2, '0');
      const day = String(suggestedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const notificationBody = `${selectedRequest.services.name} на ${suggestedDate.toLocaleDateString('bg-BG')} от ${suggestedStartTime} до ${suggestedEndTime}`;

      // Актуализираме статуса на заявката на 'changed'
      console.log('🔄 UPDATING request status to "changed"...');
      console.log('📝 Request ID:', selectedRequest.id);
      console.log('📝 Current status:', selectedRequest.status);
      console.log('📝 Update data:', {
        status: 'changed',
        suggested_date: dateStr,
        suggested_start_time: suggestedStartTime,
        suggested_end_time: suggestedEndTime,
      });

      const { data: updateData, error: updateError } = await supabase
        .from('appointment_requests')
        .update({
          status: 'changed',
          suggested_date: dateStr,
          suggested_start_time: suggestedStartTime,
          suggested_end_time: suggestedEndTime,
        })
        .eq('id', selectedRequest.id)
        .select();

      if (updateError) {
        console.error('❌ UPDATE ERROR:', updateError);
        throw updateError;
      }

      console.log('✅ UPDATE SUCCESSFUL! Response:', updateData);
      if (updateData && updateData.length > 0) {
        console.log('✅ NEW STATUS:', updateData[0].status);
        console.log('✅ Full updated record:', JSON.stringify(updateData[0], null, 2));
      }

      // Reload requests to refresh UI
      console.log('🔄 Reloading requests to refresh UI...');
      await loadRequests();
      console.log('✅ Requests reloaded!');

      // Send notification to client
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: selectedRequest.client_id,
        type: 'time_suggestion',
        title: 'Предложен алтернативен час',
        body: notificationBody,
        data: {
          request_id: selectedRequest.id,
          suggested_date: dateStr,
          suggested_start_time: suggestedStartTime,
          suggested_end_time: suggestedEndTime,
          service_id: selectedRequest.service_id,
          service_name: selectedRequest.services.name,
        }
      });

      if (notifError) throw notifError;

      setShowSuggestFormModal(false);
      setSuggestedDate(null);
      setSuggestedStartTime('');
      setSuggestedEndTime('');
      setSelectedRequest(null);

      Alert.alert('Успех', 'Предложението е изпратено до клиента');
    } catch (err) {
      console.error('Error sending time suggestion:', err);
      Alert.alert('Грешка', 'Неуспешно изпращане на предложението');
    }
  };

  const handleRejectRequest = (request: AppointmentRequest) => {
    setSelectedRequest(request);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmRejectRequest = async () => {
    if (!selectedRequest) return;

    try {
      const { error: updateError } = await supabase
        .from('appointment_requests')
        .update({ status: 'rejected' })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      let notificationBody = `${selectedRequest.services.name} на ${new Date(selectedRequest.requested_date).toLocaleDateString('bg-BG')} в ${selectedRequest.requested_time.slice(0, 5)}`;

      if (rejectReason.trim()) {
        notificationBody += `\n\nПричина: ${rejectReason}`;
      }

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: selectedRequest.client_id,
        type: 'booking_rejected',
        title: 'Заявката е отхвърлена',
        body: notificationBody,
      });

      if (notifError) console.error('Notification error:', notifError);

      setShowRejectModal(false);
      setRejectReason('');
      setSelectedRequest(null);
      loadRequests();
      Alert.alert('Успех', 'Заявката е отхвърлена и клиентът е уведомен');
    } catch (err) {
      console.error('Error rejecting request:', err);
      Alert.alert('Грешка', 'Неуспешно отхвърляне на заявката');
    }
  };

  const confirmConflictReject = async () => {
    if (!selectedRequest) return;

    try {
      const { error: updateError } = await supabase
        .from('appointment_requests')
        .update({ status: 'rejected' })
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      let notificationBody = `${selectedRequest.services.name} на ${new Date(selectedRequest.requested_date).toLocaleDateString('bg-BG')} в ${selectedRequest.requested_time.slice(0, 5)} - За дата и часа вече има създадена резервация`;

      if (conflictReason.trim()) {
        notificationBody += `\n\n${conflictReason}`;
      }

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: selectedRequest.client_id,
        type: 'booking_rejected',
        title: 'Заявката е отхвърлена',
        body: notificationBody,
      });

      if (notifError) console.error('Notification error:', notifError);

      setShowConflictModal(false);
      setConflictReason('');
      setSelectedRequest(null);
      loadRequests();
      Alert.alert('Успех', 'Заявката е отхвърлена поради конфликт');
    } catch (err) {
      console.error('Error rejecting conflicted request:', err);
      Alert.alert('Грешка', 'Неуспешно отхвърляне на заявката');
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('appointment_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      loadRequests();
      Alert.alert('Успех', 'Заявката е изтрита');
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
              const { error } = await supabase
                .from('appointment_requests')
                .delete()
                .eq('status', 'rejected');

              if (error) throw error;

              loadRequests();
              Alert.alert('Успех', 'Всички отхвърлени заявки са изтрити');
            }
          }
        ]
      );
    } catch (err) {
      console.error('Error clearing rejected requests:', err);
      Alert.alert('Грешка', 'Неуспешно изтриване на заявките');
    }
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    // Handle both "HH:MM" and "HH:MM:SS" formats
    const timeParts = startTime.substring(0, 5).split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) {
      console.error('Invalid time format:', startTime);
      return '00:00';
    }

    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const renderRequest = ({ item }: { item: AppointmentRequest }) => {
    const isHighlighted = highlightRequestId === item.id;
    return (
      <View style={[styles.requestCard, isHighlighted && styles.requestCardHighlighted]}>
        <View style={styles.requestHeader}>
          <Text style={styles.requestClientName}>{item.profiles.full_name}</Text>
          <View style={[
            styles.requestStatusBadge,
            {
              backgroundColor:
                item.status === 'pending' ? theme.colors.warning :
                item.status === 'approved' ? theme.colors.success :
                item.status === 'changed' ? theme.colors.warning :
                theme.colors.error
            }
          ]}>
            <Text style={styles.requestStatusText}>
              {item.status === 'pending' ? 'В очакване' :
               item.status === 'approved' ? 'Одобрена' :
               item.status === 'changed' ? 'Предложен друг час' :
               'Отхвърлена'}
            </Text>
          </View>
        </View>

        <View style={styles.requestDetails}>
          <View style={styles.requestDetailRow}>
            <Calendar size={16} color={theme.colors.textMuted} />
            <Text style={styles.requestDetailText}>
              {new Date(item.requested_date + 'T00:00:00').toLocaleDateString('bg-BG', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </Text>
          </View>

          <View style={styles.requestDetailRow}>
            <Clock size={16} color={theme.colors.textMuted} />
            <Text style={styles.requestDetailText}>{item.requested_time.slice(0, 5)}</Text>
          </View>

          <Text style={styles.requestServiceName}>{item.services.name}</Text>

          {item.client_message && (
            <View style={styles.requestMessage}>
              <Text style={styles.requestMessageLabel}>Съобщение:</Text>
              <Text style={styles.requestMessageText}>{item.client_message}</Text>
            </View>
          )}
        </View>

        {item.status === 'pending' && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.requestActionButton, styles.suggestButton]}
              onPress={() => handleSuggestTime(item)}
            >
              <Clock size={18} color={theme.colors.surface} />
              <Text style={styles.requestActionButtonText}>Предложи друг час</Text>
            </TouchableOpacity>

            <View style={styles.requestActionsRow}>
              <TouchableOpacity
                style={[styles.requestActionButton, styles.approveButton]}
                onPress={() => handleApproveRequest(item)}
              >
                <CheckSquare size={18} color={theme.colors.surface} />
                <Text style={styles.requestActionButtonText}>Одобри</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.requestActionButton, styles.rejectButton]}
                onPress={() => handleRejectRequest(item)}
              >
                <XSquare size={18} color={theme.colors.surface} />
                <Text style={styles.requestActionButtonText}>Откажи</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {item.status === 'rejected' && (
          <View style={styles.requestActions}>
            <TouchableOpacity
              style={[styles.requestActionButton, styles.deleteButton]}
              onPress={() => handleDeleteRequest(item.id)}
            >
              <XSquare size={18} color={theme.colors.surface} />
              <Text style={styles.requestActionButtonText}>Изтрий</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'changed' && item.suggested_date && item.suggested_start_time && item.suggested_end_time && (
          <View style={styles.requestStatusContainer}>
            <View style={styles.timeSuggestedBadge}>
              <Clock size={18} color={theme.colors.warning} />
              <Text style={styles.timeSuggestedText}>Предложен друг час</Text>
            </View>
            <View style={styles.suggestedTimeInfo}>
              <Text style={styles.suggestedTimeLabel}>Предложено време:</Text>
              <Text style={styles.suggestedTimeValue}>
                {new Date(item.suggested_date + 'T00:00:00').toLocaleDateString('bg-BG')} от {item.suggested_start_time.substring(0, 5)} до {item.suggested_end_time.substring(0, 5)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradients.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Заявки за часове</Text>
            <Text style={styles.headerSubtitle}>
              {pendingRequests.length} в очакване
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

        {requests.some(r => r.status === 'rejected') && (
          <View style={styles.clearRejectedContainer}>
            <TouchableOpacity
              style={styles.clearRejectedButton}
              onPress={handleClearAllRejected}
            >
              <Text style={styles.clearRejectedText}>Изчисти всички отхвърлени</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Зареждане...</Text>
          </View>
        ) : (
          <FlatList
            ref={requestsListRef}
            data={requests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Няма заявки за часове</Text>
              </View>
            }
            refreshing={loading}
            onRefresh={loadRequests}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise(resolve => setTimeout(resolve, 500));
              wait.then(() => {
                requestsListRef.current?.scrollToIndex({ index: info.index, animated: true });
              });
            }}
          />
        )}

        {/* Reject Request Modal */}
        <Modal
          visible={showRejectModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRejectModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.actionModalContent}>
                <Text style={styles.modalTitle}>Отхвърляне на заявка</Text>
                {selectedRequest && (
                  <Text style={styles.modalSubtitle}>
                    {selectedRequest.profiles.full_name} - {selectedRequest.services.name}
                    {'\n'}
                    {new Date(selectedRequest.requested_date).toLocaleDateString('bg-BG')} в {selectedRequest.requested_time.slice(0, 5)}
                  </Text>
                )}

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Причина (опционално):</Text>
                  <TextInput
                    style={[styles.timeTextInput, { height: 80, textAlignVertical: 'top' }]}
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    placeholder="Въведете причина за отхвърлянето..."
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <TouchableOpacity
                  style={styles.rejectConfirmButton}
                  onPress={confirmRejectRequest}
                >
                  <Text style={styles.rejectConfirmText}>Отхвърли заявката</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Назад</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Conflict Modal */}
        <Modal
          visible={showConflictModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConflictModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.actionModalContent}>
              <Text style={styles.modalTitle}>Конфликт на резервация</Text>
              {selectedRequest && (
                <>
                  <Text style={styles.modalSubtitle}>
                    За {new Date(selectedRequest.requested_date + 'T00:00:00').toLocaleDateString('bg-BG')} в {selectedRequest.requested_time.slice(0, 5)} вече има резервация.
                    {'\n\n'}
                    Искате ли да предложите друг час?
                  </Text>
                </>
              )}

              <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
                <TouchableOpacity
                  style={[styles.requestActionButton, styles.rejectButton, { flex: 1 }]}
                  onPress={() => {
                    // НЕ - отхвърли заявката
                    setShowConflictModal(false);
                    setConflictingAppointment(null);
                    // Отвори модала за отхвърляне
                    if (selectedRequest) {
                      handleRejectRequest(selectedRequest);
                    }
                  }}
                >
                  <Text style={styles.requestActionButtonText}>НЕ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.requestActionButton, styles.suggestButton, { flex: 1 }]}
                  onPress={() => {
                    // ДА - предложи друг час
                    setShowConflictModal(false);
                    setConflictingAppointment(null);
                    // Отвори модала за предложение на друг час
                    if (selectedRequest) {
                      handleSuggestTime(selectedRequest);
                    }
                  }}
                >
                  <Text style={styles.requestActionButtonText}>ДА</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.cancelButton, { marginTop: theme.spacing.md }]}
                onPress={() => {
                  setShowConflictModal(false);
                  setConflictReason('');
                  setConflictingAppointment(null);
                  setSelectedRequest(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Отказ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Schedule Date Picker */}
        <ScheduleDatePicker
          visible={showScheduleDatePicker}
          onClose={() => setShowScheduleDatePicker(false)}
          onSelectDate={handleDateSelectForSuggestion}
          workingHours={{ start: '09:00', end: '18:00', closed: false }}
          excludeAppointmentId={undefined}
          serviceDuration={selectedRequest?.services.duration_minutes || 30}
        />

        {/* Free Time Slots Modal */}
        {suggestedDate && suggestedWorkingHours && (
          <FreeTimeSlotsModal
            visible={showFreeTimeSlotsModal}
            onClose={() => setShowFreeTimeSlotsModal(false)}
            selectedDate={suggestedDate}
            workingHours={suggestedWorkingHours}
            onSelectSlot={(slotStart, slotEnd) => {
              handleSelectSlot(slotStart, slotEnd);
              setShowFreeTimeSlotsModal(false);
            }}
            excludeAppointmentId={undefined}
          />
        )}

        {/* Suggest Time Form Modal */}
        <Modal
          visible={showSuggestFormModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSuggestFormModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.suggestFormModalContent}>
              <Text style={styles.modalTitle}>Предложи друг час</Text>
              {selectedRequest && (
                <View style={styles.modalInfoSection}>
                  <Text style={styles.modalInfoText}>
                    Клиент: {selectedRequest.profiles.full_name}
                  </Text>
                  <Text style={styles.modalInfoText}>
                    Услуга: {selectedRequest.services.name}
                  </Text>
                  <Text style={styles.modalInfoText}>
                    Времетраене: {selectedRequest.services.duration_minutes} минути
                  </Text>
                </View>
              )}

              <ScrollView style={styles.suggestFormScrollView}>
                {/* Date Display */}
                <View style={styles.formField}>
                  <Text style={styles.inputLabel}>Дата:</Text>
                  <View style={styles.dateDisplayBox}>
                    <Calendar size={18} color={theme.colors.primary} />
                    <Text style={styles.dateDisplayText}>
                      {suggestedDate?.toLocaleDateString('bg-BG')}
                    </Text>
                  </View>
                </View>

                {/* Start Time Dropdown */}
                <View style={styles.formField}>
                  <Text style={styles.inputLabel}>Начален час:</Text>
                  <TouchableOpacity
                    style={styles.timeDropdownButton}
                    onPress={() => setShowSuggestedStartTimePicker(true)}
                  >
                    <Clock size={18} color={theme.colors.primary} />
                    <Text style={styles.dropdownButtonText}>
                      {suggestedStartTime || 'Изберете начален час'}
                    </Text>
                    <ChevronDown size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* End Time Dropdown */}
                <View style={styles.formField}>
                  <Text style={styles.inputLabel}>Краен час:</Text>
                  <TouchableOpacity
                    style={styles.timeDropdownButton}
                    onPress={() => setShowSuggestedEndTimePicker(true)}
                  >
                    <Clock size={18} color={theme.colors.primary} />
                    <Text style={styles.dropdownButtonText}>
                      {suggestedEndTime || 'Изберете краен час'}
                    </Text>
                    <ChevronDown size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Duration Info */}
                {suggestedStartTime && suggestedEndTime && (
                  <View style={styles.durationInfoBox}>
                    <Text style={styles.durationInfoText}>
                      Продължителност: {timeToMinutes(suggestedEndTime) - timeToMinutes(suggestedStartTime)} минути
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Buttons */}
              <View style={styles.suggestFormButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowSuggestFormModal(false);
                    setSuggestedDate(null);
                    setSuggestedStartTime('');
                    setSuggestedEndTime('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Откажи</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.requestActionButton, styles.suggestButton]}
                  onPress={confirmSuggestTime}
                >
                  <Text style={styles.requestActionButtonText}>Предложи</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Start Time Picker Modal */}
        <Modal
          visible={showSuggestedStartTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSuggestedStartTimePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowSuggestedStartTimePicker(false)}
          >
            <View style={styles.pickerContent}>
              <Text style={styles.pickerTitle}>Избери начален час</Text>
              <ScrollView style={styles.pickerScrollView}>
                {suggestedStartTimeOptions.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.pickerOption,
                      suggestedStartTime === time && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      handleSuggestedStartTimeChange(time);
                      setShowSuggestedStartTimePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        suggestedStartTime === time && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* End Time Picker Modal */}
        <Modal
          visible={showSuggestedEndTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSuggestedEndTimePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowSuggestedEndTimePicker(false)}
          >
            <View style={styles.pickerContent}>
              <Text style={styles.pickerTitle}>Избери краен час</Text>
              <ScrollView style={styles.pickerScrollView}>
                {suggestedEndTimeOptions.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.pickerOption,
                      suggestedEndTime === time && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      setSuggestedEndTime(time);
                      setShowSuggestedEndTimePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        suggestedEndTime === time && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
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
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.md,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  notificationButton: {
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  clearRejectedContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  clearRejectedButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  clearRejectedText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  requestCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  requestCardHighlighted: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    ...theme.shadows.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  requestClientName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  requestStatusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  requestStatusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  requestDetails: {
    marginBottom: theme.spacing.md,
  },
  requestDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  requestDetailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  requestServiceName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  requestMessage: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.sm,
  },
  requestMessageLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  requestMessageText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  requestActions: {
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  requestActionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  requestActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  suggestButton: {
    backgroundColor: '#FFB800',
  },
  approveButton: {
    backgroundColor: theme.colors.success,
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
  },
  deleteButton: {
    backgroundColor: theme.colors.error,
  },
  requestActionButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  actionModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...theme.shadows.luxury,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  timeTextInput: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rejectConfirmButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadows.md,
  },
  rejectConfirmText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  cancelButton: {
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  cancelButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  suggestFormModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '90%',
    maxHeight: '80%',
    ...theme.shadows.lg,
  },
  modalInfoSection: {
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  modalInfoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  suggestFormScrollView: {
    maxHeight: 400,
    marginBottom: theme.spacing.md,
  },
  formField: {
    marginBottom: theme.spacing.md,
  },
  dateDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateDisplayText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '600',
  },
  timeDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dropdownButtonText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  durationInfoBox: {
    backgroundColor: theme.colors.primary + '20',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  durationInfoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  suggestFormButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '80%',
    maxHeight: '60%',
    ...theme.shadows.lg,
  },
  pickerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  pickerScrollView: {
    maxHeight: 300,
  },
  pickerOption: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.cream,
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.primary,
  },
  pickerOptionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: theme.colors.surface,
    fontWeight: '600',
  },
  requestStatusContainer: {
    marginTop: theme.spacing.md,
  },
  timeSuggestedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: '#FFB800',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignSelf: 'flex-start',
  },
  timeSuggestedText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  suggestedTimeInfo: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.sm,
  },
  suggestedTimeLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  suggestedTimeValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
