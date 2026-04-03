import { Share, Linking, Platform } from 'react-native';

export class SocialIntegrationService {
  // Compartir pedido en WhatsApp
  static async shareOrderWhatsApp(data: {
    orderId: string;
    businessName: string;
    total: number;
    items: any[];
  }) {
    const { orderId, businessName, total, items } = data;
    
    const itemsList = items.map((item) => `• ${item.quantity}x ${item.product?.name || item.name}`).join('\n');
    
    const message = `🍔 ¡Acabo de pedir en ${businessName}!\n\n${itemsList}\n\nTotal: Bs.${total.toFixed(2)}\n\n📱 Descarga ComeYa y pide tú también:\nComeYa://download`;

    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return { success: true };
      } else {
        // Fallback a web WhatsApp
        const webUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
        return { success: true };
      }
    } catch (error) {
      console.error('WhatsApp share error:', error);
      return { success: false, error: 'No se pudo abrir WhatsApp' };
    }
  }

  // Compartir negocio
  static async shareBusiness(data: {
    businessId: string;
    businessName: string;
    rating: number;
    image?: string;
  }) {
    const { businessId, businessName, rating } = data;

    const message = `🍽️ ¡Descubre ${businessName}!\n\n⭐ ${rating.toFixed(1)} estrellas\n\n📱 Pide ahora en ComeYa:\nComeYa://business/${businessId}`;

    try {
      await Share.share({
        message,
        title: `Descubre ${businessName} en ComeYa`,
      });
      return { success: true };
    } catch (error) {
      console.error('Share business error:', error);
      return { success: false, error: 'Error al compartir' };
    }
  }

  // Compartir código de referido
  static async shareReferralCode(referralCode: string, userName: string) {
    const message = `🎁 ${userName} te invita a ComeYa!\n\nUsa mi código: ${referralCode}\n\n✨ Obtén Bs.10 de descuento en tu primer pedido\n\n📱 Descarga la app:\nComeYa://referral/${referralCode}`;

    try {
      await Share.share({
        message,
        title: 'Únete a ComeYa',
      });
      return { success: true };
    } catch (error) {
      console.error('Share referral error:', error);
      return { success: false, error: 'Error al compartir' };
    }
  }

  // Compartir en Instagram Stories (solo imagen)
  static async shareToInstagramStory(imageUri: string) {
    const instagramUrl = `instagram://story-camera`;

    try {
      const canOpen = await Linking.canOpenURL(instagramUrl);
      if (canOpen) {
        // Instagram Stories requiere implementación nativa más compleja
        // Por ahora, abrimos Instagram
        await Linking.openURL('instagram://');
        return { success: true, message: 'Abre Instagram y comparte manualmente' };
      } else {
        return { success: false, error: 'Instagram no instalado' };
      }
    } catch (error) {
      console.error('Instagram share error:', error);
      return { success: false, error: 'Error al abrir Instagram' };
    }
  }

  // Compartir en Facebook
  static async shareToFacebook(url: string, quote: string) {
    const fbUrl = `fb://facewebmodal/f?href=${encodeURIComponent(url)}&quote=${encodeURIComponent(quote)}`;

    try {
      const canOpen = await Linking.canOpenURL(fbUrl);
      if (canOpen) {
        await Linking.openURL(fbUrl);
        return { success: true };
      } else {
        // Fallback a web Facebook
        const webUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(quote)}`;
        await Linking.openURL(webUrl);
        return { success: true };
      }
    } catch (error) {
      console.error('Facebook share error:', error);
      return { success: false, error: 'Error al compartir en Facebook' };
    }
  }

  // Compartir logro/achievement
  static async shareAchievement(data: {
    achievementName: string;
    achievementDescription: string;
    userName: string;
  }) {
    const { achievementName, achievementDescription, userName } = data;

    const message = `🏆 ¡${userName} desbloqueó un logro!\n\n${achievementName}\n${achievementDescription}\n\n📱 Únete a ComeYa y desbloquea logros tú también!`;

    try {
      await Share.share({
        message,
        title: 'Logro desbloqueado en ComeYa',
      });
      return { success: true };
    } catch (error) {
      console.error('Share achievement error:', error);
      return { success: false, error: 'Error al compartir' };
    }
  }

  // Compartir posición en leaderboard
  static async shareLeaderboardPosition(data: {
    position: number;
    points: number;
    userName: string;
  }) {
    const { position, points, userName } = data;

    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';

    const message = `${medal} ¡${userName} está en el puesto #${position}!\n\n⭐ ${points} puntos\n\n📱 Compite tú también en ComeYa!`;

    try {
      await Share.share({
        message,
        title: 'Ranking en ComeYa',
      });
      return { success: true };
    } catch (error) {
      console.error('Share leaderboard error:', error);
      return { success: false, error: 'Error al compartir' };
    }
  }

  // Abrir perfil de Instagram del negocio
  static async openBusinessInstagram(instagramHandle: string) {
    const instagramUrl = `instagram://user?username=${instagramHandle}`;
    const webUrl = `https://instagram.com/${instagramHandle}`;

    try {
      const canOpen = await Linking.canOpenURL(instagramUrl);
      if (canOpen) {
        await Linking.openURL(instagramUrl);
      } else {
        await Linking.openURL(webUrl);
      }
      return { success: true };
    } catch (error) {
      console.error('Open Instagram error:', error);
      return { success: false, error: 'Error al abrir Instagram' };
    }
  }

  // Abrir página de Facebook del negocio
  static async openBusinessFacebook(facebookId: string) {
    const fbUrl = `fb://page/${facebookId}`;
    const webUrl = `https://facebook.com/${facebookId}`;

    try {
      const canOpen = await Linking.canOpenURL(fbUrl);
      if (canOpen) {
        await Linking.openURL(fbUrl);
      } else {
        await Linking.openURL(webUrl);
      }
      return { success: true };
    } catch (error) {
      console.error('Open Facebook error:', error);
      return { success: false, error: 'Error al abrir Facebook' };
    }
  }
}
