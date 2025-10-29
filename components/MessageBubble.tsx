import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Check, CheckCheck } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import MessageReactions from './MessageReactions';
import MessageReactionPicker from './MessageReactionPicker';
import MessageActionMenu from './MessageActionMenu';
import MessageAttachment from './MessageAttachment';
import ClickableMessage from './ClickableMessage';
import QuotedMessage from './QuotedMessage';
import { supabase } from '@/lib/supabase';

type ReactionType = 'heart' | 'thumbs_up' | 'thumbs_down';

interface Reaction {
  id: string;
  user_id: string;
  reaction_type: ReactionType;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  attachment_type?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_duration?: number | null;
  profiles?: {
    full_name: string;
    role?: string;
  };
  reactions?: Reaction[];
  deleted_for_all?: boolean;
  deleted_for_sender?: boolean;
  quoted_message_id?: string | null;
  quoted_message?: {
    id: string;
    content: string;
    sender_id: string;
    sender: {
      full_name: string;
    };
  } | null;
}

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  onReply?: (message: Message) => void;
  onDelete?: () => void;
}

export default function MessageBubble({
  message,
  currentUserId,
  onReply,
  onDelete,
}: MessageBubbleProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [reactionPickerPosition, setReactionPickerPosition] = useState({ x: 0, y: 0 });
  const [actionMenuPosition, setActionMenuPosition] = useState({ x: 0, y: 0 });
  const [localReactions, setLocalReactions] = useState<Reaction[]>(message.reactions || []);

  const isOwnMessage = message.sender_id === currentUserId;

  // Don't render deleted messages
  if (message.deleted_for_all || (message.deleted_for_sender && isOwnMessage)) {
    return null;
  }

  const handleLongPress = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setReactionPickerPosition({ x: pageX, y: pageY - 50 });
    setActionMenuPosition({ x: 20, y: pageY + 20 });
    setShowReactionPicker(true);
    setShowActionMenu(true);
  };

  const handleReactionSelect = async (reactionType: ReactionType) => {
    try {
      // Check if user has ANY reaction on this message
      const existingReaction = localReactions.find(
        (r) => r.user_id === currentUserId
      );

      // If clicking the same reaction type, remove it
      if (existingReaction && existingReaction.reaction_type === reactionType) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;

        setLocalReactions(localReactions.filter((r) => r.id !== existingReaction.id));
      } else {
        // Remove old reaction if exists
        if (existingReaction) {
          await supabase
            .from('message_reactions')
            .delete()
            .eq('id', existingReaction.id);
        }

        // Add new reaction
        const { data, error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: message.id,
            user_id: currentUserId,
            reaction_type: reactionType,
          })
          .select()
          .single();

        if (error) throw error;

        // Update local state
        const newReactions = existingReaction
          ? localReactions.filter((r) => r.id !== existingReaction.id)
          : localReactions;
        setLocalReactions([...newReactions, data]);
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const handleDeleteForEveryone = async () => {
    Alert.alert(
      'Изтриване на съобщение',
      'Сигурни ли сте, че искате да изтриете това съобщение за всички?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изтрий',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('messages')
                .update({ deleted_for_all: true })
                .eq('id', message.id);

              if (error) throw error;

              if (onDelete) onDelete();
            } catch (error) {
              console.error('Error deleting message for everyone:', error);
              Alert.alert('Грешка', 'Неуспешно изтриване на съобщението');
            }
          },
        },
      ]
    );
  };

  const handleDeleteForYou = async () => {
    Alert.alert(
      'Изтриване на съобщение',
      'Сигурни ли сте, че искате да изтриете това съобщение само за вас?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изтрий',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('messages')
                .update({ deleted_for_sender: true })
                .eq('id', message.id)
                .eq('sender_id', currentUserId);

              if (error) throw error;

              if (onDelete) onDelete();
            } catch (error) {
              console.error('Error deleting message for you:', error);
              Alert.alert('Грешка', 'Неуспешно изтриване на съобщението');
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('bg-BG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessageStatus = () => {
    if (!isOwnMessage) return null;

    // Render two check marks. Color states:
    // - neither delivered nor read: both grey
    // - delivered (delivered_at set) but not read: first blue, second grey
    // - read (read_at set): both blue
    const firstColor = message.delivered_at || message.read_at ? '#0066FF' : '#666666';
    const secondColor = message.read_at ? '#0066FF' : '#666666';

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Check size={16} color={firstColor} />
        <Check size={16} color={secondColor} style={{ marginLeft: -8 }} />
      </View>
    );
  };

  return (
    <>
      <View
        style={[
          styles.messageRow,
          isOwnMessage ? styles.messageRowRight : styles.messageRowLeft,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={handleLongPress}
          onPress={() => {
            if (showReactionPicker) setShowReactionPicker(false);
            if (showActionMenu) setShowActionMenu(false);
          }}
          delayLongPress={400}
          style={styles.messageContainer}
        >
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.messageBubbleSent : styles.messageBubbleReceived,
            ]}
          >
            {message.quoted_message && message.quoted_message.content && (
              <QuotedMessage
                senderName={message.quoted_message.sender?.full_name || ''}
                content={message.quoted_message.content}
                isOwnMessage={isOwnMessage}
              />
            )}

            {message.content && (message.content.trim() !== `[${message.attachment_type}]`) && (
              <ClickableMessage
                content={message.content}
                style={[
                  styles.messageText,
                  isOwnMessage && styles.messageTextSent,
                ]}
                linkStyle={
                  isOwnMessage
                    ? { color: theme.colors.surface, textDecorationColor: theme.colors.surface }
                    : { color: theme.colors.primary, textDecorationColor: theme.colors.primary }
                }
              />
            )}

            {message.attachment_type && message.attachment_url && (
              <MessageAttachment
                type={message.attachment_type as 'image' | 'file' | 'audio'}
                url={message.attachment_url}
                name={message.attachment_name || 'file'}
                size={message.attachment_size || 0}
                duration={message.attachment_duration || undefined}
              />
            )}

            <View style={[
              styles.messageFooter,
              isOwnMessage ? styles.messageFooterRight : styles.messageFooterLeft
            ]}>
              <Text
                style={[
                  styles.messageTime,
                  isOwnMessage && styles.messageTimeSent,
                ]}
              >
                {formatTime(message.created_at)}
              </Text>
              {renderMessageStatus()}
            </View>

            {isOwnMessage && message.read_at && (
              <Text style={[styles.readAtText, styles.messageTimeSent]}>
                Видяно {new Date(message.read_at).toLocaleDateString('bg-BG', {
                  day: 'numeric',
                  month: 'short',
                })}{' '}
                в {new Date(message.read_at).toLocaleTimeString('bg-BG', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>

          <MessageReactions
            reactions={localReactions}
            currentUserId={currentUserId}
            onReactionPress={handleReactionSelect}
            isOwnMessage={isOwnMessage}
          />
        </TouchableOpacity>
      </View>

      <MessageReactionPicker
        visible={showReactionPicker}
        position={reactionPickerPosition}
        onSelectReaction={(reaction) => {
          handleReactionSelect(reaction);
          setShowReactionPicker(false);
        }}
        onClose={() => setShowReactionPicker(false)}
      />

      <MessageActionMenu
        visible={showActionMenu}
        position={actionMenuPosition}
        isOwnMessage={isOwnMessage}
        onReply={() => {
          if (onReply) onReply(message);
        }}
        onDeleteForEveryone={handleDeleteForEveryone}
        onDeleteForYou={handleDeleteForYou}
        onClose={() => setShowActionMenu(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageContainer: {
    position: 'relative',
  },
  messageBubble: {
    maxWidth: '85%',
    minWidth: 120,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    ...theme.shadows.sm,
  },
  messageBubbleReceived: {
    backgroundColor: theme.colors.cream,
    borderBottomLeftRadius: 4,
  },
  messageBubbleSent: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  messageText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 20,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  messageTextSent: {
    color: theme.colors.surface,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageFooterRight: {
    justifyContent: 'flex-end',
  },
  messageFooterLeft: {
    justifyContent: 'flex-start',
  },
  messageTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  messageTimeSent: {
    color: theme.colors.surface + 'CC',
  },
  readAtText: {
    fontSize: theme.fontSize.xs,
    marginTop: 2,
    textAlign: 'right',
  },
});
