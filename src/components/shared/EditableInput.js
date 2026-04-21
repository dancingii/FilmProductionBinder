import React from "react";

const EditableInput = React.memo(
  ({
    value,
    onSave,
    shotId,
    onFocusShot,
    onBlurShot,
    type = "text",
    placeholder = "",
    style = {},
    variant = "default",
  }) => {
    const [localValue, setLocalValue] = React.useState(value || "");

    React.useEffect(() => {
      setLocalValue(value || "");
    }, [value]);

    const handleFocus = () => {
      if (onFocusShot && shotId) onFocusShot(shotId);
    };

    const handleBlur = () => {
      if (localValue !== value) {
        onSave(localValue);
      }
      if (onBlurShot) onBlurShot();
    };

    const handleKeyPress = (e) => {
      // Only blur on Enter for single-line inputs, not textareas
      if (e.key === "Enter" && variant !== "shotlist-multiline") {
        e.target.blur(); // Blur the field, which triggers handleBlur
      }
    };

    // Default styles for different variants
    const getDefaultStyle = () => {
      switch (variant) {
        case "shotlist":
          return {
            fontSize: "10px",
            padding: "2px",
            border: "1px solid #ccc",
            borderRadius: "2px",
            width: "100%",
            minHeight: "16px",
            boxSizing: "border-box",
          };
        case "shotlist-multiline":
          return {
            fontSize: "10px",
            padding: "2px",
            border: "1px solid #ccc",
            borderRadius: "2px",
            width: "100%",
            minHeight: "20px",
            boxSizing: "border-box",
            resize: "none",
            overflow: "hidden",
            whiteSpace: "normal",
            overflowWrap: "break-word",
            fontFamily: "Arial, sans-serif",
            lineHeight: "1.2",
          };
        case "todo":
          return {
            fontSize: "12px",
            padding: "4px",
            border: "1px solid #ccc",
            borderRadius: "3px",
            width: "100%",
            boxSizing: "border-box",
          };
        default:
          return {};
      }
    };

    // Use textarea for multiline variants, input for others
    const isTextarea = variant === "shotlist-multiline";

    const commonProps = {
      value: localValue,
      onChange: (e) => setLocalValue(e.target.value),
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyPress: handleKeyPress,
      placeholder: placeholder,
      style: {
        ...getDefaultStyle(),
        ...style,
      },
    };

    if (isTextarea) {
      const textareaRef = React.useRef(null);

      const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = "auto";
          textarea.style.height = textarea.scrollHeight + "px";
        }
      };

      React.useEffect(() => {
        adjustHeight();
      }, [localValue]);

      React.useEffect(() => {
        adjustHeight();
      }, []);

      return (
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            adjustHeight();
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={1}
          style={{
            ...getDefaultStyle(),
            ...style,
          }}
        />
      );
    }

    return <input type={type} {...commonProps} />;
  }
);

export default EditableInput;
