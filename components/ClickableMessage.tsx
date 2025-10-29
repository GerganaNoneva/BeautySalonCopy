import React from 'react';
import { Text, Linking, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

type ClickableMessageProps = {
  content: string;
  style?: any;
  linkStyle?: any;
};

export default function ClickableMessage({ content, style, linkStyle }: ClickableMessageProps) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const phoneRegex = /(\+?\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,9})/g;

  const parseContent = () => {
    const parts: { text: string; type: 'text' | 'url' | 'phone'; url?: string }[] = [];
    let lastIndex = 0;

    const allMatches: { index: number; length: number; type: 'url' | 'phone'; match: string }[] = [];

    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      allMatches.push({
        index: match.index,
        length: match[0].length,
        type: 'url',
        match: match[0],
      });
    }

    urlRegex.lastIndex = 0;

    while ((match = phoneRegex.exec(content)) !== null) {
      const isPartOfUrl = allMatches.some(
        (m) => match.index >= m.index && match.index < m.index + m.length
      );
      if (!isPartOfUrl) {
        allMatches.push({
          index: match.index,
          length: match[0].length,
          type: 'phone',
          match: match[0],
        });
      }
    }

    allMatches.sort((a, b) => a.index - b.index);

    allMatches.forEach((m) => {
      if (m.index > lastIndex) {
        parts.push({
          text: content.substring(lastIndex, m.index),
          type: 'text',
        });
      }

      parts.push({
        text: m.match,
        type: m.type,
        url: m.type === 'url' ? m.match : m.type === 'phone' ? `tel:${m.match.replace(/[\s-]/g, '')}` : undefined,
      });

      lastIndex = m.index + m.length;
    });

    if (lastIndex < content.length) {
      parts.push({
        text: content.substring(lastIndex),
        type: 'text',
      });
    }

    return parts;
  };

  const parts = parseContent();

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <Text key={index}>{part.text}</Text>;
        }

        return (
          <Text
            key={index}
            style={[styles.link, linkStyle]}
            onPress={() => {
              if (part.url) {
                Linking.openURL(part.url);
              }
            }}
          >
            {part.text}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
});
