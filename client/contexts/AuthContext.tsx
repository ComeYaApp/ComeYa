import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "@/lib/query-client";
import { User, UserRole } from "@/types";

interface AuthContextType {
  user: User | null;
  token: string | null; // Add explicit token field
  isLoading: boolean;
  isAuthenticated: boolean;
  pendingVerificationPhone: string | null;
  biometricAvailable: boolean;
  biometricType: string | null;
  requestPhoneLogin: (
    phone: string,
  ) => Promise<{ userNotFound?: boolean; requiresVerification?: boolean }>;
  loginWithPassword: (
    identifier: string,
    password: string,
  ) => Promise<{ success?: boolean; requiresVerification?: boolean }>;
  signup: (
    name: string,
    role: UserRole,
    phone: string,
    email?: string,
    password?: string,
  ) => Promise<{ requiresVerification: boolean; userId?: string }>;
  verifyPhone: (phone: string, code: string) => Promise<User>;
  resendVerification: (phone: string) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "@ComeYa_user";
const PENDING_PHONE_KEY = "@ComeYa_pending_phone";
const BIOMETRIC_PHONE_KEY = "@ComeYa_biometric_phone";

const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  // Ya tiene prefijo +
  if (phone.startsWith("+")) return phone.replace(/[\s-()]/g, "");
  // Código de España sin +
  if (digits.startsWith("34")) return `+${digits}`;
  // Número español de 9 dígitos (móvil: 6xx/7xx, fijo: 9xx)
  if (digits.length === 9 && (digits.startsWith("6") || digits.startsWith("7") || digits.startsWith("9"))) {
    return `+34${digits}`;
  }
  // Fallback: añadir +34
  return `+34${digits}`;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null); // Add token state
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerificationPhone, setPendingVerificationPhone] = useState<
    string | null
  >(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      if (compatible && enrolled) {
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (
          types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          setBiometricType("fingerprint");
        } else if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          setBiometricType("face");
        } else if (
          types.includes(LocalAuthentication.AuthenticationType.IRIS)
        ) {
          setBiometricType("iris");
        }
      }
    } catch (error) {
      console.log("Biometric check error:", error);
      setBiometricAvailable(false);
    }
  };

  const registerPushToken = async () => {
    if (Platform.OS === "web") return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      const { data: token } = await Notifications.getExpoPushTokenAsync();
      await apiRequest("PUT", "/api/users/push-token", { token });
    } catch {
      // silent — no bloquear login si falla
    }
  };

  const loadUser = async () => {
    try {
      // Load user data
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
        setToken(userData.token || null); // Set token from user data

        // Ensure token is also stored separately for easy access
        if (userData.token) {
          await AsyncStorage.setItem("token", userData.token);
        }
      }

      // Load pending verification phone
      const pendingPhone = await AsyncStorage.getItem(PENDING_PHONE_KEY);
      if (pendingPhone) {
        setPendingVerificationPhone(pendingPhone);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPhoneLogin = async (
    phone: string,
  ): Promise<{ userNotFound?: boolean; requiresVerification?: boolean }> => {
    const normalizedPhone = normalizePhone(phone);

    const response = await apiRequest("POST", "/api/auth/send-code", {
      phone: normalizedPhone,
    });
    const data = await response.json();

    if (data.userNotFound) {
      return { userNotFound: true };
    }

    await AsyncStorage.setItem(PENDING_PHONE_KEY, normalizedPhone);
    setPendingVerificationPhone(normalizedPhone);
    return { requiresVerification: true };
  };

  const loginWithPassword = async (
    identifier: string,
    password: string,
  ): Promise<{ success: boolean; requiresVerification?: boolean }> => {
    // Email → dev password login; Phone → trigger OTP flow first (no code validation here)
    const isEmail = identifier.includes("@");

    if (isEmail) {
      const response = await apiRequest("POST", "/api/auth/dev-email-login", {
        email: identifier,
        password,
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Credenciales incorrectas");
      }

      const newUser: User = {
        id: data.user.id,
        email: data.user.email || undefined,
        name: data.user.name,
        phone: data.user.phone,
        role: data.user.role,
        phoneVerified: data.user.phoneVerified,
        isActive: data.user.isActive,
        profileImage: data.user.profileImage || undefined,
        stripeCustomerId: data.user.stripeCustomerId,
        token: data.token,
        createdAt: new Date().toISOString(),
        preferences: {
          theme: "system",
          accentColor: "#00C853",
        },
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      await AsyncStorage.setItem("token", data.token);
      setUser(newUser);
      setToken(data.token);
      registerPushToken();
      return { success: true };
    }

    // Phone path: send OTP and force verification screen instead of validating code here
    await requestPhoneLogin(identifier);
    return { success: false, requiresVerification: true };
  };

  const signup = async (
    name: string,
    role: UserRole,
    phone: string,
    email?: string,
    password?: string,
  ): Promise<{ requiresVerification: boolean; userId?: string }> => {
    // Guardar datos temporalmente para crear usuario después de verificar
    await AsyncStorage.setItem(
      "@ComeYa_pending_signup",
      JSON.stringify({
        name,
        role,
        phone,
        email,
        password,
      }),
    );

    const response = await apiRequest("POST", "/api/auth/phone-signup", {
      name,
      role,
      phone,
      email,
      password,
    });
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Error al crear la cuenta");
    }

    if (data.requiresVerification) {
      await AsyncStorage.setItem(PENDING_PHONE_KEY, phone);
      setPendingVerificationPhone(phone);
      return { requiresVerification: true, userId: data.userId };
    }

    return { requiresVerification: false };
  };

  const verifyPhone = async (phone: string, code: string) => {
    const normalizedPhone = normalizePhone(phone);

    // Obtener datos de signup si existen
    const signupDataRaw = await AsyncStorage.getItem("@ComeYa_pending_signup");
    const signupData = signupDataRaw ? JSON.parse(signupDataRaw) : null;

    // Adjuntar el código de referido capturado al abrir la app por un enlace
    if (signupData) {
      try {
        const pendingReferral = await AsyncStorage.getItem(
          "@comeya/pending_referral_code",
        );
        if (pendingReferral) signupData.referralCode = pendingReferral;
      } catch {
        /* referido opcional */
      }
    }

    const response = await apiRequest("POST", "/api/auth/phone-login", {
      phone: normalizedPhone,
      code,
      signupData,
    });
    const data = await response.json();

    // Validar respuesta del servidor
    if (!data.user || !data.token) {
      throw new Error(data.error || "Error del servidor al verificar código");
    }

    const newUser: User = {
      id: data.user.id,
      email: data.user.email || undefined,
      name: data.user.name,
      phone: data.user.phone,
      role: data.user.role,
      phoneVerified: true,
      isActive: data.user.isActive,
      verificationStatus: data.user.verificationStatus || "pending",
      profileImage: data.user.profileImage || undefined,
      biometricEnabled: data.user.biometricEnabled || false,
      stripeCustomerId: data.user.stripeCustomerId,
      createdAt: new Date().toISOString(),
      preferences: {
        theme: "system",
        accentColor: "#00C853",
      },
      token: data.token,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.removeItem(PENDING_PHONE_KEY);
    await AsyncStorage.removeItem("@ComeYa_pending_signup");
    setUser(newUser);
    setPendingVerificationPhone(null);
    registerPushToken();
    return newUser;
  };

  const resendVerification = async (phone: string) => {
    await apiRequest("POST", "/api/auth/send-code", {
      phone,
    });
  };

  const loginWithBiometric = async (): Promise<boolean> => {
    try {
      const storedPhone = await AsyncStorage.getItem(BIOMETRIC_PHONE_KEY);
      if (!storedPhone) {
        return false;
      }

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Inicia sesión con tu huella",
        fallbackLabel: "Usar código SMS",
        cancelLabel: "Cancelar",
        disableDeviceFallback: false,
      });

      if (!authResult.success) {
        return false;
      }

      const response = await apiRequest("POST", "/api/auth/biometric-login", {
        phone: storedPhone,
      });
      const data = await response.json();

      if (data.error) {
        return false;
      }

      const newUser: User = {
        id: data.user.id,
        email: data.user.email || undefined,
        name: data.user.name,
        phone: data.user.phone,
        role: data.user.role,
        phoneVerified: data.user.phoneVerified,
        profileImage: data.user.profileImage || undefined,
        biometricEnabled: data.user.biometricEnabled,
        isActive: data.user.isActive,
        stripeCustomerId: data.user.stripeCustomerId,
        createdAt: new Date().toISOString(),
        token: data.token, // Save the JWT token
        preferences: {
          theme: "system",
          accentColor: "#00C853",
        },
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      await AsyncStorage.setItem("token", data.token);
      setUser(newUser);
      registerPushToken();
      return true;
    } catch (error) {
      console.error("Biometric login error:", error);
      return false;
    }
  };

  const enableBiometric = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirma tu identidad para activar huella",
        fallbackLabel: "Cancelar",
        cancelLabel: "Cancelar",
        disableDeviceFallback: true,
      });

      if (!authResult.success) {
        return false;
      }

      const response = await apiRequest("POST", "/api/auth/enable-biometric", {
        userId: user.id,
      });
      const data = await response.json();

      if (data.success) {
        await AsyncStorage.setItem(BIOMETRIC_PHONE_KEY, user.phone);
        const updatedUser = { ...user, biometricEnabled: true };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
        setUser(updatedUser);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Enable biometric error:", error);
      return false;
    }
  };

  const disableBiometric = async () => {
    if (!user) return;

    try {
      await apiRequest("POST", "/api/auth/disable-biometric", {
        userId: user.id,
      });
      await AsyncStorage.removeItem(BIOMETRIC_PHONE_KEY);
      const updatedUser = { ...user, biometricEnabled: false };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error("Disable biometric error:", error);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem(PENDING_PHONE_KEY);

    // Clear token cache
    try {
      const { clearTokenCache } = await import("@/lib/query-client");
      clearTokenCache();
    } catch (error) {
      // Silent fail
    }

    setUser(null);
    setToken(null);
    setPendingVerificationPhone(null);

    // Volver a la pantalla de login (evita quedarse en una pestaña
    // del panel con sesión cerrada)
    try {
      const { navigationRef } = await import("@/navigation/navigationRef");
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: "Login" }] });
      }
    } catch {
      /* navegación opcional */
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updates };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setUser(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        pendingVerificationPhone,
        biometricAvailable,
        biometricType,
        requestPhoneLogin,
        loginWithPassword,
        signup,
        verifyPhone,
        resendVerification,
        loginWithBiometric,
        enableBiometric,
        disableBiometric,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
