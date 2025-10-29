import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '@/constants/theme';

interface QuotedMessageProps {
  senderName?: string;
  content?: string;
  isOwnMessage: boolean;
  onPress?: () => void;
}

export default function QuotedMessage({
  senderName,
  content,
  isOwnMessage,
  onPress
}: QuotedMessageProps) {
  // Safety check for undefined/null content
  const safeContent = content || '';
  const safeSenderName = senderName || '';

  // Early return if no content
  if (!safeContent || safeContent.trim() === '') {
    return null;
  }

  // Truncate content to 80 characters
  const truncatedContent = safeContent.length > 80
    ? safeContent.substring(0, 80) + '...'
    : safeContent;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isOwnMessage ? styles.containerSent : styles.containerReceived
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[
        styles.border,
        isOwnMessage ? styles.borderSent : styles.borderReceived
      ]} />
      <View style={styles.content}>
        {safeSenderName && safeSenderName.trim() !== '' && (
          <Text style={[
            styles.senderName,
            isOwnMessage ? styles.textSent : styles.textReceived
          ]}>
            {safeSenderName}
          </Text>
        )}
        <Text
          style={[
            styles.messageText,
            isOwnMessage ? styles.textSent : styles.textReceived
          ]}
          numberOfLines={2}
        >
          {truncatedContent}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 10,
    paddingVertical: 8,
    paddingRight: 10,
    borderRadius: 10,
    backgroundColor: '#FFF8E7', // light golden/yellow background
    borderWidth: 1,
    borderColor: '#FFD700', // gold border
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  containerSent: {
    backgroundColor: '#FFF9E0', // slightly warmer yellow for sent
  },
  containerReceived: {
    backgroundColor: '#FFFAED', // lighter yellow for received
  },
  border: {
    width: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  borderSent: {
    backgroundColor: '#DAA520', // goldenrod for sent
  },
  borderReceived: {
    backgroundColor: '#FFD700', // pure gold for received
  },
  content: {
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
    color: '#B8860B', // dark goldenrod
  },
  textSent: {
    color: '#8B4513', // saddle brown - readable on yellow
  },
  textReceived: {
    color: '#654321', // dark brown - readable on yellow
  },
  messageText: {
    fontSize: 13,
    lineHeight: 17,
  },
});
