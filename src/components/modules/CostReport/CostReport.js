import React, { useState } from "react";

// Cost Report Module
function CostReport({
  costCategories,
  setCostCategories,
  costVendors,
  setCostVendors,
  scenes,
  shootingDays,
  castCrew,
  crewSortOrder,
  onSyncCostCategories,
  onSyncCostVendors,
  userRole,
  canEdit,
  isViewOnly,
}) {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#2196F3");
  const [newVendorName, setNewVendorName] = useState("");
  const [editingExpense, setEditingExpense] = useState(null);

  // Default crew sort order if not provided
  const defaultCrewSortOrder = [
    "Principal Crew",
    "Producer",
    "Production",
    "Camera",
    "G&E",
    "Art",
    "Wardrobe",
    "Makeup",
    "Sound",
    "Script",
    "Stunts",
    "BTS",
    "Transportation",
    "Craft Services",
    "Other",
  ];

  const sortOrder = crewSortOrder || defaultCrewSortOrder;

  // Organize crew by department
  const getOrganizedCrew = () => {
    const organizedCrew = {};

    sortOrder.forEach((dept) => {
      organizedCrew[dept] = castCrew.filter(
        (person) =>
          person.type === "crew" && (person.crewDepartment || "Other") === dept
      );
    });

    return organizedCrew;
  };

  // Calculate totals

  // Calculate totals
  const getCategoryTotal = (category) => {
    return category.expenses.reduce(
      (total, expense) =>
        total +
        (parseFloat(expense.cost) || 0) * (parseFloat(expense.quantity) || 1),
      0
    );
  };

  const getCategoryRemaining = (category) => {
    return category.budget - getCategoryTotal(category);
  };

  const getGrandTotal = () => {
    return costCategories.reduce(
      (total, category) => total + getCategoryTotal(category),
      0
    );
  };

  const getTotalBudget = () => {
    return costCategories.reduce(
      (total, category) => total + category.budget,
      0
    );
  };

  const getTotalRemaining = () => {
    return getTotalBudget() - getGrandTotal();
  };

  // Category management
  const addCategory = () => {
    if (!newCategoryName.trim()) return;

    const newCategory = {
      id: Date.now().toString(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
      expenses: [],
      budget: 0,
    };

    const updatedCategories = [...costCategories, newCategory];
    setCostCategories(updatedCategories);
    if (onSyncCostCategories) {
      onSyncCostCategories(updatedCategories);
    }
    setNewCategoryName("");
    setNewCategoryColor("#2196F3");
    setShowAddCategory(false);
  };

  const deleteCategory = (categoryId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this category and all its expenses?"
      )
    ) {
      const updatedCategories = costCategories.filter(
        (cat) => cat.id !== categoryId
      );
      setCostCategories(updatedCategories);
      if (onSyncCostCategories) {
        onSyncCostCategories(updatedCategories);
      }
    }
  };

  const updateCategoryBudget = (categoryId, budget) => {
    setCostCategories((prev) => {
      const updatedCategories = prev.map((cat) =>
        cat.id === categoryId
          ? { ...cat, budget: parseFloat(budget) || 0 }
          : cat
      );
      if (onSyncCostCategories) {
        onSyncCostCategories(updatedCategories);
      }
      return updatedCategories;
    });
  };

  // Expense management
  const addExpense = (categoryId) => {
    const newExpense = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      payment: "",
      vendor: "",
      purchaser: "",
      item: "",
      description: "",
      cost: 0,
      quantity: 1,
      scene: "",
      shootingDay: "",
      receipt: null,
    };

    setCostCategories((prev) => {
      const updatedCategories = prev.map((cat) =>
        cat.id === categoryId
          ? { ...cat, expenses: [...cat.expenses, newExpense] }
          : cat
      );
      if (onSyncCostCategories) {
        onSyncCostCategories(updatedCategories);
      }
      return updatedCategories;
    });
  };

  const updateExpense = (categoryId, expenseId, field, value) => {
    setCostCategories((prev) => {
      const updatedCategories = prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              expenses: cat.expenses.map((expense) =>
                expense.id === expenseId
                  ? {
                      ...expense,
                      [field]:
                        field === "cost" || field === "quantity"
                          ? parseFloat(value) || 0
                          : value,
                    }
                  : expense
              ),
            }
          : cat
      );
      if (onSyncCostCategories) {
        onSyncCostCategories(updatedCategories);
      }
      return updatedCategories;
    });
  };

  const deleteExpense = (categoryId, expenseId) => {
    setCostCategories((prev) => {
      const updatedCategories = prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              expenses: cat.expenses.filter(
                (expense) => expense.id !== expenseId
              ),
            }
          : cat
      );
      if (onSyncCostCategories) {
        onSyncCostCategories(updatedCategories);
      }
      return updatedCategories;
    });
  };

  // Vendor management
  const addVendor = () => {
    if (!newVendorName.trim() || costVendors.includes(newVendorName.trim()))
      return;

    const updatedVendors = [...costVendors, newVendorName.trim()];
    setCostVendors(updatedVendors);
    if (onSyncCostVendors) {
      onSyncCostVendors(updatedVendors);
    }
    setNewVendorName("");
    setShowAddVendor(false);
  };

  const deleteVendor = (vendorName) => {
    const updatedVendors = costVendors.filter(
      (vendor) => vendor !== vendorName
    );
    setCostVendors(updatedVendors);
    if (onSyncCostVendors) {
      onSyncCostVendors(updatedVendors);
    }
  };

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // Get scene options for dropdown
  const getSceneOptions = () => {
    return scenes.map((scene) => ({
      value: scene.sceneNumber,
      label: `Scene ${scene.sceneNumber}: ${scene.metadata?.location || ""}`,
    }));
  };

  // Get shooting day options for dropdown
  const getShootingDayOptions = () => {
    return shootingDays.map((day) => ({
      value: day.id,
      label: `Day ${day.dayNumber} - ${new Date(
        day.date
      ).toLocaleDateString()}`,
    }));
  };

  // Get initials from cast/crew member name
  const getPersonInitials = (personId) => {
    if (!personId) return "";
    const person = castCrew.find((p) => p.id === personId);
    if (!person) return "";

    const name = person.displayName || person.name || "";
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  };

  return (
    <div
      style={{
        padding: "20px",
        width: "100%",
        height: "calc(100vh - 40px)",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2>Cost Report</h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowAddCategory(true)}
            style={{
              backgroundColor: "#4CAF50",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            + Add Category
          </button>
          <button
            onClick={() => setShowAddVendor(true)}
            style={{
              backgroundColor: "#2196F3",
              color: "white",
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            + Add Vendor
          </button>
        </div>
      </div>

      {/* Summary Totals */}
      <div
        style={{
          display: "flex",
          gap: "20px",
          marginBottom: "30px",
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ textAlign: "center", minWidth: "120px" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
            TOTAL BUDGET
          </div>
          <div
            style={{ fontSize: "18px", fontWeight: "bold", color: "#2196F3" }}
          >
            ${getTotalBudget().toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: "center", minWidth: "120px" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
            SPENT
          </div>
          <div
            style={{ fontSize: "18px", fontWeight: "bold", color: "#4CAF50" }}
          >
            ${getGrandTotal().toFixed(2)}
          </div>
        </div>
        <div style={{ textAlign: "center", minWidth: "120px" }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
            REMAINING
          </div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: getTotalRemaining() < 0 ? "#F44336" : "#FF9800",
            }}
          >
            ${getTotalRemaining().toFixed(2)}
          </div>
        </div>
      </div>

      {/* Categories */}
      {costCategories.map((category) => (
        <div
          key={category.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            marginBottom: "0px",
            overflow: "hidden",
          }}
        >
          {/* Category Header */}
          <div
            onClick={() => toggleCategory(category.id)}
            style={{
              backgroundColor: category.color,
              color: "white",
              padding: "5px 15px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px", marginRight: "5px" }}>
                {expandedCategories[category.id] ? "▼" : "▶"}
              </span>
              <h3 style={{ margin: 0, fontSize: "14px" }}>{category.name}</h3>
              <span style={{ fontSize: "11px", opacity: 0.9 }}>
                ({category.expenses.length} items)
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <span>Budget: $</span>
                  <input
                    type="number"
                    step="0.01"
                    value={category.budget}
                    onChange={(e) =>
                      updateCategoryBudget(category.id, e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "70px",
                      padding: "2px 4px",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: "2px",
                      backgroundColor: "rgba(255,255,255,0.2)",
                      color: "white",
                      fontSize: "12px",
                    }}
                  />
                </div>
                <span>Spent: ${getCategoryTotal(category).toFixed(2)}</span>
                <span>
                  Remaining: ${getCategoryRemaining(category).toFixed(2)}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  addExpense(category.id);
                }}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                +
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCategory(category.id);
                }}
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "20px",
                  height: "20px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                ×
              </button>
            </div>
          </div>
          {/* Category Content */}
          {expandedCategories[category.id] && (
            <div style={{ padding: "15px 15px 3px 15px" }}>
              {/* Expenses Table Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "100px 80px 120px 60px 130px 130px 80px 60px 100px 100px 40px",
                  gap: "8px",
                  backgroundColor: category.color,
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "11px",
                  padding: "8px",
                  marginBottom: "1px",
                  opacity: 0.8,
                }}
              >
                <div>Date</div>
                <div>Payment</div>
                <div>Vendor</div>
                <div>Purchaser</div>
                <div>Description</div>
                <div>Scene</div>
                <div>Cost</div>
                <div>Qty</div>
                <div>Total</div>
                <div>Receipt</div>
                <div>Del</div>
              </div>

              {/* Expenses */}
              {category.expenses.map((expense, index) => (
                <div
                  key={expense.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "100px 80px 120px 60px 130px 130px 80px 60px 100px 100px 40px",
                    gap: "8px",
                    backgroundColor: index % 2 === 0 ? "#E3F2FD" : "#FFE0E0",
                    border: "1px solid #ddd",
                    fontSize: "12px",
                    padding: "3px",
                    marginBottom: "1px",
                    alignItems: "flex-start",
                  }}
                >
                  <input
                    type="date"
                    value={expense.date}
                    onChange={(e) =>
                      updateExpense(
                        category.id,
                        expense.id,
                        "date",
                        e.target.value
                      )
                    }
                    style={{
                      padding: "2px",
                      fontSize: "11px",
                      border: "1px solid #ddd",
                      borderRadius: "2px",
                    }}
                  />
                  <select
                    value={expense.payment || ""}
                    onChange={(e) =>
                      updateExpense(
                        category.id,
                        expense.id,
                        "payment",
                        e.target.value
                      )
                    }
                    style={{
                      padding: "2px",
                      fontSize: "11px",
                      border: "1px solid #ddd",
                      borderRadius: "2px",
                    }}
                  >
                    <option value="">Select...</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Check">Check</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Venmo">Venmo</option>
                    <option value="Other">Other</option>
                  </select>
                  <input
                    type="text"
                    value={expense.vendor}
                    onChange={(e) =>
                      updateExpense(
                        category.id,
                        expense.id,
                        "vendor",
                        e.target.value
                      )
                    }
                    placeholder="Vendor name"
                    style={{
                      padding: "2px",
                      fontSize: "11px",
                      border: "1px solid #ddd",
                      borderRadius: "2px",
                    }}
                  />
                  <select
                    value={expense.purchaser}
                    onChange={(e) =>
                      updateExpense(
                        category.id,
                        expense.id,
                        "purchaser",
                        e.target.value
                      )
                    }
                    style={{
                      padding: "2px",
                      fontSize: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "2px",
                      width: "100%",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    <option value="">--</option>
                    {Object.entries(getOrganizedCrew()).map(
                      ([department, departmentCrew]) => {
                        if (departmentCrew.length === 0) return null;

                        return (
                          <optgroup
                            key={department}
                            label={department.toUpperCase()}
                          >
                            {departmentCrew.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.displayName}
                              </option>
                            ))}
                          </optgroup>
                        );
                      }
                    )}
                  </select>
                  <input
                    type="text"
                    value={expense.description}
                    onChange={(e) =>
                      updateExpense(
                        category.id,
                        expense.id,
                        "description",
                        e.target.value
                      )
                    }
                    placeholder="Description"
                    style={{
                      padding: "2px",
                      fontSize: "11px",
                      border: "1px solid #ddd",
                      borderRadius: "2px",
                    }}
                  />
                  <select
                    value={expense.scene}
                    onChange={(e) =>
                      updateExpense(
                        category.id,
                        expense.id,
                        "scene",
                        e.target.value
                      )
                    }
                    style={{
                      padding: "2px",
                      fontSize: "11px",
                      border: "1px solid #ddd",
                      borderRadius: "2px",
                    }}
                  >
                    <option value="">Scene...</option>
                    {getSceneOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={expense.cost}
                    onChange={(e) =>
                      updateExpense(
                        category.id,
                        expense.id,
                        "cost",
                        e.target.value
                      )
                    }
                    style={{
                      padding: "2px",
                      fontSize: "11px",
                      border: "1px solid #ddd",
                      borderRadius: "2px",
                    }}
                  />
                  <input
                    type="number"
                    value={expense.quantity}
                    onChange={(e) =>
                      updateExpense(
                        category.id,
                        expense.id,
                        "quantity",
                        e.target.value
                      )
                    }
                    style={{
                      padding: "2px",
                      fontSize: "11px",
                      border: "1px solid #ddd",
                      borderRadius: "2px",
                    }}
                  />
                  <div style={{ fontWeight: "bold" }}>
                    $
                    {((expense.cost || 0) * (expense.quantity || 1)).toFixed(2)}
                  </div>
                  <button
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      backgroundColor: "#2196F3",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                    }}
                  >
                    📎
                  </button>
                  <button
                    onClick={() => deleteExpense(category.id, expense.id)}
                    style={{
                      backgroundColor: "#f44336",
                      color: "white",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      fontSize: "12px",
                      padding: "2px 4px",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Removed - Add Expense button now in header */}
            </div>
          )}
        </div>
      ))}

      {/* Add Category Modal */}
      {showAddCategory && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 999,
            }}
            onClick={() => setShowAddCategory(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              minWidth: "300px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Add New Category</h3>
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Category Name:
              </label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Color:
              </label>
              <input
                type="color"
                value={newCategoryColor}
                onChange={(e) => setNewCategoryColor(e.target.value)}
                style={{
                  width: "50px",
                  height: "30px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={addCategory}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Add Category
              </button>
              <button
                onClick={() => setShowAddCategory(false)}
                style={{
                  backgroundColor: "#ccc",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Vendor Modal */}
      {showAddVendor && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 999,
            }}
            onClick={() => setShowAddVendor(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "white",
              border: "2px solid #ccc",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              zIndex: 1000,
              minWidth: "300px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Add New Vendor</h3>
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                Vendor Name:
              </label>
              <input
                type="text"
                value={newVendorName}
                onChange={(e) => setNewVendorName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "3px",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={addVendor}
                style={{
                  backgroundColor: "#2196F3",
                  color: "white",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Add Vendor
              </button>
              <button
                onClick={() => setShowAddVendor(false)}
                style={{
                  backgroundColor: "#ccc",
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ADD THIS AS THE LAST LINE:
export default CostReport;
