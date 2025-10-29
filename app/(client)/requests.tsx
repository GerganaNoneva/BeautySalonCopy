import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

type AppointmentRequest = {
  id: string;
  requested_date: string;
  requested_time: string;
  client_message: string;
  status: string;
  created_at: string;
  services: {
    name: string;
  };
};

export default function ClientRequestsScreen() {
  console.log("🔵 CLIENT REQUESTS: VERSION 2.0 - Clear button added");
  const { user } = useAuth();
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (user?.id) {
      loadRequests();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    // Real-time subscription for appointment requests
    const requestsChannel = supabase
      .channel('client_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_requests',
          filter: `client_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("🔴 CLIENT REQUESTS REAL-TIME EVENT:", payload.eventType, payload.new);
          loadRequests();
        }
      )
      .subscribe((status) => {
        console.log('🔵 Client Requests: Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(requestsChannel);
    };
  }, [user?.id]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointment_requests')
        .select(`
          id,
          requested_date,
          requested_time::text,
          client_message,
          status,
          created_at,
          services(name)
        `)
        .eq('client_id', user?.id)
        .in('status', ['pending', 'rejected'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests((data || []) as any);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequests();
  };

  const handleCancelRequest = (requestId: string) => {
    setCancellingRequestId(requestId);
    setShowCancelModal(true);
  };

  const confirmCancelRequest = async () => {
    if (!cancellingRequestId) return;

    try {
      // Get request details BEFORE deletion
      const request = requests.find(r => r.id === cancellingRequestId);

      // Delete the request
      const { error } = await supabase
        .from('appointment_requests')
        .delete()
        .eq('id', cancellingRequestId);

      if (error) throw error;

      // Notify admin about cancellation (reason is optional)
      if (request) {
        try {
          await supabase.rpc('notify_admin', {
            p_title: 'Клиент отмени заявка',
            p_body: `Клиент отмени заявка за ${request.services.name} на ${new Date(request.requested_date).toLocaleDateString('bg-BG')} в ${request.requested_time.slice(0, 5)}${cancelReason.trim() ? `. Причина: ${cancelReason}` : ''}`,
            p_type: 'booking_cancelled',
            p_data: {
              request_id: cancellingRequestId,
              cancel_reason: cancelReason || null,
            }
          });
        } catch (notifError) {
          console.error('Error sending cancellation notification:', notifError);
          // Don't fail the whole operation if notification fails
        }
      }

      setShowCancelModal(false);
      setCancelReason('');
      setCancellingRequestId(null);
      loadRequests();
      Alert.alert('Успех', 'Заявката е отменена');
    } catch (err) {
      console.error('Error cancelling request:', err);
      Alert.alert('Грешка', 'Неуспешна отмяна на заявката');
    }
  };

  const handleClearRejected = async () => {
    try {
      const rejectedRequests = requests.filter(r => r.status === 'rejected');
      if (rejectedRequests.length === 0) return;

      const { error } = await supabase
        .from('appointment_requests')
        .delete()
        .eq('client_id', user?.id)
        .eq('status', 'rejected');

      if (error) throw error;
      loadRequests();
    } catch (error) {
      console.error('Error clearing rejected requests:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${dayName}, ${day}.${month}.${year}г.`;
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={20} color={theme.colors.success} />;
      case 'rejected':
        return <XCircle size={20} color={theme.colors.error} />;
      case 'pending':
        return <AlertCircle size={20} color={theme.colors.warning} />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Одобрена';
      case 'rejected':
        return 'Отхвърлена';
      case 'pending':
        return 'В очакване';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return theme.colors.success;
      case 'rejected':
        return theme.colors.error;
      case 'pending':
        return theme.colors.warning;
      default:
        return theme.colors.textMuted;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.headerTitle}>Моите заявки</Text>
        <Text style={styles.headerSubtitle}>
          {requests.filter(r => r.status === 'pending').length} в очакване
        </Text>
      </LinearGradient>

      
       
{requests.some(r => r.status === 'rejected') && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearRejected}
          >
            <Text style={styles.clearButtonText}>Изчисти отхвърлени</Text>
          </TouchableOpacity>
        )}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Зареждане...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Calendar size={64} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Няма заявки за часове</Text>
            <Text style={styles.emptySubtext}>
              Вашите заявки ще се показват тук
            </Text>
          </View>
        ) : (
          requests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.dateContainer}>
                  <Calendar size={20} color={theme.colors.primary} />
                  <Text style={styles.dateText}>
                    {formatDate(request.requested_date)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}>
                  {getStatusIcon(request.status)}
                  <Text style={styles.statusText}>{getStatusText(request.status)}</Text>
                </View>
              </View>

              <View style={styles.requestDetails}>
                <View style={styles.detailRow}>
                  <Clock size={18} color={theme.colors.textMuted} />
                  <Text style={styles.detailText}>
                    {formatTime(request.requested_time)}
                  </Text>
                </View>

                <Text style={styles.serviceName}>
                  {request.services.name}
                </Text>

                {request.client_message && (
                  <View style={styles.notesContainer}>
                    <Text style={styles.notesLabel}>Съобщение:</Text>
                    <Text style={styles.notesText}>{request.client_message}</Text>
                  </View>
                )}
              </View>

              {request.status === 'pending' && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => handleCancelRequest(request.id)}
                >
                  <X size={16} color={theme.colors.surface} />
                  <Text style={styles.cancelButtonText}>Отмени заявка</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Cancel Request Modal */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowCancelModal(false);
              setCancelReason('');
            }}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.cancelModalContent}>
                <View style={styles.cancelModalHeader}>
                  <Text style={styles.cancelModalTitle}>Отмяна на заявка</Text>
                  <TouchableOpacity onPress={() => {
                    setShowCancelModal(false);
                    setCancelReason('');
                  }}>
                    <X size={24} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.cancelModalSubtitle}>
                  Причината за отмяна е опционална. Ако желаете, можете да споделите защо отменяте заявката:
                </Text>

                <TextInput
                  style={styles.cancelReasonInput}
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  placeholder="Причина (опционално)..."
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={styles.confirmCancelButton}
                  onPress={confirmCancelRequest}
                >
                  <LinearGradient
                    colors={['#E53935', '#C62828']}
                    style={styles.confirmCancelGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.confirmCancelText}>Потвърди отмяната</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelModalBackButton}
                  onPress={() => {
                    setShowCancelModal(false);
                    setCancelReason('');
                  }}
                >
                  <Text style={styles.cancelModalBackText}>Назад</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.surface,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },

  clearButton: {
    backgroundColor: theme.colors.error,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  requestCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  requestDetails: {
    gap: theme.spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  notesContainer: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  notesText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  cancelButtonText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  cancelModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  cancelModalSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  cancelReasonInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.text,
    minHeight: 100,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  confirmCancelButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  confirmCancelGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  confirmCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.surface,
  },
  cancelModalBackButton: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  cancelModalBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
});
