import { Platform } from 'react-native';

/**
 * Firebase Native Phone Authentication Service
 * Използва @react-native-firebase/auth за реални SMS на iOS/Android
 *
 * ВАЖНО: Този модул работи само след `npx expo prebuild`
 */

let auth: any = null;

// Динамично импортираме Firebase само ако е наличен (след prebuild)
try {
  if (Platform.OS !== 'web') {
    auth = require('@react-native-firebase/auth').default;
    console.log('✅ React Native Firebase Auth loaded');
  }
} catch (error) {
  console.log('⚠️ React Native Firebase not available (use prebuild first)');
}

let confirmationResult: any = null;

/**
 * Проверява дали React Native Firebase е налични
 */
export function isNativeFirebaseAvailable(): boolean {
  return auth !== null && Platform.OS !== 'web';
}

/**
 * Нормализира телефонен номер към международен формат
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('359')) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith('0')) {
    return `+359${cleaned.substring(1)}`;
  }

  return `+359${cleaned}`;
}

/**
 * Изпраща SMS код за верификация чрез Firebase Native
 * @param phone Телефонен номер
 * @returns Promise с резултат
 */
export async function sendNativeFirebaseVerificationCode(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  if (!isNativeFirebaseAvailable()) {
    return {
      success: false,
      error: 'React Native Firebase не е наличен. Моля, изпълнете: npx expo prebuild',
    };
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    console.log(`📱 Sending Firebase Native SMS to: ${normalizedPhone}`);

    // Използваме React Native Firebase за изпращане на SMS
    confirmationResult = await auth().signInWithPhoneNumber(normalizedPhone);

    console.log('✅ Firebase Native SMS sent successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Firebase Native SMS error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    let errorMessage = 'Грешка при изпращане на SMS';

    if (error.code === 'auth/invalid-phone-number') {
      errorMessage = 'Невалиден телефонен номер';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Твърде много опити. Моля, опитайте по-късно.';
    } else if (error.code === 'auth/quota-exceeded') {
      errorMessage = 'Достигнат лимит на SMS-и. Свържете се с поддръжка.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Phone Authentication не е активиран във Firebase Console.';
    } else if (error.message) {
      errorMessage = `Firebase грешка: ${error.message}`;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Верифицира SMS код изпратен чрез Firebase Native
 * @param code 6-цифрен код
 * @returns Promise с резултат
 */
export async function verifyNativeFirebaseCode(
  code: string
): Promise<{
  success: boolean;
  error?: string;
  phoneNumber?: string;
  firebaseUid?: string;
}> {
  if (!confirmationResult) {
    return {
      success: false,
      error: 'Моля, първо изпратете SMS код',
    };
  }

  try {
    console.log('🔑 Verifying Firebase Native code...');

    const result = await confirmationResult.confirm(code);
    const user = result.user;

    console.log('✅ Firebase Native phone verified:', user.phoneNumber);

    // След успешна верификация, нулираме confirmation
    confirmationResult = null;

    return {
      success: true,
      phoneNumber: user.phoneNumber || undefined,
      firebaseUid: user.uid,
    };
  } catch (error: any) {
    console.error('❌ Firebase Native verification error:', error);

    let errorMessage = 'Невалиден код';

    if (error.code === 'auth/invalid-verification-code') {
      errorMessage = 'Невалиден код. Моля, опитайте отново.';
    } else if (error.code === 'auth/code-expired') {
      errorMessage = 'Кодът е изтекъл. Моля, изпратете нов код.';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Изчиства състоянието на Firebase Native Phone Auth
 */
export function resetNativeFirebasePhoneAuth() {
  confirmationResult = null;
}
