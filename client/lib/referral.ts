import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_REFERRAL_KEY = "@comeya/pending_referral_code";

/**
 * Código de referido pendiente, capturado al abrir la app desde un enlace
 * comeya://ref/CODIGO o https://app.comeya.es?ref=CODIGO. Se consume en el
 * registro para atribuir la invitación.
 */
export async function setPendingReferral(code: string) {
  try {
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
  } catch {
    /* almacenamiento no disponible */
  }
}

export async function getPendingReferral(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingReferral() {
  try {
    await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}
