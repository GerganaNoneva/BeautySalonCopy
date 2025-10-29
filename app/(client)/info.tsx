import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, MapPin, Clock, Instagram, Facebook, Info as InfoIcon, Navigation } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type WorkingHours = {
  [key: string]: {
    start: string;
    end: string;
    closed: boolean;
  };
};

type SalonInfo = {
  id: string;
  salon_name: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  working_hours_json: WorkingHours;
};

const DAYS_BG: { [key: string]: string } = {
  monday: '\u041F\u043E\u043D\u0435\u0434\u0435\u043B\u043D\u0438\u043A',
  tuesday: '\u0412\u0442\u043E\u0440\u043D\u0438\u043A',
  wednesday: '\u0421\u0440\u044F\u0434\u0430',
  thursday: '\u0427\u0435\u0442\u0432\u044A\u0440\u0442\u044A\u043A',
  friday: '\u041F\u0435\u0442\u044A\u043A',
  saturday: '\u0421\u044A\u0431\u043E\u0442\u0430',
  sunday: '\u041D\u0435\u0434\u0435\u043B\u044F',
};

export default function ClientInfoScreen() {
  const [info, setInfo] = useState<SalonInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalonInfo();
  }, []);

  const loadSalonInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('salon_info')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setInfo(data);
      }
    } catch (err) {
      console.error('Error loading salon info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (info?.phone) {
      Linking.openURL(`tel:${info.phone}`);
    }
  };

  const handleNavigate = () => {
    console.log('handleNavigate called', { info });

    if (!info) {
      console.log('No info available');
      Alert.alert('Грешка', 'Няма налична информация');
      return;
    }

    let url = '';

    if (info.google_maps_url && info.google_maps_url.trim() !== '') {
      url = info.google_maps_url;
      console.log('Using google_maps_url:', url);
    } else if (info.latitude && info.longitude) {
      url = `https://www.google.com/maps/search/?api=1&query=${info.latitude},${info.longitude}`;
      console.log('Using coordinates:', url);
    } else if (info.address && info.address.trim() !== '') {
      const encodedAddress = encodeURIComponent(info.address);
      url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
      console.log('Using address:', url, 'encoded from:', info.address);
    }

    if (url) {
      console.log('Opening URL:', url);
      Linking.openURL(url).catch(err => {
        console.error('Error opening URL:', err);
        Alert.alert('Грешка', 'Неуспешно отваряне на навигацията');
      });
    } else {
      console.log('No valid navigation data');
      Alert.alert('Грешка', 'Няма налична информация за навигация');
    }
  };

  const openSocialLink = (url: string) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  if (loading) {
    return (
      <LinearGradient colors={theme.gradients.champagne} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!info) {
    return (
      <LinearGradient colors={theme.gradients.champagne} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Няма налична информация</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme.gradients.champagne} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <InfoIcon size={28} color={theme.colors.primary} />
          <Text style={styles.title}>Информация</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.salonName}>{info.salon_name}</Text>

            <View style={styles.section}>
              <View style={styles.iconRow}>
                <View style={styles.iconCircle}>
                  <Phone size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.label}>Телефон</Text>
                  <Text style={styles.value}>{info.phone}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
                <Phone size={18} color={theme.colors.surface} />
                <Text style={styles.actionButtonText}>Обади се</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.section}>
              <View style={styles.iconRow}>
                <View style={styles.iconCircle}>
                  <MapPin size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.label}>Адрес</Text>
                  <Text style={styles.value}>{info.address}</Text>
                </View>
              </View>
              {info.address && (
                <TouchableOpacity style={styles.actionButton} onPress={handleNavigate}>
                  <Navigation size={18} color={theme.colors.surface} />
                  <Text style={styles.actionButtonText}>Навигация</Text>
                </TouchableOpacity>
              )}
            </View>

            {info.working_hours_json && Object.keys(info.working_hours_json).length > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.section}>
                  <View style={styles.iconRow}>
                    <View style={styles.iconCircle}>
                      <Clock size={20} color={theme.colors.primary} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.label}>Работно време</Text>
                    </View>
                  </View>
                  <View style={styles.workingHoursContainer}>
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                      const hours = info.working_hours_json[day];
                      if (!hours) return null;
                      return (
                        <View key={day} style={styles.workingHoursRow}>
                          <Text style={styles.dayText}>{DAYS_BG[day]}</Text>
                          {hours.closed ? (
                            <Text style={styles.closedText}>Почивен ден</Text>
                          ) : (
                            <Text style={styles.hoursText}>{hours.start} - {hours.end}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </View>

          {(info.instagram_url || info.facebook_url || info.tiktok_url) && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Последвайте ни</Text>
              <View style={styles.socialContainer}>
                {info.instagram_url && (
                  <TouchableOpacity
                    style={[styles.socialButton, { backgroundColor: '#E4405F' }]}
                    onPress={() => openSocialLink(info.instagram_url)}
                  >
                    <Instagram size={24} color={theme.colors.surface} />
                    <Text style={styles.socialButtonText}>Instagram</Text>
                  </TouchableOpacity>
                )}
                {info.facebook_url && (
                  <TouchableOpacity
                    style={[styles.socialButton, { backgroundColor: '#1877F2' }]}
                    onPress={() => openSocialLink(info.facebook_url)}
                  >
                    <Facebook size={24} color={theme.colors.surface} />
                    <Text style={styles.socialButtonText}>Facebook</Text>
                  </TouchableOpacity>
                )}
                {info.tiktok_url && (
                  <TouchableOpacity
                    style={[styles.socialButton, { backgroundColor: '#000000' }]}
                    onPress={() => openSocialLink(info.tiktok_url)}
                  >
                    <Text style={styles.tiktokIcon}>♪</Text>
                    <Text style={styles.socialButtonText}>TikTok</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.error,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.md,
  },
  salonName: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.md,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  value: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  actionButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  workingHoursContainer: {
    gap: theme.spacing.sm,
  },
  workingHoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  dayText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  hoursText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  closedText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
    fontStyle: 'italic',
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  socialContainer: {
    gap: theme.spacing.md,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  socialButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  tiktokIcon: {
    fontSize: 24,
    color: theme.colors.surface,
  },
});
