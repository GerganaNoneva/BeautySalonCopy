import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '@/constants/theme';

type UnregisteredClientModalProps = {
  visible: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone: string;
};

export default function UnregisteredClientModal({
  visible,
  onClose,
  clientName,
  clientPhone,
}: UnregisteredClientModalProps) {
  const handleSendInvite = () => {
    const message = `Здравей ${clientName}! Каним те да изтеглиш нашето мобилно приложение за по-лесна комуникация и записване на часове.`;

    if (Platform.OS === 'web') {
      window.open(`sms:${clientPhone}?body=${encodeURIComponent(message)}`, '_blank');
    } else {
      const separator = Platform.OS === 'ios' ? '&' : '?';
      Linking.openURL(`sms:${clientPhone}${separator}body=${encodeURIComponent(message)}`);
    }

    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Клиентът не използва приложението</Text>
          <Text style={styles.message}>
            {clientName} все още не е използвал приложението. Искаш ли да изпратиш покана?
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Откажи</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendButton} onPress={handleSendInvite}>
              <Text style={styles.sendButtonText}>Прати</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: 400,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textLight,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
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
  sendButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.surface,
  },
});
