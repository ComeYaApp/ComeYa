import React from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

interface BackButtonProps {
  color?: string;
  size?: number;
  onPress?: () => void;
}

export function BackButton({
  color = "#fff",
  size = 24,
  onPress,
}: BackButtonProps) {
  const navigation = useNavigation();

  // Only show on web
  if (Platform.OS !== "web") {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <Pressable style={styles.button} onPress={handlePress}>
      <Feather name="arrow-left" size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    marginRight: 12,
  },
});
