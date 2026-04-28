import React from "react";
import { View } from "react-native";
import { useWebLayout } from "@/hooks/useWebLayout";

interface WebLayoutProps {
  children: React.ReactNode;
  backgroundColor?: string;
}

export function WebLayout({ children, backgroundColor }: WebLayoutProps) {
  const { isDesktop, containerStyle, contentStyle } = useWebLayout();

  if (!isDesktop) return <>{children}</>;

  return (
    <View style={[containerStyle, backgroundColor ? { backgroundColor } : null]}>
      <View style={contentStyle}>
        {children}
      </View>
    </View>
  );
}
