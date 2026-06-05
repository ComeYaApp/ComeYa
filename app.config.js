export default {
  expo: {
    name: "ComeYa",
    slug: "nemy-app",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./client/assets/nuevologoapp-padded.jpeg",
    scheme: "comeya",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.comeya.app",
      buildNumber: "1.0.1",
      config: {
        googleMapsApiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
          "AIzaSyCnO6adzc_17atX7OAH4FPL6ldwHRO_48g",
      },
      infoPlist: {
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
      versionCode: 2,
      config: {
        googleMaps: {
          apiKey:
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
            "AIzaSyDLejpcrNJNHzQIduWuot5QAoepitVk2zY",
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
    privacyPolicyUrl: "https://app.comeya.es/privacy-policy",
    extra: {
      eas: {
        projectId: "8c58541f-bf02-4e36-bcf9-a2e64b126a5b",
      },
      EXPO_PUBLIC_BACKEND_URL:
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        "https://comeya-backend.onrender.com",
    },
    owner: "caskiuzs-organization",
  },
};
