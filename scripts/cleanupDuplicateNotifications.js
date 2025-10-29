const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function cleanupDuplicates() {
  try {
    console.log('🔍 Fetching all notifications...\n');

    // Get all notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    console.log(`Total notifications: ${notifications.length}\n`);

    // Group by type, user_id, title, and body to find potential duplicates
    const grouped = {};

    notifications.forEach(notif => {
      // Create a key that represents "same notification content"
      // For messages, include message_id to ensure we only keep one per message
      const messageId = notif.data?.message_id;
      const key = messageId
        ? `${notif.type}_${notif.user_id}_${messageId}`
        : `${notif.type}_${notif.user_id}_${notif.title}_${notif.body}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(notif);
    });

    // Find duplicates and keep only the newest one
    let totalToDelete = 0;
    const idsToDelete = [];

    Object.entries(grouped).forEach(([key, notifs]) => {
      if (notifs.length > 1) {
        // Keep the newest (first one since we sorted DESC), delete the rest
        const [keep, ...toDelete] = notifs;
        totalToDelete += toDelete.length;

        console.log(`\n🔴 Found ${notifs.length} duplicates:`);
        console.log(`   Type: ${keep.type}`);
        console.log(`   Body: ${keep.body}`);
        console.log(`   Keeping: ID ${keep.id} (${keep.created_at})`);
        console.log(`   Deleting: ${toDelete.length} older duplicates`);

        toDelete.forEach(n => {
          idsToDelete.push(n.id);
          console.log(`     - ID ${n.id} (${n.created_at})`);
        });
      }
    });

    if (idsToDelete.length === 0) {
      console.log('\n✅ No duplicates found! Database is clean.\n');
      return;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total notifications: ${notifications.length}`);
    console.log(`   Duplicates to delete: ${idsToDelete.length}`);
    console.log(`   Will remain: ${notifications.length - idsToDelete.length}\n`);

    console.log('⚠️  To delete duplicates, uncomment the deletion code below and run again.\n');

    // UNCOMMENT THIS SECTION TO ACTUALLY DELETE
    /*
    console.log('🗑️  Deleting duplicates...');
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('Error deleting duplicates:', deleteError);
    } else {
      console.log(`✅ Successfully deleted ${idsToDelete.length} duplicate notifications!\n`);
    }
    */

  } catch (err) {
    console.error('Error:', err);
  }
}

cleanupDuplicates();
