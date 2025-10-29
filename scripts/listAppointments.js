const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function listAppointments() {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        status,
        notes,
        client_id,
        unregistered_client_id,
        profiles!appointments_client_id_fkey(full_name, phone),
        unregistered_clients!appointments_unregistered_client_id_fkey(full_name, phone),
        services(name)
      `)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('\n=== РЕЗЕРВАЦИИ ===\n');
    console.log(`Общо резервации: ${data.length}\n`);

    data.forEach((apt, index) => {
      const profile = Array.isArray(apt.profiles) ? apt.profiles[0] : apt.profiles;
      const unregisteredClient = Array.isArray(apt.unregistered_clients) ? apt.unregistered_clients[0] : apt.unregistered_clients;
      const clientInfo = profile || unregisteredClient;
      const service = Array.isArray(apt.services) ? apt.services[0] : apt.services;

      console.log(`${index + 1}. ID: ${apt.id}`);
      console.log(`   Дата: ${apt.appointment_date}`);
      console.log(`   Час: ${apt.start_time} - ${apt.end_time}`);
      console.log(`   Клиент: ${clientInfo?.full_name || 'Неизвестен'} ${clientInfo?.phone ? `(${clientInfo.phone})` : ''}`);
      console.log(`   Услуга: ${service?.name || 'Без услуга'}`);
      console.log(`   Статус: ${apt.status}`);
      if (apt.notes) console.log(`   Бележки: ${apt.notes}`);
      console.log('');
    });

  } catch (err) {
    console.error('Exception:', err);
  }
}

listAppointments();
