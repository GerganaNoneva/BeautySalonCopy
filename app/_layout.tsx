import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Modal, View, StyleSheet } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { PhoneVerification } from '@/components/PhoneVerification';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';

function AppContent() {
  const { needsPhoneVerification, user, refreshProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (needsPhoneVerification && user) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [needsPhoneVerification, user]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="+not-found" />
      </Stack>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <PhoneVerification
              onVerified={async (verifiedPhone) => {
                if (user) {
                  const { error } = await supabase
                    .from('profiles')
                    .update({ phone: verifiedPhone, phone_verified: true })
                    .eq('id', user.id);

                  if (!error) {
                    await refreshProfile();
                    setShowModal(false);
                  }
                }
              }}
              onSkip={() => {
                setShowModal(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <NotificationsProvider>
        <AppContent />
        <StatusBar style="auto" />
      </NotificationsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    width: '90%',
    maxWidth: 400,
    ...theme.shadows.xl,
  },
});
