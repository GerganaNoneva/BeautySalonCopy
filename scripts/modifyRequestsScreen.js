const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/(admin)/requests.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add ConflictingAppointment type after AppointmentRequest
const typeToAdd = `
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
    name: string;
    phone: string;
  };
  services: {
    name: string;
  };
};
`;

// Insert after AppointmentRequest type (after line with closing brace and semicolon before "export default")
content = content.replace(
  /(type AppointmentRequest = \{[\s\S]*?\};)\n\n(export default function RequestsScreen)/,
  `$1\n${typeToAdd}\n$2`
);

// 2. Add conflictingAppointment state
content = content.replace(
  /(const \[selectedRequest, setSelectedRequest\] = useState<AppointmentRequest \| null>\(null\);)/,
  `$1\n  const [conflictingAppointment, setConflictingAppointment] = useState<ConflictingAppointment | null>(null);`
);

// 3. Modify query in handleApproveRequest to fetch full appointment details
content = content.replace(
  /(\/\/ Query for conflicting appointments\s+const \{ data: conflictingAppointments, error: conflictError \} = await supabase\s+\.from\('appointments'\)\s+\.select\('id, start_time::text, end_time::text'\))/,
  `// Query for conflicting appointments with full details
      const { data: conflictingAppointments, error: conflictError } = await supabase
        .from('appointments')
        .select(\`
          id,
          appointment_date,
          start_time::text,
          end_time::text,
          profiles(full_name, phone),
          unregistered_clients(name, phone),
          services(name)
        \`)`
);

// 4. Store conflicting appointment when conflict is detected
content = content.replace(
  /(if \(hasConflict\) \{\s+console\.log\('❌ Conflict found! Showing conflict modal\.\.\.'\);\s+\/\/ Show conflict modal - DO NOT approve!\s+setSelectedRequest\(request\);)/,
  `if (hasConflict) {
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
        setConflictingAppointment(conflictingApt || null);`
);

// 5. Modify conflict modal to show conflicting appointment details
const newModalContent = `              <Text style={styles.modalTitle}>Конфликт на резервация</Text>
              {selectedRequest && conflictingAppointment && (
                <>
                  <Text style={styles.modalSubtitle}>
                    Заявка от: {selectedRequest.profiles.full_name}
                    {' \\n'}
                    Услуга: {selectedRequest.services.name}
                    {' \\n'}
                    Дата: {new Date(selectedRequest.requested_date).toLocaleDateString('bg-BG')} в {selectedRequest.requested_time.slice(0, 5)}
                  </Text>
                  <View style={{
                    backgroundColor: theme.colors.error + '20',
                    padding: theme.spacing.md,
                    borderRadius: theme.borderRadius.md,
                    marginBottom: theme.spacing.md,
                  }}>
                    <Text style={{
                      fontSize: theme.fontSize.sm,
                      fontWeight: '700',
                      color: theme.colors.error,
                      marginBottom: theme.spacing.xs,
                    }}>
                      Конфликт със съществуваща резервация:
                    </Text>
                    <Text style={{
                      fontSize: theme.fontSize.sm,
                      color: theme.colors.text,
                      marginTop: 4,
                    }}>
                      Клиент: {conflictingAppointment.profiles?.full_name || conflictingAppointment.unregistered_clients?.name || 'Неизвестен'}
                      {' \\n'}
                      Услуга: {conflictingAppointment.services.name}
                      {' \\n'}
                      Час: {conflictingAppointment.start_time.slice(0, 5)} - {conflictingAppointment.end_time.slice(0, 5)}
                    </Text>
                  </View>
                </>
              )}`;

content = content.replace(
  /(<Text style=\{styles\.modalTitle\}>Конфликт на резервация<\/Text>\s+\{selectedRequest && \(\s+<Text style=\{styles\.modalSubtitle\}>[\s\S]*?<\/Text>\s+\)\})/,
  newModalContent
);

// 6. Clear conflictingAppointment when closing modal
content = content.replace(
  /(onPress=\{\(\) => \{\s+setShowConflictModal\(false\);\s+setConflictReason\(''\);)/,
  `onPress={() => {
                  setShowConflictModal(false);
                  setConflictReason('');
                  setConflictingAppointment(null);`
);

// Write the modified content
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Successfully modified requests.tsx');
console.log('Changes made:');
console.log('1. Added ConflictingAppointment type');
console.log('2. Added conflictingAppointment state');
console.log('3. Modified conflict detection to fetch full appointment details');
console.log('4. Updated modal to show conflicting appointment information');
console.log('5. Clear conflictingAppointment when modal closes');
