export default {
  expo: {
    name: "ComeYa",
    slug: "cy-soria",
    version: "1.0.15",
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
      // Versionado local: App Store Connect ya tiene el build 10; cada
      // build nuevo debe incrementar este número a mano (11, 12, 13…)
      buildNumber: "11",
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
      versionCode: 15,
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
      "expo-build-properties",
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
      [
        "expo-notifications",
        {
          color: "#DC2626",
        },
      ],
      // Sentry: sube sourcemaps y símbolos nativos (dSYM) en cada build para
      // que los crashes nativos lleguen simbolizados. Requiere SENTRY_ORG,
      // SENTRY_PROJECT y SENTRY_AUTH_TOKEN en el entorno de EAS.
      ...(process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
        ? [
            [
              "@sentry/react-native/expo",
              {
                organization: process.env.SENTRY_ORG,
                project: process.env.SENTRY_PROJECT,
              },
            ],
          ]
        : []),
    ],
    experiments: {
      reactCompiler: true,
    },
    privacyPolicyUrl: "https://comeya-backend.onrender.com/privacy-policy",
    extra: {
      // projectId omitido a propósito: lo escribe `eas init` al vincular el
      // proyecto de la ORGANIZACIÓN (el viejo pertenece a la cuenta personal
      // y no puede validarse con la sesión de la organización)
      EXPO_PUBLIC_BACKEND_URL:
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        "https://comeya-backend.onrender.com",
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    },
  },
};