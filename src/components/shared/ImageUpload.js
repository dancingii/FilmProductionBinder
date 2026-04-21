import React, { useState, useRef } from "react";
import ImageCropper from "./ImageCropper.js";

/**
 * ImageUpload Component
 * Reusable image upload UI with preview and validation
 *
 * @param {string} currentImageUrl - Current image URL (for preview)
 * @param {function} onUpload - Callback when image is selected: (file) => void
 * @param {function} onDelete - Callback to delete current image: () => void
 * @param {string} label - Label text (e.g., "Actor Photo", "Prop Image")
 * @param {boolean} disabled - Disable upload (for view-only mode)
 * @param {boolean} compact - Compact mode (smaller preview)
 */
export default function ImageUpload({
  currentImageUrl,
  onUpload,
  onDelete,
  label = "Upload Image",
  disabled = false,
  compact = false,
  enableCrop = true,
  aspectRatio = 1,
}) {
  const [preview, setPreview] = useState(currentImageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("Image must be less than 5MB");
      return;
    }

    setError(null);

    // Create data URL for cropper
    const reader = new FileReader();
    reader.onload = (e) => {
      if (enableCrop) {
        setSelectedImage(e.target.result);
        setIsEditingExisting(false);
        setShowCropper(true);
      } else {
        // No cropping - upload directly
        uploadImage(file, e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (blob, croppedUrl) => {
    console.log("🎨 Crop complete, blob:", blob);
    console.log("🎨 Is editing existing?", isEditingExisting);

    setShowCropper(false);
    setSelectedImage(null);

    // Convert blob to File object
    const file = new File([blob], "cropped.jpg", { type: "image/jpeg" });

    // If editing existing image, delete the old one first
    if (isEditingExisting && currentImageUrl && onDelete) {
      console.log("🗑️ Deleting old image...");
      await onDelete();
    }

    // Upload the new cropped image
    console.log("⬆️ Uploading new image...");
    await uploadImage(file, croppedUrl);

    setIsEditingExisting(false);
    console.log("✅ Complete!");
  };

  const handleEditExisting = async () => {
    try {
      setUploading(true);

      // Fetch the image as a blob to avoid CORS issues
      const response = await fetch(currentImageUrl);
      const blob = await response.blob();

      // Convert blob to data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        setIsEditingExisting(true);
        setShowCropper(true);
        setUploading(false);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error loading image:", error);
      alert("Failed to load image for editing");
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async (file, previewUrl) => {
    setUploading(true);
    setPreview(previewUrl);

    // Call parent upload handler
    if (onUpload) {
      await onUpload(file);
    }

    setUploading(false);
  };

  const handleDelete = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onDelete) {
      onDelete();
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const size = compact
    ? { width: "80px", height: "80px" }
    : { width: "150px", height: "150px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {label && (
        <label style={{ fontSize: "12px", fontWeight: "bold", color: "#333" }}>
          {label}
        </label>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Image Preview or Placeholder */}
        <div
          onClick={handleClick}
          style={{
            ...size,
            border: "2px dashed #ccc",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: disabled ? "not-allowed" : "pointer",
            backgroundColor: preview ? "transparent" : "#f5f5f5",
            backgroundImage: preview ? `url(${preview})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            position: "relative",
            overflow: "hidden",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {!preview && (
            <div
              style={{
                textAlign: "center",
                color: "#999",
                fontSize: compact ? "10px" : "12px",
              }}
            >
              <div style={{ fontSize: compact ? "24px" : "36px" }}>📷</div>
              {!compact && <div>Click to upload</div>}
            </div>
          )}
          {uploading && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "12px",
              }}
            >
              Uploading...
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            onClick={handleClick}
            disabled={disabled || uploading}
            style={{
              padding: compact ? "6px 12px" : "8px 16px",
              fontSize: compact ? "11px" : "12px",
              backgroundColor: disabled ? "#ccc" : "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: disabled ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {preview ? "Change" : "Upload"}
          </button>

          {preview && !disabled && enableCrop && (
            <button
              onClick={() => {
                setSelectedImage(preview);
                setShowCropper(true);
              }}
              disabled={uploading}
              style={{
                padding: compact ? "6px 12px" : "8px 16px",
                fontSize: compact ? "11px" : "12px",
                backgroundColor: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Recrop
            </button>
          )}

          {preview && !disabled && enableCrop && (
            <button
              onClick={handleEditExisting}
              disabled={uploading}
              style={{
                padding: compact ? "6px 12px" : "8px 16px",
                fontSize: compact ? "11px" : "12px",
                backgroundColor: "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Edit
            </button>
          )}

          {preview && !disabled && (
            <button
              onClick={handleDelete}
              disabled={uploading}
              style={{
                padding: compact ? "6px 12px" : "8px 16px",
                fontSize: compact ? "11px" : "12px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ color: "#f44336", fontSize: "11px", marginTop: "4px" }}>
          {error}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* Size Limit Info */}
      {!compact && (
        <div style={{ fontSize: "10px", color: "#999" }}>
          Max size: 5MB • Formats: JPG, PNG, WebP
        </div>
      )}

      {/* Image Cropper Modal */}
      {showCropper && selectedImage && (
        <ImageCropper
          imageSrc={selectedImage}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={aspectRatio}
          isEditingExisting={isEditingExisting}
        />
      )}
    </div>
  );
}
