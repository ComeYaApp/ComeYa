import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StyleSheet } from "react-native";
import { Image } from "expo-image";

import HomeScreen from "@/screens/HomeScreen";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type HomeStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

// Motero line-art de marca, centrado como en el mockup del home
function HeaderTitle() {
  return (
    <Image
      source={require("../../assets/images/comeya-moto-red.png")}
      style={styles.headerMoto}
      contentFit="contain"
    />
  );
}

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle />,
          headerTitleAlign: "center",
          headerRight: () => <ThemeToggleButton />,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerMoto: {
    width: 52,
    height: 40,
  },
});
