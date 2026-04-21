import React, { useState } from "react";
import ImageUpload from "./ImageUpload";

/**
 * MultiImageUpload Component
 * Supports multiple images with add/remove functionality
 *
 * @param {Array} images - Array of image URLs: ["url1", "url2", ...]
 * @param {function} onAdd - Callback when image is added: (file) => Promise<url>
 * @param {function} onDelete - Callback when image is deleted: (url, index) => void
 * @param {string} label - Label text
 * @param {boolean} disabled - Disable upload (for view-only mode)
 * @param {number} maxImages - Maximum number of images (default: 10)
 */
export default function MultiImageUpload({
  images = [],
  onAdd,
  onDelete,
  onImageClick,
  label = "Images",
  disabled = false,
  maxImages = 10,
  enableCrop = true,
  aspectRatio = 1,
}) {
  const [uploading, setUploading] = useState(false);

  const handleAdd = async (file) => {
    if (images.length >= maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    try {
      if (onAdd) {
        await onAdd(file);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (index) => {
    if (onDelete) {
      onDelete(images[index], index);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {label && (
        <label style={{ fontSize: "13px", fontWeight: "bold", color: "#333" }}>
          {label} ({images.length}/{maxImages})
        </label>
      )}

      {/* Image Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "10px",
        }}
      >
        {images.map((url, index) => (
          <div
            key={index}
            style={{
              position: "relative",
              width: "140px",
              height: "175px",
              borderRadius: "6px",
              overflow: "hidden",
              border: "1px solid #ddd",
            }}
          >
            <img
              src={url}
              alt={`Image ${index + 1}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                console.log(
                  "🖼️ IMAGE CLICKED - index:",
                  index,
                  "should NOT trigger delete"
                );
                if (onImageClick) {
                  onImageClick(images, index);
                }
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                cursor: onImageClick ? "pointer" : "default",
              }}
            />
            {!disabled && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("🗑️ DELETE BUTTON CLICKED - index:", index);
                  handleDelete(index);
                }}
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "3px",
                  width: "20px",
                  height: "20px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 100,
                  pointerEvents: "auto",
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {/* Add Image Button */}
        {!disabled && images.length < maxImages && (
          <div style={{ width: "140px" }}>
            <ImageUpload
              currentImageUrl={null}
              onUpload={handleAdd}
              onDelete={() => {}}
              label=""
              disabled={uploading}
              compact={true}
              enableCrop={enableCrop}
              aspectRatio={aspectRatio}
            />
          </div>
        )}
      </div>

      {uploading && (
        <div style={{ fontSize: "11px", color: "#2196F3" }}>Uploading...</div>
      )}
    </div>
  );
}
