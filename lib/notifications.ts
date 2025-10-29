import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      console.log('📱 Handling notification:', notification.request.content.title);
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        // Ensure notification appears in notification center
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') {
    return null;
  }

  if (isExpoGo) {
    console.log('Push notifications are not available in Expo Go. Use a development build.');
    return null;
  }

  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Неуспешно получаване на разрешение за нотификации');
      return null;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    alert('Трябва да използвате физическо устройство за push нотификации');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Важни уведомления',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  return token;
}

export async function savePushToken(userId: string, token: string) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) throw error;
  } catch (err) {
    console.error('Error saving push token:', err);
  }
}

export async function schedulePushNotification(title: string, body: string, data?: any) {
  if (isExpoGo) {
    console.log('Cannot schedule notification in Expo Go:', title, body);
    return;
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        badge: 1,
        // Add category to ensure notification persists
        categoryIdentifier: 'default',
        // Use the notification channel we created
        ...(Platform.OS === 'android' && {
          channelId: 'default',
        }),
      },
      trigger: null, // Show immediately
    });
    console.log('✅ Scheduled local notification:', title, 'ID:', notificationId);
  } catch (error) {
    console.error('❌ Error scheduling notification:', error);
  }
}

export function useNotifications() {
  return {
    registerForPushNotificationsAsync,
    savePushToken,
    schedulePushNotification,
  };
}
