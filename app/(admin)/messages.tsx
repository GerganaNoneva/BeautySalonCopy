import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageCircle, User, Send, X, ArrowLeft, Check, CheckCheck, Plus, Search, Paperclip } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalSearchParams, router } from 'expo-router';
import MessageAttachmentPicker, { Attachment } from '@/components/MessageAttachmentPicker';
import MessageAttachment from '@/components/MessageAttachment';
import ClickableMessage from '@/components/ClickableMessage';
import MessageBubble from '@/components/MessageBubble';
import UnregisteredClientModal from '@/components/UnregisteredClientModal';
import ReplyInputBanner from '@/components/ReplyInputBanner';

type Reaction = {
  id: string;
  user_id: string;
  reaction_type: 'heart' | 'thumbs_up' | 'thumbs_down';
};

type Conversation = {
  id: string;
  client_id: string;
  client_name: string;
  last_message_at: string;
  unread_count: number;
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
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
    role: string;
  };
};

type Client = {
  id: string;
  full_name: string;
  phone: string;
};

export default function MessagesScreen() {
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<Attachment | null>(null);
  const [showUnregisteredModal, setShowUnregisteredModal] = useState(false);
  const [unregisteredClient, setUnregisteredClient] = useState<Client | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  useEffect(() => {
    loadConversations();

    const globalChannel = supabase
      .channel('all_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      globalChannel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (params.selectedConversationId && conversations.length > 0 && !selectedConversation) {
      const conversation = conversations.find(c => c.id === params.selectedConversationId);
      if (conversation) {
        openConversation(conversation);
      }
    }
  }, [params.selectedConversationId, conversations]);

  useEffect(() => {
    if (params.sharedMessage) {
      setMessageText(params.sharedMessage as string);
      setShowNewMessageModal(true);
      loadClients();
    }
  }, [params.sharedMessage]);

  useEffect(() => {
    if (params.conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === params.conversationId);
      if (conversation && conversation.id !== selectedConversation?.id) {
        openConversation(conversation);
      }
    }
  }, [params.conversationId, conversations]);

  // Scroll to bottom when keyboard hides
  useEffect(() => {
    if (!selectedConversation) return;

    const keyboardDidHide = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setTimeout(() => {
          if (flatListRef.current && messages.length > 0) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      }
    );

    return () => {
      keyboardDidHide.remove();
    };
  }, [messages.length, selectedConversation]);

  useEffect(() => {
    const handleNewChat = async () => {
      if (params.newChat && conversations.length > 0) {
        const clientId = params.newChat as string;
        const existingConversation = conversations.find(c => c.client_id === clientId);
        if (existingConversation) {
          openConversation(existingConversation);
        } else {
          await loadClients();
          const { data: clientData } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('id', clientId)
            .maybeSingle();

          if (clientData) {
            startNewConversation(clientData);
          }
        }
      }
    };
    handleNewChat();
  }, [params.newChat, conversations]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'client')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          client_id,
          last_message_at,
          profiles!conversations_client_id_fkey(full_name)
        `)
        .eq('admin_id', user?.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const conversationList: Conversation[] = await Promise.all(
        (data || []).map(async (conv: any) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .is('read_at', null)
            .neq('sender_id', user?.id);

          return {
            id: conv.id,
            client_id: conv.client_id,
            client_name: conv.profiles?.full_name || 'Неизвестен',
            last_message_at: conv.last_message_at,
            unread_count: count || 0,
          };
        })
      );

      conversationList.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
      });

      setConversations(conversationList);
    } catch (err) {
      console.error('Error loading conversations:', err);
      Alert.alert('Грешка', 'Неуспешно зареждане на съобщенията');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      // Load only the last 10 messages with reactions
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles!messages_sender_id_fkey(full_name, role),
          reactions:message_reactions(id, user_id, reaction_type)
        `)
        .eq('conversation_id', conversationId)
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

      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user?.id)
        .is('read_at', null);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const loadOlderMessages = async () => {
    if (!selectedConversation || !hasMore || loadingMore || !oldestMessageId) return;

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
        .eq('conversation_id', selectedConversation.id)
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

  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
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

          setMessages((prev) => {
            // Check if message already exists (from optimistic update with temp ID)
            const existingIndex = prev.findIndex(msg =>
              msg.id === newMessage.id ||
              (msg.conversation_id === newMessage.conversation_id &&
               msg.sender_id === newMessage.sender_id &&
               msg.content === newMessage.content &&
               msg.id.toString().startsWith('temp-'))
            );

            if (existingIndex !== -1) {
              // Replace temporary message with real one
              const updated = [...prev];
              updated[existingIndex] = newMessage;

              // Scroll to bottom after replacing message
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);

              return updated;
            }

            // New message from another user

            // Scroll to bottom after adding new message
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);

            return [...prev, newMessage];
          });

          // If message is from another user (client), mark as delivered and read
          if (newMessage.sender_id !== user?.id) {
            const now = new Date().toISOString();

            // Always mark as delivered when received via realtime
            if (!newMessage.delivered_at) {
              await supabase
                .from('messages')
                .update({ delivered_at: now })
                .eq('id', newMessage.id);
            }

            // Mark as read since admin has the chat open
            if (!newMessage.read_at) {
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
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          const updatedMessage = payload.new as Message;
          setMessages((prev) => {
            const updated = prev.map((msg) =>
              msg.id === updatedMessage.id ? updatedMessage : msg
            );

            // If message became delivered or read, scroll to show the status
            if ((updatedMessage.delivered_at || updatedMessage.read_at) && updatedMessage.sender_id === user?.id) {
              // Scroll immediately
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 50);

              // Scroll again after layout updates to ensure status is fully visible
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 300);
            }

            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  // When keyboard appears, scroll to bottom so input and latest message are visible
  useEffect(() => {
    if (!selectedConversation) return;

    const onKeyboardShow = () => {
      setTimeout(() => {
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 150);
    };

    const showSub = Keyboard.addListener('keyboardDidShow', onKeyboardShow);
    return () => showSub.remove();
  }, [messages.length, selectedConversation]);

  // Ensure last message is always fully visible including status
  useEffect(() => {
    if (messages.length > 0 && selectedConversation) {
      // Scroll to bottom when last message changes or gets read status
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    }
  }, [messages.length > 0 ? messages[messages.length - 1]?.read_at : null, messages.length > 0 ? messages[messages.length - 1]?.delivered_at : null]);

  const sendMessage = async () => {

    if ((!messageText.trim() && !selectedAttachment) || !selectedConversation || !user) {
      return;
    }

    setSendingMessage(true);

    // Create temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;

    try {
      const messageData: any = {
        conversation_id: selectedConversation?.id,
        sender_id: user?.id,
        content: messageText.trim() || (selectedAttachment ? `[${selectedAttachment.type}]` : ''),
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
  delivered_at: null,
  read_at: null,
  deleted_for_sender: false,
  deleted_for_recipient: false,
  deleted_for_all: false,
  profiles: {
    full_name: user?.user_metadata?.full_name || user?.email || 'Admin',
    role: 'admin'
  }
};

setMessages((prev) => [...prev, optimisticMessage]);

// Scroll to bottom after adding optimistic message
setTimeout(() => {
  flatListRef.current?.scrollToEnd({ animated: true });
}, 100);

// Clear input immediately
setMessageText('');
setSelectedAttachment(null);
setReplyingToMessage(null);

const { data, error } = await supabase
  .from('messages')
  .insert(messageData)
  .select('*');

if (error) {
  // Remove optimistic message on error
  setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
  throw error;
}

// Replace optimistic message with real one
if (data && data[0]) {
  // Load quoted message if exists
  let messageWithQuote = data[0];
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

  // Load profiles for the message
  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', messageWithQuote.sender_id)
    .single();

  if (profileData) {
    messageWithQuote.profiles = profileData;
  }

  setMessages(prev => prev.map(msg =>
    msg.id === tempId ? messageWithQuote : msg
  ));
}

setTimeout(() => {
  flatListRef.current?.scrollToEnd({ animated: true });
}, 100);
} catch (err) {
  console.error('Error sending message:', err);
  // Remove optimistic message on error
  setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
  Alert.alert('Грешка', 'Неуспешно изпращане на съобщението');
} finally {
  setSendingMessage(false);
}
};

  const handleReply = (message: Message) => {
    setReplyingToMessage(message);
  };

  const handleAttachmentSelected = (attachment: Attachment) => {
    setSelectedAttachment(attachment);
  };

  const openConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);
    await markConversationAsRead(conversation.id);
  };

  const markConversationAsRead = async (conversationId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .is('read_at', null)
        .neq('sender_id', user?.id);

      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('type', 'new_message')
        .contains('data', { conversation_id: conversationId });

      await loadConversations();
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  };

  const handleNewMessage = () => {
    loadClients();
    setShowNewMessageModal(true);
  };

  const startNewConversation = async (client: Client) => {
    try {
      let convId: string;

      const { data: existingConversation, error: fetchError } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', client.id)
        .eq('admin_id', user?.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingConversation) {
        convId = existingConversation.id;
      } else {
        const { data: newConversation, error: insertError } = await supabase
          .from('conversations')
          .insert({
            client_id: client.id,
            admin_id: user?.id,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        convId = newConversation.id;
      }

      await loadConversations();

      const conversation = {
        id: convId,
        client_id: client.id,
        client_name: client.full_name,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      };

      setSelectedConversation(conversation);
      await loadMessages(convId);
    } catch (err) {
      console.error('Error creating conversation:', err);
      Alert.alert('Грешка', 'Неуспешно отваряне на разговор');
    }
  };

  const handleClientSelect = async (client: Client) => {
    try {
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', client.id)
        .maybeSingle();

      const { count: messageCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', client.id);

      if (!clientProfile || messageCount === 0) {
        setUnregisteredClient(client);
        setShowUnregisteredModal(true);
        return;
      }

      let convId: string;

      const { data: existingConversation, error: fetchError } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', client.id)
        .eq('admin_id', user?.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingConversation) {
        convId = existingConversation.id;
      } else {
        const { data: newConversation, error: insertError } = await supabase
          .from('conversations')
          .insert({
            client_id: client.id,
            admin_id: user?.id,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        convId = newConversation.id;
      }

      setShowNewMessageModal(false);
      setSearchQuery('');

      await loadConversations();

      const conversation = {
        id: convId,
        client_id: client.id,
        client_name: client.full_name,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      };

      setSelectedConversation(conversation);
      await loadMessages(convId);
    } catch (err) {
      console.error('Error creating conversation:', err);
      Alert.alert('Грешка', 'Неуспешно отваряне на разговор');
    }
  };

  const closeConversation = () => {
    setSelectedConversation(null);
    setMessages([]);
    loadConversations();

    if (params.selectedConversationId || params.conversationId || params.newChat) {
      router.setParams({
        selectedConversationId: undefined,
        conversationId: undefined,
        newChat: undefined
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Сега';
    if (diffMins < 60) return `${diffMins} мин`;
    if (diffHours < 24) return `${diffHours} ч`;
    if (diffDays < 7) return `${diffDays} дни`;

    return date.toLocaleDateString('bg-BG', {
      day: 'numeric',
      month: 'short',
    });
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.chatCard}
      onPress={() => openConversation(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <User size={24} color={theme.colors.primary} />
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={[styles.clientName, item.unread_count > 0 && styles.clientNameUnread]}>
            {item.client_name}
          </Text>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Text style={styles.timeText}>{formatTime(item.last_message_at)}</Text>
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.messageRow}>
          {item.unread_count > 0 ? (
            <Text style={styles.unreadMessageText}>
              {item.unread_count} непрочетен{item.unread_count === 1 ? 'о' : 'и'} съобщени{item.unread_count === 1 ? 'е' : 'я'}
            </Text>
          ) : (
            <Text style={styles.lastMessagePreview}>Натиснете за отваряне</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMessage = ({ item }: { item: Message }) => {
    return (
      <MessageBubble
        message={item}
        currentUserId={user?.id || ''}
        onReply={handleReply}
        onDelete={() => {
          if (selectedConversation) {
            loadMessages(selectedConversation.id);
          }
        }}
      />
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={theme.gradients.champagne} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnreadCount = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);

  return (
    <LinearGradient colors={theme.gradients.champagne} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Съобщения</Text>
                {totalUnreadCount > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{totalUnreadCount}</Text>
                  </View>
                )}
              </View>
              {totalUnreadCount > 0 ? (
                <Text style={styles.unreadWarning}>
                  Имате {totalUnreadCount} непрочетен{totalUnreadCount === 1 ? 'о' : 'и'} съобщени{totalUnreadCount === 1 ? 'е' : 'я'}
                </Text>
              ) : (
                <Text style={styles.subtitle}>
                  {conversations.length} {conversations.length === 1 ? 'чат' : 'чата'}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.newMessageButton}
              onPress={handleNewMessage}
            >
              <Plus size={24} color={theme.colors.surface} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={conversationSearchQuery}
            onChangeText={setConversationSearchQuery}
            placeholder="Търсене по име..."
            placeholderTextColor={theme.colors.textMuted}
          />
          {conversationSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setConversationSearchQuery('')}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={conversations.filter(c =>
            c.client_name.toLowerCase().includes(conversationSearchQuery.toLowerCase())
          )}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={64} color={theme.colors.textMuted} />
              <Text style={styles.emptyText}>Все още няма съобщения</Text>
              <Text style={styles.emptySubtext}>
                Когато клиентите ви изпратят съобщение, то ще се появи тук
              </Text>
            </View>
          }
        />

        <Modal
          visible={!!selectedConversation}
          animationType="slide"
          presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        >
          <View style={styles.container}>
            <LinearGradient colors={theme.gradients.champagne} style={{ flex: 1 }}>
              <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
              <View style={styles.chatHeader}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={closeConversation}
                >
                  <ArrowLeft size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.chatTitle}>
                  {selectedConversation?.client_name}
                </Text>
              </View>

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={0}
              >
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  renderItem={renderMessage}
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
                    value={messageText}
                    onChangeText={setMessageText}
                    placeholder="Напишете съобщение..."
                    placeholderTextColor={theme.colors.textMuted}
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
                    style={[
                      styles.sendButton,
                      ((!messageText.trim() && !selectedAttachment) || sendingMessage) &&
                        styles.sendButtonDisabled,
                    ]}
                    onPress={sendMessage}
                    disabled={(!messageText.trim() && !selectedAttachment) || sendingMessage}
                  >
                    {sendingMessage ? (
                      <ActivityIndicator size="small" color={theme.colors.surface} />
                    ) : (
                      <Send size={20} color={theme.colors.surface} />
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
              </SafeAreaView>
            </LinearGradient>
          </View>
        </Modal>

        <Modal
          visible={showNewMessageModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNewMessageModal(false)}
        >
          <View style={styles.newMessageOverlay}>
            <View style={styles.newMessageModal}>
              <View style={styles.newMessageHeader}>
                <Text style={styles.newMessageTitle}>Избери клиент</Text>
                <TouchableOpacity onPress={() => setShowNewMessageModal(false)}>
                  <X size={24} color={theme.colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Search size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Търси по име..."
                  placeholderTextColor={theme.colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                {/* Scroll to bottom whenever messages change (new message sent or received) */}
                {/** Use effect-like behavior via key change: */}
              </View>

              <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.clientSelectItem}
                    onPress={() => handleClientSelect(item)}
                  >
                    <View style={styles.clientSelectInfo}>
                      <User size={20} color={theme.colors.primary} />
                      <View style={styles.clientSelectDetails}>
                        <Text style={styles.clientSelectName}>{item.full_name}</Text>
                        {item.phone && (
                          <Text style={styles.clientSelectPhone}>{item.phone}</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyClients}>
                    <Text style={styles.emptyClientsText}>Няма намерени клиенти</Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>

        <MessageAttachmentPicker
          visible={showAttachmentPicker}
          onClose={() => setShowAttachmentPicker(false)}
          onAttachmentSelected={handleAttachmentSelected}
        />

        <UnregisteredClientModal
          visible={showUnregisteredModal}
          onClose={() => {
            setShowUnregisteredModal(false);
            setUnregisteredClient(null);
          }}
          clientName={unregisteredClient?.full_name || ''}
          clientPhone={unregisteredClient?.phone || ''}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  unreadWarning: {
    fontSize: theme.fontSize.sm,
    color: '#ef4444',
    fontWeight: '600',
  },
  listContent: {
    padding: theme.spacing.md,
  },
  chatCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    gap: theme.spacing.md,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  chatTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  clientName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  clientNameUnread: {
    fontWeight: '700',
    color: '#ef4444',
  },
  timeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  unreadMessageText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.error,
    flex: 1,
  },
  lastMessagePreview: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    minWidth: 40,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    overflow: 'visible',
    zIndex: 999,
    elevation: 6,
  },
  unreadBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
    color: theme.colors.surface,
  },
  unreadText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.textLight,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: theme.spacing.md,
  },
  messageContainer: {
    marginBottom: theme.spacing.md,
    maxWidth: '75%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  ownMessageBubble: {
    backgroundColor: theme.colors.primary,
  },
  otherMessageBubble: {
    backgroundColor: theme.colors.surface,
  },
  messageText: {
    fontSize: theme.fontSize.sm,
    marginBottom: 4,
  },
  ownMessageText: {
    color: theme.colors.surface,
  },
  otherMessageText: {
    color: theme.colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: theme.fontSize.xs,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  readAtText: {
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  otherMessageTime: {
    color: theme.colors.textMuted,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.cream,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerBadge: {
    backgroundColor: theme.colors.error,
    borderRadius: 12,
    minWidth: 40,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    overflow: 'visible',
    zIndex: 999,
    elevation: 6,
  },
  headerBadgeText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.xs,
    fontWeight: '800',
  },
  newMessageButton: {
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  newMessageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  newMessageModal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    maxHeight: '80%',
  },
  newMessageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  newMessageTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  clientSelectItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  clientSelectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  clientSelectDetails: {
    flex: 1,
  },
  clientSelectName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  clientSelectPhone: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  emptyClients: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyClientsText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
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
