import { supabase } from './supabase';
import { isFirebaseConfigured } from './firebaseConfig';
import {
  sendFirebaseVerificationCode,
  verifyFirebaseCode,
  initializeRecaptcha,
} from './firebasePhoneAuth';
import {
  isNativeFirebaseAvailable,
  sendNativeFirebaseVerificationCode,
  verifyNativeFirebaseCode,
} from './firebaseNativeAuth';

/**
 * SMS Verification Service
 * Поддържа четири метода за SMS верификация:
 * 1. Firebase Native (React Native Firebase) - РЕАЛНИ SMS на iOS/Android - безплатно до 10K/месец
 * 2. Firebase Web SDK - работи само на web браузър - безплатно до 10K/месец
 * 3. Twilio SMS API - платено, $0.0075/SMS
 * 4. Mock SMS (за разработка) - показва кода с alert
 *
 * Приоритет: Firebase Native > Firebase Web > Twilio > Mock
 */

export interface VerificationResult {
  success: boolean;
  error?: string;
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
 * Генерира 6-цифрен верификационен код
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Изпраща SMS код за верификация
 * @param phone Телефонен номер
 * @param userId ID на потребителя (опционално)
 * @returns Promise с резултат от изпращането
 */
export async function sendVerificationCode(
  phone: string,
  userId?: string
): Promise<VerificationResult> {
  try {
    const normalizedPhone = normalizePhone(phone);
    const code = generateCode();

    // Запазваме кода в базата
    const { error: insertError } = await supabase
      .from('phone_verification_codes')
      .insert({
        phone: normalizedPhone,
        code,
        user_id: userId || null,
      });

    if (insertError) {
      console.error('Error saving verification code:', insertError);
      return {
        success: false,
        error: 'Грешка при генериране на код',
      };
    }


    // ПРИОРИТЕТ 1: Firebase Native (React Native Firebase) - РЕАЛНИ SMS на мобилни
    if (isNativeFirebaseAvailable()) {
      const result = await sendNativeFirebaseVerificationCode(normalizedPhone);

      if (result.success) {
        // Firebase управлява кода автоматично, не го записваме в базата
        return { success: true };
      } else {
        console.error('❌ Firebase Native error:', result.error);

        // Ако грешката е че Phone Auth не е активиран, връщаме грешката директно
        if (result.error && result.error.includes('Phone Authentication')) {
          return {
            success: false,
            error: result.error,
          };
        }

        // Други грешки - fallback към Web Firebase, Twilio или mock
      }
    }

    // ПРИОРИТЕТ 2: Firebase Web SDK (работи само на web)
    if (isFirebaseConfigured()) {
      const result = await sendFirebaseVerificationCode(normalizedPhone);

      if (result.success) {
        // Firebase управлява кода автоматично, не го записваме в базата
        return { success: true };
      } else {
        console.error('❌ Firebase Web error:', result.error);

        // Ако грешката е че Phone Auth не е активиран, връщаме грешката директно
        if (result.error && result.error.includes('Phone Authentication')) {
          return {
            success: false,
            error: result.error,
          };
        }

        // Други грешки - fallback към Twilio или mock
      }
    }

    // ПРИОРИТЕТ 2: Twilio SMS API
    const hasTwilioCredentials =
      process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID &&
      process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN &&
      process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER &&
      process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID !== 'your_account_sid_here';

    if (hasTwilioCredentials) {
      try {
        await sendSMSViaTwilio(normalizedPhone, code);
        return { success: true };
      } catch (error) {
        console.error('❌ Twilio error:', error);
        // Fallback към mock
      }
    }

    // ПРИОРИТЕТ 3: Mock SMS (за разработка)

    if (typeof alert !== 'undefined') {
      alert(
        `Вашият код за потвърждение е: ${code}\n\n` +
        `(За продукция, конфигурирайте Firebase или Twilio в .env)`
      );
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending verification code:', error);
    return {
      success: false,
      error: 'Грешка при изпращане на код',
    };
  }
}

/**
 * Верифицира SMS код
 * Автоматично избира метод според това какво е използвано за изпращане
 * @param phone Телефонен номер
 * @param code Въведен код
 * @returns Promise с резултат от верификацията
 */
export async function verifyCode(
  phone: string,
  code: string
): Promise<VerificationResult & { userId?: string; phoneNumber?: string }> {
  try {
    const normalizedPhone = normalizePhone(phone);

    // ПРИОРИТЕТ 1: Опитваме Firebase Native верификация
    if (isNativeFirebaseAvailable()) {
      const result = await verifyNativeFirebaseCode(code);

      if (result.success) {
        return {
          success: true,
          phoneNumber: result.phoneNumber,
        };
      } else {
        // Fallback към Web Firebase проверка
      }
    }

    // ПРИОРИТЕТ 2: Опитваме Firebase Web верификация
    if (isFirebaseConfigured()) {
      const result = await verifyFirebaseCode(code);

      if (result.success) {
        return {
          success: true,
          phoneNumber: result.phoneNumber,
        };
      } else {
        // Fallback към database проверка (за Twilio/mock)
      }
    }

    // ПРИОРИТЕТ 2: Проверяваме в нашата база данни (за Twilio/mock)
    const { data, error: fetchError } = await supabase
      .from('phone_verification_codes')
      .select('*')
      .eq('phone', normalizedPhone)
      .eq('code', code)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching verification code:', fetchError);
      return {
        success: false,
        error: 'Грешка при проверка на код',
      };
    }

    if (!data) {
      // Увеличаваме броя опити - вземаме последния незверифициран код
      const { data: latestCode } = await supabase
        .from('phone_verification_codes')
        .select('id, attempts')
        .eq('phone', normalizedPhone)
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestCode) {
        await supabase
          .from('phone_verification_codes')
          .update({ attempts: latestCode.attempts + 1 })
          .eq('id', latestCode.id);
      }

      return {
        success: false,
        error: 'Невалиден или изтекъл код',
      };
    }

    // Проверяваме броя опити
    if (data.attempts >= 3) {
      return {
        success: false,
        error: 'Надхвърлен лимит на опити. Моля, изпратете нов код.',
      };
    }

    // Маркираме кода като верифициран
    const { error: updateError } = await supabase
      .from('phone_verification_codes')
      .update({ verified: true })
      .eq('id', data.id);

    if (updateError) {
      console.error('Error updating verification code:', updateError);
      return {
        success: false,
        error: 'Грешка при потвърждаване на код',
      };
    }

    return {
      success: true,
      userId: data.user_id,
      phoneNumber: normalizedPhone,
    };
  } catch (error) {
    console.error('Error verifying code:', error);
    return {
      success: false,
      error: 'Грешка при верификация',
    };
  }
}

/**
 * Изчиства изтекли и верифицирани кодове
 */
export async function cleanupExpiredCodes(): Promise<void> {
  try {
    await supabase.rpc('cleanup_expired_verification_codes');
  } catch (error) {
    console.error('Error cleaning up expired codes:', error);
  }
}

/**
 * Изпраща SMS през Twilio
 * Изисква: npm install twilio
 * И credentials в .env файла
 */
async function sendSMSViaTwilio(phone: string, code: string): Promise<void> {
  const accountSid = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio credentials not configured in .env file');
  }

  try {
    // Динамично импортираме Twilio (само ако е инсталиран)
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    const message = await client.messages.create({
      body: `Вашият код за потвърждение от Urban Beauty Salon е: ${code}\n\nКодът е валиден 15 минути.`,
      from: fromNumber,
      to: phone,
    });

  } catch (error: any) {
    // Ако Twilio пакетът не е инсталиран
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'Twilio package not installed. Run: npm install twilio'
      );
    }
    throw error;
  }
}
