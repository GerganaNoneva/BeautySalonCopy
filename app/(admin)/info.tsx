import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Switch,
  Platform,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, MapPin, Clock, Instagram, Facebook, Save, ExternalLink, Map, DollarSign, Share2, MessageCircle } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

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
  working_hours: string;
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

export default function InfoScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<SalonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);

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
      } else {
        // Create initial record if none exists
        const defaultWorkingHours: WorkingHours = {
          monday: { start: '09:00', end: '18:00', closed: false },
          tuesday: { start: '09:00', end: '18:00', closed: false },
          wednesday: { start: '09:00', end: '18:00', closed: false },
          thursday: { start: '09:00', end: '18:00', closed: false },
          friday: { start: '09:00', end: '18:00', closed: false },
          saturday: { start: '09:00', end: '18:00', closed: false },
          sunday: { start: '09:00', end: '18:00', closed: true },
        };

        const { data: newData, error: insertError } = await supabase
          .from('salon_info')
          .insert({
            salon_name: 'Beauty Salon',
            phone: '',
            address: '',
            latitude: null,
            longitude: null,
            google_maps_url: '',
            instagram_url: '',
            facebook_url: '',
            tiktok_url: '',
            working_hours_json: defaultWorkingHours,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating initial salon info:', insertError);
        } else {
          setInfo(newData);
        }
      }
    } catch (err) {
      console.error('Error loading salon info:', err);
      Alert.alert('Грешка', 'Неуспешно зареждане на информацията');
    } finally {
      setLoading(false);
    }
  };

  const searchAddressOnMap = async () => {
    if (!info?.address) {
      Alert.alert('Грешка', 'Моля, въведете адрес');
      return;
    }

    setSearchingAddress(true);
    try {
      let searchAddress = info.address
        .replace(/"/g, '')
        .replace(/"/g, '')
        .replace(/"/g, '')
        .replace(/ул\./gi, 'улица')
        .replace(/бул\./gi, 'булевард')
        .replace(/№/g, '')
        .trim();

      if (!searchAddress.toLowerCase().includes('българия') && !searchAddress.toLowerCase().includes('bulgaria')) {
        searchAddress = `${searchAddress}, България`;
      }

      const tryGeocoding = async (address: string) => {
        const encodedAddress = encodeURIComponent(address);
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=5&countrycodes=bg`;

        const response = await fetch(geocodeUrl, {
          headers: {
            'User-Agent': 'UrbanBeautyApp/1.0'
          }
        });
        return await response.json();
      };

      let data = await tryGeocoding(searchAddress);

      if (!data || data.length === 0) {
        const parts = searchAddress.split(',');
        if (parts.length >= 2) {
          const streetPart = parts[0].trim();
          const city = parts[parts.length - 1].trim();
          const simplified = `${streetPart}, ${city}`;
          data = await tryGeocoding(simplified);
        }
      }

      if (!data || data.length === 0) {
        const cityMatch = searchAddress.match(/(София|Пловдив|Варна|Бургас|Русе|Стара Загора|Плевен|Добрич|Сливен|Перник|Шумен|Хасково|Ямбол|Пазарджик|Благоевград|Велико Търново|Враца|Габрово|Кърджали|Кюстендил|Ловеч|Монтана|Видин|Разград|Силистра|Търговище|Смолян)/i);
        if (cityMatch) {
          data = await tryGeocoding(cityMatch[0]);
        }
      }

      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

        setInfo({
          ...info,
          latitude: parseFloat(lat),
          longitude: parseFloat(lon),
          google_maps_url: mapsUrl,
        });

        Alert.alert(
          'Успех',
          `Намерен адрес:\n${display_name}\n\nЛатитуда: ${lat}\nДължина: ${lon}`
        );
      } else {
        Alert.alert(
          'Адресът не е намерен',
          'Опитайте с по-прост формат:\n\nПример:\nГенерал Столетов 68, Варна\nили\nВитоша 15, София\n\nИли въведете само града:\nВарна'
        );
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      Alert.alert('Грешка', 'Неуспешно търсене на адрес');
    } finally {
      setSearchingAddress(false);
    }
  };

  const updateWorkingHours = (day: string, field: 'start' | 'end' | 'closed', value: string | boolean) => {
    if (!info) return;

    const newWorkingHours = { ...info.working_hours_json };
    if (field === 'closed') {
      newWorkingHours[day].closed = value as boolean;
    } else {
      newWorkingHours[day][field] = value as string;
    }

    setInfo({ ...info, working_hours_json: newWorkingHours });
  };

  const handleSave = async () => {
    if (!info) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('salon_info')
        .update({
          salon_name: info.salon_name,
          phone: info.phone,
          address: info.address,
          latitude: info.latitude,
          longitude: info.longitude,
          google_maps_url: info.google_maps_url,
          instagram_url: info.instagram_url,
          facebook_url: info.facebook_url,
          tiktok_url: info.tiktok_url,
          working_hours_json: info.working_hours_json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', info.id);

      if (error) throw error;

      Alert.alert('Успех', 'Информацията е запазена');
      setEditing(false);
    } catch (err) {
      console.error('Error saving salon info:', err);
      Alert.alert('Грешка', 'Неуспешно запазване');
    } finally {
      setSaving(false);
    }
  };

  const openLink = (url: string) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const shareInfo = async (type: 'all' | 'phone' | 'address' | 'social') => {
    if (!info) return;

    let message = '';

    switch (type) {
      case 'phone':
        message = `${info.salon_name}\n📞 Телефон: ${info.phone}`;
        break;
      case 'address':
        message = `${info.salon_name}\n📍 Адрес: ${info.address}`;
        if (info.google_maps_url) {
          message += `\n🗺️ Карта: ${info.google_maps_url}`;
        } else if (info.latitude && info.longitude) {
          message += `\n🗺️ Карта: https://www.google.com/maps/search/?api=1&query=${info.latitude},${info.longitude}`;
        } else if (info.address) {
          const encodedAddress = encodeURIComponent(info.address);
          message += `\n🗺️ Карта: https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        }
        break;
      case 'social':
        message = `${info.salon_name}\n\nПоследвайте ни:\n`;
        if (info.instagram_url) message += `📸 Instagram: ${info.instagram_url}\n`;
        if (info.facebook_url) message += `👍 Facebook: ${info.facebook_url}\n`;
        if (info.tiktok_url) message += `🎵 TikTok: ${info.tiktok_url}\n`;
        break;
      case 'all':
        message = `${info.salon_name}\n\n`;
        message += `📞 Телефон: ${info.phone}\n`;
        message += `📍 Адрес: ${info.address}\n`;
        if (info.google_maps_url) {
          message += `🗺️ Карта: ${info.google_maps_url}\n`;
        } else if (info.latitude && info.longitude) {
          message += `🗺️ Карта: https://www.google.com/maps/search/?api=1&query=${info.latitude},${info.longitude}\n`;
        } else if (info.address) {
          const encodedAddress = encodeURIComponent(info.address);
          message += `🗺️ Карта: https://www.google.com/maps/search/?api=1&query=${encodedAddress}\n`;
        }
        if (info.instagram_url || info.facebook_url || info.tiktok_url) {
          message += `\nПоследвайте ни:\n`;
          if (info.instagram_url) message += `📸 Instagram: ${info.instagram_url}\n`;
          if (info.facebook_url) message += `👍 Facebook: ${info.facebook_url}\n`;
          if (info.tiktok_url) message += `🎵 TikTok: ${info.tiktok_url}\n`;
        }
        break;
    }

    try {
      if (Platform.OS === 'web') {
        try {
          await navigator.clipboard.writeText(message);
          Alert.alert('Успех', 'Информацията е копирана в клипборда');
        } catch (clipboardError) {
          console.error('Clipboard error:', clipboardError);
          const tempInput = document.createElement('textarea');
          tempInput.value = message;
          tempInput.style.position = 'fixed';
          tempInput.style.opacity = '0';
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand('copy');
          document.body.removeChild(tempInput);
          Alert.alert('Успех', 'Информацията е копирана в клипборда');
        }
      } else {
        await Share.share({
          message: message,
        });
      }
    } catch (error: any) {
      console.error('Error sharing:', error);
      Alert.alert('Грешка', 'Неуспешно споделяне на информацията');
    }
  };

  const shareAsMessage = async (type: 'all' | 'phone' | 'address' | 'social') => {
    if (!info) return;

    let message = '';

    switch (type) {
      case 'phone':
        message = `${info.salon_name}\n📞 Телефон: ${info.phone}`;
        break;
      case 'address':
        message = `${info.salon_name}\n📍 Адрес: ${info.address}`;
        if (info.google_maps_url) {
          message += `\n🗺️ Карта: ${info.google_maps_url}`;
        } else if (info.latitude && info.longitude) {
          message += `\n🗺️ Карта: https://www.google.com/maps/search/?api=1&query=${info.latitude},${info.longitude}`;
        } else if (info.address) {
          const encodedAddress = encodeURIComponent(info.address);
          message += `\n🗺️ Карта: https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        }
        break;
      case 'social':
        message = `${info.salon_name}\n\nПоследвайте ни:\n`;
        if (info.instagram_url) message += `📸 Instagram: ${info.instagram_url}\n`;
        if (info.facebook_url) message += `👍 Facebook: ${info.facebook_url}\n`;
        if (info.tiktok_url) message += `🎵 TikTok: ${info.tiktok_url}\n`;
        break;
      case 'all':
        message = `${info.salon_name}\n\n`;
        message += `📞 Телефон: ${info.phone}\n`;
        message += `📍 Адрес: ${info.address}\n`;
        if (info.google_maps_url) {
          message += `🗺️ Карта: ${info.google_maps_url}\n`;
        } else if (info.latitude && info.longitude) {
          message += `🗺️ Карта: https://www.google.com/maps/search/?api=1&query=${info.latitude},${info.longitude}\n`;
        } else if (info.address) {
          const encodedAddress = encodeURIComponent(info.address);
          message += `🗺️ Карта: https://www.google.com/maps/search/?api=1&query=${encodedAddress}\n`;
        }
        if (info.instagram_url || info.facebook_url || info.tiktok_url) {
          message += `\nПоследвайте ни:\n`;
          if (info.instagram_url) message += `📸 Instagram: ${info.instagram_url}\n`;
          if (info.facebook_url) message += `👍 Facebook: ${info.facebook_url}\n`;
          if (info.tiktok_url) message += `🎵 TikTok: ${info.tiktok_url}\n`;
        }
        break;
    }

    router.push({
      pathname: '/(admin)/messages',
      params: { sharedMessage: message }
    });
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
          <Text style={styles.title}>Информация</Text>
          {!editing ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.editButtonText}>Редактирай</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.surface} />
              ) : (
                <>
                  <Save size={18} color={theme.colors.surface} />
                  <Text style={styles.saveButtonText}>Запази</Text>
                </>
              )}
            </TouchableOpacity>
            )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Име на салона</Text>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={info.salon_name}
              onChangeText={(text) => setInfo({ ...info, salon_name: text })}
              editable={editing}
              placeholder="Въведете име"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Phone size={20} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
              <Text style={styles.label}>Телефон</Text>
            </View>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={info.phone}
              onChangeText={(text) => setInfo({ ...info, phone: text })}
              editable={editing}
              placeholder="+359 888 123 456"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
            />
            {!editing && info.phone && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => Linking.openURL(`tel:${info.phone}`)}
                >
                  <Text style={styles.linkButtonText}>Обади се</Text>
                  <ExternalLink size={16} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => shareInfo('phone')}
                >
                  <Share2 size={16} color={theme.colors.secondary} />
                  <Text style={styles.shareButtonText}>Сподели</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => shareAsMessage('phone')}
                >
                  <MessageCircle size={16} color={theme.colors.accent} />
                  <Text style={styles.shareButtonText}>Съобщение</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <MapPin size={20} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
              <Text style={styles.label}>Адрес</Text>
            </View>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={info.address}
              onChangeText={(text) => setInfo({ ...info, address: text })}
              editable={editing}
              placeholder="Генерал Столетов 68, Варна"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            {editing && (
              <TouchableOpacity
                style={styles.mapSearchButton}
                onPress={searchAddressOnMap}
                disabled={searchingAddress}
              >
                {searchingAddress ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Map size={18} color={theme.colors.primary} />
                    <Text style={styles.mapSearchButtonText}>Намери на картата</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {!editing && info.address && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => shareInfo('address')}
                >
                  <Share2 size={16} color={theme.colors.secondary} />
                  <Text style={styles.shareButtonText}>Сподели</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => shareAsMessage('address')}
                >
                  <MessageCircle size={16} color={theme.colors.accent} />
                  <Text style={styles.shareButtonText}>Съобщение</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {info.latitude && info.longitude && (
            <View style={styles.section}>
              <Text style={styles.label}>Координати</Text>
              <Text style={styles.coordText}>
                {info.latitude.toFixed(6)}, {info.longitude.toFixed(6)}
              </Text>
              <View style={styles.mapPreviewContainer}>
                <Image
                  source={{
                    uri: `https://static-maps.yandex.ru/1.x/?ll=${info.longitude},${info.latitude}&size=600,300&z=15&l=map&pt=${info.longitude},${info.latitude},pm2rdm`,
                  }}
                  style={styles.mapPreview}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.mapOverlay}
                  onPress={() => openLink(info.google_maps_url)}
                >
                  <Text style={styles.mapOverlayText}>Отвори в Google Maps</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Google Maps линк</Text>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={info.google_maps_url}
              onChangeText={(text) => setInfo({ ...info, google_maps_url: text })}
              editable={editing}
              placeholder="https://maps.google.com/..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
            {!editing && info.google_maps_url && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => openLink(info.google_maps_url)}
              >
                <Text style={styles.linkButtonText}>Отвори карта</Text>
                <ExternalLink size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Clock size={20} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
              <Text style={styles.label}>Работно време</Text>
            </View>
            {Object.entries(DAYS_BG).map(([dayKey, dayName]) => {
              const dayData = info.working_hours_json[dayKey];
              if (!dayData) return null;

              return (
                <View key={dayKey} style={styles.dayRow}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{dayName}</Text>
                    <View style={styles.switchContainer}>
                      <Text style={styles.switchLabel}>
                        {dayData.closed ? 'Почивен' : 'Работен'}
                      </Text>
                      <Switch
                        value={!dayData.closed}
                        onValueChange={(value) => updateWorkingHours(dayKey, 'closed', !value)}
                        disabled={!editing}
                        trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                        thumbColor={theme.colors.surface}
                      />
                    </View>
                  </View>
                  {!dayData.closed && (
                    <View style={styles.timeInputs}>
                      <View style={styles.timeInput}>
                        <Text style={styles.timeLabel}>От:</Text>
                        <TextInput
                          style={[styles.timeField, !editing && styles.inputDisabled]}
                          value={dayData.start}
                          onChangeText={(text) => updateWorkingHours(dayKey, 'start', text)}
                          editable={editing}
                          placeholder="09:00"
                          placeholderTextColor={theme.colors.textMuted}
                        />
                      </View>
                      <View style={styles.timeInput}>
                        <Text style={styles.timeLabel}>До:</Text>
                        <TextInput
                          style={[styles.timeField, !editing && styles.inputDisabled]}
                          value={dayData.end}
                          onChangeText={(text) => updateWorkingHours(dayKey, 'end', text)}
                          editable={editing}
                          placeholder="18:00"
                          placeholderTextColor={theme.colors.textMuted}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.pricingButton}
            onPress={() => router.push('/(admin)/pricing' as any)}
          >
            <LinearGradient
              colors={theme.gradients.primary}
              style={styles.pricingButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <DollarSign size={24} color={theme.colors.surface} />
              <Text style={styles.pricingButtonText}>Ценоразпис</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Социални мрежи</Text>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Instagram size={20} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
              <Text style={styles.label}>Instagram</Text>
            </View>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={info.instagram_url}
              onChangeText={(text) => setInfo({ ...info, instagram_url: text })}
              editable={editing}
              placeholder="https://instagram.com/..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
            {!editing && info.instagram_url && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => openLink(info.instagram_url)}
              >
                <Text style={styles.linkButtonText}>Отвори</Text>
                <ExternalLink size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Facebook size={20} color={theme.colors.primary} style={{ marginRight: theme.spacing.xs }} />
              <Text style={styles.label}>Facebook</Text>
            </View>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={info.facebook_url}
              onChangeText={(text) => setInfo({ ...info, facebook_url: text })}
              editable={editing}
              placeholder="https://facebook.com/..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
            {!editing && info.facebook_url && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => openLink(info.facebook_url)}
              >
                <Text style={styles.linkButtonText}>Отвори</Text>
                <ExternalLink size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>TikTok</Text>
            <TextInput
              style={[styles.input, !editing && styles.inputDisabled]}
              value={info.tiktok_url}
              onChangeText={(text) => setInfo({ ...info, tiktok_url: text })}
              editable={editing}
              placeholder="https://tiktok.com/@..."
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
            {!editing && info.tiktok_url && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => openLink(info.tiktok_url)}
              >
                <Text style={styles.linkButtonText}>Отвори</Text>
                <ExternalLink size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {!editing && (info.instagram_url || info.facebook_url || info.tiktok_url) && (
            <View style={styles.section}>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => shareInfo('social')}
                >
                  <Share2 size={16} color={theme.colors.secondary} />
                  <Text style={styles.shareButtonText}>Сподели</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={() => shareAsMessage('social')}
                >
                  <MessageCircle size={16} color={theme.colors.accent} />
                  <Text style={styles.shareButtonText}>Съобщение</Text>
                </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  editButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accentLight,
  },
  editButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderColor: 'transparent',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    flex: 1,
  },
  linkButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    flex: 1,
  },
  shareButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.secondary,
  },
  shareAllContainer: {
    gap: theme.spacing.md,
  },
  shareAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.secondary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
  shareAllButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  mapSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
    justifyContent: 'center',
  },
  mapSearchButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  coordText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dayRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  dayName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  switchLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  timeInputs: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  timeInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  timeLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textLight,
  },
  timeField: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  mapPreviewContainer: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  mapPreview: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.border,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  mapOverlayText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  pricingButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  pricingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  pricingButtonText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.surface,
  },
});
