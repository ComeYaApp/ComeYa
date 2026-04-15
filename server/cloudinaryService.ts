import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type UploadFolder = 'profiles' | 'businesses' | 'products' | 'comprobantes' | 'reviews' | 'delivery-proofs';

export class CloudinaryService {
  /**
   * Sube una imagen base64 a Cloudinary
   * @param base64Image - Imagen en formato data:image/...;base64,xxx
   * @param folder - Carpeta destino en Cloudinary
   * @param publicId - ID público opcional (si no se provee, Cloudinary genera uno)
   * @returns URL segura de la imagen subida
   */
  static async uploadImage(base64Image: string, folder: UploadFolder, publicId?: string): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(base64Image, {
        folder: `comeya/${folder}`,
        public_id: publicId,
        resource_type: 'image',
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      return result.secure_url;
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Error al subir imagen: ${error.message}`);
    }
  }

  /**
   * Elimina una imagen de Cloudinary
   * @param publicId - ID público de la imagen (ej: comeya/profiles/user-123)
   */
  static async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      console.error('Cloudinary delete error:', error);
      throw new Error(`Error al eliminar imagen: ${error.message}`);
    }
  }

  /**
   * Extrae el public_id de una URL de Cloudinary
   * @param url - URL completa de Cloudinary
   * @returns public_id sin extensión
   */
  static extractPublicId(url: string): string | null {
    try {
      const match = url.match(/\/v\d+\/(.+)\.\w+$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
}
