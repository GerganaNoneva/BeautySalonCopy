import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Image as RNImage,
  Keyboard,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Upload, Trash2, ThumbsUp, ThumbsDown, Camera, MessageCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { useLocalSearchParams } from 'expo-router';
import NotificationsModal from '@/components/NotificationsModal';
import NotificationBadge from '@/components/NotificationBadge';

type GalleryLike = {
  id: string;
  user_id: string;
  is_like: boolean;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
};

type GalleryComment = {
  id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
};

type GalleryPhoto = {
  id: string;
  image_url: string;
  caption: string;
  created_at: string;
  likes_count?: number;
  dislikes_count?: number;
  comments_count?: number;
  likes?: GalleryLike[];
  comments?: GalleryComment[];
};

export default function AdminGalleryScreen() {
  const { scrollToPhotoId } = useLocalSearchParams<{ scrollToPhotoId?: string }>();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedPhotoId, setExpandedPhotoId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const photoRefs = useRef<{ [key: string]: View | null }>({});
  const hasManuallyChangedPhoto = useRef(false);
  const uploadButtonRef = useRef<View>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    loadPhotos();

    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    const likesChannel = supabase
      .channel('gallery_likes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gallery_likes',
        },
        () => {
          loadPhotos();
        }
      )
      .subscribe();

    const commentsChannel = supabase
      .channel('gallery_comments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gallery_comments',
        },
        () => {
          loadPhotos();
        }
      )
      .subscribe();

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      likesChannel.unsubscribe();
      commentsChannel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (scrollToPhotoId && photos.length > 0 && photoRefs.current[scrollToPhotoId] && !hasManuallyChangedPhoto.current) {
      if (expandedPhotoId !== scrollToPhotoId) {
        setExpandedPhotoId(scrollToPhotoId);
        loadPhotoDetails(scrollToPhotoId);
        markCommentNotificationsAsRead(scrollToPhotoId);
      }

      setTimeout(() => {
        photoRefs.current[scrollToPhotoId]?.measureLayout(
          scrollViewRef.current as any,
          (x, y) => {
            scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
          },
          () => {}
        );
      }, 300);
    }
  }, [scrollToPhotoId, photos]);

  const loadPhotoDetails = async (photoId: string) => {
    try {
      const { data: likesData } = await supabase
        .from('gallery_likes')
        .select('id, user_id, is_like, created_at, profiles!user_id(full_name)')
        .eq('photo_id', photoId)
        .order('created_at', { ascending: false });

      const { data: commentsData } = await supabase
        .from('gallery_comments')
        .select('id, user_id, comment_text, created_at, profiles!user_id(full_name)')
        .eq('photo_id', photoId)
        .order('created_at', { ascending: false });

      setPhotos((prev) =>
        prev.map((photo) =>
          photo.id === photoId
            ? {
                ...photo,
                likes: (likesData as any) || [],
                comments: (commentsData as any) || [],
              }
            : photo
        )
      );
    } catch (error) {
      console.error('Error loading photo details:', error);
    }
  };

  const togglePhotoExpanded = async (photoId: string) => {
    hasManuallyChangedPhoto.current = true;
    if (expandedPhotoId === photoId) {
      setExpandedPhotoId(null);
    } else {
      setExpandedPhotoId(photoId);
      loadPhotoDetails(photoId);
      await markCommentNotificationsAsRead(photoId);
    }
  };

  const markCommentNotificationsAsRead = async (photoId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('type', 'gallery_comment')
        .contains('data', { photo_id: photoId })
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking comment notifications as read:', error);
    }
  };

  const loadPhotos = async () => {
    try {
      const { data: photosData, error } = await supabase
        .from('gallery_photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const photosWithStats = await Promise.all(
        (photosData || []).map(async (photo) => {
          const { count: likesCount } = await supabase
            .from('gallery_likes')
            .select('*', { count: 'exact', head: true })
            .eq('photo_id', photo.id)
            .eq('is_like', true);

          const { count: dislikesCount } = await supabase
            .from('gallery_likes')
            .select('*', { count: 'exact', head: true })
            .eq('photo_id', photo.id)
            .eq('is_like', false);

          const { count: commentsCount } = await supabase
            .from('gallery_comments')
            .select('*', { count: 'exact', head: true })
            .eq('photo_id', photo.id);

          return {
            ...photo,
            likes_count: likesCount || 0,
            dislikes_count: dislikesCount || 0,
            comments_count: commentsCount || 0,
          };
        })
      );

      setPhotos(photosWithStats);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Извинение', 'Нуждаеме се от разрешение за достъп до галерията');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.2,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadPhoto = async () => {
    if (!selectedImage) {
      Alert.alert('Грешка', 'Моля, изберете снимка');
      return;
    }

    setUploading(true);

    try {
      let finalImageUrl = selectedImage;

      if (!selectedImage.startsWith('data:')) {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        finalImageUrl = base64;
      }

      const { error } = await supabase.from('gallery_photos').insert({
        image_url: finalImageUrl,
        caption: caption || '',
      });

      if (error) throw error;

      setCaption('');
      setSelectedImage(null);
      loadPhotos();

      if (Platform.OS === 'web') {
        alert('Снимката е качена успешно! Клиентите са уведомени.');
      } else {
        Alert.alert('Успех', 'Снимката е качена и клиентите са уведомени');
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (Platform.OS === 'web') {
        alert('Грешка при качване на снимката');
      } else {
        Alert.alert('Грешка', 'Неуспешно качване на снимката');
      }
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (id: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Сигурни ли сте, че искате да изтриете тази снимка?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Изтриване на снимка',
            'Сигурни ли сте, че искате да изтриете тази снимка?',
            [
              { text: 'Отказ', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Изтрий', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('gallery_photos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (Platform.OS === 'web') {
        alert('Снимката е изтрита успешно');
      } else {
        Alert.alert('Успех', 'Снимката е изтрита успешно');
      }

      loadPhotos();
    } catch (error) {
      console.error('Delete error:', error);
      if (Platform.OS === 'web') {
        alert('Грешка при изтриване на снимката');
      } else {
        Alert.alert('Грешка', 'Неуспешно изтриване');
      }
    }
  };

  const scrollToUploadButton = () => {
    if (uploadButtonRef.current && scrollViewRef.current) {
      setTimeout(() => {
        uploadButtonRef.current?.measureLayout(
          scrollViewRef.current as any,
          (x, y, width, height) => {
            // Calculate screen height
            const screenHeight = Dimensions.get('window').height;

            // Position button exactly above keyboard
            // scrollY = button top position - (screen height - keyboard height - button height)
            const targetY = y - (screenHeight - keyboardHeight - height - 10);

            scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
          },
          () => {}
        );
      }, 100);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Галерия</Text>
            <Text style={styles.headerSubtitle}>Управление на снимки</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <NotificationBadge size={24} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
      </LinearGradient>


      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView ref={scrollViewRef} style={styles.photosList}>
          <View style={styles.uploadSection}>
            <Text style={styles.uploadTitle}>Качи нова снимка</Text>

            {selectedImage && (
              <RNImage
                source={{ uri: selectedImage }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}

            <TextInput
              style={styles.captionInput}
              placeholder="Добави описание към снимката (незадължително)"
              placeholderTextColor={theme.colors.textMuted}
              value={caption}
              onChangeText={setCaption}
              onFocus={scrollToUploadButton}
              multiline
              numberOfLines={3}
            />

            <View style={styles.uploadButtons}>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={pickImage}
              >
                <Camera size={20} color={theme.colors.primary} />
                <Text style={styles.selectButtonText}>
                  {selectedImage ? 'Смени снимката' : 'Избери снимка'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                ref={uploadButtonRef}
                style={[styles.uploadButton, (!selectedImage || uploading) && styles.uploadButtonDisabled]}
                onPress={uploadPhoto}
                disabled={!selectedImage || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={theme.colors.surface} />
                ) : (
                  <>
                    <Upload size={20} color={theme.colors.surface} />
                    <Text style={styles.uploadButtonText}>Качи</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Качени снимки ({photos.length})</Text>

          {photos.length === 0 ? (
            <View style={styles.emptyState}>
              <Image size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyStateText}>Все още няма снимки</Text>
            </View>
          ) : (
            photos.map((photo) => (
              <View
                key={photo.id}
                style={[
                  styles.photoCard,
                  scrollToPhotoId === photo.id && styles.photoCardHighlight
                ]}
                ref={(ref) => (photoRefs.current[photo.id] = ref)}
              >
                <RNImage
                  source={{ uri: photo.image_url }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />

                <View style={styles.photoHeader}>
                  <TouchableOpacity
                    onPress={() => deletePhoto(photo.id)}
                    style={styles.deleteButton}
                  >
                    <Trash2 size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>

                <View style={styles.photoInfo}>
                  {photo.caption && (
                    <Text style={styles.photoCaption}>{photo.caption}</Text>
                  )}

                  <Text style={styles.photoDate}>
                    {new Date(photo.created_at).toLocaleDateString('bg-BG', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>

                  <TouchableOpacity
                    style={styles.statsContainer}
                    onPress={() => togglePhotoExpanded(photo.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.statCard}>
                      <ThumbsUp size={20} color={theme.colors.success} />
                      <Text style={styles.statNumber}>{photo.likes_count || 0}</Text>
                      <Text style={styles.statLabel}>Харесвания</Text>
                    </View>
                    <View style={styles.statCard}>
                      <ThumbsDown size={20} color={theme.colors.error} />
                      <Text style={styles.statNumber}>{photo.dislikes_count || 0}</Text>
                      <Text style={styles.statLabel}>Нехаресвания</Text>
                    </View>
                    <View style={styles.statCard}>
                      <MessageCircle size={20} color={theme.colors.primary} />
                      <Text style={styles.statNumber}>{photo.comments_count || 0}</Text>
                      <Text style={styles.statLabel}>Коментари</Text>
                    </View>
                  </TouchableOpacity>

                  {expandedPhotoId === photo.id && (
                    <View style={styles.detailsContainer}>
                      {photo.likes && photo.likes.length > 0 && (
                        <View style={styles.detailsSection}>
                          <View style={styles.detailsHeader}>
                            <ThumbsUp size={18} color={theme.colors.success} />
                            <Text style={styles.detailsTitle}>Харесвания ({photo.likes.filter(l => l.is_like).length})</Text>
                          </View>
                          {photo.likes.filter(like => like.is_like).map((like) => (
                            <View key={like.id} style={styles.detailItem}>
                              <Text style={styles.detailName}>{like.profiles?.full_name || 'Анонимен'}</Text>
                              <Text style={styles.detailDate}>
                                {new Date(like.created_at).toLocaleDateString('bg-BG')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {photo.likes && photo.likes.filter(l => !l.is_like).length > 0 && (
                        <View style={styles.detailsSection}>
                          <View style={styles.detailsHeader}>
                            <ThumbsDown size={18} color={theme.colors.error} />
                            <Text style={styles.detailsTitle}>Нехаресвания ({photo.likes.filter(l => !l.is_like).length})</Text>
                          </View>
                          {photo.likes.filter(like => !like.is_like).map((like) => (
                            <View key={like.id} style={styles.detailItem}>
                              <Text style={styles.detailName}>{like.profiles?.full_name || 'Анонимен'}</Text>
                              <Text style={styles.detailDate}>
                                {new Date(like.created_at).toLocaleDateString('bg-BG')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {photo.comments && photo.comments.length > 0 && (
                        <View style={styles.detailsSection}>
                          <View style={styles.detailsHeader}>
                            <MessageCircle size={18} color={theme.colors.primary} />
                            <Text style={styles.detailsTitle}>Коментари ({photo.comments.length})</Text>
                          </View>
                          {photo.comments.map((comment) => (
                            <View key={comment.id} style={styles.commentItem}>
                              <View style={styles.commentHeader}>
                                <Text style={styles.commentName}>
                                  {comment.profiles?.full_name || 'Анонимен'}
                                </Text>
                                <Text style={styles.commentDate}>
                                  {new Date(comment.created_at).toLocaleDateString('bg-BG')}
                                </Text>
                              </View>
                              <Text style={styles.commentText}>{comment.comment_text}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {(!photo.likes || photo.likes.length === 0) &&
                       (!photo.comments || photo.comments.length === 0) && (
                        <Text style={styles.noDetailsText}>Все още няма реакции или коментари</Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

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
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
  },
  uploadSection: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  imagePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    gap: theme.spacing.sm,
  },
  imagePickerText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  previewContainer: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    marginHorizontal: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
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
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.sm,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photosList: {
    flex: 1,
    paddingTop: theme.spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyStateText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  photoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  photoCardHighlight: {
    borderWidth: 3,
    borderColor: theme.colors.primary,
    ...theme.shadows.xl,
  },
  photoImage: {
    width: '100%',
    height: 250,
    backgroundColor: theme.colors.border,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  deleteButton: {
    padding: theme.spacing.xs,
  },
  photoCaption: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    fontWeight: '500',
  },
  photoDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  uploadTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  captionInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  selectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accentLight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  selectButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  photoInfo: {
    padding: theme.spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statNumber: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  detailsContainer: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  detailsSection: {
    gap: theme.spacing.sm,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailsTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  detailName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '500',
  },
  detailDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  commentItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  commentName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
  },
  commentDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  commentText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 20,
  },
  noDetailsText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: theme.spacing.md,
  },
});
