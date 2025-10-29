import { ParsedVoiceCommand } from './voiceCommandParser';
import { supabase } from '@/lib/supabase';
import { Alert, Linking } from 'react-native';

// Типове за handlers
export interface VoiceCommandHandlerContext {
  // Callbacks
  setSelectedDate: (date: Date) => void;
  setShowNextFreeSlotsModal: (show: boolean) => void;
  setShowNewReservationModal2: (show: boolean) => void;
  setPreselectedDate: (date: Date | null) => void;
  setPreselectedTime: (time: string | null) => void;

  // State
  selectedDate: Date;
  appointments: any[];
  workingHours: any;

  // Router
  router: any;
  userId: string;
}

// Главен handler за всички команди
export async function handleVoiceCommand(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  switch (command.type) {
    case 'show_next_free_slot':
      await handleShowNextFreeSlot(command, context);
      break;

    case 'show_next_n_free_slots':
      await handleShowNextNFreeSlots(command, context);
      break;

    case 'show_schedule_for_date':
      await handleShowScheduleForDate(command, context);
      break;

    case 'show_schedule_for_day':
      await handleShowScheduleForDay(command, context);
      break;

    case 'create_reservation':
      await handleCreateReservation(command, context);
      break;

    case 'client_info':
      await handleClientInfo(command, context);
      break;

    case 'open_chat':
      await handleOpenChat(command, context);
      break;

    case 'call_client':
      await handleCallClient(command, context);
      break;

    default:
      Alert.alert('Неразпозната команда', 'Моля, опитайте отново с по-ясна команда.');
  }
}

// Handler: Покажи следващия свободен час
async function handleShowNextFreeSlot(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  Alert.alert(
    '✅ Команда изпълнена',
    'Показване на следващия свободен час',
    [{ text: 'OK', onPress: () => context.setShowNextFreeSlotsModal(true) }]
  );
}

// Handler: Покажи следващите N свободни часа
async function handleShowNextNFreeSlots(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  const count = command.data?.count || 5;

  Alert.alert(
    '✅ Команда изпълнена',
    `Показване на следващите ${count} свободни часа`,
    [{ text: 'OK', onPress: () => context.setShowNextFreeSlotsModal(true) }]
  );
}

// Handler: Покажи график за определена дата
async function handleShowScheduleForDate(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  if (!command.data?.date) {
    Alert.alert('Грешка', 'Не успях да разпозная датата');
    return;
  }

  const date = new Date(command.data.date);
  const dateStr = date.toLocaleDateString('bg-BG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  Alert.alert(
    '✅ Команда изпълнена',
    `Показване на график за ${dateStr}`,
    [{
      text: 'OK',
      onPress: () => context.setSelectedDate(date)
    }]
  );
}

// Handler: Покажи график за определен ден от седмицата
async function handleShowScheduleForDay(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  if (!command.data?.dayOfWeek) {
    Alert.alert('Грешка', 'Не успях да разпозная деня');
    return;
  }

  const dayOfWeek = command.data.dayOfWeek;

  // Намираме следващия такъв ден
  const today = new Date();
  const dayNames = ['неделя', 'понеделник', 'вторник', 'сряда', 'четвъртък', 'петък', 'събота'];
  const targetDayIndex = dayNames.indexOf(dayOfWeek.toLowerCase());

  if (targetDayIndex === -1) {
    Alert.alert('Грешка', 'Невалиден ден от седмицата');
    return;
  }

  const currentDayIndex = today.getDay();
  let daysToAdd = targetDayIndex - currentDayIndex;

  // Ако денят е същия или е минал, добавяме 7 дни
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);

  const dateStr = targetDate.toLocaleDateString('bg-BG', {
    day: 'numeric',
    month: 'long',
    weekday: 'long'
  });

  Alert.alert(
    '✅ Команда изпълнена',
    `Показване на график за ${dateStr}`,
    [{
      text: 'OK',
      onPress: () => context.setSelectedDate(targetDate)
    }]
  );
}

// Handler: Създай резервация
async function handleCreateReservation(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  const { date, startTime, endTime, serviceName, clientName } = command.data || {};

  if (!date || !startTime || !serviceName || !clientName) {
    Alert.alert(
      'Непълни данни',
      'За да създам резервация, ми трябват: дата, начален час, услуга и име на клиент'
    );
    return;
  }

  const reservationDate = new Date(date);
  const dateStr = reservationDate.toLocaleDateString('bg-BG', {
    day: 'numeric',
    month: 'long'
  });

  Alert.alert(
    '✅ Отваряне на форма',
    `Резервация за ${clientName}\nДата: ${dateStr}\nЧас: ${startTime}${endTime ? ` - ${endTime}` : ''}\nУслуга: ${serviceName}`,
    [
      {
        text: 'OK',
        onPress: () => {
          // Задаваме пред-попълнените данни
          context.setPreselectedDate(reservationDate);
          context.setPreselectedTime(startTime);
          context.setSelectedDate(reservationDate);

          // Отваряме модала за нова резервация
          // Данните ще бъдат автоматично попълнени от NewReservationModal2
          (global as any).__voiceCommandData = {
            clientName,
            serviceName,
            startTime,
            endTime,
            date: date,
          };

          context.setShowNewReservationModal2(true);
        }
      },
      { text: 'Отказ', style: 'cancel' }
    ]
  );
}

