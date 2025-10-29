import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const textLower = text.toLowerCase();

    if (textLower.includes('следващите') && (textLower.includes('свободни часове') || textLower.includes('10'))) {
      return await handleMultipleFreeSlotsQuery(supabase, openaiApiKey);
    }

    if (textLower.includes('свободен час') || textLower.includes('свободен слот') || textLower.includes('кога има място')) {
      return await handleFreeSlotQuery(supabase, openaiApiKey);
    }

    if (textLower.includes('кога има час') || textLower.includes('има ли час') || textLower.includes('резервация за')) {
      return await handleClientAppointmentQuery(supabase, openaiApiKey, text);
    }

    if (textLower.includes('позвъни') || textLower.includes('обади се')) {
      return await handleCallClient(supabase, openaiApiKey, text);
    }

    if (textLower.includes('изпрати съобщение') || textLower.includes('прати съобщение') || textLower.includes('напиши')) {
      return await handleMessageClient(supabase, openaiApiKey, text);
    }

    return new Response(
      JSON.stringify({
        error: 'Unknown query type',
        answer: '😕 Не разбрах командата.\n\nМога да ти помогна с:\n• "Кажи ми следващият свободен час"\n• "Покажи ми следващите 10 свободни часа"\n• "Кажи ми [име] кога има час"\n• "Позвъни на [име]"\n• "Изпрати съобщение на [име]"'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in query-schedule function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleFreeSlotQuery(supabase: any, openaiApiKey: string) {
  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 14);

    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('appointment_date, start_time, end_time')
      .gte('appointment_date', todayStr)
      .lte('appointment_date', endDateStr)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    const workingHours = { start: '08:00', end: '20:00' };
    const slotDuration = 60;

    let firstFreeSlot = null;

    for (let d = 0; d <= 14; d++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + d);
      const checkDateStr = checkDate.toISOString().split('T')[0];

      const dayAppointments = (appointments || []).filter(
        (apt: any) => apt.appointment_date === checkDateStr
      );

      for (let hour = 8; hour < 20; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

        const hasConflict = dayAppointments.some((apt: any) => {
          const aptStart = timeToMinutes(apt.start_time);
          const aptEnd = timeToMinutes(apt.end_time);
          const slotStart = timeToMinutes(startTime);
          const slotEnd = timeToMinutes(endTime);

          return (
            (slotStart >= aptStart && slotStart < aptEnd) ||
            (slotEnd > aptStart && slotEnd <= aptEnd) ||
            (slotStart <= aptStart && slotEnd >= aptEnd)
          );
        });

        if (!hasConflict) {
          firstFreeSlot = {
            date: checkDateStr,
            dayName: getDayName(checkDate),
            startTime: startTime,
            endTime: endTime,
          };
          break;
        }
      }

      if (firstFreeSlot) break;
    }

    if (!firstFreeSlot) {
      return new Response(
        JSON.stringify({
          answer: 'В момента няма свободни часове за следващите 14 дни. Моля, свържете се директно със салона.',
          queryType: 'free_slot'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const dateObj = new Date(firstFreeSlot.date);
    const formattedDate = `${dateObj.getDate()}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getFullYear()}`;

    return new Response(
      JSON.stringify({
        answer: `Първият свободен час е на ${firstFreeSlot.dayName}, ${formattedDate} г. от ${firstFreeSlot.startTime} до ${firstFreeSlot.endTime} часа.`,
        queryType: 'free_slot',
        data: firstFreeSlot
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in handleFreeSlotQuery:', error);
    throw error;
  }
}

async function handleClientAppointmentQuery(supabase: any, openaiApiKey: string, text: string) {
  try {
    const extractNamePrompt = `Извлечи само името на клиента от следния текст: "${text}".
Върни само името, без допълнителен текст. Ако името не е ясно, върни "неизвестно".`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: extractNamePrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error('Failed to extract client name from text');
    }

    const completionData = await openaiResponse.json();
    const clientName = completionData.choices[0].message.content.trim();

    if (!clientName || clientName.toLowerCase() === 'неизвестно') {
      return new Response(
        JSON.stringify({
          answer: 'Не успях да разбера името на клиента. Моля, опитайте отново.',
          queryType: 'client_appointment'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: clients, error: clientError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'client')
      .ilike('full_name', `%${clientName}%`)
      .limit(1);

    if (clientError) throw clientError;

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({
          answer: `Не намерих клиент с името "${clientName}" в базата данни.`,
          queryType: 'client_appointment'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const client = clients[0];

    const today = new Date().toISOString().split('T')[0];

    const { data: appointments, error: aptError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time::text,
        end_time::text,
        services(name)
      `)
      .eq('client_id', client.id)
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(5);

    if (aptError) throw aptError;

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({
          answer: `${client.full_name} няма предстоящи резервации.`,
          queryType: 'client_appointment'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let answer = `${client.full_name} има следните резервации:\n\n`;

    appointments.forEach((apt: any, index: number) => {
      const dateObj = new Date(apt.appointment_date);
      const dayName = getDayName(dateObj);
      const formattedDate = `${dateObj.getDate()}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}.${dateObj.getFullYear()}`;
      const serviceName = apt.services?.name || 'Услуга';

      answer += `${index + 1}. ${dayName}, ${formattedDate} в ${apt.start_time.slice(0, 5)} - ${serviceName}\n`;
    });

    return new Response(
      JSON.stringify({
        answer: answer.trim(),
        queryType: 'client_appointment',
        data: { client, appointments }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in handleClientAppointmentQuery:', error);
    throw error;
  }
}

async function handleCallClient(supabase: any, openaiApiKey: string, text: string) {
  try {
    const extractNamePrompt = `Извлечи само името на клиента от следния текст: "${text}".
Върни само името, без допълнителен текст. Ако името не е ясно, върни "неизвестно".`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: extractNamePrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error('Failed to extract client name from text');
    }

    const completionData = await openaiResponse.json();
    const clientName = completionData.choices[0].message.content.trim();

    if (!clientName || clientName.toLowerCase() === 'неизвестно') {
      return new Response(
        JSON.stringify({
          answer: 'Не успях да разбера името на клиента. Моля, опитайте отново.',
          queryType: 'call_client'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: clients, error: clientError } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'client')
      .ilike('full_name', `%${clientName}%`)
      .limit(1);

    if (clientError) throw clientError;

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({
          answer: `Не намерих клиент с името "${clientName}" в базата данни.`,
          queryType: 'call_client'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const client = clients[0];

    if (!client.phone) {
      return new Response(
        JSON.stringify({
          answer: `${client.full_name} няма записан телефонен номер.`,
          queryType: 'call_client'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        answer: `Обаждам се на ${client.full_name}...`,
        queryType: 'call_client',
        action: 'call',
        data: {
          clientId: client.id,
          clientName: client.full_name,
          phone: client.phone
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in handleCallClient:', error);
    throw error;
  }
}

async function handleMessageClient(supabase: any, openaiApiKey: string, text: string) {
  try {
    const extractNamePrompt = `Извлечи само името на клиента от следния текст: "${text}".
Върни само името, без допълнителен текст. Ако името не е ясно, върни "неизвестно".`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: extractNamePrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error('Failed to extract client name from text');
    }

    const completionData = await openaiResponse.json();
    const clientName = completionData.choices[0].message.content.trim();

    if (!clientName || clientName.toLowerCase() === 'неизвестно') {
      return new Response(
        JSON.stringify({
          answer: 'Не успях да разбера името на клиента. Моля, опитайте отново.',
          queryType: 'message_client'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: clients, error: clientError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'client')
      .ilike('full_name', `%${clientName}%`)
      .limit(1);

    if (clientError) throw clientError;

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({
          answer: `Не намерих клиент с името "${clientName}" в базата данни.`,
          queryType: 'message_client'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const client = clients[0];

    return new Response(
      JSON.stringify({
        answer: `Отварям чата с ${client.full_name}...`,
        queryType: 'message_client',
        action: 'open_chat',
        data: {
          clientId: client.id,
          clientName: client.full_name
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in handleMessageClient:', error);
    throw error;
  }
}

async function handleMultipleFreeSlotsQuery(supabase: any, openaiApiKey: string) {
  try {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);

    const todayStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('appointment_date, start_time, end_time')
      .gte('appointment_date', todayStr)
      .lte('appointment_date', endDateStr)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;

    const freeSlots: any[] = [];

    for (let d = 0; d <= 30 && freeSlots.length < 10; d++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + d);
      const checkDateStr = checkDate.toISOString().split('T')[0];

      const dayAppointments = (appointments || []).filter(
        (apt: any) => apt.appointment_date === checkDateStr
      );

      for (let hour = 8; hour < 20 && freeSlots.length < 10; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

        const hasConflict = dayAppointments.some((apt: any) => {
          const aptStart = timeToMinutes(apt.start_time);
          const aptEnd = timeToMinutes(apt.end_time);
          const slotStart = timeToMinutes(startTime);
          const slotEnd = timeToMinutes(endTime);

          return (
            (slotStart >= aptStart && slotStart < aptEnd) ||
            (slotEnd > aptStart && slotEnd <= aptEnd) ||
            (slotStart <= aptStart && slotEnd >= aptEnd)
          );
        });

        if (!hasConflict) {
          freeSlots.push({
            date: checkDateStr,
            dayName: getDayName(checkDate),
            startTime: startTime,
            endTime: endTime,
          });
        }
      }
    }

    if (freeSlots.length === 0) {
      return new Response(
        JSON.stringify({
          answer: 'В момента няма свободни часове за следващите 30 дни. Моля, свържете се директно със салона.',
          queryType: 'multiple_free_slots'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let answer = `📅 Следващите ${freeSlots.length} свободни часа:\n\n`;

    freeSlots.forEach((slot: any, index: number) => {
      const dateObj = new Date(slot.date);
      const formattedDate = `${dateObj.getDate()}.${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;

      answer += `${index + 1}. ${slot.dayName}, ${formattedDate} | ${slot.startTime} - ${slot.endTime}\n`;
    });

    return new Response(
      JSON.stringify({
        answer: answer.trim(),
        queryType: 'multiple_free_slots',
        data: { slots: freeSlots }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in handleMultipleFreeSlotsQuery:', error);
    throw error;
  }
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getDayName(date: Date): string {
  const days = ['Неделя', 'Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота'];
  return days[date.getDay()];
}
