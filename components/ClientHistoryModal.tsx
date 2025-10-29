import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type HistoryItem = {
  id: string;
  type: 'appointment' | 'request';
  service_name: string;
  date: string;
  time: string;
  status: string;
  created_at: string;
  client_message?: string;
};

type ClientHistoryModalProps = {
  visible: boolean;
  clientId: string | null;
  clientName: string;
  onClose: () => void;
};

export default function ClientHistoryModal({
  visible,
  clientId,
  clientName,
  onClose,
}: ClientHistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && clientId) {
      loadHistory();
    }
  }, [visible, clientId]);

  const loadHistory = async () => {
    if (!clientId) return;

    setLoading(true);
    try {
      const [appointmentsResult, requestsResult] = await Promise.all([
        supabase
          .from('appointments')
          .select(`
            id,
            appointment_date,
            start_time,
            status,
            created_at,
            services(name)
          `)
          .eq('client_id', clientId)
          .order('appointment_date', { ascending: false }),
        supabase
          .from('appointment_requests')
          .select(`
            id,
            requested_date,
            requested_time,
            status,
            created_at,
            client_message,
            services(name)
          `)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ]);

      const appointments: HistoryItem[] = (appointmentsResult.data || []).map((apt) => ({
        id: apt.id,
        type: 'appointment',
        service_name: apt.services?.name || 'Неизвестна услуга',
        date: apt.appointment_date,
        time: apt.start_time,
        status: apt.status,
        created_at: apt.created_at,
      }));

      const requests: HistoryItem[] = (requestsResult.data || []).map((req) => ({
        id: req.id,
        type: 'request',
        service_name: req.services?.name || 'Неизвестна услуга',
        date: req.requested_date,
        time: req.requested_time,
        status: req.status,
        created_at: req.created_at,
        client_message: req.client_message,
      }));

      const combined = [...appointments, ...requests].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setHistory(combined);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'approved':
        return theme.colors.success;
      case 'cancelled':
      case 'rejected':
        return theme.colors.error;
      case 'pending':
        return theme.colors.warning;
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusText = (status: string, type: string) => {
    if (type === 'appointment') {
      switch (status) {
        case 'confirmed':
          return 'Потвърдена';
        case 'cancelled':
          return 'Отказана';
        default:
          return status;
      }
    } else {
      switch (status) {
        case 'pending':
          return 'В очакване';
        case 'approved':
          return 'Одобрена';
        case 'rejected':
          return 'Отхвърлена';
        default:
          return status;
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'approved':
        return <CheckCircle size={20} color={theme.colors.success} />;
      case 'cancelled':
      case 'rejected':
        return <XCircle size={20} color={theme.colors.error} />;
      case 'pending':
        return <AlertCircle size={20} color={theme.colors.warning} />;
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{clientName}</Text>
            <Text style={styles.subtitle}>История</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {history.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Няма история за този клиент</Text>
              </View>
            ) : (
              history.map((item) => (
                <View key={`${item.type}-${item.id}`} style={styles.historyCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.serviceText}>{item.service_name}</Text>
                      <Text style={styles.typeText}>
                        {item.type === 'appointment' ? 'Резервация' : 'Заявка'}
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      {getStatusIcon(item.status)}
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(item.status) },
                        ]}
                      >
                        {getStatusText(item.status, item.type)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDetails}>
                    <View style={styles.detailRow}>
                      <Calendar size={16} color={theme.colors.textLight} />
                      <Text style={styles.detailText}>
                        {new Date(item.date).toLocaleDateString('bg-BG', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Clock size={16} color={theme.colors.textLight} />
                      <Text style={styles.detailText}>
                        {item.time.slice(0, 5)}
                      </Text>
                    </View>
                  </View>

                  {item.client_message && (
                    <Text style={styles.messageText}>"{item.client_message}"</Text>
                  )}

                  <Text style={styles.createdText}>
                    Създадена: {new Date(item.created_at).toLocaleDateString('bg-BG')} в{' '}
                    {new Date(item.created_at).toLocaleTimeString('bg-BG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  emptyContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  serviceText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  typeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
  cardDetails: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
  },
  messageText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  createdText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
});
