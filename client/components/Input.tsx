import React from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
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
            <Text style={styles.iconText}>{leftIcon}</Text>
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
  },
  iconContainer: {
    width: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: theme.colors.border,
  },
  iconText: {
    fontSize: 16,
  },
  input: {
    ...theme.typography.body,
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
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
