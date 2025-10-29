import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Image as RNImage,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, HeartCrack, Image as ImageIcon, MessageCircle, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationsModal from '@/components/NotificationsModal';
import NotificationBadge from '@/components/NotificationBadge';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GalleryPhoto = {
  id: string;
  image_url: string;
  caption: string;
  likes_count: number;
  dislikes_count: number;
};

type Comment = {
  id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
};

type PhotoReactions = {
  [photoId: string]: boolean | null;
};

export default function ClientGalleryScreen() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsMap, setCommentsMap] = useState<{ [photoId: string]: Comment[] }>({});
  const [newComment, setNewComment] = useState('');
  const [userReactions, setUserReactions] = useState<PhotoReactions>({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadPhotos();
    markGalleryNotificationsAsRead();

    // Subscribe to new gallery photos
    const photosChannel = supabase
      .channel(`gallery_photos_changes_client_${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gallery_photos',
        },
        (payload) => {
          loadPhotos();
          // Mark new photo notification as read when client sees it
          if (payload.eventType === 'INSERT' && user) {
            setTimeout(() => markGalleryNotificationsAsRead(), 500);
          }
        }
      )
      .subscribe((status) => {
      });

    const likesChannel = supabase
      .channel(`gallery_likes_changes_client_${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gallery_likes',
        },
        (payload) => {
          loadPhotos();
        }
      )
      .subscribe((status) => {
      });

    const commentsChannel = supabase
      .channel(`gallery_comments_changes_client_${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gallery_comments',
        },
        (payload) => {
          loadPhotos();
        }
      )
      .subscribe((status) => {
      });

    return () => {
      photosChannel.unsubscribe();
      likesChannel.unsubscribe();
      commentsChannel.unsubscribe();
    };
  }, [user]);

  const markGalleryNotificationsAsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'new_photo')
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking gallery notifications as read:', error);
    }
  };

  const loadPhotos = async () => {
    try {
      const { data: photosData, error: photosError } = await supabase
        .from('gallery_photos')
        .select('id, image_url, caption, created_at')
        .order('created_at', { ascending: false });

      if (photosError) throw photosError;

      const photosWithCounts = await Promise.all(
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

          return {
            ...photo,
            likes_count: likesCount || 0,
            dislikes_count: dislikesCount || 0,
          };
        })
      );

      setPhotos(photosWithCounts);
      await loadAllUserReactions(photosWithCounts.map(p => p.id));
      await loadAllComments(photosWithCounts.map(p => p.id));
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUserReactions = async (photoIds: string[]) => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('gallery_likes')
        .select('photo_id, is_like')
        .eq('user_id', user.id)
        .in('photo_id', photoIds);

      if (error) throw error;

      const reactions: PhotoReactions = {};
      (data || []).forEach((like) => {
        reactions[like.photo_id] = like.is_like;
      });
      setUserReactions(reactions);
    } catch (error) {
      console.error('Error loading reactions:', error);
    }
  };

  const loadAllComments = async (photoIds: string[]) => {
    try {
      const commentsPromises = photoIds.map(async (photoId) => {
        const { data, error } = await supabase
          .from('gallery_comments')
          .select(`
            id,
            user_id,
            comment_text,
            created_at,
            profiles!user_id(full_name)
          `)
          .eq('photo_id', photoId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading comments for photo:', photoId, error);
        }

        return { photoId, comments: (data as any) || [] };
      });

      const results = await Promise.all(commentsPromises);
      const map: { [photoId: string]: Comment[] } = {};
      results.forEach(({ photoId, comments }) => {
        map[photoId] = comments;
      });
      setCommentsMap(map);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleReaction = async (photoId: string, isLike: boolean) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    try {
      const { data: existingReaction } = await supabase
        .from('gallery_likes')
        .select('*')
        .eq('photo_id', photoId)
        .eq('user_id', user?.id)
        .maybeSingle();

      let likesChange = 0;
      let dislikesChange = 0;
      let newUserReaction: boolean | null = null;

      if (existingReaction) {
        if (existingReaction.is_like === isLike) {
          await supabase
            .from('gallery_likes')
            .delete()
            .eq('id', existingReaction.id);

          likesChange = isLike ? -1 : 0;
          dislikesChange = !isLike ? -1 : 0;
          newUserReaction = null;
        } else {
          await supabase
            .from('gallery_likes')
            .update({ is_like: isLike })
            .eq('id', existingReaction.id);

          if (existingReaction.is_like) {
            likesChange = -1;
            dislikesChange = 1;
          } else {
            likesChange = 1;
            dislikesChange = -1;
          }
          newUserReaction = isLike;
        }
      } else {
        await supabase.from('gallery_likes').insert({
          photo_id: photoId,
          user_id: user?.id,
          is_like: isLike,
        });

        likesChange = isLike ? 1 : 0;
        dislikesChange = !isLike ? 1 : 0;
        newUserReaction = isLike;
      }

      const newLikesCount = photo.likes_count + likesChange;
      const newDislikesCount = photo.dislikes_count + dislikesChange;

      await supabase
        .from('gallery_photos')
        .update({
          likes_count: newLikesCount,
          dislikes_count: newDislikesCount,
        })
        .eq('id', photoId);

      const updatedPhotos = photos.map(p =>
        p.id === photoId
          ? { ...p, likes_count: newLikesCount, dislikes_count: newDislikesCount }
          : p
      );
      setPhotos(updatedPhotos);
      setUserReactions(prev => ({ ...prev, [photoId]: newUserReaction }));
    } catch (error) {
      console.error('Error saving reaction:', error);
      Alert.alert('Грешка', 'Неуспешно запазване на реакцията');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedPhotoId) return;

    try {
      const { error } = await supabase.from('gallery_comments').insert({
        photo_id: selectedPhotoId,
        user_id: user?.id,
        comment_text: newComment.trim(),
      });

      if (error) throw error;

      const { data: newCommentData, error: fetchError } = await supabase
        .from('gallery_comments')
        .select(`
          id,
          user_id,
          comment_text,
          created_at,
          profiles!user_id(full_name)
        `)
        .eq('photo_id', selectedPhotoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        console.error('Error fetching new comment:', fetchError);
      }

      if (newCommentData) {
        setCommentsMap(prev => ({
          ...prev,
          [selectedPhotoId]: [newCommentData as any, ...(prev[selectedPhotoId] || [])],
        }));
      }

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Грешка', 'Неуспешно добавяне на коментар');
    }
  };

  const openCommentsModal = (photoId: string) => {
    setSelectedPhotoId(photoId);
    setShowCommentsModal(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (photos.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyState}>
          <ImageIcon size={64} color={theme.colors.textMuted} />
          <Text style={styles.emptyStateText}>Няма снимки в галерията</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Галерия</Text>
            <Text style={styles.headerSubtitle}>харесай или коментирай снимка</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <NotificationBadge size={24} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {photos.map((photo) => {
          const userReaction = userReactions[photo.id];
          const comments = commentsMap[photo.id] || [];

          return (
            <View key={photo.id} style={styles.photoCard}>
              <View style={styles.imageContainer}>
                <RNImage
                  source={{ uri: photo.image_url }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />

                <View style={styles.leftStat}>
                  <HeartCrack size={24} color={theme.colors.surface} strokeWidth={2.5} />
                  <Text style={styles.statCountText}>{photo.dislikes_count}</Text>
                </View>

                <View style={styles.rightStat}>
                  <Heart size={24} color={theme.colors.surface} strokeWidth={2.5} />
                  <Text style={styles.statCountText}>{photo.likes_count}</Text>
                </View>
              </View>

              <View style={styles.whiteSection}>
                <View style={styles.captionContainer}>
                  {photo.caption && photo.caption.trim() !== '' && (
                    <Text style={styles.caption}>{photo.caption}</Text>
                  )}
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, userReaction === false && styles.activeBtnDislike]}
                    onPress={() => handleReaction(photo.id, false)}
                  >
                    <LinearGradient
                      colors={
                        userReaction === false
                          ? ['#ef4444', '#dc2626']
                          : ['#ffffff', '#f3f4f6']
                      }
                      style={styles.actionBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <HeartCrack
                        size={28}
                        color={userReaction === false ? theme.colors.surface : '#ef4444'}
                        strokeWidth={2.5}
                      />
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.messageBtn}
                    onPress={() => openCommentsModal(photo.id)}
                  >
                    <MessageCircle size={28} color={theme.colors.primary} strokeWidth={2.5} />
                    {comments.length > 0 && (
                      <View style={styles.commentBadge}>
                        <Text style={styles.commentBadgeText}>{comments.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, userReaction === true && styles.activeBtnLike]}
                    onPress={() => handleReaction(photo.id, true)}
                  >
                    <LinearGradient
                      colors={
                        userReaction === true
                          ? ['#10b981', '#059669']
                          : ['#ffffff', '#f3f4f6']
                      }
                      style={styles.actionBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Heart
                        size={28}
                        color={userReaction === true ? theme.colors.surface : '#10b981'}
                        strokeWidth={2.5}
                        fill={userReaction === true ? theme.colors.surface : 'transparent'}
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showCommentsModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Коментари</Text>
              <TouchableOpacity onPress={() => setShowCommentsModal(false)}>
                <X size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.commentsList}>
              {selectedPhotoId && (commentsMap[selectedPhotoId] || []).length === 0 ? (
                <Text style={styles.noCommentsText}>Все още няма коментари</Text>
              ) : (
                (commentsMap[selectedPhotoId] || []).map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    <Text style={styles.commentAuthor}>
                      {comment.profiles?.full_name || 'Потребител'}
                    </Text>
                    <Text style={styles.commentText}>{comment.comment_text}</Text>
                    <Text style={styles.commentDate}>
                      {new Date(comment.created_at).toLocaleDateString('bg-BG')}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Напиши коментар..."
                placeholderTextColor={theme.colors.textMuted}
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendButton, !newComment.trim() && styles.sendButtonDisabled]}
                onPress={handleAddComment}
                disabled={!newComment.trim()}
              >
                <Text style={styles.sendButtonText}>Изпрати</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  notificationButton: {
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  emptyStateText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  photoCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  leftStat: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  rightStat: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: theme.borderRadius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  statCountText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  whiteSection: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  captionContainer: {
    marginBottom: theme.spacing.sm,
  },
  caption: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 22,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnGradient: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBtnDislike: {
    shadowColor: '#ef4444',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  activeBtnLike: {
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  messageBtn: {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  commentBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  commentBadgeText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '80%',
    paddingBottom: theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  commentsList: {
    maxHeight: 400,
    padding: theme.spacing.lg,
  },
  noCommentsText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    padding: theme.spacing.xl,
  },
  commentItem: {
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  commentAuthor: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  commentText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  commentDate: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  commentInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.border,
  },
  sendButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
