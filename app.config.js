export default {
  expo: {
    name: "ComeYa",
    slug: "comeya",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./client/assets/nuevologoapp-padded.jpeg",
    scheme: "comeya",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.comeya.app",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyCnO6adzc_17atX7OAH4FPL6ldwHRO_48g"
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicacion para asignarte pedidos y mostrar tu posicion en tiempo real."
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#FE1519",
        foregroundImage: "./client/assets/nuevologoapp-padded.jpeg"
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
      favicon: "./public/icon.png",
      bundler: "metro"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./client/assets/splash.png",
          imageWidth: 500,
          resizeMode: "contain",
          backgroundColor: "#FE1519",
          dark: {
            backgroundColor: "#FE1519",
            image: "./client/assets/splash.png"
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
