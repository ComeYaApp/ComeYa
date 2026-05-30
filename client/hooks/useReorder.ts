import { useCart } from "@/contexts/CartContext";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import * as Haptics from "expo-haptics";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function useReorder() {
  const { clearCart, addToCart } = useCart();
  const navigation = useNavigation<NavigationProp>();

  const reorder = async (order: {
    id: string;
    businessId: string;
    businessName: string;
    items: any[];
  }) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Limpiar carrito actual
      await clearCart();

      // Agregar todos los items del pedido anterior
      for (const item of order.items) {
        const product = item.product || {
          id: item.productId || item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          description: "",
          isAvailable: true,
          isWeightBased: false,
        };

        await addToCart(
          product,
          order.businessId,
          order.businessName,
          item.quantity,
          item.note,
        );
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navegar al carrito
      navigation.navigate("Cart");
    } catch (error) {
      console.error("Reorder error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return { reorder };
}
