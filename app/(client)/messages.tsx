import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Send, Check, CheckCheck, Paperclip, X } from 'lucide-react-native';
import NotificationsModal from '@/components/NotificationsModal';
import NotificationBadge from '@/components/NotificationBadge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import MessageAttachmentPicker, { Attachment } from '@/components/MessageAttachmentPicker';
import MessageAttachment from '@/components/MessageAttachment';
import ClickableMessage from '@/components/ClickableMessage';
import MessageBubble from '@/components/MessageBubble';
import ReplyInputBanner from '@/components/ReplyInputBanner';
import { useFocusEffect } from '@react-navigation/native';

type Reaction = {
  id: string;
  user_id: string;
  reaction_type: 'heart' | 'thumbs_up' | 'thumbs_down';
};

type Message = {
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
  profiles?: {
    full_name: string;
    role?: string;
  };
};

export default function ClientMessagesScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const flatListRef = useRef<any>(null);
  const isFocused = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      isFocused.current = true;
      if (conversationId) {
        markMessagesAsRead(conversationId);
      }

      // Scroll to bottom whenever the screen is focused
      if (messages.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 300);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 500);
      }

      return () => {
        isFocused.current = false;
      };
    }, [conversationId, messages.length])
  );

  useEffect(() => {
    if (user) {
      let subscription: any;

      const initConversation = async () => {
        try {
          // Get the admin
          const { data: admin, error: adminError } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')
            .maybeSingle();

          if (adminError || !admin) {
            console.error('No admin found');
            setLoading(false);
            return;
          }

          // Find or create conversation
          let convId: string;

          const { data: existingConv, error: fetchError } = await supabase
            .from('conversations')
            .select('id')
            .eq('client_id', user.id)
            .eq('admin_id', admin.id)
            .maybeSingle();

          if (fetchError) throw fetchError;

          if (existingConv) {
            convId = existingConv.id;
          } else {
            const { data: newConv, error: insertError } = await supabase
              .from('conversations')
              .insert({
                client_id: user.id,
                admin_id: admin.id,
              })
              .select('id')
              .single();

            if (insertError) throw insertError;
            convId = newConv.id;
          }

          setConversationId(convId);
          loadMessages(convId);
          subscription = setupRealtimeSubscription(convId);
        } catch (error) {
          console.error('Error initializing conversation:', error);
          setLoading(false);
        }
      };

      initConversation();

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [user]);

  // Removed auto-scroll on messages.length change to prevent unwanted scrolling when loading old messages

  // When keyboard appears, scroll to bottom
  useEffect(() => {
    if (!conversationId) return;

    const keyboardDidShow = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setTimeout(() => {
          if (flatListRef.current && messages.length > 0) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 150);
      }
    );

    return () => {
      keyboardDidShow.remove();
    };
  }, [messages.length, conversationId]);

  // Ensure last message is always fully visible including status
  useEffect(() => {
    if (messages.length > 0 && conversationId) {
      // Scroll to bottom when last message changes or gets read status
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    }
  }, [messages.length > 0 ? messages[messages.length - 1]?.read_at : null, messages.length > 0 ? messages[messages.length - 1]?.delivered_at : null]);

  const markMessagesAsRead = async (convId: string) => {
    if (!isFocused.current) return;

    try {
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', convId)
        .neq('sender_id', user?.id || '')
        .is('read_at', null);

      if (unreadMessages && unreadMessages.length > 0) {
        await supabase
          .from('messages')
          .update({ read_at: new Date().toISOString() })
          .in(
            'id',
            unreadMessages.map((msg) => msg.id)
          );
        const messageIds = unreadMessages.map((msg) => msg.id);
        // Batch update notifications that reference these message IDs in their JSON data.
        try {
          // Try to mark all notifications for this conversation as read in one go
          // by using the conversation_id stored in message rows (safer and covers messages without direct message_id link).
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user?.id)
            .eq('type', 'new_message')
            .filter("data->>conversation_id", 'eq', String(convId));
        } catch (err) {
          console.error('Error updating notifications for conversation messages, falling back to per-message update:', err);
          // Fallback: update per message id
          for (const messageId of messageIds) {
            try {
              await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user?.id)
                .eq('type', 'new_message')
                .filter("data->>message_id", 'eq', String(messageId));
            } catch (innerErr) {
              console.error('Error updating notification for message id', messageId, innerErr);
            }
          }
        }

        loadMessages(convId);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      // Load only the last 10 messages with reactions
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!messages_sender_id_fkey(full_name, role),
          reactions:message_reactions(id, user_id, reaction_type)
        `)
        .eq('conversation_id', convId)
        .neq('deleted_for_all', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Load quoted messages separately
      const messagesWithQuotes = await Promise.all((data || []).map(async (msg: any) => {
        if (msg.quoted_message_id) {
          const { data: quotedMsg } = await supabase
            .from('messages')
            .select('id, content, sender_id, profiles!messages_sender_id_fkey(full_name)')
            .eq('id', msg.quoted_message_id)
            .single();

          return {
            ...msg,
            quoted_message: quotedMsg ? {
              id: quotedMsg.id,
              content: quotedMsg.content,
              sender_id: quotedMsg.sender_id,
              sender: quotedMsg.profiles
            } : null
          };
        }
        return msg;
      }));

      const sortedMessages = messagesWithQuotes.reverse();
      setMessages(sortedMessages);

      if (sortedMessages.length > 0) {
        setOldestMessageId(sortedMessages[0].id);
        setHasMore(data && data.length === 10);
      } else {
        setHasMore(false);
      }

      // Scroll to bottom with multiple attempts to ensure it works
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 300);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 500);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (!conversationId || !hasMore || loadingMore || !oldestMessageId) return;

    setLoadingMore(true);
    try {
      const oldestMessage = messages[0];

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!messages_sender_id_fkey(full_name, role),
          reactions:message_reactions(id, user_id, reaction_type)
        `)
        .eq('conversation_id', conversationId)
        .neq('deleted_for_all', true)
        .lt('created_at', oldestMessage.created_at)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data && data.length > 0) {
        // Load quoted messages separately
        const messagesWithQuotes = await Promise.all(data.map(async (msg: any) => {
          if (msg.quoted_message_id) {
            const { data: quotedMsg } = await supabase
              .from('messages')
              .select('id, content, sender_id, profiles!messages_sender_id_fkey(full_name)')
              .eq('id', msg.quoted_message_id)
              .single();

            return {
              ...msg,
              quoted_message: quotedMsg ? {
                id: quotedMsg.id,
                content: quotedMsg.content,
                sender_id: quotedMsg.sender_id,
                sender: quotedMsg.profiles
              } : null
            };
          }
          return msg;
        }));

        const sortedOldMessages = messagesWithQuotes.reverse();

        setMessages(prev => [...sortedOldMessages, ...prev]);
        setOldestMessageId(sortedOldMessages[0].id);
        setHasMore(data.length === 10);
        // Don't scroll - maintain current position
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const setupRealtimeSubscription = (convId: string) => {
    const subscription = supabase
      .channel(`messages:${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`
        },
        async (payload) => {
          let newMessage = payload.new as Message;

          // Load quoted message if exists
          if (newMessage.quoted_message_id) {
            const { data: quotedMsg } = await supabase
              .from('messages')
              .select('id, content, sender_id, profiles!messages_sender_id_fkey(full_name)')
              .eq('id', newMessage.quoted_message_id)
              .single();

            if (quotedMsg) {
              const profiles = Array.isArray(quotedMsg.profiles) ? quotedMsg.profiles[0] : quotedMsg.profiles;
              newMessage = {
                ...newMessage,
                quoted_message: {
                  id: quotedMsg.id,
                  content: quotedMsg.content,
                  sender_id: quotedMsg.sender_id,
                  sender: {
                    full_name: profiles?.full_name || ''
                  }
                }
              };
            }
          }

          // Load profiles if not included
          if (!newMessage.profiles) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, role')
              .eq('id', newMessage.sender_id)
              .single();

            if (profileData) {
              newMessage.profiles = profileData;
            }
          }

          // Add message to state if it doesn't already exist
          setMessages((prev) => {
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev;
            }

            // Scroll to bottom after adding new message
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);

            return [...prev, newMessage];
          });

          // If message is from another user (admin), mark as delivered and read
          if (newMessage.sender_id !== user?.id) {
            const now = new Date().toISOString();

            // Always mark as delivered when received via realtime
            if (!newMessage.delivered_at) {
              await supabase
                .from('messages')
                .update({ delivered_at: now })
                .eq('id', newMessage.id);
            }

            // Mark as read only if chat is in focus
            if (!newMessage.read_at && isFocused.current) {
              await supabase
                .from('messages')
                .update({ read_at: now })
                .eq('id', newMessage.id);

              await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', user?.id)
                .eq('type', 'new_message')
                .contains('data', { message_id: newMessage.id });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            );

            // If message became delivered or read, scroll to show the status
            if ((updatedMessage.delivered_at || updatedMessage.read_at) && updatedMessage.sender_id === user?.id) {
              setTimeout(() => {
                if (flatListRef.current && messages.length > 0) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 200);
            }

            return updated;
          });
        }
      )
      .subscribe();

    return subscription;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedAttachment) {
      return;
    }

    if (!user) {
      return;
    }

    if (!conversationId) {
      return;
    }

    setSending(true);

    // Create temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;

    try {
      const messageData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage.trim() || (selectedAttachment ? `[${selectedAttachment.type}]` : ''),
      };

      if (replyingToMessage) {
        messageData.quoted_message_id = replyingToMessage.id;
      }

      if (selectedAttachment) {
        messageData.attachment_type = selectedAttachment.type;
        messageData.attachment_url = selectedAttachment.url;
        messageData.attachment_name = selectedAttachment.name;
        messageData.attachment_size = selectedAttachment.size;
        if (selectedAttachment.duration) {
          messageData.attachment_duration = selectedAttachment.duration;
        }
      }

      // Optimistically add message to UI immediately
      const optimisticMessage: any = {
        id: tempId,
        created_at: new Date().toISOString(),
        conversation_id: messageData.conversation_id,
        sender_id: messageData.sender_id,
        content: messageData.content,
        quoted_message_id: messageData.quoted_message_id || null,
        quoted_message: replyingToMessage ? {
          id: replyingToMessage.id,
          content: replyingToMessage.content,
          sender_id: replyingToMessage.sender_id,
          sender: {
            full_name: replyingToMessage.profiles?.full_name || ''
          }
        } : null,
        attachment_type: messageData.attachment_type || null,
        attachment_url: messageData.attachment_url || null,
        attachment_name: messageData.attachment_name || null,
        attachment_size: messageData.attachment_size || null,
        attachment_duration: messageData.attachment_duration || null,
        read_at: null,
        delivered_at: null,
        deleted_for_sender: false,
        deleted_for_all: false,
        profiles: {
          full_name: user?.user_metadata?.full_name || user?.email || 'Клиент',
          role: 'client'
        },
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      // Scroll to bottom after adding optimistic message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Clear input immediately
      setNewMessage('');
      setSelectedAttachment(null);
      setReplyingToMessage(null);

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select(`
          *,
          profiles!messages_sender_id_fkey(full_name, role)
        `);

      if (error) {
        console.error('Error inserting message:', error);
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        throw error;
      }


      // Replace optimistic message with real one
      if (data && data[0]) {
        // Load quoted message if exists
        let messageWithQuote = data[0] as Message;
        if (messageWithQuote.quoted_message_id) {
          const { data: quotedMsg } = await supabase
            .from('messages')
            .select('id, content, sender_id, profiles!messages_sender_id_fkey(full_name)')
            .eq('id', messageWithQuote.quoted_message_id)
            .single();

          if (quotedMsg) {
            const profiles = Array.isArray(quotedMsg.profiles) ? quotedMsg.profiles[0] : quotedMsg.profiles;
            messageWithQuote = {
              ...messageWithQuote,
              quoted_message: {
                id: quotedMsg.id,
                content: quotedMsg.content,
                sender_id: quotedMsg.sender_id,
                sender: {
                  full_name: profiles?.full_name || ''
                }
              }
            };
          }
        }

        setMessages(prev => prev.map(msg =>
          msg.id === tempId ? messageWithQuote : msg
        ));

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error if not already removed
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleReply = (message: Message) => {
    setReplyingToMessage(message);
  };

  const handleAttachmentSelected = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradients.primary} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Съобщения</Text>
            <Text style={styles.headerSubtitle}>Чат със салона</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <NotificationBadge size={24} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messagesContainer}
            contentContainerStyle={[styles.messagesContent, { paddingBottom: 200 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScroll={(event) => {
              const offsetY = event.nativeEvent.contentOffset.y;

              // Load older messages when scrolling near the top
              if (offsetY < 100 && !loadingMore && hasMore) {
                loadOlderMessages();
              }
            }}
            scrollEventThrottle={400}
            inverted={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
            ListHeaderComponent={
              loadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.loadingMoreText}>Зареждане на стари съобщения...</Text>
                </View>
              ) : !hasMore && messages.length > 0 ? (
                <View style={styles.endOfMessagesContainer}>
                  <Text style={styles.endOfMessagesText}>Началото на разговора</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Все още няма съобщения. Започнете разговор!
                </Text>
              </View>
            }
            renderItem={({ item: message }) => (
              <MessageBubble
                message={message}
                currentUserId={user?.id || ''}
                onReply={handleReply}
                onDelete={() => loadMessages(conversationId!)}
              />
            )}
          />

          {selectedAttachment && (
            <View style={styles.attachmentPreview}>
              <MessageAttachment
                type={selectedAttachment.type}
                url={selectedAttachment.url}
                name={selectedAttachment.name}
                size={selectedAttachment.size}
                duration={selectedAttachment.duration}
              />
              <TouchableOpacity
                style={styles.removeAttachment}
                onPress={() => setSelectedAttachment(null)}
              >
                <X size={16} color={theme.colors.surface} />
              </TouchableOpacity>
            </View>
          )}

          {replyingToMessage && (
            <ReplyInputBanner
              senderName={replyingToMessage.profiles?.full_name || 'Потребител'}
              content={replyingToMessage.content}
              onCancel={() => setReplyingToMessage(null)}
            />
          )}

          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => setShowAttachmentPicker(true)}
            >
              <Paperclip size={22} color={theme.colors.primary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Напишете съобщение..."
              placeholderTextColor={theme.colors.textMuted}
              value={newMessage}
              onChangeText={setNewMessage}
              onSubmitEditing={sendMessage}
              onFocus={() => {
                setTimeout(() => {
                  if (flatListRef.current && messages.length > 0) {
                    flatListRef.current.scrollToEnd({ animated: true });
                  }
                }, 100);
              }}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, sending && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={sending || (!newMessage.trim() && !selectedAttachment)}
            >
              {sending ? (
                <ActivityIndicator size="small" color={theme.colors.surface} />
              ) : (
                <Send size={20} color={theme.colors.surface} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <MessageAttachmentPicker
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onAttachmentSelected={handleAttachmentSelected}
      />

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
  },
  notificationButton: {
    padding: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: theme.spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  messageRow: {
    marginBottom: theme.spacing.md,
  },
  messageRowLeft: {
    alignItems: 'flex-start',
  },
  messageRowRight: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.sm,
  },
  messageBubbleReceived: {
    backgroundColor: theme.colors.surface,
  },
  messageBubbleSent: {
    backgroundColor: theme.colors.primary,
  },
  senderName: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  messageText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 20,
  },
  messageTextSent: {
    color: theme.colors.surface,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  messageTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  messageTimeSent: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  readAtText: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentPreview: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    position: 'relative',
  },
  removeAttachment: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.error,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  loadingMoreContainer: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  loadingMoreText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  endOfMessagesContainer: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  endOfMessagesText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
});
