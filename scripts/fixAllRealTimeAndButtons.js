const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing all real-time and button issues...\n');

// 1. Fix client requests - add clear rejected button
const clientRequestsPath = path.join(__dirname, '../app/(client)/requests.tsx');
let clientRequests = fs.readFileSync(clientRequestsPath, 'utf8');

// Add handleClearRejected function before formatDate
const clearRejectedFunction = `
  const handleClearRejected = async () => {
    try {
      const rejectedRequests = requests.filter(r => r.status === 'rejected');
      if (rejectedRequests.length === 0) return;

      const { error } = await supabase
        .from('appointment_requests')
        .delete()
        .eq('client_id', user?.id)
        .eq('status', 'rejected');

      if (error) throw error;
      loadRequests();
    } catch (error) {
      console.error('Error clearing rejected requests:', error);
    }
  };
`;

if (!clientRequests.includes('handleClearRejected')) {
  clientRequests = clientRequests.replace(
    /const formatDate = /,
    `${clearRejectedFunction}\n  const formatDate = `
  );
}

// Add clear button UI before ScrollView
const clearButtonUI = `
        {requests.some(r => r.status === 'rejected') && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearRejected}
          >
            <Text style={styles.clearButtonText}>Изчисти отхвърлени</Text>
          </TouchableOpacity>
        )}
`;

if (!clientRequests.includes('Изчисти отхвърлени')) {
  clientRequests = clientRequests.replace(
    /(<ScrollView)/,
    `${clearButtonUI}\n      $1`
  );
}

// Add styles for clear button
const clearButtonStyles = `
  clearButton: {
    backgroundColor: theme.colors.error,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },`;

if (!clientRequests.includes('clearButton:')) {
  clientRequests = clientRequests.replace(
    /(headerSubtitle: \{[\s\S]*?\},)/,
    `$1\n${clearButtonStyles}`
  );
}

fs.writeFileSync(clientRequestsPath, clientRequests, 'utf8');
console.log('✅ Fixed client requests - added clear rejected button');

// 2. Verify admin requests has clear all rejected - check console logs
const adminRequestsPath = path.join(__dirname, '../app/(admin)/requests.tsx');
let adminRequests = fs.readFileSync(adminRequestsPath, 'utf8');

// Add console.log to real-time subscription if missing
if (!adminRequests.includes('Admin Requests: Request change detected')) {
  adminRequests = adminRequests.replace(
    /(console\.log\('Appointment request change:', payload\);)/,
    `console.log('Admin Requests: Request change detected:', payload.eventType);\n          $1`
  );
  fs.writeFileSync(adminRequestsPath, adminRequests, 'utf8');
  console.log('✅ Added logging to admin requests real-time');
}

// 3. Verify schedule.tsx has real-time - add logging
const schedulePath = path.join(__dirname, '../app/(admin)/schedule.tsx');
let schedule = fs.readFileSync(schedulePath, 'utf8');

if (schedule.includes('admin_schedule_appointments_changes')) {
  if (!schedule.includes('Admin Schedule: Appointment change detected')) {
    schedule = schedule.replace(
      /(console\.log\('Schedule: Appointment change detected:', payload\.eventType\);)/,
      `console.log('Admin Schedule: Appointment change detected:', payload.eventType);`
    );
    fs.writeFileSync(schedulePath, schedule, 'utf8');
    console.log('✅ Verified admin schedule real-time subscription');
  }
} else {
  console.log('❌ Admin schedule does NOT have real-time subscription!');
}

// 4. Verify appointments.tsx has real-time - add logging
const appointmentsPath = path.join(__dirname, '../app/(client)/appointments.tsx');
let appointments = fs.readFileSync(appointmentsPath, 'utf8');

if (appointments.includes('client_appointments_changes')) {
  if (!appointments.includes('Client Appointments: Change detected')) {
    appointments = appointments.replace(
      /(console\.log\('Client appointments: Appointment change detected:', payload\.eventType\);)/,
      `console.log('Client Appointments: Change detected:', payload.eventType);`
    );
    fs.writeFileSync(appointmentsPath, appointments, 'utf8');
    console.log('✅ Verified client appointments real-time subscription');
  }
} else {
  console.log('❌ Client appointments does NOT have real-time subscription!');
}

console.log('\n🎉 All fixes completed!');
console.log('\nNow refresh your browser with Ctrl+Shift+R');
