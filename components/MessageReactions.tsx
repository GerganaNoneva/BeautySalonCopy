import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

type ReactionType = 'heart' | 'thumbs_up' | 'thumbs_down';

interface Reaction {
  id: string;
  user_id: string;
  reaction_type: ReactionType;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  currentUserId: string;
  onReactionPress: (reactionType: ReactionType) => void;
  isOwnMessage: boolean;
}

const REACTION_EMOJIS: Record<ReactionType, string> = {
  heart: '❤️',
  thumbs_up: '👍',
  thumbs_down: '👎',
};

export default function MessageReactions({
  reactions,
  currentUserId,
  onReactionPress,
  isOwnMessage,
}: MessageReactionsProps) {
  // Early return for invalid reactions
  if (!reactions || !Array.isArray(reactions) || reactions.length === 0) {
    return null;
  }

  // Group reactions by type and count them
  const reactionCounts: Record<ReactionType, { count: number; hasUserReacted: boolean }> = {
    heart: { count: 0, hasUserReacted: false },
    thumbs_up: { count: 0, hasUserReacted: false },
    thumbs_down: { count: 0, hasUserReacted: false },
  };

  // Filter out invalid reactions first
  const validReactions = reactions.filter((reaction) => {
    if (!reaction || typeof reaction !== 'object') {
      console.warn('Invalid reaction object:', reaction);
      return false;
    }
    if (!reaction.reaction_type || typeof reaction.reaction_type !== 'string') {
      console.warn('Reaction without valid type:', reaction);
      return false;
    }
    if (!(reaction.reaction_type in reactionCounts)) {
      console.warn(`Invalid reaction type: ${reaction.reaction_type}`);
      return false;
    }
    return true;
  });

  // Early return if no valid reactions
  if (validReactions.length === 0) {
    return null;
  }

  validReactions.forEach((reaction) => {
    const type = reaction.reaction_type as ReactionType;
    reactionCounts[type].count += 1;
    if (reaction.user_id === currentUserId) {
      reactionCounts[type].hasUserReacted = true;
    }
  });

  return (
    <View style={[styles.container, isOwnMessage ? styles.containerLeft : styles.containerRight]}>
      {(Object.keys(reactionCounts) as ReactionType[]).map((type) => {
        const { count, hasUserReacted } = reactionCounts[type];
        if (count === 0) return null;

        return (
          <TouchableOpacity
            key={type}
            style={[
              styles.reactionBubble,
              hasUserReacted && styles.reactionBubbleActive,
            ]}
            onPress={() => onReactionPress(type)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{REACTION_EMOJIS[type]}</Text>
            {count > 1 && <Text style={styles.count}>{count}</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: -15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  containerLeft: {
    left: 8,
  },
  containerRight: {
    right: 8,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  reactionBubbleActive: {
    backgroundColor: theme.colors.primary + '15',
    },
  emoji: {
    fontSize: 20,
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
