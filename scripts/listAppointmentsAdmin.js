const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use SERVICE_ROLE_KEY to bypass RLS
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY not found in .env');
  console.log('\nTo view all appointments bypassing RLS:');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to Settings > API');
  console.log('4. Copy the "service_role" key');
  console.log('5. Add to .env: SUPABASE_SERVICE_ROLE_KEY=your_key');
  console.log('\nOR: View appointments directly in Dashboard > Table Editor > appointments');
  process.exit(0);
}

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  serviceRoleKey
);

async function listAppointments() {
  try {
    console.log('\n=== LISTING ALL APPOINTMENTS (ADMIN MODE) ===\n');

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
      .order('start_time', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`Общо резервации: ${data.length}\n`);

    if (data.length === 0) {
      console.log('Няма резервации в базата данни.');
      console.log('\nАко си създал резервация в приложението, провери:');
      console.log('1. Дали INSERT операцията е била успешна (виж browser console)');
      console.log('2. Дали миграцията е приложена правилно');
      console.log('3. Дали има грешка при записване');
      return;
    }

    data.forEach((apt, index) => {
      const profile = Array.isArray(apt.profiles) ? apt.profiles[0] : apt.profiles;
      const unregisteredClient = Array.isArray(apt.unregistered_clients)
        ? apt.unregistered_clients[0]
        : apt.unregistered_clients;
      const clientInfo = profile || unregisteredClient;
      const service = Array.isArray(apt.services) ? apt.services[0] : apt.services;

      console.log(`${index + 1}. ID: ${apt.id}`);
      console.log(`   Дата: ${apt.appointment_date}`);
      console.log(`   Час: ${apt.start_time} - ${apt.end_time}`);
      console.log(`   Клиент: ${clientInfo?.full_name || 'Неизвестен'} ${clientInfo?.phone ? `(${clientInfo.phone})` : ''}`);
      console.log(`   Тип: ${apt.client_id ? 'Регистриран' : 'Нерегистриран'}`);
      console.log(`   Услуга: ${service?.name || 'Без услуга'}`);
      console.log(`   Статус: ${apt.status}`);
      if (apt.notes) console.log(`   Бележки: ${apt.notes}`);
      console.log('');
    });

    console.log('=== КРАЙ ===\n');

  } catch (err) {
    console.error('Exception:', err);
  }
}

listAppointments();
