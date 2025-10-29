import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Calendar, Clock, User, Send, ChevronDown, Mic } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import ScheduleDatePicker from './ScheduleDatePicker';
import FreeTimeSlotsModal from './FreeTimeSlotsModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function transliterateToCyrillic(text: string): string {
  const map: Record<string, string> = {
    'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'zh': 'ж', 'z': 'з',
    'i': 'и', 'y': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п',
    'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'f': 'ф', 'h': 'х', 'ts': 'ц', 'ch': 'ч',
    'sh': 'ш', 'sht': 'щ', 'a': 'а', 'yu': 'ю', 'ya': 'я',
    'A': 'А', 'B': 'Б', 'V': 'В', 'G': 'Г', 'D': 'Д', 'E': 'Е', 'Zh': 'Ж', 'Z': 'З',
    'I': 'И', 'Y': 'Й', 'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О', 'P': 'П',
    'R': 'Р', 'S': 'С', 'T': 'Т', 'U': 'У', 'F': 'Ф', 'H': 'Х', 'Ts': 'Ц', 'Ch': 'Ч',
    'Sh': 'Ш', 'Sht': 'Щ', 'Yu': 'Ю', 'Ya': 'Я'
  };

  let result = text;
  const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const regex = new RegExp(key, 'g');
    result = result.replace(regex, map[key]);
  }

  return result;
}

function normalizeNameForSearch(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all whitespace and special characters except + and digits
  let cleaned = phoneNumber.replace(/[\s\-()]/g, '');

  // If starts with 0, replace with +359
  if (cleaned.startsWith('0')) {
    cleaned = '+359' + cleaned.substring(1);
  }

  return cleaned;
}

function formatDateWithWeekday(date: Date): string {
  const weekday = date.toLocaleDateString('bg-BG', { weekday: 'long' });
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);

  // Capitalize first letter of weekday
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return `${capitalizedWeekday}, ${day}.${month}.${year}г.`;
}

type ReservationModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  selectedTime: string;
  onSuccess: () => void;
  workingHours: {
    start: string;
    end: string;
    closed: boolean;
  };
  appointments: Array<{
    start_time: string;
    end_time: string;
  }>;
  voiceData?: {
    customerName: string;
    phone: string;
    service: string;
    date: string;
    startTime: string;
    endTime: string;
    notes: string;
  } | null;
  editingAppointment?: any | null;
};

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
};

