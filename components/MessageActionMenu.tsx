import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { Reply, Trash2, UserX } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

interface MessageActionMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  isOwnMessage: boolean;
  onReply: () => void;
  onDeleteForEveryone: () => void;
  onDeleteForYou: () => void;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MessageActionMenu({
  visible,
  position,
  isOwnMessage,
  onReply,
  onDeleteForEveryone,
  onDeleteForYou,
  onClose,
}: MessageActionMenuProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.menu,
            {
              bottom: Math.max(insets.bottom + 16, 32),
              left: 16,
              right: 16,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onReply();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Reply size={20} color={theme.colors.primary} />
            <Text style={styles.menuItemText}>Отговори</Text>
          </TouchableOpacity>

          {isOwnMessage && (
            <>
              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onDeleteForEveryone();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Trash2 size={20} color={theme.colors.error} />
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                  Отмяна на изпращането за всички
                </Text>
              </TouchableOpacity>

              <View style={styles.separator} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onDeleteForYou();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <UserX size={20} color={theme.colors.textMuted} />
                <Text style={styles.menuItemText}>Отмяна на изпращането за вас</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menu: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: 8,
    ...theme.shadows.luxury,
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: theme.fontSize.md,
    fontWeight: '500',
    color: theme.colors.text,
    flex: 1,
  },
  menuItemDanger: {
    color: theme.colors.error,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
});