// Handler: Информация за клиент (кога има час)
async function handleClientInfo(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  const clientName = command.data?.clientName;

  if (!clientName) {
    Alert.alert('Грешка', 'Не успях да разпозная името на клиента');
    return;
  }

  try {
    // Търсим клиента в базата
    const { data: clients, error: clientError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', `%${clientName}%`)
      .limit(5);

    if (clientError) throw clientError;

    if (!clients || clients.length === 0) {
      Alert.alert('Не намерен', `Клиент с име "${clientName}" не беше намерен`);
      return;
    }

    // Вземаме първия клиент (най-добро съвпадение)
    const client = clients[0];

    // Търсим следващи часове за клиента
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const { data: futureAppointments, error: aptError } = await supabase
      .from('appointments')
      .select('appointment_date, start_time, end_time, services(name)')
      .eq('client_id', client.id)
      .gte('appointment_date', todayStr)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(3);

    if (aptError) throw aptError;

    if (!futureAppointments || futureAppointments.length === 0) {
      Alert.alert(
        'Информация за клиент',
        `${client.full_name} няма предстоящи часове`
      );
      return;
    }

    // Форматираме информацията
    const appointmentsText = futureAppointments
      .map((apt: any) => {
        const date = new Date(apt.appointment_date);
        const dateStr = date.toLocaleDateString('bg-BG', {
          day: 'numeric',
          month: 'long',
          weekday: 'short'
        });
        return `• ${dateStr} в ${apt.start_time.slice(0, 5)} - ${apt.services?.name || 'Без услуга'}`;
      })
      .join('\n');

    Alert.alert(
      `📅 ${client.full_name}`,
      `Предстоящи часове:\n\n${appointmentsText}`
    );
  } catch (error) {
    console.error('Error fetching client info:', error);
    Alert.alert('Грешка', 'Не успях да извлека информация за клиента');
  }
}

// Handler: Отвори чат с клиент
async function handleOpenChat(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  const clientName = command.data?.clientName;

  if (!clientName) {
    Alert.alert('Грешка', 'Не успях да разпозная името на клиента');
    return;
  }

  try {
    // Търсим клиента
    const { data: clients, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', `%${clientName}%`)
      .limit(5);

    if (error) throw error;

    if (!clients || clients.length === 0) {
      Alert.alert('Не намерен', `Клиент с име "${clientName}" не беше намерен`);
      return;
    }

    const client = clients[0];

    // Проверяваме дали има съществуваща conversation
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('admin_id', context.userId)
      .eq('client_id', client.id)
      .maybeSingle();

    if (conversation) {
      context.router.push(`/(admin)/messages?conversationId=${conversation.id}`);
    } else {
      context.router.push(`/(admin)/messages?newChat=${client.id}`);
    }

    Alert.alert('✅ Готово', `Отваряне на чат с ${client.full_name}`);
  } catch (error) {
    console.error('Error opening chat:', error);
    Alert.alert('Грешка', 'Не успях да отворя чата');
  }
}

// Handler: Позвъни на клиент
async function handleCallClient(
  command: ParsedVoiceCommand,
  context: VoiceCommandHandlerContext
) {
  const clientName = command.data?.clientName;

  if (!clientName) {
    Alert.alert('Грешка', 'Не успях да разпозная името на клиента');
    return;
  }

  try {
    // Търсим клиента и телефона му
    const { data: clients, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .ilike('full_name', `%${clientName}%`)
      .limit(5);

    if (error) throw error;

    if (!clients || clients.length === 0) {
      Alert.alert('Не намерен', `Клиент с име "${clientName}" не беше намерен`);
      return;
    }

    const client = clients[0];

    if (!client.phone) {
      Alert.alert('Няма телефон', `${client.full_name} няма записан телефонен номер`);
      return;
    }

    // Отваряме dialer-а
    Alert.alert(
      'Обаждане',
      `Ще се обадя на ${client.full_name} (${client.phone})`,
      [
        {
          text: 'Позвъни',
          onPress: () => Linking.openURL(`tel:${client.phone}`)
        },
        { text: 'Отказ', style: 'cancel' }
      ]
    );
  } catch (error) {
    console.error('Error calling client:', error);
    Alert.alert('Грешка', 'Не успях да намеря телефона на клиента');
  }
}
