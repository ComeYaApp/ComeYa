export default {
  expo: {
    name: "ComeYa",
    slug: "cy-soria",
    version: "1.0.6",
    orientation: "portrait",
    icon: "./client/assets/nuevologoapp-padded.jpeg",
    scheme: "comeya",
    userInterfaceStyle: "automatic",
    // New Architecture requerido por react-native-reanimated@4.1.1
    // expo-av@16.0.8 ya es compatible con New Architecture en SDK 54
    // Android build es --local, usa gradle.properties independientemente
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.comeya.app",
      buildNumber: "7",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription:
          "Necesitamos tu ubicacion para asignarte pedidos y mostrar tu posicion en tiempo real.",
        NSCameraUsageDescription: "Permite tomar fotos para tu perfil y productos",
        NSPhotoLibraryUsageDescription: "Permite seleccionar imágenes para tu perfil",
        CFBundleAllowMixedLocalizations: true,
        UIBackgroundModes: ["location", "fetch"]
      },
      icon: "./client/assets/nuevologoapp-padded.jpeg",
      splash: {
        image: "./client/assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
      },
      associatedDomains: ["applinks:comeya.es"]
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#DC2626",
        foregroundImage: "./client/assets/nuevologoapp-padded.jpeg",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.comeya.app",
      versionCode: 7,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
      permissions: [
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.INTERNET",
        "android.permission.POST_NOTIFICATIONS",
      ],
    },
    web: {
      output: "single",
      favicon: "./public/icon.png",
      bundler: "metro",
    },
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            excludedPods: ["stripe-react-native"],
          },
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./client/assets/splash.png",
          imageWidth: 500,
          resizeMode: "contain",
          backgroundColor: "#DC2626",
          dark: {
            backgroundColor: "#DC2626",
            image: "./client/assets/splash.png",
          },
        },
      ],
      "expo-web-browser",
      "expo-secure-store",
      "expo-location",
    ],
    experiments: {
      reactCompiler: true,
    },
    privacyPolicyUrl: "https://comeya-backend.onrender.com/privacy-policy",
    extra: {
      eas: {
        projectId: "9c6cb8bb-967c-4f24-807f-6e8c81b5e61b",
      },
      EXPO_PUBLIC_BACKEND_URL:
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        "https://comeya-backend.onrender.com",
    },
    owner: "cazkiuzs-team",
  },
};