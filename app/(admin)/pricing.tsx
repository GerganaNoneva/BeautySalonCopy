import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DollarSign, Clock, Edit2, Trash2, Plus, ImageIcon, X, Bell } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import PromotionNotificationModal from '@/components/PromotionNotificationModal';

type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  image_url: string | null;
};

type Promotion = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  image_url: string | null;
};

export default function AdminPricingScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'services' | 'promotions'>('services');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedPromotionForNotification, setSelectedPromotionForNotification] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: '',
    price: '',
    image_url: '',
  });

  useEffect(() => {
    loadServices();
    loadPromotions();
  }, []);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('name');

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('Error loading promotions:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration_minutes: '',
      price: '',
      image_url: '',
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.2,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData({ ...formData, image_url: result.assets[0].uri });
    }
  };

  const handleEdit = (service: Service) => {
    setFormData({
      name: service.name,
      description: service.description,
      duration_minutes: service.duration_minutes.toString(),
      price: service.price.toString(),
      image_url: service.image_url || '',
    });
    setEditingId(service.id);
    setShowAddForm(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.duration_minutes || !formData.price) {
      Alert.alert('Грешка', 'Моля, попълнете всички задължителни полета');
      return;
    }

    try {
      let finalImageUrl = formData.image_url;

      if (formData.image_url && !formData.image_url.startsWith('data:')) {
        const response = await fetch(formData.image_url);
        const arrayBuffer = await response.arrayBuffer();

        // Convert ArrayBuffer to base64
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = 'data:image/jpeg;base64,' + btoa(binary);
        finalImageUrl = base64;
      }

      const serviceData = {
        name: formData.name,
        description: formData.description,
        duration_minutes: parseInt(formData.duration_minutes),
        price: parseFloat(formData.price),
        image_url: finalImageUrl || null,
      };

      if (editingId) {
        const { data: oldService } = await supabase
          .from('services')
          .select('price')
          .eq('id', editingId)
          .single();

        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingId);

        if (error) throw error;

        if (oldService && oldService.price !== serviceData.price) {
          const { data: clients } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'client');

          if (clients && clients.length > 0) {
            const priceChange = serviceData.price > oldService.price ? 'увеличена' : 'намалена';
            const notifications = clients.map(client => ({
              user_id: client.id,
              type: 'price_change',
              title: 'Промяна в ценоразписа',
              body: `Цената на услугата "${serviceData.name}" е ${priceChange} от ${oldService.price} лв на ${serviceData.price} лв`,
              data: {
                service_id: editingId,
                old_price: oldService.price,
                new_price: serviceData.price,
              },
            }));

            await supabase.from('notifications').insert(notifications);
          }
        }
      } else {
        const { error } = await supabase.from('services').insert(serviceData);

        if (error) throw error;
      }

      loadServices();
      resetForm();
      Alert.alert('Успех', editingId ? 'Услугата е обновена' : 'Услугата е добавена');
    } catch (error) {
      Alert.alert('Грешка', 'Неуспешно запазване');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Изтриване на услуга',
      'Сигурни ли сте, че искате да изтриете тази услуга?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изтрий',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('services')
                .delete()
                .eq('id', id);

              if (error) throw error;
              loadServices();
            } catch (error) {
              Alert.alert('Грешка', 'Неуспешно изтриване');
            }
          },
        },
      ]
    );
  };

  const handleEditPromotion = (promotion: Promotion) => {
    setFormData({
      name: promotion.name,
      description: promotion.description,
      duration_minutes: promotion.duration_minutes.toString(),
      price: promotion.price.toString(),
      image_url: promotion.image_url || '',
    });
    setEditingId(promotion.id);
    setShowAddForm(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const handleSavePromotion = async () => {
    if (!formData.name || !formData.duration_minutes || !formData.price) {
      Alert.alert('Грешка', 'Моля, попълнете всички задължителни полета');
      return;
    }

    try {
      let imageUrl = formData.image_url;

      // Upload image if it's a local file (starts with file://)
      if (imageUrl && imageUrl.startsWith('file://')) {
        try {
          const response = await fetch(imageUrl);
          const arrayBuffer = await response.arrayBuffer();
          const fileExt = imageUrl.split('.').pop();
          const fileName = `promotion-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('promotion-images')
            .upload(filePath, arrayBuffer, {
              contentType: `image/${fileExt}`,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('promotion-images')
            .getPublicUrl(filePath);

          imageUrl = urlData.publicUrl;
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          Alert.alert('Предупреждение', 'Снимката не можа да бъде качена, но промоцията ще бъде запазена');
          imageUrl = '';
        }
      }

      const promotionData: any = {
        name: formData.name,
        description: formData.description,
        duration_minutes: parseInt(formData.duration_minutes),
        price: parseFloat(formData.price),
      };

      if (imageUrl) {
        promotionData.image_url = imageUrl;
      }

      if (editingId) {
        const { data: oldPromotion } = await supabase
          .from('promotions')
          .select('*')
          .eq('id', editingId)
          .single();

        const { error } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', editingId);

        if (error) throw error;

        if (oldPromotion) {
          const hasChanges =
            oldPromotion.price !== promotionData.price ||
            oldPromotion.name !== promotionData.name ||
            oldPromotion.description !== promotionData.description ||
            oldPromotion.duration_minutes !== promotionData.duration_minutes;

          if (hasChanges) {
            const { data: clients } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'client');

            if (clients && clients.length > 0) {
              let notificationBody = '';
              if (oldPromotion.price !== promotionData.price) {
                notificationBody = `Промоцията "${promotionData.name}" вече е ${promotionData.price} лв (преди: ${oldPromotion.price} лв)`;
              } else {
                notificationBody = `Промоцията "${promotionData.name}" е обновена. Разгледайте промените!`;
              }

              const notifications = clients.map(client => ({
                user_id: client.id,
                type: 'price_change',
                title: 'Промяна в промоция',
                body: notificationBody,
                data: {
                  promotion_id: editingId,
                  promotion_name: promotionData.name,
                },
              }));

              await supabase.from('notifications').insert(notifications);
            }
          }
        }
      } else {
        const { data: newPromotion, error } = await supabase
          .from('promotions')
          .insert(promotionData)
          .select()
          .single();

        if (error) throw error;

        if (newPromotion) {
          const { data: clients } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'client');

          if (clients && clients.length > 0) {
            const notifications = clients.map(client => ({
              user_id: client.id,
              type: 'new_promotion',
              title: 'Нова промоция!',
              body: `Разгледайте новата ни промоция: ${promotionData.name} - само ${promotionData.price} лв!`,
              data: {
                promotion_id: newPromotion.id,
                promotion_name: promotionData.name,
                price: promotionData.price,
              },
            }));

            await supabase.from('notifications').insert(notifications);
          }
        }
      }

      loadPromotions();
      resetForm();
      Alert.alert('Успех', editingId ? 'Промоцията е обновена' : 'Промоцията е добавена успешно и уведомленията са изпратени до всички клиенти!');
    } catch (error) {
      Alert.alert('Грешка', 'Неуспешно запазване');
    }
  };

  const handleDeletePromotion = async (id: string) => {
    Alert.alert(
      'Изтриване на промоция',
      'Сигурни ли сте, че искате да изтриете тази промоция?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изтрий',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', id);

              if (error) throw error;
              loadPromotions();
            } catch (error) {
              Alert.alert('Грешка', 'Неуспешно изтриване');
            }
          },
        },
      ]
    );
  };

  const handleNotifyClients = (promotion: Promotion) => {
    setSelectedPromotionForNotification({
      id: promotion.id,
      name: promotion.name,
    });
    setShowNotificationModal(true);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Ценоразпис</Text>
        <Text style={styles.headerSubtitle}>Управление на услуги и промоции</Text>
      </LinearGradient>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'services' && styles.tabActive]}
          onPress={() => {
            setActiveTab('services');
            resetForm();
          }}
        >
          <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
            Услуги
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'promotions' && styles.tabActive]}
          onPress={() => {
            setActiveTab('promotions');
            resetForm();
          }}
        >
          <Text style={[styles.tabText, activeTab === 'promotions' && styles.tabTextActive]}>
            Промоции
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView ref={scrollViewRef} style={styles.content}>
          {!showAddForm && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddForm(true)}
            >
              <LinearGradient
                colors={theme.gradients.secondary}
                style={styles.addButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Plus size={20} color={theme.colors.surface} />
                <Text style={styles.addButtonText}>
                  {activeTab === 'services' ? 'Добави услуга' : 'Добави промоция'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {showAddForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {activeTab === 'services'
                  ? (editingId ? 'Редактирай услуга' : 'Нова услуга')
                  : (editingId ? 'Редактирай промоция' : 'Нова промоция')}
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Име на услугата *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Маникюр класик"
                  placeholderTextColor={theme.colors.textMuted}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Описание</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Кратко описание на услугата"
                  placeholderTextColor={theme.colors.textMuted}
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Снимка</Text>
                <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                  <ImageIcon size={20} color={theme.colors.primary} />
                  <Text style={styles.imagePickerText}>{formData.image_url ? 'Промени снимка' : 'Избери снимка'}</Text>
                </TouchableOpacity>
                {formData.image_url && (
                  <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: formData.image_url }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => setFormData({ ...formData, image_url: '' })}
                    >
                      <X size={16} color={theme.colors.surface} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.label}>Продължителност (мин) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="60"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formData.duration_minutes}
                    onChangeText={(text) =>
                      setFormData({ ...formData, duration_minutes: text })
                    }
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.label}>Цена (лв) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="45.00"
                    placeholderTextColor={theme.colors.textMuted}
                    value={formData.price}
                    onChangeText={(text) => setFormData({ ...formData, price: text })}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={resetForm}
                >
                  <Text style={styles.cancelButtonText}>Отказ</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.formButton}
                  onPress={activeTab === 'services' ? handleSave : handleSavePromotion}
                >
                  <LinearGradient
                    colors={theme.gradients.primary}
                    style={styles.saveButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.saveButtonText}>Запази</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === 'services' ? (
            <View style={styles.servicesList}>
              <Text style={styles.sectionTitle}>Услуги ({services.length})</Text>

              {services.map((service, index) => (
              <View key={service.id} style={styles.serviceCard}>
                <LinearGradient
                  colors={
                    index % 2 === 0
                      ? [theme.colors.surface, theme.colors.accentLight]
                      : [theme.colors.accentLight, theme.colors.surface]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.serviceCardGradient}
                >
                  {service.image_url && (
                    <Image source={{ uri: service.image_url }} style={styles.serviceImage} />
                  )}

                  <View style={styles.serviceHeader}>
                    <View style={styles.serviceNameContainer}>
                      <View style={styles.iconCircle}>
                        <DollarSign size={20} color={theme.colors.primary} />
                      </View>
                      <Text style={styles.serviceName}>{service.name}</Text>
                    </View>
                    <View style={styles.serviceActions}>
                      <TouchableOpacity
                        onPress={() => handleEdit(service)}
                        style={styles.actionButton}
                      >
                        <Edit2 size={18} color={theme.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(service.id)}
                        style={styles.actionButton}
                      >
                        <Trash2 size={18} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {service.description && (
                    <Text style={styles.serviceDescription}>{service.description}</Text>
                  )}

                  <View style={styles.serviceFooter}>
                    <View style={styles.detailBadge}>
                      <Clock size={16} color={theme.colors.primary} />
                      <Text style={styles.detailBadgeText}>{service.duration_minutes} мин</Text>
                    </View>

                    <View style={styles.priceContainer}>
                      <Text style={styles.priceAmount}>{service.price.toFixed(2)}</Text>
                      <Text style={styles.priceCurrency}>лв</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
              ))}
            </View>
          ) : (
            <View style={styles.servicesList}>
              <Text style={styles.sectionTitle}>Промоции ({promotions.length})</Text>

              {promotions.map((promotion, index) => (
                <View key={promotion.id} style={styles.serviceCard}>
                  <LinearGradient
                    colors={[theme.colors.accent, theme.colors.accentLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.serviceCardGradient}
                  >
                    <View style={styles.serviceHeader}>
                      <View style={styles.serviceNameContainer}>
                        <View style={styles.iconCircle}>
                          <DollarSign size={20} color={theme.colors.surface} />
                        </View>
                        <Text style={[styles.serviceName, { color: theme.colors.surface }]}>
                          {promotion.name}
                        </Text>
                      </View>
                      <View style={styles.serviceActions}>
                        <TouchableOpacity
                          onPress={() => handleEditPromotion(promotion)}
                          style={styles.actionButton}
                        >
                          <Edit2 size={18} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeletePromotion(promotion.id)}
                          style={styles.actionButton}
                        >
                          <Trash2 size={18} color={theme.colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {promotion.description && (
                      <Text style={[styles.serviceDescription, { color: theme.colors.surface, opacity: 0.9 }]}>
                        {promotion.description}
                      </Text>
                    )}

                    <View style={styles.serviceFooter}>
                      <View style={[styles.detailBadge, { backgroundColor: theme.colors.surface }]}>
                        <Clock size={16} color={theme.colors.accent} />
                        <Text style={[styles.detailBadgeText, { color: theme.colors.accent }]}>
                          {promotion.duration_minutes} мин
                        </Text>
                      </View>

                      <View style={styles.priceContainer}>
                        <Text style={[styles.priceAmount, { color: theme.colors.surface }]}>
                          {promotion.price.toFixed(2)}
                        </Text>
                        <Text style={[styles.priceCurrency, { color: theme.colors.surface }]}>лв</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {selectedPromotionForNotification && (
        <PromotionNotificationModal
          visible={showNotificationModal}
          promotionId={selectedPromotionForNotification.id}
          promotionName={selectedPromotionForNotification.name}
          onClose={() => {
            setShowNotificationModal(false);
            setSelectedPromotionForNotification(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 50,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xs,
    ...theme.shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: theme.colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingTop: theme.spacing.lg,
  },
  addButton: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  formTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  formButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  formButton: {
    flex: 1,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  saveButtonGradient: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  servicesList: {
    paddingHorizontal: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  serviceCard: {
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.lg,
  },
  serviceCardGradient: {
    padding: theme.spacing.lg,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  serviceNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  serviceName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  serviceActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    padding: theme.spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  serviceDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  detailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  detailBadgeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.xs,
  },
  priceAmount: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  priceCurrency: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  imagePickerText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    marginTop: theme.spacing.sm,
    position: 'relative',
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: theme.borderRadius.md,
  },
  notifyButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  removeImageButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
  },
});
