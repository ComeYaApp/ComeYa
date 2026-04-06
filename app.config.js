export default {
  expo: {
    name: "ComeYa",
    slug: "comeya",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "comeya",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.comeya.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicacion para asignarte pedidos y mostrar tu posicion en tiempo real."
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#FFFFFF",
        foregroundImage: "./assets/images/android-icon-foreground.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.comeya.app",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDLejpcrNJNHzQIduWuot5QAoepitVk2zY"
        }
      }
    },
    web: {
      output: "single",
      favicon: "./assets/images/icon.png"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#FFFFFF",
          dark: {
            backgroundColor: "#121212",
            image: "./assets/images/splash-icon.png"
          }
        }
      ],
      "expo-web-browser",
      "expo-secure-store",
      "expo-location"
    ],
    experiments: {
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: "8c58541f-bf02-4e36-bcf9-a2e64b126a5b"
      },
      EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || "https://comeya-backend.onrender.com"
    },
    owner: "caskiuzs-organization"
  }
};
