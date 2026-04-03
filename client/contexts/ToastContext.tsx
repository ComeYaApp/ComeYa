import React, { createContext, useContext, useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, ComeYaColors } from "@/constants/theme";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastType): keyof typeof Feather.glyphMap => {
    switch (type) {
      case "success":
        return "check-circle";
      case "error":
        return "x-circle";
      case "warning":
        return "alert-triangle";
      default:
        return "info";
    }
  };

  const getColor = (type: ToastType): string => {
    switch (type) {
      case "success":
        return "#4CAF50";
      case "error":
        return ComeYaColors.error;
      case "warning":
        return "#FF9800";
      default:
        return ComeYaColors.primary;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View
        style={[styles.container, { top: insets.top + Spacing.md }]}
        style={{ pointerEvents: "box-none" }}
      >
        {toasts.map((toast) => (
          <Pressable
            key={toast.id}
            onPress={() => removeToast(toast.id)}
            style={[styles.toast, { borderLeftColor: getColor(toast.type) }]}
          >
            <Feather
              name={getIcon(toast.type)}
              size={20}
              color={getColor(toast.type)}
            />
            <ThemedText type="body" style={styles.message} numberOfLines={2}>
              {toast.message}
            </ThemedText>
            <Feather name="x" size={16} color="#888" />
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    gap: Spacing.sm,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 4,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
    elevation: 4,
    gap: Spacing.sm,
  },
  message: {
    flex: 1,
    color: "#333",
  },
});
