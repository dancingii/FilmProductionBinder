import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";

/**
 * ImageCropper Component
 * Modal cropper with zoom and drag controls
 */
export default function ImageCropper({
  imageSrc,
  onComplete,
  onCancel,
  aspectRatio = 1,
  isEditingExisting = false,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Canvas is empty");
          return;
        }
        blob.name = "cropped.jpg";
        const croppedUrl = URL.createObjectURL(blob);
        resolve({ blob, croppedUrl });
      }, "image/jpeg");
    });
  };

  const handleCrop = async () => {
    console.log("✂️ Starting crop...");
    console.log("✂️ Cropped area pixels:", croppedAreaPixels);

    if (!croppedAreaPixels) {
      console.error("❌ No crop area selected!");
      alert("Please adjust the crop area");
      return;
    }

    try {
      setProcessing(true);
      console.log("✂️ Getting cropped image...");
      const { blob, croppedUrl } = await getCroppedImg(
        imageSrc,
        croppedAreaPixels
      );
      console.log("✂️ Crop successful, calling onComplete");
      onComplete(blob, croppedUrl);
    } catch (e) {
      console.error("❌ Crop error:", e);
      alert(`Crop failed: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.8)",
          zIndex: 9998,
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          zIndex: 9999,
          width: "700px",
          maxWidth: "90vw",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "15px 20px",
            backgroundColor: "#2196F3",
            color: "white",
            fontWeight: "bold",
            fontSize: "16px",
          }}
        >
          Crop & Frame Image
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "400px",
            backgroundColor: "#000",
          }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "12px",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              Zoom
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={handleReset}
              style={{
                padding: "8px 16px",
                backgroundColor: "#FFC107",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "12px",
              }}
            >
              Reset
            </button>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={onCancel}
                disabled={processing}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ccc",
                  color: "#333",
                  border: "none",
                  borderRadius: "4px",
                  cursor: processing ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCrop}
                disabled={processing}
                style={{
                  padding: "8px 16px",
                  backgroundColor: processing ? "#ccc" : "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: processing ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                {processing
                  ? "Processing..."
                  : isEditingExisting
                  ? "Apply Changes"
                  : "Crop & Upload"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
