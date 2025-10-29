import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type CreateClientModalProps = {
  visible: boolean;
  onClose: () => void;
  onClientCreated: () => void;
};

export default function CreateClientModal({
  visible,
  onClose,
  onClientCreated,
}: CreateClientModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const handleClose = () => {
    setName('');
    setPhone('');
    setEmail('');
    onClose();
  };

  const validatePhone = (phoneNumber: string): boolean => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 9 && cleaned.length <= 15;
  };

  const validateEmail = (emailAddress: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailAddress);
  };

  const normalizePhoneNumber = (phoneNumber: string): string => {
    // Remove all whitespace and special characters except + and digits
    let cleaned = phoneNumber.replace(/[\s\-()]/g, '');

    // If starts with 0, replace with +359
    if (cleaned.startsWith('0')) {
      cleaned = '+359' + cleaned.substring(1);
    }

    return cleaned;
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Грешка', 'Моля, въведете име на клиента');
      return;
    }

    if (phone.trim() && !validatePhone(phone)) {
      Alert.alert('Грешка', 'Моля, въведете валиден телефонен номер');
      return;
    }

    if (email.trim() && !validateEmail(email)) {
      Alert.alert('Грешка', 'Моля, въведете валиден имейл адрес');
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Грешка', 'Не сте влезли в системата');
        return;
      }

      const normalizedPhone = phone.trim() ? normalizePhoneNumber(phone.trim()) : null;

      const { data, error } = await supabase
        .from('unregistered_clients')
        .insert({
          full_name: name.trim(),
          phone: normalizedPhone,
          email: email.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating client:', error);
        Alert.alert('Грешка', error.message || 'Неуспешно създаване на клиент');
        return;
      }

      console.log('Client created successfully:', data);

      handleClose();
      await onClientCreated();
      Alert.alert('Успех', 'Клиентът е създаден успешно');
    } catch (err: any) {
      console.error('Error creating client:', err);
      Alert.alert('Грешка', err?.message || 'Неуспешно създаване на клиент');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Създай нов клиент</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Име и фамилия</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Иван Петров"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="words"
              editable={!creating}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Телефон (опционално)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+359 888 123 456"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
              editable={!creating}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Имейл (опционално)</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ivan@example.com"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!creating}
            />
            <Text style={styles.helpText}>
              Ако не въведете имейл, ще се генерира автоматично
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={creating}
            >
              <Text style={styles.cancelButtonText}>Откажи</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, creating && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color={theme.colors.surface} />
              ) : (
                <Text style={styles.createButtonText}>Създай</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.xs,
    zIndex: 1,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  helpText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  cancelButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  createButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
});
