import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Search, Send, Users } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';

type Client = {
  id: string;
  full_name: string;
  phone: string;
};

type PromotionNotificationModalProps = {
  visible: boolean;
  promotionId: string;
  promotionName: string;
  onClose: () => void;
};

export default function PromotionNotificationModal({
  visible,
  promotionId,
  promotionName,
  onClose,
}: PromotionNotificationModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      loadClients();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredClients(
        clients.filter((client) =>
          client.full_name.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredClients(clients);
    }
  }, [searchQuery, clients]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'client')
        .order('full_name');

      if (error) throw error;
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на клиенти');
    } finally {
      setLoading(false);
    }
  };

  const toggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const selectAll = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const sendNotifications = async () => {
    if (selectedClients.size === 0) {
      Alert.alert('Внимание', 'Моля, изберете поне един клиент');
      return;
    }

    setSending(true);
    try {
      const notifications = Array.from(selectedClients).map((clientId) => ({
        user_id: clientId,
        type: 'new_promotion',
        title: 'Специална промоция!',
        body: `Проверете промоцията: ${promotionName}`,
        data: {
          promotion_id: promotionId,
          promotion_name: promotionName,
        },
      }));

      const { error } = await supabase.from('notifications').insert(notifications);

      if (error) throw error;

      Alert.alert('Успех', `Уведомления изпратени на ${selectedClients.size} клиента`);
      setSelectedClients(new Set());
      setSearchQuery('');
      onClose();
    } catch (error) {
      console.error('Error sending notifications:', error);
      Alert.alert('Грешка', 'Неуспешно изпращане на уведомления');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSelectedClients(new Set());
    setSearchQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Уведоми клиенти</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.promotionInfo}>
            <Text style={styles.promotionName}>{promotionName}</Text>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Търси по име..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <TouchableOpacity style={styles.selectAllButton} onPress={selectAll}>
            <Users size={20} color={theme.colors.primary} />
            <Text style={styles.selectAllText}>
              {selectedClients.size === filteredClients.length ? 'Размаркирай всички' : 'Избери всички'}
            </Text>
            <Text style={styles.selectionCount}>
              ({selectedClients.size}/{filteredClients.length})
            </Text>
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.clientList}>
              {filteredClients.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={[
                    styles.clientItem,
                    selectedClients.has(client.id) && styles.clientItemSelected,
                  ]}
                  onPress={() => toggleClient(client.id)}
                >
                  <View>
                    <Text style={styles.clientName}>{client.full_name}</Text>
                    {client.phone && (
                      <Text style={styles.clientPhone}>{client.phone}</Text>
                    )}
                  </View>
                  {selectedClients.has(client.id) && (
                    <View style={styles.checkmark} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendNotifications}
            disabled={sending || selectedClients.size === 0}
          >
            {sending ? (
              <ActivityIndicator size="small" color={theme.colors.surface} />
            ) : (
              <>
                <Send size={20} color={theme.colors.surface} />
                <Text style={styles.sendButtonText}>
                  Изпрати уведомления ({selectedClients.size})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 4,
  },
  promotionInfo: {
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  promotionName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  selectAllText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  selectionCount: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  clientList: {
    flex: 1,
    marginBottom: 16,
  },
  clientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  clientItemSelected: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  clientPhone: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
});
