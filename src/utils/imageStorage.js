import { supabase } from "../supabase";

/**
 * Image Storage Utility for Supabase Storage
 * Handles upload, delete, and URL generation for production images
 */

/**
 * Upload an image to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} projectId - Current project ID
 * @param {string} module - Module name (actors, props, makeup, wardrobe, etc.)
 * @param {string} itemId - Unique ID for the item (person_id, prop_id, etc.)
 * @param {string} fileName - Optional custom filename
 * @returns {Promise<{url: string, path: string} | {error: string}>}
 */
export async function uploadImage(
  file,
  projectId,
  module,
  itemId,
  fileName = null
) {
  try {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      return { error: "File must be an image" };
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { error: "Image must be less than 5MB" };
    }

    // Generate file path: {project_id}/{module}/{item_id}/{filename}
    const fileExt = file.name.split(".").pop();
    const timestamp = Date.now();
    const finalFileName = fileName || `${timestamp}.${fileExt}`;
    const filePath = `${projectId}/${module}/${itemId}/${finalFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("production-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true, // Replace if file already exists
      });

    if (error) {
      console.error("Upload error:", error);
      return { error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("production-images")
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (err) {
    console.error("Upload exception:", err);
    return { error: "Upload failed" };
  }
}

/**
 * Delete an image from Supabase Storage
 * @param {string} filePath - Full path to the file in storage
 * @returns {Promise<{success: boolean} | {error: string}>}
 */
export async function deleteImage(filePath) {
  try {
    const { error } = await supabase.storage
      .from("production-images")
      .remove([filePath]);

    if (error) {
      console.error("Delete error:", error);
      return { error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Delete exception:", err);
    return { error: "Delete failed" };
  }
}

/**
 * Get public URL for an image
 * @param {string} filePath - Full path to the file in storage
 * @returns {string} Public URL
 */
export function getImageUrl(filePath) {
  if (!filePath) return null;

  const { data } = supabase.storage
    .from("production-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/**
 * Extract file path from full URL
 * @param {string} url - Full public URL
 * @returns {string} File path
 */
export function extractPathFromUrl(url) {
  if (!url) return null;

  // Extract path after /production-images/
  const match = url.match(/\/production-images\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Compress image before upload (optional, for mobile)
 * @param {File} file - Image file
 * @param {number} maxWidth - Max width in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<File>} Compressed file
 */
export async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a wardrobe item image
 * @param {File} file - Image file
 * @param {string} projectId - Project ID
 * @param {string} characterName - Character name
 * @param {string} lookNumber - Wardrobe look number
 * @returns {Promise<{url: string, path: string} | {error: string}>}
 */
export async function uploadWardrobeImage(
  file,
  projectId,
  characterName,
  lookNumber
) {
  const itemId = `${characterName.replace(/\s+/g, "_")}/look_${lookNumber}`;
  return uploadImage(file, projectId, "wardrobe", itemId);
}

/**
 * Upload a garment inventory image
 * @param {File} file - Image file
 * @param {string} projectId - Project ID
 * @param {string} garmentId - Garment ID
 * @returns {Promise<{url: string, path: string} | {error: string}>}
 */
export async function uploadGarmentImage(file, projectId, garmentId) {
  return uploadImage(file, projectId, "garment", garmentId);
}

/**
 * Delete multiple images by their URLs
 * @param {Array<string>} urls - Array of image URLs to delete
 * @returns {Promise<{success: boolean, errors: Array}>}
 */
export async function deleteMultipleImages(urls) {
  const errors = [];

  for (const url of urls) {
    const filePath = extractPathFromUrl(url);
    if (filePath) {
      const result = await deleteImage(filePath);
      if (result.error) {
        errors.push({ url, error: result.error });
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Upload multiple images for a wardrobe item
 * @param {Array<File>} files - Array of image files
 * @param {string} projectId - Project ID
 * @param {string} characterName - Character name
 * @param {string} lookNumber - Wardrobe look number
 * @returns {Promise<{urls: Array<string>, errors: Array}>}
 */
export async function uploadMultipleWardrobeImages(
  files,
  projectId,
  characterName,
  lookNumber
) {
  const urls = [];
  const errors = [];

  for (const file of files) {
    const result = await uploadWardrobeImage(
      file,
      projectId,
      characterName,
      lookNumber
    );

    if (result.error) {
      errors.push({ file: file.name, error: result.error });
    } else {
      urls.push(result.url);
    }
  }

  return { urls, errors };
}

/**
 * Upload multiple images for a garment
 * @param {Array<File>} files - Array of image files
 * @param {string} projectId - Project ID
 * @param {string} garmentId - Garment ID
 * @returns {Promise<{urls: Array<string>, errors: Array}>}
 */
export async function uploadMultipleGarmentImages(files, projectId, garmentId) {
  const urls = [];
  const errors = [];

  for (const file of files) {
    const result = await uploadGarmentImage(file, projectId, garmentId);

    if (result.error) {
      errors.push({ file: file.name, error: result.error });
    } else {
      urls.push(result.url);
    }
  }

  return { urls, errors };
}
