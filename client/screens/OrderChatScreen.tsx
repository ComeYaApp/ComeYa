import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  Spacing,
  BorderRadius,
  ComeYaColors,
  Shadows,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type OrderChatRouteProp = RouteProp<RootStackParamList, "OrderChat">;
type OrderChatNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "OrderChat"
>;

interface ChatMessage {
  id: string;
  orderId: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  const { theme } = useTheme();
  const time = new Date(message.createdAt).toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Animated.View
      entering={FadeInUp.springify()}
      style={[
        styles.messageBubble,
        isOwn ? styles.ownMessage : styles.otherMessage,
        {
          backgroundColor: isOwn ? ComeYaColors.primary : theme.card,
          ...Shadows.sm,
        },
      ]}
    >
      <ThemedText type="body" style={{ color: isOwn ? "#FFFFFF" : theme.text }}>
        {message.message}
      </ThemedText>
      <View style={styles.messageFooter}>
        <ThemedText
          type="small"
          style={{
            color: isOwn ? "rgba(255,255,255,0.7)" : theme.textSecondary,
          }}
        >
          {time}
        </ThemedText>
        {isOwn && message.isRead ? (
          <Feather
            name="check-circle"
            size={12}
            color="rgba(255,255,255,0.7)"
            style={{ marginLeft: 4 }}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

function EmptyState() {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyState}>
      <Feather name="message-circle" size={48} color={theme.textSecondary} />
      <ThemedText
        type="body"
        style={{
          color: theme.textSecondary,
          marginTop: Spacing.md,
          textAlign: "center",
        }}
      >
        Inicia una conversación
      </ThemedText>
      <ThemedText
        type="caption"
        style={{
          color: theme.textSecondary,
          textAlign: "center",
          marginTop: Spacing.xs,
        }}
      >
        Envía un mensaje para comunicarte
      </ThemedText>
    </View>
  );
}

export default function OrderChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigation = useNavigation<OrderChatNavigationProp>();
  const route = useRoute<OrderChatRouteProp>();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  const { orderId, receiverId, receiverName } = route.params || {};
  const [messageText, setMessageText] = useState("");
  const [orderMeta, setOrderMeta] = useState<any | null>(null);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: receiverName || "Chat",
    });
  }, [navigation, receiverName]);

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/orders", orderId, "chat"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/orders/${orderId}/chat`);
      const data = await response.json();
      return data || [];
    },
    refetchInterval: 3000,
    enabled: !!orderId,
  });

  useEffect(() => {
    const fetchOrderMeta = async () => {
      if (!orderId) return;
      try {
        const res = await apiRequest("GET", `/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrderMeta(data?.order || data);
        }
      } catch (err) {
        console.error("No se pudo cargar detalle del pedido para chat", err);
      }
    };
    fetchOrderMeta();
  }, [orderId]);

  const resolvedReceiverId = useMemo(() => {
    if (receiverId) return receiverId;
    if (!orderMeta || !user) return undefined;

    // Lógica mejorada para resolver el destinatario
    if (user.role === "delivery_driver") {
      // Repartidor envía al cliente
      return orderMeta.userId || orderMeta.customerId;
    }

    if (user.role === "customer") {
      // Cliente puede enviar al repartidor o al negocio
      if (orderMeta.deliveryPersonId) {
        return orderMeta.deliveryPersonId; // Preferencia: repartidor
      }
      return orderMeta.businessId; // Fallback: negocio
    }

    if (user.role === "business_owner") {
      // Negocio envía al cliente
      return orderMeta.userId || orderMeta.customerId;
    }

    return undefined;
  }, [receiverId, orderMeta, user]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", `/api/orders/${orderId}/chat`, {
        senderId: user?.id,
        receiverId: resolvedReceiverId,
        message,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || "No se pudo enviar el mensaje");
      }
      return response.json();
    },
    onMutate: async (message: string) => {
      if (!user?.id) return;
      const optimisticMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        orderId,
        senderId: user.id,
        receiverId: resolvedReceiverId || "",
        message,
        createdAt: new Date().toISOString(),
        isRead: false,
      };

      await queryClient.cancelQueries({
        queryKey: ["/api/orders", orderId, "chat"],
      });
      const previous =
        queryClient.getQueryData<ChatMessage[]>([
          "/api/orders",
          orderId,
          "chat",
        ]) || [];
      queryClient.setQueryData<ChatMessage[]>(
        ["/api/orders", orderId, "chat"],
        [...previous, optimisticMessage],
      );
      setMessageText("");
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["/api/orders", orderId, "chat"],
          context.previous,
        );
      }
      showToast(
        (error as Error)?.message || "No se pudo enviar el mensaje",
        "error",
      );
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/orders", orderId, "chat"],
      });
    },
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    if (!resolvedReceiverId) {
      showToast("No se pudo determinar el destinatario", "error");
      return;
    }
    sendMessageMutation.mutate(messageText.trim());
  };

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const showReceiverHint = !resolvedReceiverId;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        {showReceiverHint ? (
          <View
            style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm }}
          >
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Cargando destinatario del chat... abre desde el pedido con
              repartidor asignado.
            </ThemedText>
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={sortedMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} isOwn={item.senderId === user?.id} />
          )}
          inverted={messages.length > 0}
          ListEmptyComponent={EmptyState}
          contentContainerStyle={[
            styles.messagesList,
            { paddingTop: Spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.inputContainer,
            { paddingBottom: insets.bottom + Spacing.sm },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: theme.card },
              Shadows.sm,
            ]}
          >
            {showReceiverHint ? (
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
              >
                No encontramos destinatario aún. Abre el chat desde un pedido
                con repartidor asignado.
              </ThemedText>
            ) : null}
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={theme.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleSend}
              disabled={
                !messageText.trim() ||
                sendMessageMutation.isPending ||
                !resolvedReceiverId
              }
              style={[
                styles.sendButton,
                {
                  backgroundColor: messageText.trim()
                    ? ComeYaColors.primary
                    : theme.backgroundSecondary,
                  opacity: sendMessageMutation.isPending ? 0.6 : 1,
                },
              ]}
            >
              <Feather
                name="send"
                size={20}
                color={messageText.trim() ? "#FFFFFF" : theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  ownMessage: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.lg,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.xs,
  },
});
