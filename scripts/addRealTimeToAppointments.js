const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/(client)/appointments.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the useEffect that calls loadAppointments
const oldUseEffect = `  useEffect(() => {
    if (user?.id) {
      loadAppointments();
    }
  }, [user?.id]);`;

const newUseEffect = `  useEffect(() => {
    if (user?.id) {
      loadAppointments();

      // Real-time subscription for appointments
      const appointmentsChannel = supabase
        .channel('client_appointments_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: \`client_id=eq.\${user.id}\`,
          },
          (payload) => {
            console.log('Client appointments: Appointment change detected:', payload.eventType);
            loadAppointments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(appointmentsChannel);
      };
    }
  }, [user?.id]);`;

content = content.replace(oldUseEffect, newUseEffect);

// Write the modified content
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully added real-time subscription to appointments.tsx');
