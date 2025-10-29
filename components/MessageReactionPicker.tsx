import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import { theme } from '@/constants/theme';

type ReactionType = 'heart' | 'thumbs_up' | 'thumbs_down';

interface MessageReactionPickerProps {
  visible: boolean;
  position: { x: number; y: number };
  onSelectReaction: (reaction: ReactionType) => void;
  onClose: () => void;
}

const REACTIONS: Array<{ type: ReactionType; emoji: string }> = [
  { type: 'heart', emoji: '❤️' },
  { type: 'thumbs_up', emoji: '👍' },
  { type: 'thumbs_down', emoji: '👎' },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MessageReactionPicker({
  visible,
  position,
  onSelectReaction,
  onClose,
}: MessageReactionPickerProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 7,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  // Calculate position to keep picker on screen
  const pickerWidth = REACTIONS.length * 60 + 16;
  const pickerHeight = 60;

  let adjustedX = position.x - pickerWidth / 2;
  let adjustedY = position.y - pickerHeight - 10;

  // Keep picker within screen bounds
  if (adjustedX < 10) adjustedX = 10;
  if (adjustedX + pickerWidth > SCREEN_WIDTH - 10) {
    adjustedX = SCREEN_WIDTH - pickerWidth - 10;
  }
  if (adjustedY < 50) adjustedY = position.y + 10;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.picker,
            {
              left: adjustedX,
              top: adjustedY,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {REACTIONS.map(({ type, emoji }) => (
            <TouchableOpacity
              key={type}
              style={styles.reactionButton}
              onPress={() => {
                onSelectReaction(type);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  picker: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 30,
    padding: 8,
    gap: 4,
    ...theme.shadows.luxury,
    elevation: 10,
  },
  reactionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reactionEmoji: {
    fontSize: 28,
  },
});
