const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/(admin)/schedule.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the useEffect that calls loadAppointments
const oldUseEffect = `  useEffect(() => {
    loadAppointments();
  }, [selectedDate]);`;

const newUseEffect = `  useEffect(() => {
    loadAppointments();

    // Real-time subscription for appointments
    const appointmentsChannel = supabase
      .channel('admin_schedule_appointments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
        },
        (payload) => {
          console.log('Schedule: Appointment change detected:', payload.eventType);
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(appointmentsChannel);
    };
  }, [selectedDate]);`;

content = content.replace(oldUseEffect, newUseEffect);

// Write the modified content
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully added real-time subscription to schedule.tsx');
