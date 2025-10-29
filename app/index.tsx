import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneVerificationModal } from '@/components/PhoneVerification';
import { theme } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { session, loading, isAdmin, needsPhoneVerification, profile } = useAuth();
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    console.log('🔍 Index useEffect:', {
      loading,
      hasSession: !!session,
      hasProfile: !!profile,
      hasRedirected,
      isAdmin,
      needsPhoneVerification
    });

    if (!loading && !hasRedirected) {
      if (session && profile) {
        console.log('✅ Routing decision:', {
          email: profile?.email,
          role: profile?.role,
          isAdmin,
          needsPhoneVerification,
          createdByAdmin: profile?.created_by_admin
        });

        if (needsPhoneVerification) {
          setShowPhoneModal(true);
        } else if (isAdmin) {
          console.log('→ Redirecting to ADMIN schedule');
          setHasRedirected(true);
          router.replace('/(admin)/schedule');
        } else {
          console.log('→ Redirecting to CLIENT booking');
          setHasRedirected(true);
          router.replace('/(client)/booking');
        }
      } else if (session && !profile) {
        console.log('⚠️  Have session but NO profile - waiting for profile to load...');
      } else if (!session) {
        console.log('❌ No session - redirecting to login in 2 seconds');
        setTimeout(() => {
          setHasRedirected(true);
          router.replace('/auth/login');
        }, 2000);
      }
    }
  }, [loading, session, isAdmin, needsPhoneVerification, profile, hasRedirected]);

  const handlePhoneVerified = () => {
    setShowPhoneModal(false);
    setHasRedirected(true);
    if (isAdmin) {
      router.replace('/(admin)/schedule');
    } else {
      router.replace('/(client)/booking');
    }
  };

  return (
    <LinearGradient
      colors={theme.gradients.luxury}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.ornamentTop} />
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={[styles.decorativeLine, styles.decorativeLineTop]} />
          <Text style={styles.subtitle}>ДОБРЕ ДОШЛИ В</Text>
          <Text style={styles.brandNameLarge}>URBAN</Text>
          <Text style={styles.brandDescription}>BEAUTY SALON</Text>
          <View style={[styles.decorativeLine, styles.decorativeLineBottom]} />
        </View>
        <Text style={styles.tagline}>Луксозен салон за красота</Text>
        <ActivityIndicator
          size="large"
          color={theme.colors.cream}
          style={styles.loader}
        />
      </View>
      <View style={styles.ornamentBottom} />
      {profile && (
        <PhoneVerificationModal
          visible={showPhoneModal}
          userId={profile.id}
          onVerified={handlePhoneVerified}
          onClose={() => {
            // Не позволяваме затваряне - верификацията е задължителна
            console.log('Phone verification is required - cannot close modal');
          }}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ornamentTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  ornamentBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  decorativeLine: {
    height: 1,
    backgroundColor: theme.colors.cream,
    opacity: 0.6,
  },
  decorativeLineTop: {
    width: 80,
    marginBottom: theme.spacing.lg,
  },
  decorativeLineBottom: {
    width: 120,
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.cream,
    fontWeight: '300',
    letterSpacing: 3,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    opacity: 0.9,
  },
  brandNameLarge: {
    fontSize: theme.fontSize.display,
    color: theme.colors.cream,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  brandDescription: {
    fontSize: theme.fontSize.md,
    color: theme.colors.cream,
    fontWeight: '300',
    letterSpacing: 4,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    opacity: 0.85,
  },
  tagline: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.champagne,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    letterSpacing: 1,
    opacity: 0.9,
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
});
