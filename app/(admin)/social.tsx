import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ScrollView,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Facebook, Instagram, ImageIcon, Sparkles, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '@/constants/theme';
import NotificationsModal from '@/components/NotificationsModal';
import NotificationBadge from '@/components/NotificationBadge';

type SocialPlatform = 'facebook' | 'instagram' | 'tiktok';

export default function AdminSocialScreen() {
  const [postText, setPostText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [showAIModal, setShowAIModal] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const pickImages = async () => {
    if (Platform.OS !== 'web') {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Грешка', 'Нуждаем се от разрешение за достъп до снимките');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset) => asset.uri);
      setImages([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const convertImageToBase64 = async (uri: string): Promise<string> => {
    try {
      console.log('Converting image to base64 using FileSystem:', uri);
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      console.log('Base64 conversion successful, length:', base64.length);
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  };

  const generateAIPost = async (platform: SocialPlatform) => {
    setShowAIModal(false);
    setGeneratingAI(true);

    const platformNames = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      tiktok: 'TikTok',
    };

    const platformName = platformNames[platform];

    // Platform-specific instructions
    let platformInstructions = '';
    if (platform === 'instagram' || platform === 'tiktok') {
      platformInstructions = 'Направи текста по-емоционален и неформален.';
    } else if (platform === 'facebook') {
      platformInstructions = 'Направи го разговорен, но убедителен.';
    }

    const basePrompt = `Създай рекламен текст за социалната мрежа: ${platformName}

Изисквания:
• ${images.length > 0 ? 'Анализирай прикачената снимка и отрази настроението и съдържанието й в текста' : 'Създай общ рекламен текст за салон за красота'}
• Текстът трябва да бъде естествен, ангажиращ и продаващ
• Използва език и стил, подходящи за ${platformName}
• ${platformInstructions}
• Интегрирай ясен призив към действие естествено в текста
• Добави 3–7 подходящи хаштага в края

ВАЖНО: Генерирай цялостен, естествен текст без етикети като "Заглавие:", "Основен текст:", "Призив към действие:" или "Хаштагове:". Просто напиши текста директно, като единен, течащ пост, завършващ с хаштагове на нов ред.

Пример за формат:
[Първи параграф с атрактивно начало]

[Втори параграф с основна информация и призив към действие]

#хаштаг1 #хаштаг2 #хаштаг3

Пиши на български език.`;

    try {
      let messageContent: any;
      let model = 'gpt-4-turbo';

      if (images.length > 0) {
        // Convert first image to base64
        console.log('Converting image to base64...');
        const base64Image = await convertImageToBase64(images[0]);
        console.log('Image converted, length:', base64Image.length);

        messageContent = [
          {
            type: 'text',
            text: basePrompt,
          },
          {
            type: 'image_url',
            image_url: {
              url: base64Image,
              detail: 'high',
            },
          },
        ];
        model = 'gpt-4o';
      } else {
        messageContent = basePrompt;
      }

      console.log('Sending request to OpenAI with model:', model);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'Ти си експерт по дигитален маркетинг и копирайтинг за салони за красота. Създавай ангажиращо и професионално съдържание.',
            },
            {
              role: 'user',
              content: messageContent,
            },
          ],
          max_tokens: 800,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error details:', JSON.stringify(errorData, null, 2));
        Alert.alert(
          'Грешка от API',
          `${errorData.error?.message || 'Неизвестна грешка'}\n\nМодел: ${model}`
        );
        throw new Error('API error');
      }

      const data = await response.json();
      console.log('Response received:', data);
      const generatedText = data.choices[0]?.message?.content || '';
      setPostText(generatedText.trim());

      Alert.alert('Успех!', 'Постът е генериран успешно');
    } catch (error: any) {
      console.error('Error generating AI post:', error);
      Alert.alert(
        'Грешка',
        `Неуспешно генериране на пост с AI.\n\n${error.message || 'Проверете API ключа и опитайте отново.'}`
      );
    } finally {
      setGeneratingAI(false);
    }
  };

  const publishPost = (platform: SocialPlatform) => {
    if (!postText.trim() && images.length === 0) {
      Alert.alert('Грешка', 'Моля, добавете текст или снимки');
      return;
    }

    const platformUrls = {
      facebook: 'https://www.facebook.com',
      instagram: 'https://www.instagram.com',
      tiktok: 'https://www.tiktok.com',
    };

    const platformNames = {
      facebook: 'Facebook',
      instagram: 'Instagram',
      tiktok: 'TikTok',
    };

    Alert.alert(
      `Публикуване в ${platformNames[platform]}`,
      `Ще бъдете пренасочени към ${platformNames[platform]} за да публикувате поста.`,
      [
        {
          text: 'Публикувай',
          onPress: () => {
            Linking.openURL(platformUrls[platform]);
            setPostText('');
            setImages([]);
          },
        },
        { text: 'Отказ', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradients.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Социални мрежи</Text>
            <Text style={styles.headerSubtitle}>Създайте и публикувайте постове</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <NotificationBadge size={24} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.editorCard}>
          <Text style={styles.sectionTitle}>Създайте пост</Text>

          <View style={styles.imagesSection}>
            <View style={styles.imagePickerContainer}>
              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImages}>
                <ImageIcon size={24} color={theme.colors.primary} />
                <Text style={styles.imagePickerText}>Добави снимки</Text>
              </TouchableOpacity>
            </View>

            {images.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.imagesList}
              >
                {images.map((uri, index) => (
                  <View key={index} style={styles.imagePreviewContainer}>
                    <Image source={{ uri }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <X size={16} color={theme.colors.surface} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.textSection}>
            <View style={styles.textHeader}>
              <Text style={styles.textLabel}>Текст на поста</Text>
              <TouchableOpacity
                style={styles.aiButton}
                onPress={() => setShowAIModal(true)}
                disabled={generatingAI}
              >
                {generatingAI ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Sparkles size={18} color={theme.colors.primary} />
                    <Text style={styles.aiButtonText}>Генерирай с AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Напиши пост или създай с AI"
              placeholderTextColor={theme.colors.textMuted}
              value={postText}
              onChangeText={setPostText}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{postText.length} символа</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.publishTitle}>Публикувай в:</Text>
          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => publishPost('facebook')}
            >
              <View style={[styles.socialIconContainer, { backgroundColor: '#1877F2' }]}>
                <Facebook size={32} color={theme.colors.surface} />
              </View>
              <Text style={styles.socialButtonText}>Facebook</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => publishPost('instagram')}
            >
              <LinearGradient
                colors={['#833AB4', '#FD1D1D', '#FCAF45']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.socialIconContainer}
              >
                <Instagram size={32} color={theme.colors.surface} />
              </LinearGradient>
              <Text style={styles.socialButtonText}>Instagram</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => publishPost('tiktok')}
            >
              <View style={[styles.socialIconContainer, { backgroundColor: '#000000' }]}>
                <Text style={styles.tiktokIcon}>🎵</Text>
              </View>
              <Text style={styles.socialButtonText}>TikTok</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showAIModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAIModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Избери платформа за AI генерация</Text>
            <Text style={styles.modalSubtitle}>
              AI ще създаде пост, оптимизиран за избраната платформа
            </Text>

            <View style={styles.aiPlatformButtons}>
              <TouchableOpacity
                style={styles.aiPlatformButton}
                onPress={() => generateAIPost('facebook')}
              >
                <View style={[styles.aiIconContainer, { backgroundColor: '#1877F2' }]}>
                  <Facebook size={40} color={theme.colors.surface} />
                </View>
                <Text style={styles.aiPlatformText}>Facebook</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.aiPlatformButton}
                onPress={() => generateAIPost('instagram')}
              >
                <LinearGradient
                  colors={['#833AB4', '#FD1D1D', '#FCAF45']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aiIconContainer}
                >
                  <Instagram size={40} color={theme.colors.surface} />
                </LinearGradient>
                <Text style={styles.aiPlatformText}>Instagram</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.aiPlatformButton}
                onPress={() => generateAIPost('tiktok')}
              >
                <View style={[styles.aiIconContainer, { backgroundColor: '#000000' }]}>
                  <Text style={styles.tiktokIconLarge}>🎵</Text>
                </View>
                <Text style={styles.aiPlatformText}>TikTok</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowAIModal(false)}
            >
              <Text style={styles.modalCancelText}>Отказ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
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
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.md,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  editorCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  imagesSection: {
    marginBottom: theme.spacing.lg,
  },
  imagePickerContainer: {
    marginBottom: theme.spacing.md,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  imagePickerText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  imagesList: {
    flexDirection: 'row',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: theme.spacing.sm,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: theme.borderRadius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textSection: {
    marginBottom: theme.spacing.lg,
  },
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  textLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.borderRadius.sm,
  },
  aiButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  charCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg,
  },
  publishTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: theme.spacing.md,
  },
  socialButton: {
    alignItems: 'center',
    flex: 1,
  },
  socialIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  socialButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  tiktokIcon: {
    fontSize: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  aiPlatformButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.xl,
  },
  aiPlatformButton: {
    alignItems: 'center',
  },
  aiIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  aiPlatformText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  tiktokIconLarge: {
    fontSize: 40,
  },
  modalCancelButton: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
