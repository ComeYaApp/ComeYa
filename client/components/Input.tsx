import React from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  leftIcon?: string;
}

export function Input({
  label,
  error,
  containerStyle,
  style,
  leftIcon,
  ...props
}: InputProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrapper}>
        {leftIcon && (
          <View style={styles.iconContainer}>
            <Feather
              name={leftIcon as any}
              size={18}
              color={theme.colors.text.secondary}
            />
          </View>
        )}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithIcon,
            error && styles.inputError,
            style,
          ]}
          placeholderTextColor={theme.colors.text.disabled}
          {...props}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  iconContainer: {
    width: 44,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  input: {
    ...theme.typography.body,
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    minHeight: 48,
  },
  inputWithIcon: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
});
