import React from "react";

/**
 * Shared presence indicator component
 * Shows colored border and user name when someone is editing an item
 *
 * @param {string} itemId - ID of the current item
 * @param {array} otherUsers - Array of other users from usePresence hook
 * @param {object} children - Content to wrap with presence indicator
 * @param {string} position - Where to show name: 'top', 'bottom', 'left', 'right'
 */
function PresenceIndicator({ itemId, otherUsers, children, position = "top" }) {
  // Find if anyone else is editing this item
  const editor = otherUsers.find(
    (user) => user.itemId === itemId && user.itemId !== null
  );

  if (!editor) {
    return children;
  }

  const nameTag = (
    <div
      style={{
        position: "absolute",
        ...(position === "top" && { top: "-20px", left: "0" }),
        ...(position === "bottom" && { bottom: "-20px", left: "0" }),
        ...(position === "left" && {
          left: "-10px",
          top: "0",
          transform: "translateX(-100%)",
        }),
        ...(position === "right" && {
          right: "-10px",
          top: "0",
          transform: "translateX(100%)",
        }),
        backgroundColor: editor.color,
        color: "white",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: "bold",
        whiteSpace: "nowrap",
        zIndex: 10,
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      }}
    >
      {editor.displayName}
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      {nameTag}
      <div
        style={{
          border: `3px solid ${editor.color}`,
          borderRadius: "4px",
          boxShadow: `0 0 8px ${editor.color}50`,
          transition: "all 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PresenceIndicator;
