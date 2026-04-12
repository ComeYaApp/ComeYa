import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { ComeYaColors, Spacing, BorderRadius } from "@/constants/theme";

const { width, height } = Dimensions.get("window");
const ONBOARDING_KEY = "@ComeYa_onboarding_completed";

interface OnboardingSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  gradient: readonly [string, string];
}

const slides: OnboardingSlide[] = [
  {
    id: 1,
    title: "ComeYa",
    subtitle: "Tu delivery en Soria",
    description:
      "Conecta con restaurantes y negocios locales de Soria. Pedidos frescos directo a tu puerta.",
    icon: "heart",
    gradient: [ComeYaColors.primary, "#E65100"],
  },
  {
    id: 2,
    title: "ComeYa",
    subtitle: "Apoyando el comercio local",
    description:
      "Cada pedido apoya a un negocio de Soria.\n\nConectamos la comunidad soriana con los sabores que amamos.",
    icon: "sun",
    gradient: ["#9C27B0", "#6A1B9A"],
  },
  {
    id: 3,
    title: "Cómo usar ComeYa",
    subtitle: "Es muy fácil",
    description:
      "1. Explora restaurantes y negocios\n2. Agrega productos al carrito\n3. Paga con tarjeta o Bizum\n4. Recibe en tu puerta",
    icon: "check-circle",
    gradient: ["#00897B", "#00695C"],
  },
];

interface OnboardingOverlayProps {
  onComplete: () => void;
}

function SlideContent({
  slide,
  isActive,
}: {
  slide: OnboardingSlide;
  isActive: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      scale.value = 0.9;
      opacity.value = 0;
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <LinearGradient
      colors={slide.gradient}
      style={[styles.slideContainer, { paddingTop: insets.top + Spacing.xl }]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        <View style={styles.iconContainer}>
          <Feather name={slide.icon} size={64} color="#FFFFFF" />
        </View>

        <ThemedText type="h1" style={[styles.title, { fontSize: 42 }]}>
          {slide.title}
        </ThemedText>

        <ThemedText
          type="h4"
          style={[styles.subtitle, { marginTop: -Spacing.xs }]}
        >
          {slide.subtitle}
        </ThemedText>

        <View style={styles.divider} />

        <ThemedText type="body" style={styles.description}>
          {slide.description}
        </ThemedText>
      </Animated.View>
    </LinearGradient>
  );
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const insets = useSafeAreaInsets();

  const handleNext = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      onComplete();
    }
  };

  const handleSkip = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
    >
      <Pressable style={styles.touchArea} onPress={handleNext}>
        <SlideContent slide={slides[currentSlide]} isActive={true} />
      </Pressable>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === currentSlide && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.buttons}>
          {!isLastSlide && (
            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <ThemedText type="body" style={styles.skipText}>
                Saltar
              </ThemedText>
            </Pressable>
          )}

          <Pressable onPress={handleNext} style={styles.nextButton}>
            <ThemedText type="body" style={styles.nextText}>
              {isLastSlide ? "Comenzar" : "Siguiente"}
            </ThemedText>
            <Feather
              name={isLastSlide ? "check" : "arrow-right"}
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <ThemedText type="small" style={styles.tapHint}>
          Toca para continuar
        </ThemedText>
      </View>
    </Animated.View>
  );
}

export async function checkOnboardingCompleted(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
    return completed === "true";
  } catch {
    return false;
  }
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  touchArea: {
    flex: 1,
  },
  slideContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  slideContent: {
    alignItems: "center",
    maxWidth: 340,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 2,
  },
  subtitle: {
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginTop: Spacing.sm,
    fontWeight: "500",
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
    borderRadius: 2,
    marginVertical: Spacing.xl,
  },
  description: {
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 16,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
    width: 24,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skipButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  nextText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  tapHint: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: Spacing.md,
  },
});
