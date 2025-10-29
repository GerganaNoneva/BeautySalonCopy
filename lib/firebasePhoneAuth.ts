import { Platform } from 'react-native';
import {
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  RecaptchaVerifier,
  ConfirmationResult,
  ApplicationVerifier,
} from 'firebase/auth';
import { firebaseAuth, isFirebaseConfigured } from './firebaseConfig';

/**
 * Firebase Phone Authentication Service
 * Използва Firebase за изпращане на SMS кодове за верификация
 */

let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

/**
 * Инициализира reCAPTCHA verifier (само за web)
 * За мобилни устройства Firebase автоматично управлява верификацията
 */
export function initializeRecaptcha(containerId: string = 'recaptcha-container') {
  if (Platform.OS === 'web' && firebaseAuth && !recaptchaVerifier) {
    try {
      recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
        size: 'invisible',
        callback: () => {
          console.log('✅ reCAPTCHA verified');
        },
        'expired-callback': () => {
          console.warn('⚠️ reCAPTCHA expired');
          recaptchaVerifier = null;
        },
      });
    } catch (error) {
      console.error('❌ reCAPTCHA initialization error:', error);
    }
  }
}

/**
 * Нормализира телефонен номер към международен формат
 * 0888123456 -> +359888123456
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
 * Изпраща SMS код за верификация чрез Firebase
 * @param phone Телефонен номер
 * @returns Promise с резултат
 */
export async function sendFirebaseVerificationCode(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      error: 'Firebase не е конфигуриран. Добавете credentials в .env файла.',
    };
  }

  if (!firebaseAuth) {
    return {
      success: false,
      error: 'Firebase Auth не е инициализиран',
    };
  }

  try {
    const normalizedPhone = normalizePhone(phone);
    console.log(`📱 Sending Firebase SMS to: ${normalizedPhone}`);
    console.log('📱 Platform:', Platform.OS);

    // Firebase Phone Auth работи само на Web в Expo managed workflow
    if (Platform.OS !== 'web') {
      return {
        success: false,
        error: 'Firebase Phone Auth работи само на web платформа в Expo. За мобилни устройства използвайте Twilio или Mock SMS.',
      };
    }

    // За web използваме reCAPTCHA
    if (!recaptchaVerifier) {
      initializeRecaptcha();
    }

    if (!recaptchaVerifier) {
      return {
        success: false,
        error: 'reCAPTCHA не е инициализиран. Уверете се че има <div id="recaptcha-container"></div> в HTML-а.',
      };
    }

    confirmationResult = await signInWithPhoneNumber(
      firebaseAuth,
      normalizedPhone,
      recaptchaVerifier as ApplicationVerifier
    );

    console.log('✅ Firebase SMS sent successfully');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Firebase SMS error:', error);
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
      errorMessage = 'Phone Authentication не е активиран във Firebase Console. Моля, активирайте го.';
    } else if (error.code === 'auth/missing-phone-number') {
      errorMessage = 'Липсва телефонен номер';
    } else if (error.message) {
      // Показваме реалната грешка за debugging
      errorMessage = `Firebase грешка: ${error.message}`;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Верифицира SMS код изпратен чрез Firebase
 * @param code 6-цифрен код
 * @returns Promise с резултат и Firebase user credential
 */
export async function verifyFirebaseCode(
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
    console.log('🔑 Verifying Firebase code...');

    const result = await confirmationResult.confirm(code);
    const user = result.user;

    console.log('✅ Firebase phone verified:', user.phoneNumber);

    // След успешна верификация, нулираме confirmation
    confirmationResult = null;

    return {
      success: true,
      phoneNumber: user.phoneNumber || undefined,
      firebaseUid: user.uid,
    };
  } catch (error: any) {
    console.error('❌ Firebase verification error:', error);

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
 * Изчиства състоянието на Firebase Phone Auth
 */
export function resetFirebasePhoneAuth() {
  confirmationResult = null;
  if (recaptchaVerifier && Platform.OS === 'web') {
    try {
      recaptchaVerifier.clear();
    } catch (error) {
      console.error('Error clearing reCAPTCHA:', error);
    }
    recaptchaVerifier = null;
  }
}
