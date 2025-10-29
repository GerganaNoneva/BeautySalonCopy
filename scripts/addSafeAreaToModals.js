const fs = require('fs');
const path = require('path');

const modalsToFix = [
  'ScheduleDatePicker.tsx',
  'ReservationModal.tsx',
  'NewReservationModal.tsx',
  'NewReservationModal2.tsx',
  'FreeTimeSlotsModal.tsx',
  'NextFreeTimeSlotsModal.tsx',
  'CreateClientModal.tsx',
];

const componentsDir = path.join(__dirname, '..', 'components');

modalsToFix.forEach(filename => {
  const filePath = path.join(componentsDir, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipping ${filename} - file not found`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already has useSafeAreaInsets
  if (content.includes('useSafeAreaInsets')) {
    console.log(`✅ ${filename} - already has safe area insets`);
    return;
  }

  console.log(`🔧 Fixing ${filename}...`);

  // Add import
  if (content.includes("from 'react-native-safe-area-context'")) {
    // Already has import from safe area context
    if (!content.includes('useSafeAreaInsets')) {
      content = content.replace(
        /from 'react-native-safe-area-context';/,
        "from 'react-native-safe-area-context';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';"
      );
    }
  } else {
    // Add new import after other imports
    const lastImportMatch = content.match(/import .+ from .+;(?=\n\n)/);
    if (lastImportMatch) {
      const insertPos = lastImportMatch.index + lastImportMatch[0].length;
      content = content.slice(0, insertPos) +
                "\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';" +
                content.slice(insertPos);
    }
  }

  // Add const insets = useSafeAreaInsets(); after first useState or const in component
  // Find the component function
  const componentMatch = content.match(/export default function \w+\([^)]*\) \{/);
  if (componentMatch) {
    const componentStart = componentMatch.index + componentMatch[0].length;
    // Find first const or useState after component start
    const firstConstMatch = content.slice(componentStart).match(/\n  const /);
    if (firstConstMatch && !content.includes('const insets = useSafeAreaInsets()')) {
      const insertPos = componentStart + firstConstMatch.index + 1;
      content = content.slice(0, insertPos) +
                "  const insets = useSafeAreaInsets();\n" +
                content.slice(insertPos);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ ${filename} - imports added`);
});

console.log('\n📝 Note: You need to manually add { marginBottom: insets.bottom + 16 } to modalContent View in each modal');
