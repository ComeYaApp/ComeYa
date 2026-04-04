import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image, TextInput, Modal } from 'react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';

interface GroupOrder {
  id: string;
  name: string;
  restaurant: string;
  organizer: string;
  participants: number;
  maxParticipants: number;
  deadline: string;
  total: number;
  status: 'open' | 'closed' | 'ordered';
}

interface SocialReview {
  id: string;
  user: string;
  restaurant: string;
  rating: number;
  comment: string;
  images: string[];
  likes: number;
  date: string;
  isLiked: boolean;
}

export default function SocialFeaturesScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'groups' | 'reviews' | 'community'>('groups');
  const [groupOrders, setGroupOrders] = useState<GroupOrder[]>([]);
  const [socialReviews, setSocialReviews] = useState<SocialReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  useEffect(() => {
    loadSocialData();
  }, []);

  const loadSocialData = async () => {
    try {
      const mockGroups: GroupOrder[] = [
        {
          id: '1',
          name: 'Almuerzo Oficina',
          restaurant: 'Tacos El Güero',
          organizer: 'María González',
          participants: 4,
          maxParticipants: 8,
          deadline: '2024-01-15T13:00:00Z',
          total: 32000,
          status: 'open',
        },
        {
          id: '2',
          name: 'Pizza Viernes',
          restaurant: 'Pizza Napoli',
          organizer: 'Carlos Ruiz',
          participants: 6,
          maxParticipants: 10,
          deadline: '2024-01-12T19:30:00Z',
          total: 54000,
          status: 'closed',
        },
      ];

      const mockReviews: SocialReview[] = [
        {
          id: '1',
          user: 'Ana López',
          restaurant: 'Sushi Zen',
          rating: 5,
          comment: '¡Increíble! El mejor sushi de la ciudad 🍣',
          images: ['https://via.placeholder.com/200x150'],
          likes: 24,
          date: '2024-01-10',
          isLiked: false,
        },
        {
          id: '2',
          user: 'Pedro Martínez',
          restaurant: 'Burger House',
          rating: 4,
          comment: 'Muy buenas hamburguesas, recomendado 👍',
          images: [],
          likes: 12,
          date: '2024-01-09',
          isLiked: true,
        },
      ];

      setGroupOrders(mockGroups);
      setSocialReviews(mockReviews);
    } catch (error) {
      console.error('Error loading social data:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinGroupOrder = async (groupId: string) => {
    Alert.alert(
      'Unirse al Grupo',
      '¿Quieres unirte a este pedido grupal?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Unirse',
          onPress: () => {
            Alert.alert('¡Éxito!', 'Te has unido al pedido grupal');
            loadSocialData();
          },
        },
      ]
    );
  };

  const likeReview = async (reviewId: string) => {
    setSocialReviews(prev => prev.map(review => 
      review.id === reviewId 
        ? { 
            ...review, 
            isLiked: !review.isLiked,
            likes: review.isLiked ? review.likes - 1 : review.likes + 1
          }
        : review
    ));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount / 100);
  };

  const renderGroups = () => (
    <ScrollView>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Pedidos Grupales</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateGroup(true)}
        >
          <Text style={styles.createButtonText}>+ Crear</Text>
        </TouchableOpacity>
      </View>

      {groupOrders.map((group) => (
        <View key={group.id} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupName}>{group.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: group.status === 'open' ? 'green' : 'orange' }]}>
              <Text style={styles.statusText}>
                {group.status === 'open' ? 'Abierto' : 'Cerrado'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.groupRestaurant}>📍 {group.restaurant}</Text>
          <Text style={styles.groupOrganizer}>👤 Organizado por {group.organizer}</Text>
          
          <View style={styles.groupStats}>
            <Text style={styles.groupParticipants}>
              👥 {group.participants}/{group.maxParticipants} personas
            </Text>
            <Text style={styles.groupTotal}>{formatCurrency(group.total)}</Text>
          </View>
          
          <Text style={styles.groupDeadline}>
            ⏰ Cierra: {new Date(group.deadline).toLocaleString('es-VE')}
          </Text>
          
          {group.status === 'open' && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => joinGroupOrder(group.id)}
            >
              <Text style={styles.joinButtonText}>Unirse al Grupo</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>¿Cómo funcionan?</Text>
        <View style={styles.howItWorks}>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Crea o únete a un grupo</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>Todos eligen sus productos</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>Se divide el costo de envío</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderReviews = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Reseñas de la Comunidad</Text>
      
      {socialReviews.map((review) => (
        <View key={review.id} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewUser}>
              <Text style={styles.reviewUserName}>{review.user}</Text>
              <Text style={styles.reviewRestaurant}>en {review.restaurant}</Text>
            </View>
            <Text style={styles.reviewDate}>{review.date}</Text>
          </View>
          
          <View style={styles.reviewRating}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text key={star} style={styles.star}>
                {star <= review.rating ? '⭐' : '☆'}
              </Text>
            ))}
          </View>
          
          <Text style={styles.reviewComment}>{review.comment}</Text>
          
          {review.images.length > 0 && (
            <ScrollView horizontal style={styles.reviewImages}>
              {review.images.map((image, index) => (
                <Image key={index} source={{ uri: image }} style={styles.reviewImage} />
              ))}
            </ScrollView>
          )}
          
          <View style={styles.reviewActions}>
            <TouchableOpacity
              style={styles.likeButton}
              onPress={() => likeReview(review.id)}
            >
              <Text style={[styles.likeIcon, { color: review.isLiked ? 'red' : Colors.light.tabIconDefault }]}>
                {review.isLiked ? '❤️' : '🤍'}
              </Text>
              <Text style={styles.likeCount}>{review.likes}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.shareButton}>
              <Text style={styles.shareIcon}>📤</Text>
              <Text style={styles.shareText}>Compartir</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderCommunity = () => (
    <ScrollView>
      <Text style={styles.sectionTitle}>Comunidad Foodie</Text>
      
      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Challenges Activos</Text>
        
        <View style={styles.challengeCard}>
          <Text style={styles.challengeIcon}>🏆</Text>
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeTitle}>Explorador de Sabores</Text>
            <Text style={styles.challengeDescription}>
              Prueba 5 restaurantes diferentes esta semana
            </Text>
            <Text style={styles.challengeProgress}>Progreso: 2/5</Text>
          </View>
        </View>
        
        <View style={styles.challengeCard}>
          <Text style={styles.challengeIcon}>📸</Text>
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeTitle}>Fotógrafo Culinario</Text>
            <Text style={styles.challengeDescription}>
              Comparte 10 fotos de tus pedidos
            </Text>
            <Text style={styles.challengeProgress}>Progreso: 7/10</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Leaderboard Semanal</Text>
        
        <View style={styles.leaderboard}>
          <View style={styles.leaderItem}>
            <Text style={styles.leaderRank}>🥇</Text>
            <Text style={styles.leaderName}>María González</Text>
            <Text style={styles.leaderPoints}>2,450 pts</Text>
          </View>
          
          <View style={styles.leaderItem}>
            <Text style={styles.leaderRank}>🥈</Text>
            <Text style={styles.leaderName}>Carlos Ruiz</Text>
            <Text style={styles.leaderPoints}>2,180 pts</Text>
          </View>
          
          <View style={styles.leaderItem}>
            <Text style={styles.leaderRank}>🥉</Text>
            <Text style={styles.leaderName}>Ana López</Text>
            <Text style={styles.leaderPoints}>1,950 pts</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.subsectionTitle}>Grupos de Interés</Text>
        
        <TouchableOpacity style={styles.interestGroup}>
          <Text style={styles.interestIcon}>🌮</Text>
          <View style={styles.interestInfo}>
            <Text style={styles.interestTitle}>Amantes de la Comida Mexicana</Text>
            <Text style={styles.interestMembers}>1,234 miembros</Text>
          </View>
          <Text style={styles.joinText}>Unirse</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.interestGroup}>
          <Text style={styles.interestIcon}>🍕</Text>
          <View style={styles.interestInfo}>
            <Text style={styles.interestTitle}>Pizza Lovers Soria</Text>
            <Text style={styles.interestMembers}>856 miembros</Text>
          </View>
          <Text style={styles.joinText}>Unirse</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.interestGroup}>
          <Text style={styles.interestIcon}>🥗</Text>
          <View style={styles.interestInfo}>
            <Text style={styles.interestTitle}>Comida Saludable</Text>
            <Text style={styles.interestMembers}>642 miembros</Text>
          </View>
          <Text style={styles.joinText}>Unirse</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Cargando comunidad...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comunidad ComeYa</Text>
      
      <View style={styles.tabContainer}>
        {[
          { key: 'groups', label: 'Grupos' },
          { key: 'reviews', label: 'Reseñas' },
          { key: 'community', label: 'Comunidad' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabContent}>
        {activeTab === 'groups' && renderGroups()}
        {activeTab === 'reviews' && renderReviews()}
        {activeTab === 'community' && renderCommunity()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    textAlign: 'center',
    paddingVertical: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: Colors.light.tint,
  },
  tabText: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    fontWeight: '500',
  },
  activeTabText: {
    color: 'white',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  createButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  groupRestaurant: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 4,
  },
  groupOrganizer: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 8,
  },
  groupStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupParticipants: {
    fontSize: 14,
    color: Colors.light.text,
  },
  groupTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.tint,
  },
  groupDeadline: {
    fontSize: 12,
    color: 'orange',
    marginBottom: 12,
  },
  joinButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  joinButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  howItWorks: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.tint,
    color: 'white',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 12,
  },
  stepText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  reviewCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewUser: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  reviewRestaurant: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  reviewRating: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  star: {
    fontSize: 16,
    marginRight: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 12,
  },
  reviewImages: {
    marginBottom: 12,
  },
  reviewImage: {
    width: 100,
    height: 75,
    borderRadius: 8,
    marginRight: 8,
  },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  likeCount: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  shareText: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    marginBottom: 12,
  },
  challengeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  challengeDescription: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
    marginBottom: 4,
  },
  challengeProgress: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  leaderboard: {
    gap: 8,
  },
  leaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
  },
  leaderRank: {
    fontSize: 20,
    marginRight: 12,
  },
  leaderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  leaderPoints: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  interestGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  interestIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  interestInfo: {
    flex: 1,
  },
  interestTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  interestMembers: {
    fontSize: 12,
    color: Colors.light.tabIconDefault,
  },
  joinText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 18,
    color: Colors.light.text,
    textAlign: 'center',
    marginTop: 50,
  },
});