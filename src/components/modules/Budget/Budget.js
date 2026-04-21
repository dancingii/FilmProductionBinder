import React from "react";
import {
  atlDepartments,
  btlDepartments,
  legalDepartments,
  additionalCategories,
} from "./stockCategories.js";
import ContingencySettingsModal from "./ContingencySettingsModal.js";
import ProjectSettingsModal from "./ProjectSettingsModal.js";

// Budget Module Component
function BudgetModule({ budgetData, setBudgetData, onSyncBudgetData }) {
  const [atlExpanded, setAtlExpanded] = React.useState(true);
  const [btlExpanded, setBtlExpanded] = React.useState(true);
  const [legalExpanded, setLegalExpanded] = React.useState(false);
  const [marketingExpanded, setMarketingExpanded] = React.useState(false);
  const [postExpanded, setPostExpanded] = React.useState(false);
  const [showProjectSettings, setShowProjectSettings] = React.useState(false);
  const [showContingencySettings, setShowContingencySettings] =
    React.useState(false);
  const [editingItem, setEditingItem] = React.useState(null);
  const [editingType, setEditingType] = React.useState(null); // 'atl' or 'btl'
  const [draggedItem, setDraggedItem] = React.useState(null);
  const [draggedType, setDraggedType] = React.useState(null);
  const [editableAgencyRate, setEditableAgencyRate] = React.useState(10);
  const [editableBondRate, setEditableBondRate] = React.useState(null); // null means use auto calculation

  // Get shooting days for bond calculation
  const shootingDaysCount = budgetData.projectInfo?.shootingDays || 0;

  // Calculate totals
  const atlTotal = (() => {
    const manualTotal =
      budgetData.atlItems?.reduce(
        (sum, item) => sum + (item.budgetAmount || 0),
        0
      ) || 0;

    // Add auto-generated SAG fees
    const sagActors = (budgetData.atlItems || []).filter(
      (item) => item.type === "cast" && item.unionStatus === "SAG-AFTRA"
    );

    if (sagActors.length === 0) return manualTotal;

    const sagTotalBudget = sagActors.reduce(
      (sum, actor) => sum + (actor.budgetAmount || 0),
      0
    );

    const agencyFees = Math.round(sagTotalBudget * (editableAgencyRate / 100));

    // Bond calculation based on shooting days
    let bondMultiplier = shootingDaysCount > 10 ? 0.4 : 1.0;
    const bondAmount =
      editableBondRate !== null
        ? Math.round((sagTotalBudget + agencyFees) * (editableBondRate / 100))
        : Math.round((sagTotalBudget + agencyFees) * bondMultiplier);

    return manualTotal + agencyFees + bondAmount;
  })();
  const btlTotal =
    budgetData.btlItems?.reduce(
      (sum, item) => sum + (item.budgetAmount || 0),
      0
    ) || 0;
  const legalTotal =
    budgetData.legalItems?.reduce(
      (sum, item) => sum + (item.budgetAmount || 0),
      0
    ) || 0;
  const marketingTotal =
    budgetData.marketingItems?.reduce(
      (sum, item) => sum + (item.budgetAmount || 0),
      0
    ) || 0;
  const postTotal =
    budgetData.postItems?.reduce(
      (sum, item) => sum + (item.budgetAmount || 0),
      0
    ) || 0;

  // Calculate category totals
  const getCategoryTotal = (category, sectionType) => {
    const itemsKey = `${sectionType}Items`;
    const items = budgetData[itemsKey] || [];
    return items
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + (item.budgetAmount || 0), 0);
  };

  // Calculate contingency
  const contingencySettings =
    budgetData.contingencySettings &&
    budgetData.contingencySettings.percentage !== undefined
      ? budgetData.contingencySettings
      : {
          percentage: 10,
          includeATL: true,
          includeBTL: true,
          includeLegal: true,
          includeMarketing: false,
          includePost: false,
        };

  let contingencyBase = 0;
  if (contingencySettings.includeATL) contingencyBase += atlTotal;
  if (contingencySettings.includeBTL) contingencyBase += btlTotal;
  if (contingencySettings.includeLegal) contingencyBase += legalTotal;
  if (contingencySettings.includeMarketing) contingencyBase += marketingTotal;
  if (contingencySettings.includePost) contingencyBase += postTotal;

  const contingencyAmount = Math.round(
    contingencyBase * ((contingencySettings.percentage || 10) / 100)
  );
  // Calculate department budget totals
  const departmentBudgets = budgetData.departmentBudgets || {};
  const departmentBudgetTotal = Object.keys(departmentBudgets)
    .filter((key) => key.startsWith("btl_"))
    .reduce((sum, key) => sum + (departmentBudgets[key] || 0), 0);

  const grandTotal =
    atlTotal +
    btlTotal +
    legalTotal +
    marketingTotal +
    postTotal +
    contingencyAmount +
    departmentBudgetTotal;
  const paidTotal = [
    ...(budgetData.atlItems || []),
    ...(budgetData.btlItems || []),
    ...(budgetData.legalItems || []),
    ...(budgetData.marketingItems || []),
    ...(budgetData.postItems || []),
  ].reduce((sum, item) => sum + (item.paid || 0), 0);
  const unpaidTotal = grandTotal - paidTotal;

  /// Clean up any NaN values in budget data
  React.useEffect(() => {
    const needsCleanup = [
      ...(budgetData.atlItems || []),
      ...(budgetData.btlItems || []),
      ...(budgetData.legalItems || []),
      ...(budgetData.marketingItems || []),
      ...(budgetData.postItems || []),
    ].some((item) => isNaN(item.budgetAmount));

    if (needsCleanup) {
      setBudgetData((prev) => {
        const cleanItems = (items) =>
          items.map((item) => ({
            ...item,
            budgetAmount: isNaN(item.budgetAmount) ? 0 : item.budgetAmount,
            paid: isNaN(item.paid) ? 0 : item.paid,
            unpaid: isNaN(item.unpaid) ? 0 : item.unpaid,
          }));

        const cleaned = {
          ...prev,
          atlItems: cleanItems(prev.atlItems || []),
          btlItems: cleanItems(prev.btlItems || []),
          legalItems: cleanItems(prev.legalItems || []),
          marketingItems: cleanItems(prev.marketingItems || []),
          postItems: cleanItems(prev.postItems || []),
        };

        // Sync removed - data cleanup should not trigger database sync
        // This prevents infinite realtime loops when loading data from database

        return cleaned;
      });
    }
  }, [
    budgetData.atlItems,
    budgetData.btlItems,
    budgetData.legalItems,
    budgetData.marketingItems,
    budgetData.postItems,
  ]);

  // Initialize default budget data if not exists
  React.useEffect(() => {
    if (!budgetData.projectInfo) {
      setBudgetData((prev) => ({
        ...prev,
        projectInfo: {
          title: "",
          directors: "",
          producers: "",
          executiveProducers: "",
          productionCompany: "",
          prepPeriod: 0,
          shootingDays: 0,
          pickupDays: "",
          postWeeks: 0,
          format: "",
          cameraType: "",
          length: "",
          shootingRatio: "",
          distribution: "",
          datePrepared: new Date().toISOString().split("T")[0],
          lastUpdate: new Date().toISOString().split("T")[0],
        },
        atlItems: [],
        btlItems: [],
        legalItems: [],
        marketingItems: [],
        postItems: [],
        weeklyReports: [],
        customCategories: [],
        totals: {
          atlTotal: 0,
          btlTotal: 0,
          grandTotal: 0,
          paidTotal: 0,
          unpaidTotal: 0,
        },
      }));
    }
  }, [budgetData, setBudgetData]);

  // Add new budget item
  const addBudgetItem = (type, itemType = "personnel") => {
    const newId = `${type}_${Date.now()}`;
    const newItem = {
      id: newId,
      code: "",
      category: "",
      name: "",
      characterName: itemType === "cast" ? "" : undefined,
      prepDays: itemType === "personnel" ? 0 : undefined,
      quantity: itemType === "non-personnel" ? 1 : undefined,
      days:
        itemType !== "non-personnel"
          ? itemType === "personnel"
            ? budgetData.projectInfo?.shootingDays || 0
            : ""
          : undefined,
      rateType: "Daily",
      rate: 0,
      prepaidExpenses: 0,
      budgetAmount: 0,
      paid: 0,
      isPaid: false,
      includeInContingency: true,
      notes: "",
      type: itemType,
    };

    const itemsKey = `${type}Items`;
    const updatedData = {
      ...budgetData,
      [itemsKey]: [...(budgetData[itemsKey] || []), newItem],
    };
    setBudgetData(updatedData);
    if (onSyncBudgetData) {
      onSyncBudgetData(updatedData);
    }

    setEditingItem(newItem);
    setEditingType(type);
  };

  // Add stock category
  const addStockCategory = (stockItem, type) => {
    const newId = `${type}_${Date.now()}`;
    const newItem = {
      id: newId,
      code: stockItem.code,
      category: stockItem.category,
      name: "",
      characterName: stockItem.type === "cast" ? "" : undefined,
      prepDays: stockItem.type === "personnel" ? 0 : undefined,
      quantity: stockItem.type === "non-personnel" ? 1 : undefined,
      days:
        stockItem.type !== "non-personnel"
          ? stockItem.type === "personnel"
            ? budgetData.projectInfo?.shootingDays || 0
            : ""
          : undefined,
      rateType: stockItem.rateType,
      rate: 0,
      prepaidExpenses: 0,
      budgetAmount: 0,
      paid: 0,
      isPaid: false,
      includeInContingency: true,
      notes: "",
      type: stockItem.type,
    };

    const itemsKey = `${type}Items`;
    const updatedData = {
      ...budgetData,
      [itemsKey]: [...(budgetData[itemsKey] || []), newItem],
    };
    setBudgetData(updatedData);
    if (onSyncBudgetData) {
      onSyncBudgetData(updatedData);
    }
  };

  // Update budget item
  const updateBudgetItem = (type, itemId, field, value) => {
    setBudgetData((prev) => {
      const itemsKey = `${type}Items`;
      const items = prev[itemsKey] || [];
      const updatedItems = items.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };

          // Auto-calculate budget amount when rate, days, prepDays, kitFee, or quantity changes
          if (
            field === "rate" ||
            field === "days" ||
            field === "prepDays" ||
            field === "kitFee" ||
            field === "quantity" ||
            field === "rateType"
          ) {
            const rate = parseFloat(updatedItem.rate) || 0;
            const days = parseFloat(updatedItem.days) || 0;
            const prepDays = parseFloat(updatedItem.prepDays) || 0;
            const kitFee = parseFloat(updatedItem.kitFee) || 0;
            const quantity = parseFloat(updatedItem.quantity) || 1;
            const prepaid = parseFloat(updatedItem.prepaidExpenses) || 0;
            const itemType = updatedItem.type || "personnel";

            // Non-personnel items use quantity instead of days
            if (itemType === "non-personnel") {
              if (updatedItem.rateType === "Flat") {
                updatedItem.budgetAmount = rate * quantity + prepaid;
              } else {
                // Daily, Weekly, etc. - quantity is the number of days/weeks
                updatedItem.budgetAmount = rate * quantity + prepaid;
              }
            } else {
              // Original personnel/cast logic
              if (updatedItem.rateType === "Flat") {
                updatedItem.budgetAmount = rate + kitFee + prepaid;
              } else if (updatedItem.rateType === "Daily - Whole Show") {
                const shootingDays = prev.projectInfo?.shootingDays || 0;
                updatedItem.budgetAmount =
                  rate * shootingDays + rate * prepDays + kitFee + prepaid;
              } else {
                // Daily, Weekly, etc.
                updatedItem.budgetAmount =
                  rate * days + rate * prepDays + kitFee + prepaid;
              }
            }

            updatedItem.unpaid =
              updatedItem.budgetAmount - (parseFloat(updatedItem.paid) || 0);
          }

          // Update unpaid when paid amount changes
          if (field === "paid") {
            updatedItem.unpaid =
              updatedItem.budgetAmount - parseFloat(value || 0);
          }

          return updatedItem;
        }
        return item;
      });

      return {
        ...prev,
        [itemsKey]: updatedItems,
      };
    });
  };

  // Debounced sync
  const debouncedSyncRef = React.useRef(null);

  // Debounced sync removed - prevents infinite realtime loops
  // Sync only happens on explicit user actions (add, edit, delete, etc.)

  // Manual sync handler for blur
  const handleBlur = () => {
    // Clear debounce and sync immediately
    if (debouncedSyncRef.current) {
      clearTimeout(debouncedSyncRef.current);
    }
    if (onSyncBudgetData) {
      onSyncBudgetData(budgetData);
    }
  };

  // Delete budget item
  const deleteBudgetItem = (type, itemId) => {
    const itemsKey = `${type}Items`;
    const updatedData = {
      ...budgetData,
      [itemsKey]: (budgetData[itemsKey] || []).filter(
        (item) => item.id !== itemId
      ),
    };
    setBudgetData(updatedData);
    if (onSyncBudgetData) {
      onSyncBudgetData(updatedData);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, item, type) => {
    setDraggedItem(item);
    setDraggedType(type);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, dropIndex, type) => {
    e.preventDefault();

    if (!draggedItem || draggedType !== type) return;

    setBudgetData((prev) => {
      const itemsKey = `${type}Items`;
      const items = prev[itemsKey] || [];
      const draggedIndex = items.findIndex(
        (item) => item.id === draggedItem.id
      );

      if (draggedIndex === -1 || draggedIndex === dropIndex) return prev;

      const newItems = [...items];
      const [removed] = newItems.splice(draggedIndex, 1);
      newItems.splice(dropIndex, 0, removed);

      const updatedData = {
        ...prev,
        [itemsKey]: newItems,
      };

      if (onSyncBudgetData) {
        onSyncBudgetData(updatedData);
      }

      return updatedData;
    });

    setDraggedItem(null);
    setDraggedType(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedType(null);
  };

  // Render budget item row
  const renderBudgetItem = (item, index, type) => {
    const isEven = index % 2 === 0;
    const backgroundColor = isEven ? "#E3F2FD" : "#FFE0E0";
    const itemType = item.type || "personnel";

    // Different grid layouts based on item type
    let gridColumns, headerCells;

    if (itemType === "cast") {
      gridColumns =
        "80px 120px 120px 120px 80px 60px 80px 80px 65px 80px 60px 60px 120px 40px";
      headerCells = [
        "Code",
        "Category",
        "Character",
        "Actor Name",
        "Union",
        "Days",
        "Type",
        "Rate",
        "Budget",
        "Paid",
        "Unpaid",
        "Contingency",
        "Notes",
        "Del",
      ];
    } else if (itemType === "personnel") {
      gridColumns =
        "80px 150px 160px 60px 70px 80px 80px 60px 65px 80px 60px 60px 120px 40px";
      headerCells = [
        "Code",
        "Category",
        "Name",
        "Prep Days",
        "Shoot Days",
        "Type",
        "Rate",
        "Kit Fee",
        "Budget",
        "Paid",
        "Unpaid",
        "Contingency",
        "Notes",
        "Del",
      ];
    } else {
      // non-personnel
      gridColumns =
        "80px 160px 300px 60px 80px 80px 65px 80px 60px 60px 120px 40px";
      headerCells = [
        "Code",
        "Category",
        "Description",
        "Qty",
        "Type",
        "Rate",
        "Budget",
        "Paid",
        "Unpaid",
        "Contingency",
        "Notes",
        "Del",
      ];
    }

    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item, type)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, index, type)}
        onDragEnd={handleDragEnd}
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gap: "4px",
          padding: "3px 4px",
          backgroundColor:
            draggedItem?.id === item.id ? "#ffeb3b" : backgroundColor,
          alignItems: "center",
          fontSize: "11px",
          borderBottom: "1px solid #ddd",
          cursor: "move",
          transition: "background-color 0.2s ease",
        }}
      >
        <input
          type="text"
          value={item.code || ""}
          onChange={(e) =>
            updateBudgetItem(type, item.id, "code", e.target.value)
          }
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.target.blur();
            }
          }}
          style={{ padding: "2px", fontSize: "10px", border: "1px solid #ccc" }}
          placeholder="Code"
        />
        <input
          type="text"
          value={item.category || ""}
          onChange={(e) =>
            updateBudgetItem(type, item.id, "category", e.target.value)
          }
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.target.blur();
            }
          }}
          style={{ padding: "2px", fontSize: "10px", border: "1px solid #ccc" }}
          placeholder="Category"
        />

        {itemType === "cast" ? (
          <>
            <input
              type="text"
              value={item.characterName || ""}
              onChange={(e) =>
                updateBudgetItem(type, item.id, "characterName", e.target.value)
              }
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.target.blur();
                }
              }}
              style={{
                padding: "2px",
                fontSize: "10px",
                border: "1px solid #ccc",
              }}
              placeholder="Character"
            />
            <input
              type="text"
              value={item.name || ""}
              onChange={(e) =>
                updateBudgetItem(type, item.id, "name", e.target.value)
              }
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.target.blur();
                }
              }}
              style={{
                padding: "2px",
                fontSize: "10px",
                border: "1px solid #ccc",
              }}
              placeholder="Actor Name"
            />
            <select
              value={item.unionStatus || ""}
              onChange={(e) =>
                updateBudgetItem(type, item.id, "unionStatus", e.target.value)
              }
              onBlur={handleBlur}
              style={{
                padding: "2px",
                fontSize: "10px",
                border: "1px solid #ccc",
              }}
            >
              <option value="">Non-Union</option>
              <option value="SAG-AFTRA">SAG-AFTRA</option>
              <option value="ACTRA">ACTRA</option>
              <option value="Equity">Equity</option>
              <option value="IATSE">IATSE</option>
              <option value="DGA">DGA</option>
              <option value="WGA">WGA</option>
            </select>
          </>
        ) : (
          <input
            type="text"
            value={item.name || ""}
            onChange={(e) =>
              updateBudgetItem(type, item.id, "name", e.target.value)
            }
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.target.blur();
              }
            }}
            style={{
              padding: "2px",
              fontSize: "10px",
              border: "1px solid #ccc",
            }}
            placeholder={itemType === "non-personnel" ? "Description" : "Name"}
          />
        )}

        {itemType === "personnel" && (
          <input
            type="number"
            value={item.prepDays || ""}
            onChange={(e) =>
              updateBudgetItem(type, item.id, "prepDays", e.target.value)
            }
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.target.blur();
              }
            }}
            style={{
              padding: "2px",
              fontSize: "10px",
              border: "1px solid #ccc",
              backgroundColor: item.isPaid ? "#f5f5f5" : "white",
              color: item.isPaid ? "#999" : "black",
            }}
            placeholder="Prep"
            disabled={item.isPaid}
          />
        )}

        {itemType === "non-personnel" ? (
          <input
            type="number"
            value={item.quantity || 1}
            onChange={(e) =>
              updateBudgetItem(type, item.id, "quantity", e.target.value)
            }
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.target.blur();
              }
            }}
            style={{
              padding: "2px",
              fontSize: "10px",
              border: "1px solid #ccc",
            }}
            placeholder="Qty"
          />
        ) : (
          <input
            type="number"
            value={item.days || ""}
            onChange={(e) =>
              updateBudgetItem(type, item.id, "days", e.target.value)
            }
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.target.blur();
              }
            }}
            style={{
              padding: "2px",
              fontSize: "10px",
              border: "1px solid #ccc",
              backgroundColor: item.isPaid ? "#f5f5f5" : "white",
              color: item.isPaid ? "#999" : "black",
            }}
            placeholder={itemType === "personnel" ? "Shoot" : "Days"}
            disabled={item.isPaid}
          />
        )}

        <select
          value={item.rateType || "Daily"}
          onChange={(e) =>
            updateBudgetItem(type, item.id, "rateType", e.target.value)
          }
          onBlur={handleBlur}
          style={{
            padding: "2px",
            fontSize: "10px",
            border: "1px solid #ccc",
            backgroundColor: item.isPaid ? "#f5f5f5" : "white",
            color: item.isPaid ? "#999" : "black",
          }}
          disabled={item.isPaid}
        >
          <option value="Daily">Daily</option>
          <option value="Daily - Whole Show">Daily - Whole Show</option>
          <option value="Flat">Flat</option>
          <option value="Weekly">Weekly</option>
        </select>
        <input
          type="number"
          value={item.rate || ""}
          onChange={(e) =>
            updateBudgetItem(type, item.id, "rate", e.target.value)
          }
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.target.blur();
            }
          }}
          style={{
            padding: "2px",
            fontSize: "10px",
            border: "1px solid #ccc",
            backgroundColor: item.isPaid ? "#f5f5f5" : "white",
            color: item.isPaid ? "#999" : "black",
          }}
          placeholder="Rate"
          disabled={item.isPaid}
        />
        {itemType === "personnel" && (
          <input
            type="number"
            value={item.kitFee || ""}
            onChange={(e) =>
              updateBudgetItem(type, item.id, "kitFee", e.target.value)
            }
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.target.blur();
              }
            }}
            style={{
              padding: "2px",
              fontSize: "10px",
              border: "1px solid #ccc",
              backgroundColor:
                item.isPaid ||
                ![
                  "BEAUTY MAKEUP ARTIST",
                  "SPECIAL FX MAKEUP ARTIST",
                  "HAIR STYLIST",
                ].includes(item.category)
                  ? "#f5f5f5"
                  : "white",
              color:
                item.isPaid ||
                ![
                  "BEAUTY MAKEUP ARTIST",
                  "SPECIAL FX MAKEUP ARTIST",
                  "HAIR STYLIST",
                ].includes(item.category)
                  ? "#999"
                  : "black",
            }}
            placeholder={
              [
                "BEAUTY MAKEUP ARTIST",
                "SPECIAL FX MAKEUP ARTIST",
                "HAIR STYLIST",
              ].includes(item.category)
                ? "Kit Fee"
                : "N/A"
            }
            disabled={
              item.isPaid ||
              ![
                "BEAUTY MAKEUP ARTIST",
                "SPECIAL FX MAKEUP ARTIST",
                "HAIR STYLIST",
              ].includes(item.category)
            }
          />
        )}
        <div style={{ textAlign: "left", fontWeight: "bold" }}>
          ${(item.budgetAmount || 0).toLocaleString()}
        </div>
        <input
          type="number"
          value={item.paid || ""}
          onChange={(e) =>
            updateBudgetItem(type, item.id, "paid", e.target.value)
          }
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.target.blur();
            }
          }}
          style={{ padding: "2px", fontSize: "10px", border: "1px solid #ccc" }}
          placeholder="Paid"
        />
        <div style={{ textAlign: "left", fontWeight: "bold" }}>
          ${((item.budgetAmount || 0) - (item.paid || 0)).toLocaleString()}
        </div>
        <input
          type="checkbox"
          checked={item.includeInContingency !== false}
          onChange={(e) => {
            updateBudgetItem(
              type,
              item.id,
              "includeInContingency",
              e.target.checked
            );
            handleBlur();
          }}
          style={{
            transform: "scale(1.2)",
            cursor: "pointer",
          }}
        />
        <input
          type="text"
          value={item.notes || ""}
          onChange={(e) =>
            updateBudgetItem(type, item.id, "notes", e.target.value)
          }
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.target.blur();
            }
          }}
          style={{
            padding: "2px",
            fontSize: "10px",
            border: "1px solid #ccc",
            backgroundColor: "white",
          }}
          placeholder="Notes"
        />
        <button
          onClick={() => deleteBudgetItem(type, item.id)}
          style={{
            width: "24px",
            height: "24px",
            fontSize: "12px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "3px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>
    );
  };

  // Render department header with budget tracking for all departments
  const renderDepartmentHeader = (
    departmentName,
    departmentItems = null,
    sectionType = null,
    budgetType = null
  ) => {
    const showDropdown = sectionType === "btl" && departmentItems;

    // Calculate department spending for non-personnel items
    const calculateDepartmentSpending = (deptName, budgetSection) => {
      const itemsKey = `${budgetSection}Items`;
      const items = budgetData[itemsKey] || [];

      // Find items that belong to this department and are non-personnel
      let departmentItems = [];
      if (budgetSection === "btl") {
        const deptConfig = btlDepartments[deptName];
        if (deptConfig) {
          const allStockItems = [];
          if (Array.isArray(deptConfig)) {
            allStockItems.push(...deptConfig);
          } else if (deptConfig && typeof deptConfig === "object") {
            Object.values(deptConfig).forEach((subItems) => {
              if (Array.isArray(subItems)) {
                allStockItems.push(...subItems);
              }
            });
          }

          departmentItems = items.filter(
            (item) =>
              item.type === "non-personnel" &&
              allStockItems.some(
                (stockItem) => stockItem.category === item.category
              )
          );
        }
      } else if (budgetSection === "atl") {
        const deptConfig = atlDepartments[deptName];
        if (deptConfig) {
          departmentItems = items.filter(
            (item) =>
              item.type === "non-personnel" &&
              deptConfig.some(
                (stockItem) => stockItem.category === item.category
              )
          );
        }
      }

      return departmentItems.reduce(
        (sum, item) => sum + (item.budgetAmount || 0),
        0
      );
    };

    // Get department budget
    const budgetKey = `departmentBudgets`;
    const departmentBudgets = budgetData[budgetKey] || {};
    const departmentBudget =
      departmentBudgets[`${budgetType}_${departmentName}`] || 0;
    const departmentSpending = calculateDepartmentSpending(
      departmentName,
      budgetType
    );
    const remainingBudget = departmentBudget - departmentSpending;
    const isOverBudget = remainingBudget < 0;

    return (
      <div
        style={{
          backgroundColor: "#e0e0e0",
          color: "#333",
          padding: budgetType ? "4px 10px" : "12px 10px",
          fontWeight: "bold",
          fontSize: "12px",
          marginTop: "10px",
          marginBottom: "5px",
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        {budgetType && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "10px",
              position: "absolute",
              left: "10px",
            }}
          >
            <span>Budget:</span>
            <input
              type="number"
              value={departmentBudget || ""}
              onChange={(e) => {
                const newBudget = parseFloat(e.target.value) || 0;
                const updatedData = {
                  ...budgetData,
                  departmentBudgets: {
                    ...budgetData.departmentBudgets,
                    [`${budgetType}_${departmentName}`]: newBudget,
                  },
                };
                setBudgetData(updatedData);
                if (onSyncBudgetData) {
                  onSyncBudgetData(updatedData);
                }
              }}
              style={{
                width: "80px",
                padding: "2px",
                fontSize: "10px",
                border: "1px solid #ccc",
                borderRadius: "3px",
              }}
              placeholder="Budget"
            />
            <span>Spent: ${departmentSpending.toLocaleString()}</span>
            <span
              style={{
                color: isOverBudget ? "#d32f2f" : "#2e7d32",
                fontWeight: "bold",
              }}
            >
              Remaining: ${Math.abs(remainingBudget).toLocaleString()}
              {isOverBudget ? " OVER" : ""}
            </span>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {departmentName}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginLeft: "auto",
          }}
        >
          {showDropdown && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  try {
                    const parts = e.target.value.split("|");
                    let stockItem = null;

                    if (parts.length === 3) {
                      const [dept, subDept, code] = parts;
                      if (subDept === "direct") {
                        stockItem = departmentItems.find(
                          (item) => item.code === code
                        );
                      } else {
                        const subDeptItems = departmentItems[subDept];
                        if (Array.isArray(subDeptItems)) {
                          stockItem = subDeptItems.find(
                            (item) => item.code === code
                          );
                        }
                      }
                    }

                    if (stockItem) {
                      addStockCategory(stockItem, "btl");
                    }
                    e.target.value = "";
                  } catch (error) {
                    console.error("Error adding BTL department stock:", error);
                  }
                }
              }}
              style={{
                width: "120px",
                padding: "2px 4px",
                fontSize: "10px",
                border: "1px solid #ccc",
                borderRadius: "3px",
                backgroundColor: "white",
                appearance: "none",
                backgroundImage:
                  'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><polygon fill="%23666" points="6,8 2,4 10,4"/></svg>\')',
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 4px center",
                paddingRight: "20px",
              }}
            >
              <option value="">Add Stock Item</option>
              {Array.isArray(departmentItems)
                ? departmentItems.map((item) => (
                    <option
                      key={item.code}
                      value={`${departmentName}|direct|${item.code}`}
                    >
                      {item.code} - {item.category}
                    </option>
                  ))
                : Object.entries(departmentItems).map(
                    ([subDeptName, subItems]) =>
                      subItems.map((item) => (
                        <option
                          key={item.code}
                          value={`${departmentName}|${subDeptName}|${item.code}`}
                        >
                          {item.code} - {item.category}
                        </option>
                      ))
                  )}
            </select>
          )}
        </div>
      </div>
    );
  };

  // Render column header based on item type
  const renderColumnHeader = (itemType) => {
    let gridColumns, headerLabels;

    if (itemType === "cast") {
      gridColumns =
        "80px 120px 120px 120px 80px 60px 80px 80px 65px 80px 60px 60px 120px 40px";
      headerLabels = [
        "Code",
        "Category",
        "Character",
        "Actor Name",
        "Union",
        "Days",
        "Type",
        "Rate",
        "Budget",
        "Paid",
        "Unpaid",
        "Contingency",
        "Notes",
        "",
      ];
    } else if (itemType === "personnel") {
      gridColumns =
        "80px 150px 160px 60px 70px 80px 80px 60px 65px 80px 60px 60px 120px 40px";
      headerLabels = [
        "Code",
        "Category",
        "Name",
        "Prep Days",
        "Shoot Days",
        "Type",
        "Rate",
        "Kit Fee",
        "Budget",
        "Paid",
        "Unpaid",
        "Contingency",
        "Notes",
        "",
      ];
    } else {
      // non-personnel
      gridColumns =
        "80px 160px 300px 60px 80px 80px 65px 80px 60px 60px 120px 40px";
      headerLabels = [
        "Code",
        "Category",
        "Description",
        "Qty",
        "Type",
        "Rate",
        "Budget",
        "Paid",
        "Unpaid",
        "Contingency",
        "Notes",
        "",
      ];
    }

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gap: "4px",
          padding: "6px 4px",
          backgroundColor: "#f0f0f0",
          fontWeight: "bold",
          fontSize: "11px",
          borderBottom: "2px solid #ddd",
        }}
      >
        {headerLabels.map((label, index) => (
          <div key={index}>{label}</div>
        ))}
      </div>
    );
  };

  // Render additional category sections
  const renderAdditionalCategorySection = (
    categoryName,
    categoryData,
    total,
    expanded,
    setExpanded,
    type
  ) => {
    return (
      <div style={{ marginBottom: "20px" }}>
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            backgroundColor: "#e8e8ff",
            padding: "10px",
            cursor: "pointer",
            borderBottom: "1px solid #ddd",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
          }}
        >
          <span>
            {expanded ? "▼" : "▶"} {categoryName} - ${total.toLocaleString()}
          </span>
          <div>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  try {
                    const parts = e.target.value.split("|");
                    let stockItem = null;

                    console.log(`${type} dropdown selection:`, parts);

                    if (parts.length === 3) {
                      const [dept, subDept, code] = parts;
                      if (subDept === "direct") {
                        // Direct array items
                        const deptItems = categoryData[dept];
                        if (Array.isArray(deptItems)) {
                          stockItem = deptItems.find(
                            (item) => item.code === code
                          );
                        }
                      } else {
                        // Nested structure
                        const subDeptItems = categoryData[dept]?.[subDept];
                        if (Array.isArray(subDeptItems)) {
                          stockItem = subDeptItems.find(
                            (item) => item.code === code
                          );
                        }
                      }

                      console.log(`${type} stock item lookup:`, {
                        dept,
                        subDept,
                        code,
                        stockItem,
                      });
                    }

                    if (stockItem) {
                      console.log(`Adding ${type} stock item:`, stockItem);
                      addStockCategory(stockItem, type);
                    } else {
                      console.log(`${type} stock item not found:`, parts);
                    }
                    e.target.value = "";
                  } catch (error) {
                    console.error(
                      `Error adding ${type} stock category:`,
                      error
                    );
                  }
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: "4px",
                fontSize: "12px",
                border: "1px solid #ccc",
                borderRadius: "3px",
              }}
            >
              <option value="">Add Stock Category</option>
              {Object.entries(categoryData).map(([deptName, items]) => (
                <optgroup key={deptName} label={deptName}>
                  {Array.isArray(items)
                    ? items.map((item) => (
                        <option
                          key={item.code}
                          value={`${deptName}|direct|${item.code}`}
                        >
                          {item.code} - {item.category}
                        </option>
                      ))
                    : Object.entries(items).map(([subDeptName, subItems]) =>
                        subItems.map((item) => (
                          <option
                            key={item.code}
                            value={`${deptName}|${subDeptName}|${item.code}`}
                          >
                            {item.code} - {item.category}
                          </option>
                        ))
                      )}
                </optgroup>
              ))}
            </select>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addBudgetItem(type);
              }}
              style={{
                padding: "4px 8px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
                marginLeft: "5px",
              }}
            >
              Add Custom
            </button>
          </div>
        </div>

        {expanded && (
          <div>
            {/* Render departments for this category */}
            {Object.entries(categoryData).map(([departmentName, items]) => {
              const itemsKey = `${type}Items`;

              // Flatten nested structure to get all stock items for this department
              const allStockItems = [];
              if (Array.isArray(items)) {
                allStockItems.push(...items);
              } else if (items && typeof items === "object") {
                Object.values(items).forEach((subItems) => {
                  if (Array.isArray(subItems)) {
                    allStockItems.push(...subItems);
                  }
                });
              }

              const departmentItems = (budgetData[itemsKey] || []).filter(
                (item) =>
                  allStockItems.some(
                    (stockItem) => stockItem.category === item.category
                  )
              );

              // Group items by type for proper headers
              const itemsByType = departmentItems.reduce((acc, item) => {
                const itemType = item.type || "personnel";
                if (!acc[itemType]) acc[itemType] = [];
                acc[itemType].push(item);
                return acc;
              }, {});

              return (
                <div key={departmentName}>
                  {renderDepartmentHeader(departmentName)}

                  {Object.entries(itemsByType).map(([itemType, typeItems]) => (
                    <div key={itemType}>
                      {renderColumnHeader(itemType)}
                      {typeItems.map((item, index) =>
                        renderBudgetItem(item, index, type)
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Custom items not in stock categories */}
            {(() => {
              const itemsKey = `${type}Items`;

              // Flatten all stock items from categoryData properly
              const allStockItems = [];
              Object.values(categoryData).forEach((items) => {
                if (Array.isArray(items)) {
                  allStockItems.push(...items);
                } else if (items && typeof items === "object") {
                  Object.values(items).forEach((subItems) => {
                    if (Array.isArray(subItems)) {
                      allStockItems.push(...subItems);
                    }
                  });
                }
              });

              const customItems = (budgetData[itemsKey] || []).filter(
                (item) =>
                  !allStockItems.some(
                    (stockItem) => stockItem.category === item.category
                  )
              );

              if (customItems.length > 0) {
                const itemsByType = customItems.reduce((acc, item) => {
                  const itemType = item.type || "personnel";
                  if (!acc[itemType]) acc[itemType] = [];
                  acc[itemType].push(item);
                  return acc;
                }, {});

                return (
                  <div>
                    {renderDepartmentHeader("CUSTOM ITEMS")}
                    {Object.entries(itemsByType).map(
                      ([itemType, typeItems]) => (
                        <div key={itemType}>
                          {renderColumnHeader(itemType)}
                          {typeItems.map((item, index) =>
                            renderBudgetItem(item, index, type)
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        height: "calc(100vh - 44px)",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Module Header */}
      <div
        style={{
          backgroundColor: "#f5f5f5",
          padding: "10px",
          borderBottom: "2px solid #ddd",
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px" }}>Budget Planning</h2>
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "22px",
            fontWeight: "bold",
          }}
        >
          Total Budget: ${grandTotal.toLocaleString()}
        </div>
        <div>
          <button
            onClick={() => setShowProjectSettings(true)}
            style={{
              padding: "8px 16px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Project Settings
          </button>
        </div>
      </div>
      {/* Budget Summary */}
      <div
        style={{
          padding: "10px",
          backgroundColor: "#fafafa",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>
            <strong>
              Contingency ({budgetData.contingencyPercentage || 10}% - $
              {contingencyAmount.toLocaleString()}):
            </strong>
          </span>
          <button
            onClick={() => setShowContingencySettings(true)}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              border: "1px solid #ccc",
              backgroundColor: "#f5f5f5",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
          >
            ⚙
          </button>
        </div>
        <div style={{ paddingRight: "20px" }}>
          <strong>Paid:</strong> ${paidTotal.toLocaleString()}
        </div>
      </div>

      {/* Production Schedule Section */}
      <div
        style={{
          padding: "15px",
          backgroundColor: "#f9f9f9",
          border: "1px solid #ddd",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "20px",
            alignItems: "center",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
                color: "#333",
              }}
            >
              Prep Period (weeks):
            </label>
            <input
              type="number"
              min="0"
              value={budgetData.projectInfo?.prepPeriod || 0}
              onChange={(e) => {
                setBudgetData((prev) => {
                  const updatedData = {
                    ...prev,
                    projectInfo: {
                      ...prev.projectInfo,
                      prepPeriod: parseInt(e.target.value) || 0,
                    },
                  };
                  if (onSyncBudgetData) {
                    onSyncBudgetData(updatedData);
                  }
                  return updatedData;
                });
              }}
              style={{
                width: "100%",
                padding: "6px",
                border: "1px solid #ccc",
                borderRadius: "3px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
                color: "#333",
              }}
            >
              Shooting Days:
            </label>
            <input
              type="number"
              min="1"
              value={budgetData.projectInfo?.shootingDays || 0}
              onChange={(e) => {
                setBudgetData((prev) => {
                  const updatedData = {
                    ...prev,
                    projectInfo: {
                      ...prev.projectInfo,
                      shootingDays: parseInt(e.target.value) || 0,
                    },
                  };
                  if (onSyncBudgetData) {
                    onSyncBudgetData(updatedData);
                  }
                  return updatedData;
                });
              }}
              style={{
                width: "100%",
                padding: "6px",
                border: "1px solid #ccc",
                borderRadius: "3px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
                color: "#333",
              }}
            >
              Pickup Days:
            </label>
            <input
              type="text"
              value={budgetData.projectInfo?.pickupDays || ""}
              onChange={(e) => {
                setBudgetData((prev) => {
                  const updatedData = {
                    ...prev,
                    projectInfo: {
                      ...prev.projectInfo,
                      pickupDays: e.target.value,
                    },
                  };
                  if (onSyncBudgetData) {
                    onSyncBudgetData(updatedData);
                  }
                  return updatedData;
                });
              }}
              style={{
                width: "100%",
                padding: "6px",
                border: "1px solid #ccc",
                borderRadius: "3px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
              placeholder="e.g., TBD or 2"
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
                fontSize: "12px",
                color: "#333",
              }}
            >
              Post Weeks:
            </label>
            <input
              type="number"
              min="0"
              value={budgetData.projectInfo?.postWeeks || 0}
              onChange={(e) => {
                setBudgetData((prev) => {
                  const updatedData = {
                    ...prev,
                    projectInfo: {
                      ...prev.projectInfo,
                      postWeeks: parseInt(e.target.value) || 0,
                    },
                  };
                  if (onSyncBudgetData) {
                    onSyncBudgetData(updatedData);
                  }
                  return updatedData;
                });
              }}
              style={{
                width: "100%",
                padding: "6px",
                border: "1px solid #ccc",
                borderRadius: "3px",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {/* ATL Section */}
      <div style={{ marginBottom: "20px" }}>
        <div
          onClick={() => setAtlExpanded(!atlExpanded)}
          style={{
            backgroundColor: "#e8f5e8",
            padding: "3px 10px",
            cursor: "pointer",
            borderBottom: "1px solid #ddd",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
          }}
        >
          <span>
            {atlExpanded ? "▼" : "▶"} Above The Line (ATL) - $
            {atlTotal.toLocaleString()}
          </span>
          <div>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  try {
                    const [dept, code] = e.target.value.split("|");
                    const stockItem = atlDepartments[dept]?.find(
                      (item) => item.code === code
                    );
                    if (stockItem) {
                      addStockCategory(stockItem, "atl");
                    }
                    e.target.value = "";
                  } catch (error) {
                    console.error("Error adding ATL stock category:", error);
                  }
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                padding: "4px",
                fontSize: "12px",
                border: "1px solid #ccc",
                borderRadius: "3px",
              }}
            >
              <option value="">Add Stock Category</option>
              {Object.entries(atlDepartments).map(([deptName, items]) => (
                <optgroup key={deptName} label={deptName}>
                  {items.map((item) => (
                    <option key={item.code} value={`${deptName}|${item.code}`}>
                      {item.code} - {item.category}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addBudgetItem("atl");
              }}
              style={{
                padding: "4px 8px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
                marginLeft: "5px",
              }}
            >
              Add Custom
            </button>
          </div>
        </div>

        {atlExpanded && (
          <div>
            {/* Render ATL departments */}
            {Object.entries(atlDepartments).map(([departmentName, items]) => {
              const departmentItems = (budgetData.atlItems || []).filter(
                (item) =>
                  items.some(
                    (stockItem) => stockItem.category === item.category
                  )
              );

              // Group items by type for proper headers
              const itemsByType = departmentItems.reduce((acc, item) => {
                const type = item.type || "personnel";
                if (!acc[type]) acc[type] = [];
                acc[type].push(item);
                return acc;
              }, {});

              return (
                <div key={departmentName}>
                  {renderDepartmentHeader(departmentName)}

                  {Object.entries(itemsByType).map(([itemType, typeItems]) => (
                    <div key={itemType}>
                      {renderColumnHeader(itemType)}
                      {typeItems.map((item, index) =>
                        renderBudgetItem(item, index, "atl")
                      )}
                    </div>
                  ))}

                  {/* Department Total */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "80px 120px 120px 120px 80px 60px 80px 80px 65px 80px 60px 60px 120px 40px",
                      gap: "4px",
                      padding: "6px 4px",
                      backgroundColor: "#e3f2fd",
                      fontWeight: "bold",
                      fontSize: "12px",
                      borderTop: "2px solid #2196F3",
                      borderBottom: "2px solid #2196F3",
                    }}
                  >
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div style={{ textAlign: "left", fontWeight: "bold" }}>
                      $
                      {departmentItems
                        .reduce(
                          (sum, item) => sum + (item.budgetAmount || 0),
                          0
                        )
                        .toLocaleString()}
                    </div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                  </div>

                  {/* Auto-generated Union Fee Rows - Only for CAST department */}
                  {departmentName === "CAST" &&
                    (() => {
                      // Calculate SAG totals
                      const sagActors = (budgetData.atlItems || []).filter(
                        (item) =>
                          item.type === "cast" &&
                          item.unionStatus === "SAG-AFTRA"
                      );

                      if (sagActors.length === 0) return null;

                      const sagTotalBudget = sagActors.reduce(
                        (sum, actor) => sum + (actor.budgetAmount || 0),
                        0
                      );
                      const agencyFees = Math.round(
                        sagTotalBudget * (editableAgencyRate / 100)
                      );
                      const bondAmount =
                        editableBondRate !== null
                          ? Math.round(
                              (sagTotalBudget + agencyFees) *
                                (editableBondRate / 100)
                            )
                          : Math.round(
                              (sagTotalBudget + agencyFees) *
                                (shootingDaysCount > 10 ? 0.4 : 1.0)
                            );

                      return (
                        <>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "80px 120px 120px 120px 80px 60px 80px 80px 65px 80px 60px 60px 120px 40px",
                              gap: "4px",
                              padding: "3px 4px",
                              backgroundColor: "#d32f2f",
                              color: "white",
                              alignItems: "center",
                              fontSize: "11px",
                              borderBottom: "1px solid #ddd",
                              fontWeight: "bold",
                            }}
                          >
                            <div>AUTO</div>
                            <div>AGENCY FEES</div>
                            <div>SAG Talent Agency Fees</div>
                            <div>Auto-generated</div>
                            <div>-</div>
                            <div>-</div>
                            <div>Auto</div>
                            <div
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                const newRate = prompt(
                                  "Enter agency fee percentage:",
                                  editableAgencyRate
                                );
                                if (newRate !== null && !isNaN(newRate)) {
                                  setEditableAgencyRate(parseFloat(newRate));
                                }
                              }}
                              onDoubleClick={() => setEditableAgencyRate(10)}
                              title="Click to edit, double-click to reset to 10%"
                            >
                              {editableAgencyRate}%
                            </div>
                            <div style={{ textAlign: "left" }}>
                              ${agencyFees.toLocaleString()}
                            </div>
                            <div>$0</div>
                            <div>☑</div>
                            <div>Auto-calculated</div>
                            <div>-</div>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "80px 120px 120px 120px 80px 60px 80px 80px 65px 80px 60px 60px 120px 40px",
                              gap: "4px",
                              padding: "3px 4px",
                              backgroundColor: "#d32f2f",
                              color: "white",
                              alignItems: "center",
                              fontSize: "11px",
                              borderBottom: "1px solid #ddd",
                              fontWeight: "bold",
                            }}
                          >
                            <div>124-00</div>
                            <div>SAG-AFTRA BOND</div>
                            <div>Union Bond Payment</div>
                            <div>Auto-generated</div>
                            <div>-</div>
                            <div>-</div>
                            <div>Auto</div>
                            <div
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                const currentRate =
                                  editableBondRate !== null
                                    ? editableBondRate
                                    : shootingDaysCount > 10
                                    ? 40
                                    : 100;
                                const newRate = prompt(
                                  `Enter bond fee percentage (currently ${currentRate}%):`,
                                  currentRate
                                );
                                if (newRate !== null && !isNaN(newRate)) {
                                  setEditableBondRate(parseFloat(newRate));
                                }
                              }}
                              onDoubleClick={() => setEditableBondRate(null)}
                              title="Click to edit, double-click to reset to auto"
                            >
                              {editableBondRate !== null
                                ? `${editableBondRate}%`
                                : shootingDaysCount > 10
                                ? "40%"
                                : "100%"}
                            </div>
                            <div style={{ textAlign: "left" }}>
                              ${bondAmount.toLocaleString()}
                            </div>
                            <div>$0</div>
                            <div>☑</div>
                            <div>Auto-calculated</div>
                            <div>-</div>
                          </div>
                        </>
                      );
                    })()}
                </div>
              );
            })}

            {/* Custom ATL Items not in stock categories */}
            {(() => {
              const customItems = (budgetData.atlItems || []).filter(
                (item) =>
                  !Object.values(atlDepartments)
                    .flat()
                    .some((stockItem) => stockItem.category === item.category)
              );

              if (customItems.length > 0) {
                const itemsByType = customItems.reduce((acc, item) => {
                  const type = item.type || "personnel";
                  if (!acc[type]) acc[type] = [];
                  acc[type].push(item);
                  return acc;
                }, {});

                return (
                  <div>
                    {renderDepartmentHeader("CUSTOM ITEMS")}
                    {Object.entries(itemsByType).map(
                      ([itemType, typeItems]) => (
                        <div key={itemType}>
                          {renderColumnHeader(itemType)}
                          {typeItems.map((item, index) =>
                            renderBudgetItem(item, index, "atl")
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>

      {/* BTL Section */}
      <div style={{ marginBottom: "20px" }}>
        <div
          onClick={() => setBtlExpanded(!btlExpanded)}
          style={{
            backgroundColor: "#fff3e0",
            padding: "10px",
            cursor: "pointer",
            borderBottom: "1px solid #ddd",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
          }}
        >
          <span>
            {btlExpanded ? "▼" : "▶"} Below The Line (BTL) - $
            {btlTotal.toLocaleString()}
          </span>
          <div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addBudgetItem("btl");
              }}
              style={{
                padding: "4px 8px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Add Custom
            </button>
          </div>
        </div>

        {btlExpanded && (
          <div>
            {/* Render BTL departments */}
            {Object.entries(btlDepartments).map(([departmentName, items]) => {
              // Flatten nested structure to get all stock items for this department
              const allStockItems = [];

              const flattenItems = (itemsToFlatten) => {
                if (Array.isArray(itemsToFlatten)) {
                  allStockItems.push(...itemsToFlatten);
                } else if (
                  itemsToFlatten &&
                  typeof itemsToFlatten === "object"
                ) {
                  Object.values(itemsToFlatten).forEach((subItems) => {
                    flattenItems(subItems); // Recursive call for deeper nesting
                  });
                }
              };

              flattenItems(items);

              const departmentItems = (budgetData.btlItems || []).filter(
                (item) =>
                  allStockItems.some(
                    (stockItem) => stockItem.category === item.category
                  )
              );

              // Group items by type for proper headers
              const itemsByType = departmentItems.reduce((acc, item) => {
                const type = item.type || "personnel";
                if (!acc[type]) acc[type] = [];
                acc[type].push(item);
                return acc;
              }, {});

              return (
                <div key={departmentName}>
                  {renderDepartmentHeader(departmentName, items, "btl", "btl")}

                  {Object.entries(itemsByType).map(([itemType, typeItems]) => (
                    <div key={itemType}>
                      {renderColumnHeader(itemType)}
                      {typeItems.map((item, index) =>
                        renderBudgetItem(item, index, "btl")
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Custom BTL Items not in stock categories */}
            {(() => {
              // Flatten all BTL stock items for comparison
              const allBTLStockItems = [];
              Object.values(btlDepartments).forEach((items) => {
                if (Array.isArray(items)) {
                  allBTLStockItems.push(...items);
                } else if (items && typeof items === "object") {
                  Object.values(items).forEach((subItems) => {
                    if (Array.isArray(subItems)) {
                      allBTLStockItems.push(...subItems);
                    }
                  });
                }
              });

              const customItems = (budgetData.btlItems || []).filter(
                (item) =>
                  !allBTLStockItems.some(
                    (stockItem) => stockItem.category === item.category
                  )
              );

              if (customItems.length > 0) {
                const itemsByType = customItems.reduce((acc, item) => {
                  const type = item.type || "personnel";
                  if (!acc[type]) acc[type] = [];
                  acc[type].push(item);
                  return acc;
                }, {});

                return (
                  <div>
                    {renderDepartmentHeader("CUSTOM ITEMS")}
                    {Object.entries(itemsByType).map(
                      ([itemType, typeItems]) => (
                        <div key={itemType}>
                          {renderColumnHeader(itemType)}
                          {typeItems.map((item, index) =>
                            renderBudgetItem(item, index, "btl")
                          )}
                        </div>
                      )
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>

      {/* Legal Section */}
      {renderAdditionalCategorySection(
        "Legal",
        legalDepartments,
        legalTotal,
        legalExpanded,
        setLegalExpanded,
        "legal"
      )}

      {/* Marketing, EPK, & PR Section */}
      {renderAdditionalCategorySection(
        "Marketing, EPK, & PR",
        additionalCategories["MARKETING, EPK, & PR"],
        marketingTotal,
        marketingExpanded,
        setMarketingExpanded,
        "marketing"
      )}

      {/* Post Production Section */}
      {renderAdditionalCategorySection(
        "Post Production",
        additionalCategories["POST PRODUCTION"],
        postTotal,
        postExpanded,
        setPostExpanded,
        "post"
      )}

      {/* Contingency Settings Modal */}
      {showContingencySettings && (
        <ContingencySettingsModal
          budgetData={budgetData}
          setBudgetData={setBudgetData}
          onClose={() => setShowContingencySettings(false)}
          atlTotal={atlTotal}
          btlTotal={btlTotal}
          legalTotal={legalTotal}
          marketingTotal={marketingTotal}
          postTotal={postTotal}
        />
      )}

      {/* Project Settings Modal - Complete Implementation */}
      {showProjectSettings && (
        <ProjectSettingsModal
          budgetData={budgetData}
          setBudgetData={setBudgetData}
          onClose={() => setShowProjectSettings(false)}
        />
      )}
    </div>
  );
}

export default BudgetModule;