export default function ReservationModal({
  visible,
  onClose,
  selectedDate,
  selectedTime,
  onSuccess,
  workingHours,
  appointments,
  voiceData,
  editingAppointment,
}: ReservationModalProps) {
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const notesFieldRef = React.useRef<View>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isEditMode = !!editingAppointment;
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
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showSlotsPicker, setShowSlotsPicker] = useState(false);
  const [editDate, setEditDate] = useState(selectedDate);
  const [selectedSlotRange, setSelectedSlotRange] = useState<{ start: string; end: string } | null>(null);
  const [editWorkingHours, setEditWorkingHours] = useState(workingHours);
  const [startTimeOptions, setStartTimeOptions] = useState<string[]>([]);
  const [endTimeOptions, setEndTimeOptions] = useState<string[]>([]);
  const [startTimePlaceholder, setStartTimePlaceholder] = useState('');
  const [endTimePlaceholder, setEndTimePlaceholder] = useState('Избери краен час');

  useEffect(() => {
    if (visible) {
      if (!voiceData && !editingAppointment) {
        resetForm();
      }
      loadData();
      if (!voiceData && !editingAppointment) {
        // При нова резервация от слот
        setStartTime(selectedTime);
        setStartTimePlaceholder(selectedTime);

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
        setEndTimePlaceholder('Изберете краен час');
      }
    }
  }, [visible, selectedTime]);


  useEffect(() => {
    if (editingAppointment && visible && services.length > 0 && promotions.length > 0 && clients.length > 0) {
      applyEditingData();
    }
  }, [editingAppointment, visible, services, promotions, clients]);

  useEffect(() => {
    if (voiceData && visible && services.length > 0 && promotions.length > 0 && clients.length > 0) {
      applyVoiceData();
    }
  }, [voiceData, visible, services, promotions, clients]);

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
      // Add type field to each service so we can differentiate from promotions
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
      // Add type field to each promotion so we can differentiate from services
      const promotionsWithType = (data || []).map(p => ({ ...p, type: 'promotion' }));
      setPromotions(promotionsWithType);
    } catch (error) {
      console.error('Error loading promotions:', error);
    }
  };

  const loadClients = async () => {
    try {
      console.log('ReservationModal: Loading clients...');
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

      console.log('ReservationModal: Registered clients result:', registeredResult);
      console.log('ReservationModal: Unregistered clients result:', unregisteredResult);

      if (registeredResult.error) {
        console.error('ReservationModal: Error loading registered clients:', registeredResult.error);
        throw registeredResult.error;
      }
      if (unregisteredResult.error) {
        console.error('ReservationModal: Error loading unregistered clients:', unregisteredResult.error);
        throw unregisteredResult.error;
      }

      const allClients = [
        ...(registeredResult.data || []),
        ...(unregisteredResult.data || [])
      ];

      console.log('ReservationModal: Total clients loaded:', allClients.length, allClients);
      setClients(allClients);
    } catch (error) {
      console.error('ReservationModal: Error loading clients:', error);
    }
  };

  const applyVoiceData = () => {
    if (!voiceData) return;

    const matchedService = services.find(
      (s) => s.name.toLowerCase().includes(voiceData.service.toLowerCase()) ||
             voiceData.service.toLowerCase().includes(s.name.toLowerCase())
    );

    if (matchedService) {
      setSelectedService(matchedService);
    } else {
      Alert.alert(
        'Услуга не е намерена',
        `Услугата "${voiceData.service}" не е намерена в каталога. Моля, изберете услуга ръчно.`
      );
    }

    const transliteratedName = transliterateToCyrillic(voiceData.customerName);
    const searchNameOriginal = normalizeNameForSearch(voiceData.customerName);
    const searchNameTranslit = normalizeNameForSearch(transliteratedName);

    const matchedClient = clients.find((c) => {
      const clientName = normalizeNameForSearch(c.full_name);
      return clientName === searchNameOriginal ||
             clientName === searchNameTranslit ||
             clientName.includes(searchNameOriginal) ||
             clientName.includes(searchNameTranslit) ||
             searchNameOriginal.includes(clientName) ||
             searchNameTranslit.includes(clientName);
    });

    if (matchedClient) {
      setSelectedClient(matchedClient);
      setNewClientMode(false);
      if (voiceData.phone && voiceData.phone.trim()) {
        Alert.alert(
          'Клиент намерен',
          `Използван е съществуващ клиент: ${matchedClient.full_name}`
        );
      }
    } else {
      setNewClientMode(true);
      const finalName = /[a-zA-Z]/.test(voiceData.customerName) ? transliteratedName : voiceData.customerName;
      setNewClientName(finalName);
      setNewClientPhone(voiceData.phone || '');

      const phoneMsg = voiceData.phone && voiceData.phone.trim()
        ? ` с телефон ${voiceData.phone}`
        : '';
      Alert.alert(
        'Нов клиент',
        `Клиентът "${finalName}" не е намерен. Ще бъде създаден като нов клиент${phoneMsg}.`
      );
    }

    setStartTime(voiceData.startTime);
    setEndTime(voiceData.endTime);
  };

  const applyEditingData = () => {
    if (!editingAppointment) return;

    // Check if this is a service or promotion appointment
    if (editingAppointment.service_id) {
      const matchedService = services.find(s => s.id === editingAppointment.service_id);
      if (matchedService) {
        setSelectedService(matchedService);
      }
    } else if (editingAppointment.promotion_id) {
      const matchedPromotion = promotions.find(p => p.id === editingAppointment.promotion_id);
      if (matchedPromotion) {
        setSelectedService(matchedPromotion);
      }
    }

    if (editingAppointment.client_id) {
      const matchedClient = clients.find(c => c.id === editingAppointment.client_id);
      if (matchedClient) {
        setSelectedClient(matchedClient);
        setNewClientMode(false);
      }
    } else if (editingAppointment.unregistered_client_id) {
      const matchedClient = clients.find(c => c.id === editingAppointment.unregistered_client_id);
      if (matchedClient) {
        setSelectedClient(matchedClient);
        setNewClientMode(false);
      }
    }

    // Зареждаме оригиналната дата от резервацията
    const originalDate = new Date(editingAppointment.appointment_date + 'T00:00:00');
    setEditDate(originalDate);

    // Зареждаме оригиналните часове от резервацията
    const originalStartTime = editingAppointment.start_time.substring(0, 5);
    const originalEndTime = editingAppointment.end_time.substring(0, 5);

    setStartTime(originalStartTime);
    setEndTime(originalEndTime);
    setStartTimePlaceholder(originalStartTime);
    setEndTimePlaceholder(originalEndTime);
    setNotes(editingAppointment.notes || '');

    // Почистваме опциите за часове при първоначално зареждане
    setStartTimeOptions([]);
    setEndTimeOptions([]);
  };

  const handleDateSelect = async (date: Date) => {
    // Нормализираме датата за local timezone като използваме UTC компонентите
    const normalizedDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    console.log('ReservationModal - Received date object:', date);
    console.log('ReservationModal - Normalized date:', normalizedDate);
    console.log('ReservationModal - Date ISO string:', normalizedDate.toISOString());
    console.log('ReservationModal - Date local string:', normalizedDate.toLocaleDateString());
    setEditDate(normalizedDate);
    await loadWorkingHoursForDate(normalizedDate);
    setShowSlotsPicker(true);
  };

  const loadWorkingHoursForDate = async (date: Date) => {
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
          setEditWorkingHours({
            start: dayHours.start || '09:00',
            end: dayHours.end || '18:00',
            closed: dayHours.closed || false,
          });
        }
      }
    } catch (error) {
      console.error('Error loading working hours for date:', error);
    }
  };

  const handleSlotSelect = (slotStart: string, slotEnd: string) => {
    setSelectedSlotRange({ start: slotStart, end: slotEnd });

    // Помощни функции за манипулация на времето
    const addMinutes = (timeStr: string, mins: number) => {
      const [h, m] = timeStr.split(':').map(Number);
      const total = h * 60 + m + mins;
      const nh = Math.floor(total / 60);
      const nm = total % 60;
      return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
    };

    if (isEditMode) {
      // При редакция: генерираме опции за начален час от началото до края - 30 мин
      const startOptions: string[] = [];
      let cur = slotStart;
      const slotEndMinutes = timeToMinutes(slotEnd);
      while (timeToMinutes(cur) < slotEndMinutes - 30) {
        startOptions.push(cur);
        cur = addMinutes(cur, 30);
      }
      // Добавяме последния възможен начален час
      if (startOptions.length === 0 || timeToMinutes(startOptions[startOptions.length - 1]) < slotEndMinutes - 30) {
        startOptions.push(cur);
      }

      setStartTimeOptions(startOptions);
      setStartTimePlaceholder(slotStart);
      setStartTime('');

      // Генерираме опции за краен час от началото + 30 мин до края
      const endOptions: string[] = [];
      let endCur = addMinutes(slotStart, 30);
      while (timeToMinutes(endCur) <= slotEndMinutes) {
        endOptions.push(endCur);
        endCur = addMinutes(endCur, 30);
      }
      setEndTimeOptions(endOptions);
      setEndTime('');
      setEndTimePlaceholder('Изберете краен час');
    } else {
      // При нова резервация: заключен начален час
      setStartTime(slotStart);
      setStartTimePlaceholder(slotStart);

      // Генерираме опции за краен час от началото + 30 мин до края
      const endOptions: string[] = [];
      let cur = addMinutes(slotStart, 30);
      const slotEndMinutes = timeToMinutes(slotEnd);
      while (timeToMinutes(cur) <= slotEndMinutes) {
        endOptions.push(cur);
        cur = addMinutes(cur, 30);
      }
      setEndTimeOptions(endOptions);
      setEndTime('');
      setEndTimePlaceholder('Изберете краен час');
    }
  };



  const generateAllTimeOptions = () => {
    const times = [];
    const [startHour, startMinute] = workingHours.start.split(':').map(Number);
    const [endHour, endMinute] = workingHours.end.split(':').map(Number);

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute - 30;

    for (let totalMinutes = startTotalMinutes; totalMinutes <= endTotalMinutes; totalMinutes += 30) {
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      times.push(timeStr);
    }
    return times;
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

  const generateEndTimeOptions = () => {
    if (!startTime) return [];

    const times = [];
    const [endHour, endMinute] = workingHours.end.split(':').map(Number);
    const workingEndMinutes = endHour * 60 + endMinute;

    const startMinutes = timeToMinutes(startTime);
    const minEndMinutes = startMinutes + 30;

    const nextOccupiedSlot = findNextOccupiedSlot(startMinutes);
    const maxEndMinutes = nextOccupiedSlot !== null
      ? Math.min(nextOccupiedSlot, workingEndMinutes)
      : workingEndMinutes;

    for (let totalMinutes = minEndMinutes; totalMinutes <= maxEndMinutes; totalMinutes += 30) {
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      times.push(timeStr);
    }

    if (times.length === 0 && minEndMinutes <= workingEndMinutes) {
      times.push(`${Math.floor(minEndMinutes / 60).toString().padStart(2, '0')}:${(minEndMinutes % 60).toString().padStart(2, '0')}`);
    }

    return times;
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

  const validateTimeSlotWithWarning = (startTime: string, endTime: string): Promise<boolean> => {
    return new Promise((resolve) => {
      console.log('⏰ Validating time slot...');
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      const durationMinutes = endMinutes - startMinutes;
      console.log('Duration in minutes:', durationMinutes);
      console.log('Service duration:', selectedService?.duration_minutes);

      if (selectedService && durationMinutes !== selectedService.duration_minutes) {
        const difference = Math.abs(durationMinutes - selectedService.duration_minutes);
        console.log('⚠️ Duration mismatch! Difference:', difference);

        // SKIP THE WARNING - just continue
        console.log('✅ Continuing anyway (warning skipped)');
        resolve(true);

        // Optional: Show warning in console only
        console.warn(`Time duration (${durationMinutes} min) differs from service duration (${selectedService.duration_minutes} min) by ${difference} minutes`);
      } else {
        console.log('✅ Duration matches service');
        resolve(true);
      }
    });
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const createReservation = async () => {
    console.log('🔵 CREATE RESERVATION BUTTON CLICKED!');
    console.log('Selected service:', selectedService);
    console.log('Start time:', startTime);
    console.log('End time:', endTime);
    console.log('New client mode:', newClientMode);
    console.log('Selected client:', selectedClient);
    console.log('New client name:', newClientName);

    if (!selectedService) {
      console.log('❌ No service selected');
      Alert.alert('Грешка', 'Моля, изберете услуга');
      return;
    }

    if (!editDate && !selectedDate) {
      console.log('❌ No date selected');
      Alert.alert('Грешка', 'Моля, изберете дата');
      return;
    }

    console.log('🔍 Checking client validation...');
    console.log('  newClientMode:', newClientMode);
    console.log('  selectedClient:', selectedClient);

    if (!newClientMode && !selectedClient) {
      console.log('❌ No client selected in existing client mode');
      Alert.alert('Грешка', 'Моля, изберете клиент или създайте нов');
      return;
    }

    if (newClientMode && (!newClientName || !newClientName.trim())) {
      console.log('❌ No client name provided in new client mode');
      Alert.alert('Грешка', 'Моля, въведете име на клиент');
      return;
    }

    if (!endTime) {
      console.log('❌ No end time selected');
      Alert.alert('Грешка', 'Моля, изберете краен час');
      return;
    }

    console.log('✅ Service selected, validating times...');
    if (!validateTimes()) {
      console.log('❌ Times validation failed');
      return;
    }

    console.log('✅ Times validated, checking time slot...');
    const shouldContinue = await validateTimeSlotWithWarning(startTime, endTime);
    console.log('Time slot validation result:', shouldContinue);

    if (!shouldContinue) {
      console.log('❌ User cancelled or time slot invalid');
      return;
    }

    console.log('✅ All validations passed, proceeding...');

    let clientId = selectedClient?.id;
    let isUnregistered = false;

    if (newClientMode) {
      console.log('=== NEW CLIENT MODE ===');
      console.log('newClientName:', newClientName);
      console.log('newClientPhone:', newClientPhone);

      if (!newClientName || !newClientName.trim()) {
        console.log('ERROR: No client name provided');
        Alert.alert('Грешка', 'Моля, въведете име на клиент');
        return;
      }

      try {
        console.log('Getting authenticated user...');
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          console.log('ERROR: No authenticated user');
          throw new Error('No authenticated user');
        }

        console.log('User ID:', user.id);
        console.log('Inserting new unregistered client...');

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

        console.log('Insert result - data:', newClient);
        console.log('Insert result - error:', insertError);

        if (insertError) {
          console.error('Insert error details:', JSON.stringify(insertError, null, 2));
          throw insertError;
        }

        if (!newClient?.id) {
          console.log('ERROR: No client ID returned');
          throw new Error('No client ID returned');
        }

        console.log('Successfully created client with ID:', newClient.id);
        clientId = newClient.id;
        isUnregistered = true;
      } catch (error: any) {
        console.error('Error creating client:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        Alert.alert('Грешка', `Неуспешно създаване на клиент: ${error.message || 'Неизвестна грешка'}`);
        return;
      }
    }

    console.log('=== CHECKING CLIENT ID ===');
    console.log('clientId:', clientId);
    console.log('isUnregistered:', isUnregistered);

    if (!clientId) {
      console.log('ERROR: No clientId - showing alert');
      Alert.alert('Грешка', 'Моля, изберете или въведете клиент');
      return;
    }

    try {
      console.log('=== CREATING APPOINTMENT ===');
      setLoading(true);
      const finalDate = isEditMode ? editDate : selectedDate;
      // Use local date format to avoid timezone issues
      const localDate = new Date(
        finalDate.getFullYear(),
        finalDate.getMonth(),
        finalDate.getDate()
      );
      const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;

      console.log('Date:', dateStr);
      console.log('Start time:', startTime);
      console.log('End time:', endTime);

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      console.log('Checking for existing appointments...');
      console.log('Edit mode:', isEditMode);
      console.log('Editing appointment ID:', editingAppointment?.id);

      let query = supabase
        .from('appointments')
        .select('id, start_time, end_time, profiles!appointments_client_id_fkey(full_name), services(name)')
        .eq('appointment_date', dateStr);

      if (isEditMode && editingAppointment) {
        console.log('Excluding current appointment from overlap check:', editingAppointment.id);
        query = query.neq('id', editingAppointment.id);
      }

      const { data: existingAppointments, error: checkError } = await query;

      if (checkError) {
        console.error('Error checking appointments:', checkError);
        throw checkError;
      }

      console.log('Existing appointments:', existingAppointments);

      if (existingAppointments && existingAppointments.length > 0) {
        for (const apt of existingAppointments) {
          const aptStartMinutes = timeToMinutes(apt.start_time);
          const aptEndMinutes = timeToMinutes(apt.end_time);

          const hasOverlap =
            (startMinutes >= aptStartMinutes && startMinutes < aptEndMinutes) ||
            (endMinutes > aptStartMinutes && endMinutes <= aptEndMinutes) ||
            (startMinutes <= aptStartMinutes && endMinutes >= aptEndMinutes);

          if (hasOverlap) {
            console.log('OVERLAP DETECTED with appointment:', apt);
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

      if (isEditMode && editingAppointment) {
        console.log('Edit mode: Deleting old appointment and creating new one');
        console.log('Old appointment ID:', editingAppointment.id);

        const { error: deleteError } = await supabase
          .from('appointments')
          .delete()
          .eq('id', editingAppointment.id);

        if (deleteError) {
          console.error('❌ Error deleting old appointment:', JSON.stringify(deleteError, null, 2));
          throw deleteError;
        }

        console.log('✅ Old appointment deleted');
        console.log('Creating new appointment with data:', JSON.stringify(appointmentData, null, 2));

        const { data: newAppointment, error: insertError } = await supabase
          .from('appointments')
          .insert(appointmentData)
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error creating new appointment:', JSON.stringify(insertError, null, 2));
          throw insertError;
        }

        console.log('✅ New appointment created with ID:', newAppointment.id);

        // Determine original client ID
        const originalClientId = editingAppointment.client_id;
        const originalIsUnregistered = !originalClientId && editingAppointment.unregistered_client_id;

        // Check if client changed
        const clientChanged = originalClientId !== (!isUnregistered ? clientId : null);

        if (clientChanged) {
          console.log('Client changed from', originalClientId, 'to', clientId);

          // Notify old client (if registered) that appointment was removed
          if (originalClientId) {
            console.log('Sending removal notification to old client:', originalClientId);
            const { error: oldClientNotifError } = await supabase
              .from('notifications')
              .insert({
                user_id: originalClientId,
                type: 'appointment_cancelled',
                title: 'Резервацията е премахната',
                body: `Вашата резервация за ${editDate.toLocaleDateString('bg-BG')} от ${editingAppointment.start_time.substring(0, 5)} до ${editingAppointment.end_time.substring(0, 5)} е премахната.`,
                data: {
                  date: editingAppointment.appointment_date,
                  start_time: editingAppointment.start_time,
                  end_time: editingAppointment.end_time,
                }
              });

            if (oldClientNotifError) {
              console.error('Error sending notification to old client:', oldClientNotifError);
            } else {
              console.log('✅ Removal notification sent to old client');
            }
          }

          // Notify new client (if registered) about new appointment
          if (!isUnregistered && clientId) {
            console.log('Sending creation notification to new client:', clientId);
            const { error: newClientNotifError } = await supabase
              .from('notifications')
              .insert({
                user_id: clientId,
                type: 'appointment_created',
                title: 'Нова резервация',
                body: `Имате нова резервация за ${editDate.toLocaleDateString('bg-BG')} от ${startTime} до ${endTime}.`,
                data: {
                  appointment_id: newAppointment.id,
                  date: dateStr,
                  start_time: startTime,
                  end_time: endTime,
                  service_name: selectedService.name,
                }
              });

            if (newClientNotifError) {
              console.error('Error sending notification to new client:', newClientNotifError);
            } else {
              console.log('✅ Creation notification sent to new client');
            }
          }
        } else {
          // Same client - send update notification
          if (!isUnregistered && clientId) {
            console.log('Sending update notification to same client:', clientId);
            const { error: notifError } = await supabase
              .from('notifications')
              .insert({
                user_id: clientId,
                type: 'appointment_updated',
                title: 'Резервацията е променена',
                body: `Вашата резервация е променена на ${editDate.toLocaleDateString('bg-BG')} от ${startTime} до ${endTime}.`,
                data: {
                  appointment_id: newAppointment.id,
                  date: dateStr,
                  start_time: startTime,
                  end_time: endTime,
                  service_name: selectedService.name,
                }
              });

            if (notifError) {
              console.error('Error sending notification:', notifError);
            } else {
              console.log('✅ Update notification sent successfully');
            }
          }
        }

        Alert.alert('Успех', 'Резервацията е променена успешно');
      } else {
        console.log('Appointment data to insert:', JSON.stringify(appointmentData, null, 2));
        console.log('Inserting appointment...');

        const { data: insertedAppointment, error } = await supabase
          .from('appointments')
          .insert(appointmentData)
          .select()
          .single();

        console.log('Insert appointment result - data:', insertedAppointment);
        console.log('Insert appointment result - error:', error);

        if (error) {
          console.error('❌ Error inserting appointment:', JSON.stringify(error, null, 2));
          throw error;
        }

        if (!insertedAppointment) {
          console.error('❌ No appointment data returned');
          throw new Error('No appointment data returned');
        }

        console.log('✅ SUCCESS: Appointment created with ID:', insertedAppointment.id);

        // Database trigger automatically creates notification, no manual insert needed

        Alert.alert('Успех', 'Резервацията е създадена успешно');
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      console.error('FATAL ERROR creating reservation:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
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
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{isEditMode ? 'Редактиране на резервация' : 'Нова резервация'}</Text>
              {voiceData && (
                <View style={styles.voiceBadge}>
                  <Mic size={14} color={theme.colors.primary} />
                  <Text style={styles.voiceBadgeText}>Гласова</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
            {isEditMode ? (
              <>
                <Text style={styles.sectionTitle}>Дата</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Calendar size={18} color={theme.colors.primary} />
                  <Text style={[styles.dropdownButtonText, styles.dateText]}>
                    {formatDateWithWeekday(editDate)}
                  </Text>
                  <ChevronDown size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.infoRow}>
                <Calendar size={18} color={theme.colors.primary} />
                <Text style={[styles.infoText, styles.dateText]}>
                  {formatDateWithWeekday(selectedDate)}
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Часове</Text>
            <View style={styles.timeRow}>
              {!isEditMode ? (
                // При нова резервация - заключен начален час
                <View style={[styles.timeField, styles.lockedField]}>
                  <Clock size={16} color={theme.colors.textMuted} />
                  <Text style={styles.timeText}>
                    {startTime || startTimePlaceholder}
                  </Text>
                </View>
              ) : (
                // При редакция - dropdown меню
                <TouchableOpacity
                  style={styles.timeField}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Clock size={16} color={theme.colors.primary} />
                  <Text style={[styles.timeText, !startTime && styles.placeholderText]}>
                    {startTime || startTimePlaceholder}
                  </Text>
                  <ChevronDown size={16} color={theme.colors.text} />
                </TouchableOpacity>
              )}

              <Text style={styles.timeSeparator}>-</Text>

              <TouchableOpacity
                style={styles.timeField}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Clock size={16} color={theme.colors.primary} />
                <Text style={[styles.timeText, !endTime && styles.placeholderText]}>
                  {endTime || endTimePlaceholder}
                </Text>
                <ChevronDown size={16} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {startTime && endTime && (
              <Text style={styles.durationText}>
                {`${Math.round((timeToMinutes(endTime) - timeToMinutes(startTime)))} мин`}
              </Text>
            )}

            <Text style={styles.sectionTitle}>Услуга</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowServicePicker(true)}
            >
              <Text style={[styles.dropdownButtonText, !selectedService && styles.placeholderText]}>
                {selectedService ? selectedService.name : 'Избери услуга'}
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
                    <Text style={styles.submitText}>{isEditMode ? 'Запази' : 'Създай'}</Text>
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

      {/* Modal за избор на начален час - само при редакция */}
      {isEditMode && (
        <Modal
          visible={showStartTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStartTimePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowStartTimePicker(false)}
          >
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Изберете начален час</Text>
                <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                  <X size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList}>
                {startTimeOptions.map((time: string) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.pickerItem,
                      startTime === time && styles.pickerItemSelected,
                    ]}
                    onPress={() => {
                      setStartTime(time);
                      setShowStartTimePicker(false);

                      // Актуализираме опциите за краен час на база избрания начален час
                      if (selectedSlotRange) {
                        const addMinutes = (timeStr: string, mins: number) => {
                          const [h, m] = timeStr.split(':').map(Number);
                          const total = h * 60 + m + mins;
                          const nh = Math.floor(total / 60);
                          const nm = total % 60;
                          return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
                        };

                        const newEndOptions: string[] = [];
                        let cur = addMinutes(time, 30);
                        const slotEndMinutes = timeToMinutes(selectedSlotRange.end);
                        while (timeToMinutes(cur) <= slotEndMinutes) {
                          newEndOptions.push(cur);
                          cur = addMinutes(cur, 30);
                        }
                        setEndTimeOptions(newEndOptions);
                      }
                      setEndTime('');
                      setEndTimePlaceholder('Изберете краен час');
                    }}
                  >
                    <Text style={styles.pickerItemName}>{time}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

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
              <Text style={styles.pickerTitle}>
                {endTimePlaceholder}
              </Text>
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

      <ScheduleDatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelectDate={handleDateSelect}
        workingHours={workingHours}
        excludeAppointmentId={editingAppointment?.id}
        serviceDuration={selectedService?.duration_minutes || 30}
      />

      <FreeTimeSlotsModal
        visible={showSlotsPicker}
        onClose={() => setShowSlotsPicker(false)}
        selectedDate={editDate}
        workingHours={editWorkingHours}
        onSelectSlot={(slotStart, slotEnd) => {
          handleSlotSelect(slotStart, slotEnd);
          setShowSlotsPicker(false);
        }}
        excludeAppointmentId={editingAppointment?.id}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  readonlyField: {
    backgroundColor: '#f2f2f2',
    color: '#666',
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  lockedField: {
    backgroundColor: '#e8e8e8',
  },
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  voiceBadgeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: '600',
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
  timeScroller: {
    marginBottom: theme.spacing.md,
  },
  timeOption: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeOptionSelected: {
    backgroundColor: theme.colors.accentLight,
    borderColor: theme.colors.primary,
  },
  timeOptionText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  timeOptionTextSelected: {
    color: theme.colors.primary,
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
  optionCard: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: theme.spacing.xs,
  },
  optionCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.accentLight,
  },
  optionName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  optionDetails: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textLight,
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
  notesInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
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
    fontSize: theme.fontSize.md,
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
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  submitText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
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
  },
  dropdownButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    flex: 1,
  },
  placeholderText: {
    color: theme.colors.textMuted,
  },
  serviceDetails: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
    paddingLeft: theme.spacing.sm,
    marginTop: -theme.spacing.xs,
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
