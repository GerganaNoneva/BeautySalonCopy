const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function cleanupInvalidReactions() {
  try {
    console.log('\n=== CLEANUP INVALID REACTIONS ===\n');

    // Step 1: Check what invalid reactions exist
    console.log('Step 1: Checking for invalid reactions...');
    const { data: invalidReactions, error: selectError } = await supabase
      .from('message_reactions')
      .select('reaction_type')
      .not('reaction_type', 'in', '(heart,thumbs_up,thumbs_down)');

    if (selectError) {
      console.error('❌ Error checking invalid reactions:', selectError.message);
      return;
    }

    if (!invalidReactions || invalidReactions.length === 0) {
      console.log('✅ No invalid reactions found!');
      console.log('\n=== CLEANUP COMPLETED ===\n');
      return;
    }

    // Count by type
    const counts = {};
    invalidReactions.forEach(r => {
      counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
    });

    console.log('Found invalid reactions:');
    Object.entries(counts).forEach(([type, count]) => {
      console.log(`  - "${type}": ${count} reactions`);
    });
    console.log(`Total invalid reactions: ${invalidReactions.length}`);

    // Step 2: Delete all invalid reactions
    console.log('\nStep 2: Deleting invalid reactions...');
    const { error: deleteError } = await supabase
      .from('message_reactions')
      .delete()
      .not('reaction_type', 'in', '(heart,thumbs_up,thumbs_down)');

    if (deleteError) {
      console.error('❌ Error deleting invalid reactions:', deleteError.message);
      return;
    }

    console.log(`✅ Successfully deleted ${invalidReactions.length} invalid reactions!`);

    // Step 3: Verify cleanup
    console.log('\nStep 3: Verifying cleanup...');
    const { data: remainingInvalid, error: verifyError } = await supabase
      .from('message_reactions')
      .select('reaction_type')
      .not('reaction_type', 'in', '(heart,thumbs_up,thumbs_down)');

    if (verifyError) {
      console.error('❌ Error verifying cleanup:', verifyError.message);
      return;
    }

    if (!remainingInvalid || remainingInvalid.length === 0) {
      console.log('✅ All invalid reactions have been removed!');
    } else {
      console.log(`⚠️  Warning: ${remainingInvalid.length} invalid reactions still remain`);
    }

    console.log('\n=== CLEANUP COMPLETED ===\n');

  } catch (err) {
    console.error('Exception:', err);
  }
}

cleanupInvalidReactions();
