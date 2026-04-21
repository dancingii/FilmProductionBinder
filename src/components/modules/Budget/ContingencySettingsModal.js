import React from "react";

const ContingencySettingsModal = ({
  budgetData,
  setBudgetData,
  onClose,
  atlTotal,
  btlTotal,
  legalTotal,
  marketingTotal,
  postTotal,
}) => {
  const [settings, setSettings] = React.useState({
    percentage: budgetData.contingencySettings?.percentage || 10,
    includeATL:
      budgetData.contingencySettings?.includeATL !== undefined
        ? budgetData.contingencySettings.includeATL
        : true,
    includeBTL:
      budgetData.contingencySettings?.includeBTL !== undefined
        ? budgetData.contingencySettings.includeBTL
        : true,
    includeLegal:
      budgetData.contingencySettings?.includeLegal !== undefined
        ? budgetData.contingencySettings.includeLegal
        : true,
    includeMarketing: budgetData.contingencySettings?.includeMarketing || false,
    includePost: budgetData.contingencySettings?.includePost || false,
  });

  const handleSave = () => {
    setBudgetData((prev) => ({
      ...prev,
      contingencySettings: settings,
    }));
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Calculate preview totals
  let contingencyBase = 0;
  if (settings.includeATL) contingencyBase += atlTotal;
  if (settings.includeBTL) contingencyBase += btlTotal;
  if (settings.includeLegal) contingencyBase += legalTotal;
  if (settings.includeMarketing) contingencyBase += marketingTotal;
  if (settings.includePost) contingencyBase += postTotal;

  const contingencyAmount = Math.round(
    contingencyBase * (settings.percentage / 100)
  );

  const inputStyle = {
    width: "100%",
    padding: "8px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const checkboxStyle = {
    marginRight: "8px",
    transform: "scale(1.2)",
  };

  const labelStyle = {
    display: "flex",
    alignItems: "center",
    marginBottom: "12px",
    fontSize: "14px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "30px",
          borderRadius: "8px",
          width: "500px",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            borderBottom: "2px solid #2196F3",
            paddingBottom: "15px",
            marginBottom: "25px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              color: "#333",
              textAlign: "center",
            }}
          >
            Contingency Settings
          </h2>
        </div>

        <div style={{ marginBottom: "25px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "bold",
              fontSize: "16px",
            }}
          >
            Contingency Percentage:
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={settings.percentage}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                percentage: parseFloat(e.target.value) || 0,
              }))
            }
            style={{
              ...inputStyle,
              fontSize: "16px",
              textAlign: "center",
              fontWeight: "bold",
            }}
          />
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginTop: "4px",
              textAlign: "center",
            }}
          >
            Enter percentage (0-100)
          </div>
        </div>

        <div style={{ marginBottom: "25px" }}>
          <h3
            style={{
              fontSize: "18px",
              marginBottom: "15px",
              color: "#333",
            }}
          >
            Include in Contingency Calculation:
          </h3>

          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={settings.includeATL}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  includeATL: e.target.checked,
                }))
              }
              style={checkboxStyle}
            />
            Above The Line (ATL) - ${atlTotal.toLocaleString()}
          </label>

          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={settings.includeBTL}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  includeBTL: e.target.checked,
                }))
              }
              style={checkboxStyle}
            />
            Below The Line (BTL) - ${btlTotal.toLocaleString()}
          </label>

          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={settings.includeLegal}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  includeLegal: e.target.checked,
                }))
              }
              style={checkboxStyle}
            />
            Legal - ${legalTotal.toLocaleString()}
          </label>

          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={settings.includeMarketing}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  includeMarketing: e.target.checked,
                }))
              }
              style={checkboxStyle}
            />
            Marketing, EPK, & PR - ${marketingTotal.toLocaleString()}
          </label>

          <label style={labelStyle}>
            <input
              type="checkbox"
              checked={settings.includePost}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  includePost: e.target.checked,
                }))
              }
              style={checkboxStyle}
            />
            Post Production - ${postTotal.toLocaleString()}
          </label>
        </div>

        <div
          style={{
            backgroundColor: "#f9f9f9",
            padding: "15px",
            borderRadius: "4px",
            marginBottom: "25px",
            border: "1px solid #ddd",
          }}
        >
          <div style={{ fontSize: "14px", marginBottom: "8px" }}>
            <strong>Contingency Base:</strong> $
            {contingencyBase.toLocaleString()}
          </div>
          <div
            style={{ fontSize: "16px", fontWeight: "bold", color: "#2196F3" }}
          >
            <strong>Contingency Amount ({settings.percentage}%):</strong> $
            {contingencyAmount.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            borderTop: "1px solid #ddd",
            paddingTop: "20px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              padding: "10px 20px",
              backgroundColor: "#f5f5f5",
              color: "#333",
              border: "1px solid #ddd",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            Save Contingency Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContingencySettingsModal;
