import React from "react";

const ProjectSettingsModal = ({ budgetData, setBudgetData, onClose }) => {
  const [formData, setFormData] = React.useState({
    title: budgetData.projectInfo?.title || "",
    directors: budgetData.projectInfo?.directors || "",
    producers: budgetData.projectInfo?.producers || "",
    executiveProducers: budgetData.projectInfo?.executiveProducers || "",
    productionCompany: budgetData.projectInfo?.productionCompany || "",
    prepPeriod: budgetData.projectInfo?.prepPeriod || 0,
    shootingDays: budgetData.projectInfo?.shootingDays || 0,
    pickupDays: budgetData.projectInfo?.pickupDays || "",
    postWeeks: budgetData.projectInfo?.postWeeks || 0,
    format: budgetData.projectInfo?.format || "",
    cameraType: budgetData.projectInfo?.cameraType || "",
    length: budgetData.projectInfo?.length || "",
    shootingRatio: budgetData.projectInfo?.shootingRatio || "",
    distribution: budgetData.projectInfo?.distribution || "",
    datePrepared:
      budgetData.projectInfo?.datePrepared ||
      new Date().toISOString().split("T")[0],
    lastUpdate: new Date().toISOString().split("T")[0],
    formatIsOther: false,
    cameraTypeIsOther: false,
  });

  const [errors, setErrors] = React.useState({});

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Project title is required";
    }

    if (!formData.directors.trim()) {
      newErrors.directors = "Director(s) required";
    }

    if (!formData.producers.trim()) {
      newErrors.producers = "Producer(s) required";
    }

    if (!formData.productionCompany.trim()) {
      newErrors.productionCompany = "Production company required";
    }

    if (!formData.shootingDays || formData.shootingDays < 1) {
      newErrors.shootingDays = "Shooting days must be at least 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      setBudgetData((prev) => ({
        ...prev,
        projectInfo: {
          ...formData,
          lastUpdate: new Date().toISOString().split("T")[0],
        },
      }));
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const inputStyle = {
    width: "100%",
    padding: "8px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const errorInputStyle = {
    ...inputStyle,
    borderColor: "#f44336",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
    fontSize: "14px",
    color: "#333",
  };

  const errorStyle = {
    color: "#f44336",
    fontSize: "12px",
    marginTop: "2px",
  };

  const fieldStyle = {
    marginBottom: "15px",
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
          width: "700px",
          maxHeight: "85vh",
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
            Project Settings (Top Sheet)
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          {/* Left Column */}
          <div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Project Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                style={errors.title ? errorInputStyle : inputStyle}
                placeholder="Enter project title"
              />
              {errors.title && <div style={errorStyle}>{errors.title}</div>}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Director(s) *</label>
              <input
                type="text"
                value={formData.directors}
                onChange={(e) => handleInputChange("directors", e.target.value)}
                style={errors.directors ? errorInputStyle : inputStyle}
                placeholder="e.g., John Smith / Jane Doe"
              />
              {errors.directors && (
                <div style={errorStyle}>{errors.directors}</div>
              )}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Producer(s) *</label>
              <input
                type="text"
                value={formData.producers}
                onChange={(e) => handleInputChange("producers", e.target.value)}
                style={errors.producers ? errorInputStyle : inputStyle}
                placeholder="Producer name(s)"
              />
              {errors.producers && (
                <div style={errorStyle}>{errors.producers}</div>
              )}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Executive Producer(s)</label>
              <input
                type="text"
                value={formData.executiveProducers}
                onChange={(e) =>
                  handleInputChange("executiveProducers", e.target.value)
                }
                style={inputStyle}
                placeholder="Executive producer name(s)"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Production Company *</label>
              <input
                type="text"
                value={formData.productionCompany}
                onChange={(e) =>
                  handleInputChange("productionCompany", e.target.value)
                }
                style={errors.productionCompany ? errorInputStyle : inputStyle}
                placeholder="Production company name"
              />
              {errors.productionCompany && (
                <div style={errorStyle}>{errors.productionCompany}</div>
              )}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Format</label>
              <select
                value={
                  formData.format === "Other" ||
                  (formData.format &&
                    ![
                      "4K UHD 3840x2160",
                      "2K 2048x1080",
                      "HD 1920x1080",
                      "6K 6144x3456",
                      "8K 7680x4320",
                    ].includes(formData.format))
                    ? "Other"
                    : formData.format
                }
                onChange={(e) => {
                  if (e.target.value === "Other") {
                    handleInputChange("formatIsOther", true);
                    handleInputChange("format", "");
                  } else {
                    handleInputChange("formatIsOther", false);
                    handleInputChange("format", e.target.value);
                  }
                }}
                style={inputStyle}
              >
                <option value="">Select format</option>
                <option value="4K UHD 3840x2160">4K UHD 3840x2160</option>
                <option value="2K 2048x1080">2K 2048x1080</option>
                <option value="HD 1920x1080">HD 1920x1080</option>
                <option value="6K 6144x3456">6K 6144x3456</option>
                <option value="8K 7680x4320">8K 7680x4320</option>
                <option value="Other">Other</option>
              </select>
              {formData.formatIsOther && (
                <input
                  type="text"
                  value={formData.format}
                  onChange={(e) => handleInputChange("format", e.target.value)}
                  style={{ ...inputStyle, marginTop: "5px" }}
                  placeholder="Enter custom format"
                />
              )}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Camera Type</label>
              <select
                value={
                  formData.cameraType === "Other" ||
                  (formData.cameraType &&
                    ![
                      "RED Komodo",
                      "RED Scarlet-W",
                      "ARRI Alexa Mini",
                      "ARRI Alexa LF",
                      "Sony FX9",
                      "Sony FX6",
                      "Canon C70",
                      "Canon C300 Mark III",
                      "Blackmagic URSA",
                    ].includes(formData.cameraType))
                    ? "Other"
                    : formData.cameraType
                }
                onChange={(e) => {
                  if (e.target.value === "Other") {
                    handleInputChange("cameraTypeIsOther", true);
                    handleInputChange("cameraType", "");
                  } else {
                    handleInputChange("cameraTypeIsOther", false);
                    handleInputChange("cameraType", e.target.value);
                  }
                }}
                style={inputStyle}
              >
                <option value="">Select camera</option>
                <option value="RED Komodo">RED Komodo</option>
                <option value="RED Scarlet-W">RED Scarlet-W</option>
                <option value="ARRI Alexa Mini">ARRI Alexa Mini</option>
                <option value="ARRI Alexa LF">ARRI Alexa LF</option>
                <option value="Sony FX9">Sony FX9</option>
                <option value="Sony FX6">Sony FX6</option>
                <option value="Canon C70">Canon C70</option>
                <option value="Canon C300 Mark III">Canon C300 Mark III</option>
                <option value="Blackmagic URSA">Blackmagic URSA</option>
                <option value="Other">Other</option>
              </select>
              {formData.cameraTypeIsOther && (
                <input
                  type="text"
                  value={formData.cameraType}
                  onChange={(e) =>
                    handleInputChange("cameraType", e.target.value)
                  }
                  style={{ ...inputStyle, marginTop: "5px" }}
                  placeholder="Enter custom camera type"
                />
              )}
            </div>
          </div>

          {/* Right Column */}
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <div>
                <label style={labelStyle}>Prep Period (weeks)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.prepPeriod}
                  onChange={(e) =>
                    handleInputChange(
                      "prepPeriod",
                      parseInt(e.target.value) || 0
                    )
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Shooting Days *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.shootingDays}
                  onChange={(e) =>
                    handleInputChange(
                      "shootingDays",
                      parseInt(e.target.value) || 0
                    )
                  }
                  style={errors.shootingDays ? errorInputStyle : inputStyle}
                />
                {errors.shootingDays && (
                  <div style={errorStyle}>{errors.shootingDays}</div>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "15px",
              }}
            >
              <div>
                <label style={labelStyle}>Pickup Days</label>
                <input
                  type="text"
                  value={formData.pickupDays}
                  onChange={(e) =>
                    handleInputChange("pickupDays", e.target.value)
                  }
                  style={inputStyle}
                  placeholder="e.g., TBD or 2"
                />
              </div>
              <div>
                <label style={labelStyle}>Post Weeks</label>
                <input
                  type="number"
                  min="0"
                  value={formData.postWeeks}
                  onChange={(e) =>
                    handleInputChange(
                      "postWeeks",
                      parseInt(e.target.value) || 0
                    )
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Estimated Length</label>
              <input
                type="text"
                value={formData.length}
                onChange={(e) => handleInputChange("length", e.target.value)}
                style={inputStyle}
                placeholder="e.g., 95min"
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Shooting Ratio</label>
              <select
                value={formData.shootingRatio}
                onChange={(e) =>
                  handleInputChange("shootingRatio", e.target.value)
                }
                style={inputStyle}
              >
                <option value="">Select ratio</option>
                <option value="3:1">3:1</option>
                <option value="5:1">5:1</option>
                <option value="7:1">7:1</option>
                <option value="10:1">10:1</option>
                <option value="12:1">12:1</option>
                <option value="15:1">15:1</option>
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Distribution</label>
              <select
                value={formData.distribution}
                onChange={(e) =>
                  handleInputChange("distribution", e.target.value)
                }
                style={inputStyle}
              >
                <option value="">Select distribution</option>
                <option value="Theatrical">Theatrical</option>
                <option value="Streaming">Streaming</option>
                <option value="VOD">VOD</option>
                <option value="Theatrical + Streaming">
                  Theatrical + Streaming
                </option>
                <option value="Festival Circuit">Festival Circuit</option>
                <option value="TBD">TBD</option>
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              <div>
                <label style={labelStyle}>Date Prepared</label>
                <input
                  type="date"
                  value={formData.datePrepared}
                  onChange={(e) =>
                    handleInputChange("datePrepared", e.target.value)
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Updated</label>
                <input
                  type="date"
                  value={formData.lastUpdate}
                  readOnly
                  style={{
                    ...inputStyle,
                    backgroundColor: "#f5f5f5",
                    color: "#666",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            borderTop: "1px solid #ddd",
            paddingTop: "20px",
            marginTop: "25px",
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
            Save Project Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsModal;
