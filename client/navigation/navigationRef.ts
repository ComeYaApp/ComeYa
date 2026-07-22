import { createNavigationContainerRef } from "@react-navigation/native";
import { RootStackParamList } from "./RootStackNavigator";

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function resetToMain() {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: "Main" }],
    });
  }
}