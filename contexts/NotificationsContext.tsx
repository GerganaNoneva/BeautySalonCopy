import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { schedulePushNotification } from '@/lib/notifications';
import { useAuth } from './AuthContext';
import { router } from 'expo-router';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data: any;
};

type NotificationsContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  loadNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  deleteReadNotifications: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

  const notifList = data || [];
  // Treat any value that is not explicitly true as unread (handles null)
  const unread = notifList.filter((n) => n.is_read !== true).length;

      setNotifications(notifList);
      // Ensure proper unread count sync even if state updates asynchronously
      setUnreadCount((prev) => {
        return unread;
      });
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Optimistically update local state and recalculate unread count
      setNotifications((prev) => {
        const updated = prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n));
        // Count items where is_read is not strictly true
        const unread = updated.filter((n) => n.is_read !== true).length;
        setUnreadCount(unread);
        return updated;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Reload on error to sync state
      loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .or('is_read.is.false,is_read.is.null');

      if (error) throw error;

      // Optimistically update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
      // Reload on error to sync state
      loadNotifications();
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      // Optimistically update local state and recalculate unread count
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== notificationId);
        const unread = updated.filter((n) => n.is_read !== true).length;
        setUnreadCount(unread);
        return updated;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Reload on error to sync state
      loadNotifications();
    }
  };

  const deleteReadNotifications = async () => {
    if (!user?.id) return;

    // Optimistically remove read notifications from local state so UI updates immediately
    let removedNotifications: Notification[] = [];
    setNotifications((prev) => {
      removedNotifications = prev.filter((n) => n.is_read === true);
      const updated = prev.filter((n) => n.is_read !== true);
      const unread = updated.filter((n) => n.is_read !== true).length;
      setUnreadCount(unread);
      return updated;
    });

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true);

      if (error) {
        console.error('Error deleting read notifications:', error);
        // rollback to authoritative state from DB
        await loadNotifications();
      }
    } catch (err) {
      console.error('Exception deleting read notifications:', err);
      // rollback
      await loadNotifications();
    }
  };

  // Load notifications when user changes
  useEffect(() => {
    if (user?.id) {
      // loadNotifications sets notifications and unreadCount already
      loadNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user?.id]);

  // Setup realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    // Helper: fetch authoritative unread count from DB and set it
    const fetchAndSetUnreadCount = async () => {
      try {
        // Count ALL unread notifications for the badge
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .or('is_read.is.false,is_read.is.null');

        if (error) throw error;

  const unread = (count as number) || 0;
        setUnreadCount(unread);
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    const channelName = `notifications_${user.id}`;

    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            setNotifications((prev) => {
              const updated = [newNotif, ...prev];
              const unread = updated.filter((n) => !n.is_read).length;
              setUnreadCount(unread);
              // Schedule a local push notification so the client gets notified immediately
              try {
                // schedulePushNotification handles Expo Go and permission checks internally
                schedulePushNotification(
                  newNotif.title || 'Уведомление',
                  newNotif.body || 'Имате ново уведомление',
                  { notification_id: newNotif.id, ...newNotif.data }
                );
              } catch (err) {
                console.error('Error scheduling local push notification:', err);
              }
              return updated;
            });
            // If this is a new message notification, mark the corresponding message as delivered
            try {
              const messageId = newNotif.data?.message_id;
              if (messageId) {
                await supabase
                  .from('messages')
                  .update({ delivered_at: new Date().toISOString() })
                  .eq('id', messageId)
                  .is('delivered_at', null);
              }
            } catch (err) {
              console.error('Error marking message delivered from notification:', err);
            }
            // ensure authoritative count in case some server-side logic changed other rows
            fetchAndSetUnreadCount().catch(() => {});
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotif = payload.new as Notification;
            // Update local list if we have it cached, but also fetch authoritative unread count
            setNotifications((prev) => prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n)));
            // If the notification wasn't in our local cache (e.g. older than limit) the local
            // array won't change; fetch authoritative unread count from DB to guarantee badge sync.
            fetchAndSetUnreadCount().catch(() => {});
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setNotifications((prev) => {
              const updated = prev.filter((n) => n.id !== deletedId);
              const unread = updated.filter((n) => !n.is_read).length;
              setUnreadCount(unread);
              return updated;
            });
            // keep authoritative count in sync
            fetchAndSetUnreadCount().catch(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  // Update app icon badge whenever the authoritative notifications array changes.
  // We derive the unread count directly from `notifications` so the badge always
  // equals the number of unread notifications in the list.
  useEffect(() => {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (Platform.OS === 'web' || isExpoGo) return;

    try {
  // derive ALL unread notifications from the notifications array
  const unread = notifications.filter((n) => n.is_read !== true).length;
      // Keep local state in sync with the authoritative list
      if (unread !== unreadCount) {
        setUnreadCount(unread);
      }

      (async () => {
        try {
          await ExpoNotifications.setBadgeCountAsync(unread);
        } catch (err) {
          console.error('Error setting app badge count:', err);
        }
      })();
    } catch (err) {
      console.error('Error while syncing badge from notifications array:', err);
    }
  }, [notifications]);

  // Recalculate authoritative unread count whenever notifications array changes
  useEffect(() => {
    try {
      const recalculated = notifications.filter((n) => n.is_read !== true).length;
      if (recalculated !== unreadCount) {
        setUnreadCount(recalculated);
      }
    } catch (err) {
      console.error('Error recalculating unreadCount:', err);
    }
  }, [notifications]);

  // Handle push notification clicks
  useEffect(() => {
    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) return;

    const handleNotificationAction = async (notification: Notification) => {
      try {
        // Mark notification as read
        if (!notification.is_read) {
          await markAsRead(notification.id);
        }

        // Perform action based on notification type
        if (notification.type === 'new_message' && notification.data?.conversation_id) {
          // Mark all message notifications for this conversation as read
          try {
            await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('user_id', user?.id)
              .eq('type', 'new_message')
              .filter("data->>conversation_id", 'eq', String(notification.data.conversation_id));
          } catch (err) {
            console.error('Error marking conversation notifications as read:', err);
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user?.id)
            .single();

          if (profile?.role === 'admin') {
            router.push({
              pathname: '/(admin)/messages',
              params: { selectedConversationId: notification.data.conversation_id }
            });
          } else {
            router.push('/(client)/messages');
          }
        } else if (notification.type === 'free_slot' && notification.data?.date && notification.data?.start_time) {
          router.push({
            pathname: '/(client)/booking',
            params: {
              prefillDate: notification.data.date,
              prefillStartTime: notification.data.start_time,
              prefillEndTime: notification.data.end_time
            }
          });
        } else if (notification.type === 'new_photo') {
          router.push('/(client)/gallery');
        } else if (notification.type === 'gallery_comment' && notification.data?.photo_id) {
          router.push({
            pathname: '/(admin)/gallery',
            params: { scrollToPhotoId: notification.data.photo_id }
          });
        } else if (notification.type === 'new_promotion' || notification.type === 'price_change') {
          const promotionId = notification.data?.promotion_id;
          if (promotionId) {
            router.push({
              pathname: '/(client)/pricing',
              params: { highlightPromotionId: promotionId }
            });
          } else {
            router.push('/(client)/pricing');
          }
        } else if (notification.type === 'new_booking_request' && notification.data?.request_id) {
          router.push('/(admin)/requests');
        } else if (notification.type === 'booking_rejected') {
          // For admins, just mark as read without navigation
          // For clients, navigate to appointments
          if (!isAdmin) {
            const appointmentId = notification.data?.appointment_id;
            if (appointmentId) {
              router.push({
                pathname: '/(client)/appointments',
                params: { highlightAppointmentId: appointmentId }
              });
            } else {
              router.push('/(client)/appointments');
            }
          }
          // If admin, do nothing (notification is already marked as read above)
        } else if (notification.type === 'appointment_cancelled') {
          // For admins, just mark as read without navigation
          // For clients, navigate to appointments
          if (!isAdmin) {
            const appointmentId = notification.data?.appointment_id;
            if (appointmentId) {
              router.push({
                pathname: '/(client)/appointments',
                params: { highlightAppointmentId: appointmentId }
              });
            } else {
              router.push('/(client)/appointments');
            }
          }
          // If admin, do nothing (notification is already marked as read above)
        } else if (
          notification.type === 'booking_confirmed' ||
          notification.type === 'appointment_updated' ||
          notification.type === 'appointment_created' ||
          notification.type === 'new_appointment'
        ) {
          const appointmentId = notification.data?.appointment_id;
          if (appointmentId) {
            router.push({
              pathname: '/(client)/appointments',
              params: { highlightAppointmentId: appointmentId }
            });
          } else {
            router.push('/(client)/appointments');
          }
        }
      } catch (error) {
        console.error('Error handling notification action:', error);
      }
    };

    const subscription = ExpoNotifications.addNotificationResponseReceivedListener(async (response) => {
      const notificationData = response.notification.request.content.data;

      // Find the notification in our local list
      const notification = notifications.find(n => n.id === notificationData?.notification_id);

      if (notification) {
        await handleNotificationAction(notification);
      } else {
        // If notification not in local cache, fetch it from DB
        try {
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('id', notificationData?.notification_id)
            .single();

          if (!error && data) {
            await handleNotificationAction(data as Notification);
          }
        } catch (err) {
          console.error('Error fetching notification from DB:', err);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [notifications, user?.id]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        loadNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteReadNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

// Recalculate unreadCount whenever notifications array changes to ensure badge is authoritative
// This effect is outside the provider so it won't create closure issues; it updates via setUnreadCount inside provider.

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return context;
}
