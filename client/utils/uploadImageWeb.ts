/**
 * uploadImageWeb — sube una imagen desde el browser a Cloudinary via backend
 * Funciona igual que ImagePicker en la app nativa
 */

import { apiRequest } from "@/lib/query-client";

export type UploadFolder =
  | "profiles"
  | "businesses"
  | "products"
  | "comprobantes"
  | "reviews"
  | "delivery-proofs"
  | "tip-proofs"
  | "issues";

/**
 * Abre el selector de archivos del browser y sube la imagen a Cloudinary
 * @returns URL de Cloudinary o null si el usuario cancela
 */
export async function pickAndUploadImage(
  folder: UploadFolder,
): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const url = await uploadFileToCloudinary(file, folder);
        resolve(url);
      } catch (err) {
        console.error("Error subiendo imagen:", err);
        resolve(null);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Sube un File/Blob directamente a Cloudinary via backend
 */
export async function uploadFileToCloudinary(
  file: File | Blob,
  folder: UploadFolder,
): Promise<string> {
  const base64 = await fileToBase64(file);
  const endpoint = getEndpointForFolder(folder);
  const res = await apiRequest("POST", endpoint, { image: base64 });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Error al subir imagen");
  // Cada endpoint devuelve la URL con diferente key
  return data.imageUrl || data.profileImage || data.url || data.proofUrl || "";
}

/**
 * Convierte un File/Blob a base64 data URL
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Captura una foto desde la cámara del browser (WebRTC)
 */
export async function captureFromCamera(
  folder: UploadFolder,
): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment"; // cámara trasera
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const url = await uploadFileToCloudinary(file, folder);
        resolve(url);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

function getEndpointForFolder(folder: UploadFolder): string {
  switch (folder) {
    case "profiles":
      return "/api/user/profile-image";
    case "businesses":
      return "/api/upload/business-image";
    case "products":
      return "/api/upload/product-image";
    case "comprobantes":
      return "/api/upload/payment-proof";
    case "reviews":
      return "/api/upload/review-image";
    case "delivery-proofs":
      return "/api/upload/delivery-proof";
    case "tip-proofs":
      return "/api/upload/image";
    case "issues":
      return "/api/upload/image";
    default:
      return "/api/upload/image";
  }
}
