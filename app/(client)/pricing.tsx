import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, DollarSign, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { router, useLocalSearchParams } from 'expo-router';
import NotificationsModal from '@/components/NotificationsModal';
import NotificationBadge from '@/components/NotificationBadge';

type Service = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
};

type Promotion = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
};

export default function ClientPricingScreen() {
  const { highlightPromotionId, highlightServiceId } = useLocalSearchParams<{
    highlightPromotionId?: string;
    highlightServiceId?: string;
  }>();
  const [services, setServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [highlightedPromotionId, setHighlightedPromotionId] = useState<string | null>(null);
  const [highlightedServiceId, setHighlightedServiceId] = useState<string | null>(null);
  const promotionRefs = useRef<{ [key: string]: View | null }>({});
  const serviceRefs = useRef<{ [key: string]: View | null }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    loadServices();
    loadPromotions();
  }, []);

  // Real-time subscription for services
  useEffect(() => {
    const servicesChannel = supabase
      .channel('client_pricing_services_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services',
        },
        (payload) => {
          loadServices();
        }
      )
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(servicesChannel);
    };
  }, []);

  // Real-time subscription for promotions
  useEffect(() => {
    const promotionsChannel = supabase
      .channel('client_pricing_promotions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'promotions',
        },
        (payload) => {
          loadPromotions();
        }
      )
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(promotionsChannel);
    };
  }, []);

  useEffect(() => {
    if (highlightPromotionId && promotions.length > 0) {
      setTimeout(() => {
        const promotionRef = promotionRefs.current[highlightPromotionId];
        if (promotionRef && scrollViewRef.current) {
          promotionRef.measureLayout(
            scrollViewRef.current as any,
            (x, y) => {
              scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
              setHighlightedPromotionId(highlightPromotionId);
              setTimeout(() => setHighlightedPromotionId(null), 3000);
            },
            () => {}
          );
        }
      }, 300);
    }
  }, [highlightPromotionId, promotions]);

  useEffect(() => {
    if (highlightServiceId && services.length > 0) {
      setTimeout(() => {
        const serviceRef = serviceRefs.current[highlightServiceId];
        if (serviceRef && scrollViewRef.current) {
          serviceRef.measureLayout(
            scrollViewRef.current as any,
            (x, y) => {
              scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
              setHighlightedServiceId(highlightServiceId);
              setTimeout(() => setHighlightedServiceId(null), 3000);
            },
            () => {}
          );
        }
      }, 300);
    }
  }, [highlightServiceId, services]);

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('❌ Pricing: Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error('❌ Pricing: Error loading promotions:', error);
    }
  };

  const handleServiceSelect = (service: Service) => {
    router.push({
      pathname: '/(client)/booking',
      params: { selectedServiceId: service.id }
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.primary}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Ценоразпис</Text>
            <Text style={styles.headerSubtitle}>Нашите услуги</Text>
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
        <ScrollView ref={scrollViewRef} style={styles.content}>
          <View style={styles.infoBox}>
            <Calendar size={24} color={theme.colors.primary} />
            <Text style={styles.infoText}>Изберете услуга, за да видите повече информация. За резервация използвайте раздел "Заяви час"</Text>
          </View>

          {promotions.length > 0 && (
            <View style={styles.promotionsSection}>
              <Text style={styles.sectionTitle}>Промоции</Text>
              {promotions.map((promotion) => (
                <View
                  key={promotion.id}
                  ref={(ref) => (promotionRefs.current[promotion.id] = ref)}
                  style={[
                    styles.promotionCard,
                    highlightedPromotionId === promotion.id && styles.highlightedCard,
                  ]}
                >
                  {promotion.image_url && (
                    <Image
                      source={{ uri: promotion.image_url }}
                      style={styles.promotionImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.promotionContent}>
                    <View style={styles.promotionHeader}>
                      <Text style={styles.promotionName}>{promotion.name}</Text>
                      <View style={styles.promotionPriceTag}>
                        <DollarSign size={16} color={theme.colors.surface} />
                        <Text style={styles.promotionPrice}>{promotion.price} лв</Text>
                      </View>
                    </View>
                    {promotion.description && (
                      <Text style={styles.promotionDescription}>{promotion.description}</Text>
                    )}
                    <View style={styles.promotionFooter}>
                      <Clock size={16} color={theme.colors.textMuted} />
                      <Text style={styles.promotionDuration}>{promotion.duration_minutes} мин</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Услуги</Text>

          {services.length === 0 ? (
            <View style={styles.emptyState}>
              <DollarSign size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyStateText}>Все още няма добавени услуги</Text>
            </View>
          ) : (
            services.map((service) => (
              <View
                key={service.id}
                ref={(ref) => (serviceRefs.current[service.id] = ref)}
                style={[
                  styles.serviceCard,
                  highlightedServiceId === service.id && styles.highlightedCard,
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleServiceSelect(service)}
                  activeOpacity={0.8}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={theme.gradients.secondary}
                    style={styles.serviceGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {service.image_url && (
                      <Image
                        source={{ uri: service.image_url }}
                        style={styles.serviceImage}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.serviceContent}>
                      <View style={styles.serviceHeader}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        <View style={styles.priceTag}>
                          <Text style={styles.priceText}>{service.price.toFixed(2)} лв</Text>
                        </View>
                      </View>

                      {service.description && (
                        <Text style={styles.serviceDescription}>{service.description}</Text>
                      )}

                      <View style={styles.serviceMeta}>
                        <View style={styles.metaItem}>
                          <Clock size={16} color={theme.colors.surface} />
                          <Text style={styles.metaText}>{service.duration_minutes} минути</Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))
          )}

          <View style={styles.footerInfo}>
            <Text style={styles.footerTitle}>Как да запазя час?</Text>
            <Text style={styles.footerDirectText}>
              Отидете на заявка за час и натиснете "нова заявка за час"
            </Text>
            <Text style={styles.footerOrText}>ИЛИ</Text>
            <Text style={styles.footerDirectText}>
              Изберете услуга и създайте заявка за резервация
            </Text>
          </View>
        </ScrollView>
      )}

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
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingTop: theme.spacing.lg,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    lineHeight: 20,
  },
  promotionsSection: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  promotionCard: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  highlightedCard: {
    opacity: 0.7,
  },
  promotionImage: {
    width: '100%',
    height: 150,
  },
  promotionContent: {
    padding: theme.spacing.lg,
  },
  promotionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  promotionName: {
    flex: 1,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.surface,
    marginRight: theme.spacing.md,
  },
  promotionPriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  promotionPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  promotionDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.9,
    marginBottom: theme.spacing.sm,
    lineHeight: 20,
  },
  promotionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  promotionDuration: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyStateText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  serviceCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  serviceGradient: {
    padding: theme.spacing.lg,
  },
  serviceImage: {
    width: '100%',
    height: 150,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  serviceContent: {
    gap: theme.spacing.sm,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  serviceName: {
    flex: 1,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  priceTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.round,
  },
  priceText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  serviceDescription: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    opacity: 0.9,
    lineHeight: 20,
  },
  serviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.surface,
    fontWeight: '500',
    opacity: 0.9,
  },
  footerInfo: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  footerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  footerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textLight,
    lineHeight: 24,
  },
  footerOrText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
    marginVertical: theme.spacing.md,
  },
  footerDirectText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
});
