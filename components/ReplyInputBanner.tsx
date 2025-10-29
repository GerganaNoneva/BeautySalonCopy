import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { theme } from '@/constants/theme';

interface ReplyInputBannerProps {
  senderName: string;
  content: string;
  onCancel: () => void;
}

export default function ReplyInputBanner({
  senderName,
  content,
  onCancel
}: ReplyInputBannerProps) {
  // Truncate content to 60 characters
  const truncatedContent = content.length > 60
    ? content.substring(0, 60) + '...'
    : content;

  return (
    <View style={styles.container}>
      <View style={styles.border} />
      <View style={styles.content}>
        <Text style={styles.label}>Отговаря на {senderName}</Text>
        <Text style={styles.messageText} numberOfLines={1}>
          {truncatedContent}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onCancel}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  border: {
    width: 3,
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
