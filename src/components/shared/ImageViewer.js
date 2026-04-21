import React, { useState, useEffect } from "react";

const ImageViewer = ({ images, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in animation
    setTimeout(() => setIsVisible(true), 10);

    // ESC key handler
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200); // Wait for fade out
  };

  const handlePrevious = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  if (!images || images.length === 0) return null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
        cursor: "pointer",
      }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "rgba(255, 255, 255, 0.2)",
          border: "none",
          color: "white",
          fontSize: "24px",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10001,
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) =>
          (e.target.style.background = "rgba(255, 255, 255, 0.3)")
        }
        onMouseLeave={(e) =>
          (e.target.style.background = "rgba(255, 255, 255, 0.2)")
        }
      >
        ×
      </button>

      {/* Image */}
      <img
        src={images[currentIndex]}
        alt={`View ${currentIndex + 1}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          cursor: "default",
          userSelect: "none",
        }}
      />

      {/* Navigation - only show if multiple images */}
      {images.length > 1 && (
        <>
          {/* Previous button */}
          <button
            onClick={handlePrevious}
            className="image-viewer-nav-button"
            style={{
              position: "absolute",
              left: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "white",
              fontSize: "32px",
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.2s, background 0.2s",
              zIndex: 10001,
            }}
          >
            ‹
          </button>

          {/* Next button */}
          <button
            onClick={handleNext}
            className="image-viewer-nav-button"
            style={{
              position: "absolute",
              right: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "white",
              fontSize: "32px",
              width: "50px",
              height: "50px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.2s, background 0.2s",
              zIndex: 10001,
            }}
          >
            ›
          </button>

          {/* Image counter */}
          <div
            style={{
              position: "absolute",
              bottom: "30px",
              left: "50%",
              transform: "translateX(-50%)",
              color: "white",
              fontSize: "16px",
              background: "rgba(0, 0, 0, 0.5)",
              padding: "8px 16px",
              borderRadius: "20px",
              zIndex: 10001,
            }}
          >
            {currentIndex + 1} / {images.length}
          </div>
        </>
      )}

      {/* CSS for hover effect on nav buttons */}
      <style>{`
        .image-viewer-nav-button:hover {
          opacity: 1 !important;
          background: rgba(255, 255, 255, 0.3) !important;
        }
        div:hover .image-viewer-nav-button {
          opacity: 0.7;
        }
      `}</style>
    </div>
  );
};

export default ImageViewer;
