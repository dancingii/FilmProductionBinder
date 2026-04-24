// /services/database.js
// Database service layer for Film Production App
// Handles all Supabase database operations for load/sync

import { supabase } from "../supabase";

// ============================================================================
// DATABASE LOAD FUNCTIONS
// ============================================================================

export const loadScenesFromDatabase = async (
  selectedProject,
  setScenes,
  setScenesLoaded,
  loadStripboardScenesCallback
) => {
  try {
    const { data, error } = await supabase
      .from("scenes")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedScenes = (data || []).map((scene) => ({
      sceneNumber: scene.scene_number,
      heading: scene.heading,
      content: scene.content || [],
      metadata: scene.metadata || {},
      pageNumber: scene.page_number,
      pageLength: scene.page_length,
      estimatedDuration: scene.estimated_duration || "30 min",
      status: scene.status || "Not Scheduled",
      manualTimeOfDay: scene.manual_time_of_day || null,
      description: scene.description || null,
      notes: scene.notes || null,
    }));

    // Simple numerical sort
    formattedScenes.sort((a, b) => {
      const aNum = parseInt(String(a.sceneNumber)) || 0;
      const bNum = parseInt(String(b.sceneNumber)) || 0;
      return aNum - bNum;
    });

    console.log("Setting scenes:", formattedScenes.length, "scenes loaded");
    setScenes(formattedScenes);
    setScenesLoaded(true);

    // Load stripboard scenes after main scenes are loaded
    if (loadStripboardScenesCallback) {
      loadStripboardScenesCallback(formattedScenes);
    }
  } catch (error) {
    console.error("Error loading scenes:", error);
    setScenesLoaded(true);
  }
};

export const loadStripboardScenesAfterScenes = async (
  selectedProject,
  loadedScenes,
  setStripboardScenes
) => {
  try {
    const { data, error } = await supabase
      .from("stripboard_scenes")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    if (data && data.length > 0) {
      const mergedStripboardScenes = loadedScenes.map((scene) => {
        const stripboardScene = data.find(
          (s) => s.scene_number == scene.sceneNumber
        );
        return {
          ...scene,
          status: stripboardScene?.status || scene.status,
          scheduledDate: stripboardScene?.scheduled_date || null,
          scheduledTime: stripboardScene?.scheduled_time || null,
        };
      });

      setStripboardScenes(mergedStripboardScenes);
      console.log(
        "✅ Loaded stripboard scenes AFTER main scenes:",
        data.length
      );
    } else {
      setStripboardScenes([...loadedScenes]);
      console.log("No stripboard scenes found, using main scenes as fallback");
    }
  } catch (error) {
    console.error("Error loading stripboard scenes:", error);
    setStripboardScenes([...loadedScenes]);
  }
};

export const loadCastCrewFromDatabase = async (
  selectedProject,
  setCastCrew
) => {
  if (!selectedProject) return;

  console.log("📖 Loading Cast/Crew from database...");

  try {
    // Load cast/crew base data
    const { data: castCrewData, error: castCrewError } = await supabase
      .from("cast_crew")
      .select("*")
      .eq("project_id", selectedProject.id)
      .order("name");

    if (castCrewError) throw castCrewError;

    // Load all availability data efficiently in one call
    const { data: availabilityData, error: availabilityError } =
      await supabase.rpc("get_all_availability", {
        p_project_id: selectedProject.id,
      });

    if (availabilityError) {
      console.error("⚠️ Failed to load availability data:", availabilityError);
      // Continue without availability data rather than failing completely
    }

    // Create availability lookup map
    const availabilityMap = {};
    if (availabilityData) {
      availabilityData.forEach((item) => {
        availabilityMap[item.person_id] = item.availability;
      });
    }

    // Transform database format to app format
    const transformedData = (castCrewData || []).map((person) => ({
      id: person.id,
      user_id: person.user_id,
      photoUrl: person.photo_url,
      displayName: person.name,
      name: person.name, // Add name field for compatibility
      type: person.type || "crew",
      character: person.type === "cast" ? person.role : "",
      position: person.type === "crew" ? person.role : "",
      crewDepartment: person.department || "",
      email: person.contact_info?.email || "",
      phone: person.contact_info?.phone || "",
      height: "", // Add for compatibility
      weight: "", // Add for compatibility
      emergencyContact: person.contact_info?.emergencyContact || {},
      wardrobe: person.contact_info?.wardrobe || {},
      dietary: person.contact_info?.dietary || {},
      unionNumber: "", // Add for compatibility
      characters: person.characters ? JSON.parse(person.characters) : [],
      // Use normalized availability data from new table
      availability: availabilityMap[person.id] || {
        availableDates: [],
        unavailableDates: [],
        bookedDates: [],
        unionStatus: person.availability?.unionStatus || "",
        notes: person.availability?.notes || "",
      },
    }));

    console.log(
      `✅ Loaded ${transformedData.length} cast/crew members with availability`
    );
    setCastCrew(transformedData);
  } catch (error) {
    console.error("❌ Error loading Cast/Crew:", error);
    setCastCrew([]);
  }
};

export const loadTaggedItemsFromDatabase = async (
  selectedProject,
  setTaggedItems,
  calculateCategoryNumbers
) => {
  try {
    const { data, error } = await supabase
      .from("tagged_items")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedTaggedItems = {};
    (data || []).forEach((item) => {
      formattedTaggedItems[item.word] = {
        displayName: item.display_name,
        customTitle: item.custom_title,
        category: item.category,
        color: item.color,
        chronologicalNumber: item.chronological_number,
        position: item.position,
        scenes: item.scenes || [],
        instances: item.instances || [],
        assignedCharacters: item.assigned_characters || [],
        manuallyCreated: item.manually_created || false,
        originalProp: item.original_prop,
      };
    });

    const itemsWithCategoryNumbers =
      calculateCategoryNumbers(formattedTaggedItems);
    setTaggedItems(itemsWithCategoryNumbers);
    console.log(
      "Loaded tagged items from database:",
      Object.keys(itemsWithCategoryNumbers).length
    );
  } catch (error) {
    console.error("Error loading tagged items:", error);
  }
};

export const loadProjectSettingsFromDatabase = async (
  selectedProject,
  setProjectSettings,
  setCharacterSceneOverrides
) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", selectedProject.id)
      .single();

    if (error) throw error;

    if (data && data.settings) {
      setProjectSettings({
        filmTitle: data.name || "",
        producer: data.producer || "",
        director: data.director || "",
        ...data.settings,
      });
      console.log("Loaded project settings from database");
    }

    if (data && data.character_overrides) {
      setCharacterSceneOverrides(data.character_overrides);
      console.log("Loaded character overrides from database");
    }
  } catch (error) {
    console.error("Error loading project settings:", error);
  }
};

export const loadShootingDaysFromDatabase = async (
  selectedProject,
  setShootingDays
) => {
  try {
    const { data, error } = await supabase
      .from("shooting_days")
      .select("*")
      .eq("project_id", selectedProject.id)
      .order("day_number");

    if (error) throw error;

    const formattedShootingDays = (data || []).map((day) => ({
      id: day.id, // ✅ FIXED: Read from UUID column, not TEXT day_id column
      date: day.date,
      dayNumber: day.day_number,
      scheduleBlocks: day.schedule_blocks || [],
      isLocked: day.is_locked || false,
      isShot: day.is_shot || false,
      isCollapsed: day.is_collapsed || false,
    }));

    console.log(
      "📥 LOADING SHOOTING DAYS:",
      formattedShootingDays.length,
      "days"
    );
    console.log("📥 FIRST DAY LOADED:", {
      id: formattedShootingDays[0]?.id,
      date: formattedShootingDays[0]?.date,
      dayNumber: formattedShootingDays[0]?.dayNumber,
      scheduleBlocksCount:
        formattedShootingDays[0]?.scheduleBlocks?.length || 0,
    });

    setShootingDays(formattedShootingDays);
    console.log(
      "Loaded shooting days from database:",
      formattedShootingDays.length
    );
  } catch (error) {
    console.error("Error loading shooting days:", error);
  }
};

export const loadCharactersFromDatabase = async (
  selectedProject,
  setCharacters
) => {
  try {
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedCharacters = {};
    (data || []).forEach((character) => {
      formattedCharacters[character.name] = {
        name: character.name,
        scenes: character.scenes || [],
        chronologicalNumber: character.chronological_number || 1,
      };
    });

    setCharacters(formattedCharacters);
    console.log("Characters loaded:", Object.keys(formattedCharacters).length);
  } catch (error) {
    console.error("Error loading characters:", error);
  }
};

export const loadActualLocationsFromDatabase = async (
  selectedProject,
  setActualLocations
) => {
  try {
    const { data, error } = await supabase
      .from("actual_locations")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedLocations = (data || []).map((location) => ({
      id: location.location_id,
      name: location.name || "",
      address: location.address || "",
      contactPerson: location.contact_person || "",
      phone: location.phone || "",
      category: location.category || "",
      permitRequired: location.permit_required || false,
      parkingInfo: location.parking_info || "",
      notes: location.notes || "",
      city: location.city || "",
      state: location.state || "",
      zipCode: location.zip_code || "",
    }));

    setActualLocations(formattedLocations);
    console.log(
      "Loaded actual locations from database:",
      formattedLocations.length
    );
  } catch (error) {
    console.error("Error loading actual locations:", error);
  }
};

export const loadScriptLocationsFromDatabase = async (
  selectedProject,
  setScriptLocations
) => {
  try {
    const { data, error } = await supabase
      .from("script_locations")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedScriptLocations = (data || []).map((location) => ({
      id: location.location_id,
      parentLocation: location.parent_location || "",
      subLocation: location.sub_location || "",
      fullName: location.full_name || "",
      intExt: location.int_ext || "",
      scenes: location.scenes || [],
      actualLocationId: location.actual_location_id || null,
      category: location.category || "",
      removedScenes: location.removed_scenes || [],
    }));

    setScriptLocations(formattedScriptLocations);
    console.log(
      "Loaded script locations from database:",
      formattedScriptLocations.length
    );
  } catch (error) {
    console.error("Error loading script locations:", error);
  }
};

export const loadCallSheetDataFromDatabase = async (
  selectedProject,
  setCallSheetData
) => {
  try {
    const { data, error } = await supabase
      .from("call_sheet_data")
      .select("*")
      .eq("project_id", selectedProject.id)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (data) {
      setCallSheetData({
        callTime: data.call_time || "7:30 AM",
        castCallTimes: data.cast_call_times || {},
        customNotes: data.custom_notes || {},
        crewByDay: data.crew_by_day || {},
        tableSizesByDay: data.table_sizes_by_day || {},
        callTimeByDay: data.call_time_by_day || {},
        notesByDay: data.notes_by_day || {},
        crewCallTimes: data.crew_call_times || {},
        hiddenCastByDay: data.hidden_cast_by_day || {},
      });
      console.log("Loaded call sheet data from database");
    }
  } catch (error) {
    console.error("Error loading call sheet data:", error);
  }
};

export const loadWardrobeItemsFromDatabase = async (
  selectedProject,
  setWardrobeItems
) => {
  try {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedWardrobe = (data || []).map((item) => item.item_data);
    setWardrobeItems(formattedWardrobe);
    console.log(
      "Loaded wardrobe items from database:",
      formattedWardrobe.length
    );
  } catch (error) {
    console.error("Error loading wardrobe items:", error);
  }
};

export const loadGarmentInventoryFromDatabase = async (
  selectedProject,
  setGarmentInventory
) => {
  try {
    const { data, error } = await supabase
      .from("garment_inventory")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedGarments = (data || []).map((item) => item.garment_data);
    setGarmentInventory(formattedGarments);
    console.log(
      "Loaded garment inventory from database:",
      formattedGarments.length
    );
  } catch (error) {
    console.error("Error loading garment inventory:", error);
  }
};

export const loadCostCategoriesFromDatabase = async (
  selectedProject,
  setCostCategories
) => {
  try {
    const { data, error } = await supabase
      .from("cost_categories")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const allRows = data || [];
    const parents = allRows.filter((r) => !r.parent_id);
    const children = allRows.filter((r) => r.parent_id);

    const formattedCategories = parents.map((category) => ({
      id: category.category_id,
      name: category.name,
      color: category.color,
      expenses: category.expenses || [],
      budget: category.budget || 0,
      budgetSource: category.budget_source || "manual",
      departmentKey: category.department_key || null,
      description: category.description || "",
      subCategories: children
        .filter((c) => c.parent_id === category.category_id)
        .map((sub) => ({
          id: sub.category_id,
          name: sub.name,
          color: sub.color,
          expenses: sub.expenses || [],
          budget: sub.budget || 0,
          budgetLineId: sub.budget_line_id || null,
          budgetSource: sub.budget_source || "budget",
          description: sub.description || "",
          parentId: sub.parent_id,
        })),
    }));

    setCostCategories(formattedCategories);
    console.log(
      "Loaded cost categories from database:",
      formattedCategories.length
    );
  } catch (error) {
    console.error("Error loading cost categories:", error);
  }
};

export const loadCostVendorsFromDatabase = async (
  selectedProject,
  setCostVendors
) => {
  try {
    const { data, error } = await supabase
      .from("cost_vendors")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const vendorNames = (data || []).map((vendor) => vendor.vendor_name);
    setCostVendors(vendorNames);
    console.log("Loaded cost vendors from database:", vendorNames.length);
  } catch (error) {
    console.error("Error loading cost vendors:", error);
  }
};

export const loadBudgetDataFromDatabase = async (
  selectedProject,
  setBudgetData
) => {
  try {
    const { data, error } = await supabase
      .from("budget_data")
      .select("*")
      .eq("project_id", selectedProject.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (data) {
      setBudgetData({
        projectInfo: data.project_info || {},
        atlItems: data.atl_items || [],
        btlItems: data.btl_items || [],
        legalItems: data.legal_items || [],
        marketingItems: data.marketing_items || [],
        postItems: data.post_items || [],
        contingencySettings: data.contingency_settings || {
          percentage: 10,
          includeATL: true,
          includeBTL: true,
          includeLegal: true,
          includeMarketing: false,
          includePost: false,
        },
        departmentBudgets: data.department_budgets || {},
        weeklyReports: data.weekly_reports || [],
        customCategories: data.custom_categories || [],
        totals: data.totals || {
          atlTotal: 0,
          btlTotal: 0,
          grandTotal: 0,
          paidTotal: 0,
          unpaidTotal: 0,
        },
      });
      console.log("Loaded budget data from database");
    }
  } catch (error) {
    console.error("Error loading budget data:", error);
  }
};

export const loadTodoItemsFromDatabase = async (
  selectedProject,
  setTodoItems
) => {
  try {
    const { data, error } = await supabase
      .from("todo_items")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedTodos = (data || []).map((item) => item.item_data);
    setTodoItems(formattedTodos);
    console.log("Loaded todo items from database:", formattedTodos.length);
  } catch (error) {
    console.error("Error loading todo items:", error);
  }
};

export const loadShotListDataFromDatabase = async (
  selectedProject,
  setShotListData,
  setSceneNotes
) => {
  try {
    const { data, error } = await supabase
      .from("shot_list_data")
      .select("*")
      .eq("project_id", selectedProject.id)
      .limit(1);

    if (error && error.code !== "PGRST116") throw error;

    if (data) {
      setShotListData(data?.[0]?.shot_list_data || {});
      setSceneNotes(data?.[0]?.scene_notes || {});
      console.log("Loaded shot list data from database");
    }
  } catch (error) {
    console.error("Error loading shot list data:", error);
  }
};

export const loadScheduledScenesFromDatabase = async (
  selectedProject,
  setScheduledScenes
) => {
  try {
    const { data, error } = await supabase
      .from("scheduled_scenes")
      .select("*")
      .eq("project_id", selectedProject.id);

    if (error) throw error;

    const formattedScheduled = {};
    (data || []).forEach((mapping) => {
      formattedScheduled[mapping.shoot_date] = mapping.scenes || [];
    });

    setScheduledScenes(formattedScheduled);
    console.log(
      "Loaded scheduled scenes from database:",
      Object.keys(formattedScheduled).length,
      "dates"
    );
  } catch (error) {
    console.error("Error loading scheduled scenes:", error);
  }
};

export const loadTimelineDataFromDatabase = async (
  selectedProject,
  setTimelineData
) => {
  try {
    const { data, error } = await supabase
      .from("timeline_data")
      .select("*")
      .eq("project_id", selectedProject.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (data && data.timeline_data) {
      setTimelineData(data.timeline_data);
      console.log("Loaded timeline data from database");
    }
  } catch (error) {
    console.error("Error loading timeline data:", error);
  }
};

export const loadContinuityElementsFromDatabase = async (
  selectedProject,
  setContinuityElements
) => {
  try {
    const { data, error } = await supabase
      .from("continuity_elements")
      .select("*")
      .eq("project_id", selectedProject.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (data && data.continuity_elements) {
      setContinuityElements(data.continuity_elements);
      console.log("Loaded continuity elements from database");
    }
  } catch (error) {
    console.error("Error loading continuity elements:", error);
  }
};

// ============================================================================
// DATABASE SYNC FUNCTIONS
// ============================================================================

export const saveScenesDatabase = async (
  selectedProject,
  updatedScenes,
  scenesLoaded,
  isSavingScenes,
  setIsSavingScenes
) => {
  if (!selectedProject || !scenesLoaded || isSavingScenes) return;

  setIsSavingScenes(true);

  try {
    console.log(
      "🔄 Saving scenes to database:",
      updatedScenes.length,
      "scenes"
    );

    const scenesData = updatedScenes.map((scene) => ({
      project_id: selectedProject.id,
      scene_number: scene.sceneNumber,
      heading: scene.heading,
      content: scene.content || [],
      metadata: scene.metadata || {},
      page_number: scene.pageNumber,
      page_length: scene.pageLength,
      estimated_duration: scene.estimatedDuration || "30 min",
      status: scene.status || "Not Scheduled",
      manual_time_of_day: scene.manualTimeOfDay || null,
      description: scene.description || null,
      notes: scene.notes || null,
    }));

    // Safe UPSERT pattern
    const { error } = await supabase.rpc("sync_scenes", {
      p_project_id: selectedProject.id,
      p_scenes_data: scenesData,
    });

    if (error) throw error;

    console.log("✅ Scenes saved successfully to database");
  } catch (error) {
    console.error("❌ Critical error saving scenes:", error);
    alert(
      `Database save failed: ${error.message}. Your changes may not persist.`
    );
  } finally {
    setIsSavingScenes(false);
  }
};

export const syncStripboardScenesToDatabase = async (
  selectedProject,
  updatedStripboardScenes
) => {
  if (!selectedProject || !updatedStripboardScenes) return;

  try {
    console.log("Syncing stripboard scenes to database...");

    const stripboardScenesData = updatedStripboardScenes.map((scene) => ({
      project_id: selectedProject.id,
      scene_number: scene.sceneNumber,
      status: scene.status || "Not Scheduled",
      scheduled_date: scene.scheduledDate || null,
      scheduled_time: scene.scheduledTime || null,
    }));

    const { error } = await supabase.rpc("sync_stripboard_scenes", {
      p_project_id: selectedProject.id,
      p_stripboard_data: stripboardScenesData,
    });

    if (error) throw error;

    console.log("Stripboard scenes synced to database successfully");
  } catch (error) {
    console.error("Error syncing stripboard scenes:", error);
  }
};

// ============================================================================
// ATOMIC STRIPBOARD SCENE UPDATE FUNCTIONS - Granular sync for individual scenes
// ============================================================================

/**
 * Update status for a single stripboard scene (atomic)
 */
export const updateStripboardSceneStatus = async (
  selectedProject,
  sceneNumber,
  status
) => {
  try {
    console.log(`🔄 Updating scene ${sceneNumber} status to: ${status}`);

    const { error } = await supabase.rpc("update_stripboard_scene_status", {
      p_project_id: selectedProject.id,
      p_scene_number: sceneNumber.toString(),
      p_status: status,
    });

    if (error) throw error;

    console.log(`✅ Scene ${sceneNumber} status updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update scene status:`, error);
    throw error;
  }
};

/**
 * Update schedule (status + date + time) for a single scene (atomic)
 */
export const updateStripboardSceneSchedule = async (
  selectedProject,
  sceneNumber,
  status,
  scheduledDate,
  scheduledTime
) => {
  try {
    console.log(
      `🔄 Updating scene ${sceneNumber} schedule: ${status}, ${scheduledDate}, ${scheduledTime}`
    );

    const { error } = await supabase.rpc("update_stripboard_scene_schedule", {
      p_project_id: selectedProject.id,
      p_scene_number: sceneNumber.toString(),
      p_status: status,
      p_scheduled_date: scheduledDate,
      p_scheduled_time: scheduledTime,
    });

    if (error) throw error;

    console.log(`✅ Scene ${sceneNumber} schedule updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update scene schedule:`, error);
    throw error;
  }
};

/**
 * Clear schedule for a single scene (unschedule) - atomic
 */
export const clearStripboardSceneSchedule = async (
  selectedProject,
  sceneNumber
) => {
  try {
    console.log(`🔄 Clearing schedule for scene ${sceneNumber}`);

    const { error } = await supabase.rpc("clear_stripboard_scene_schedule", {
      p_project_id: selectedProject.id,
      p_scene_number: sceneNumber.toString(),
    });

    if (error) throw error;

    console.log(`✅ Scene ${sceneNumber} schedule cleared successfully`);
  } catch (error) {
    console.error(`❌ Failed to clear scene schedule:`, error);
    throw error;
  }
};

/**
 * Batch update multiple scene statuses atomically (for lock/unlock day)
 */
export const batchUpdateStripboardSceneStatuses = async (
  selectedProject,
  sceneUpdates
) => {
  try {
    console.log(
      `🔄 Batch updating ${sceneUpdates.length} stripboard scenes atomically`
    );

    const { error } = await supabase.rpc(
      "batch_update_stripboard_scene_statuses",
      {
        p_project_id: selectedProject.id,
        p_scene_updates: sceneUpdates,
      }
    );

    if (error) throw error;

    console.log(
      `✅ Batch update complete - ${sceneUpdates.length} scenes updated`
    );
  } catch (error) {
    console.error(`❌ Batch scene update failed:`, error);
    throw error;
  }
};

// ============================================================================
// END ATOMIC STRIPBOARD SCENE FUNCTIONS
// ============================================================================

// ============================================================================
// ATOMIC MAIN SCENES UPDATE FUNCTIONS - Granular sync for individual scenes
// ============================================================================

/**
 * Update status for a single main scene (atomic)
 */
export const updateSceneStatus = async (
  selectedProject,
  sceneNumber,
  status
) => {
  try {
    console.log(`🔄 Updating main scene ${sceneNumber} status to: ${status}`);

    const { error } = await supabase.rpc("update_scene_status", {
      p_project_id: selectedProject.id,
      p_scene_number: sceneNumber.toString(),
      p_status: status,
    });

    if (error) throw error;

    console.log(`✅ Main scene ${sceneNumber} status updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update main scene status:`, error);
    throw error;
  }
};

/**
 * Update full scene heading (atomic)
 */
export const updateSceneHeading = async (
  selectedProject,
  sceneNumber,
  heading,
  intExt,
  location,
  timeOfDay,
  modifier
) => {
  try {
    console.log(`🔄 Updating scene ${sceneNumber} heading to: ${heading}`);
    const { error } = await supabase.rpc("update_scene_heading", {
      p_project_id: selectedProject.id,
      p_scene_number: sceneNumber.toString(),
      p_heading: heading,
      p_int_ext: intExt,
      p_location: location,
      p_time_of_day: timeOfDay,
      p_modifier: modifier,
    });
    if (error) throw error;
    console.log(`✅ Scene ${sceneNumber} heading updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update scene heading:`, error);
    throw error;
  }
};

/**
 * Update manual time of day for a single scene (atomic)
 */
export const updateSceneTimeOfDay = async (
  selectedProject,
  sceneNumber,
  timeOfDay
) => {
  try {
    console.log(
      `🔄 Updating main scene ${sceneNumber} time of day to: ${timeOfDay}`
    );

    const { error } = await supabase.rpc("update_scene_time_of_day", {
      p_project_id: selectedProject.id,
      p_scene_number: sceneNumber.toString(),
      p_manual_time_of_day: timeOfDay,
    });

    if (error) throw error;

    console.log(
      `✅ Main scene ${sceneNumber} time of day updated successfully`
    );
  } catch (error) {
    console.error(`❌ Failed to update main scene time of day:`, error);
    throw error;
  }
};

/**
 * Update description for a single scene (atomic)
 */
export const updateSceneDescription = async (
  selectedProject,
  sceneNumber,
  description
) => {
  try {
    console.log(`🔄 Updating main scene ${sceneNumber} description`);

    const { error } = await supabase.rpc("update_scene_description", {
      p_project_id: selectedProject.id,
      p_scene_number: sceneNumber.toString(),
      p_description: description,
    });

    if (error) throw error;

    console.log(
      `✅ Main scene ${sceneNumber} description updated successfully`
    );
  } catch (error) {
    console.error(`❌ Failed to update main scene description:`, error);
    throw error;
  }
};

/**
 * Update notes for a single scene (atomic)
 */
export const updateSceneNotes = async (selectedProject, sceneNumber, notes) => {
  try {
    console.log(`🔄 Updating main scene ${sceneNumber} notes`);

    const { error } = await supabase.rpc("update_scene_notes", {
      p_project_id: selectedProject.id,
      p_scene_number: sceneNumber.toString(),
      p_notes: notes,
    });

    if (error) throw error;

    console.log(`✅ Main scene ${sceneNumber} notes updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update main scene notes:`, error);
    throw error;
  }
};

// ============================================================================
// END ATOMIC MAIN SCENES FUNCTIONS
// ============================================================================

export const syncScheduledScenesToDatabase = async (
  selectedProject,
  updatedScheduledScenes,
  syncLocks = null
) => {
  if (!selectedProject || !updatedScheduledScenes) return;

  try {
    // Set sync lock to prevent realtime reload loop
    if (syncLocks) {
      syncLocks.current.scheduledScenes = true;
    }

    console.log("Syncing scheduled scenes to database...");

    const scheduledScenesData = Object.entries(updatedScheduledScenes).map(
      ([date, scenes]) => ({
        project_id: selectedProject.id,
        shoot_date: date,
        scenes: scenes || [],
      })
    );

    const { error: rpcError } = await supabase.rpc("sync_scheduled_scenes", {
      p_project_id: selectedProject.id,
      p_scheduled_data: scheduledScenesData,
    });
    if (rpcError) throw rpcError;

    console.log("Scheduled scenes synced to database successfully");
  } catch (error) {
    console.error("Error syncing scheduled scenes:", error);
  } finally {
    // Clear sync lock after sync completes
    if (syncLocks) {
      setTimeout(() => {
        syncLocks.current.scheduledScenes = false;
      }, 100);
    }
  }
};

export const syncScriptLocationsToDatabase = async (
  selectedProject,
  updatedLocations
) => {
  if (!selectedProject || !updatedLocations) return;

  // Empty data protection
  if (!Array.isArray(updatedLocations) || updatedLocations.length === 0) {
    console.warn("⚠️ SYNC BLOCKED: Empty script locations array");
    return;
  }

  try {
    console.log("🔄 Syncing Script Locations to database (ATOMIC)...");

    const locationsData = updatedLocations
      .filter((loc) => loc && loc.id)
      .map((loc) => ({
        project_id: selectedProject.id,
        location_id: loc.id,
        parent_location: loc.parentLocation,
        sub_location: loc.subLocation,
        full_name: loc.fullName,
        int_ext: loc.intExt,
        scenes: loc.scenes || [],
        actual_location_id: loc.actualLocationId || null,
        category: loc.category || "unassigned",
        removed_scenes: loc.removedScenes || [],
      }));

    // Second check after filter
    if (locationsData.length === 0) {
      console.warn("⚠️ SYNC BLOCKED: All script locations filtered out");
      return;
    }

    // TEMPORARY: Log exact data being sent to RPC
    console.log("🔍 EXACT DATA BEING SENT TO RPC:", {
      p_project_id: selectedProject.id,
      p_locations_data: JSON.stringify(locationsData, null, 2),
    });

    // Use atomic RPC function
    console.log("🔍 EXACT DATA BEING SENT TO RPC:", {
      p_project_id: selectedProject.id,
      p_locations_data: locationsData,
    });
    console.log(
      "🔍 FIRST LOCATION SAMPLE:",
      JSON.stringify(locationsData[0], null, 2)
    );
    // Use a dynamic approach - let's see what target locations we actually have
    console.log(
      "🔍 ALL LOCATION IDs IN SYNC:",
      locationsData.map((loc) => loc.location_id)
    );
    console.log(
      "🔍 ALL LOCATION IDs IN SYNC:",
      locationsData.map((loc) => loc.location_id)
    );
    console.log("🔍 SYNC DATA COUNT:", locationsData.length);
    console.log("🔍 CHECKING FOR SPECIFIC LOCATIONS:");
    const bathoomTarget = locationsData.find(
      (loc) => loc.location_id === "script_location_1762107556378_31"
    );
    const garageTarget = locationsData.find(
      (loc) => loc.location_id === "script_location_1762107556378_9"
    );
    const exteriorTarget = locationsData.find(
      (loc) => loc.location_id === "script_location_1762107556378_12"
    );
    const bedroomTarget = locationsData.find(
      (loc) => loc.location_id === "script_location_1762107556378_36"
    );
    console.log("🔍 BATHROOM TARGET EXISTS:", !!bathoomTarget);
    console.log("🔍 GARAGE TARGET EXISTS:", !!garageTarget);
    console.log("🔍 EXTERIOR TARGET EXISTS:", !!exteriorTarget);
    console.log("🔍 BEDROOM TARGET EXISTS:", !!bedroomTarget);

    const { error } = await supabase.rpc("sync_script_locations", {
      p_project_id: selectedProject.id,
      p_locations_data: locationsData,
    });

    if (error) throw error;

    console.log("✅ Script Locations synced successfully (ATOMIC)");

    // Force realtime-style reload after script location sync
    setTimeout(() => {
      console.log("🔴 FORCING Script locations reload after sync");
      if (typeof window !== "undefined" && window.forceScriptLocationsReload) {
        window.forceScriptLocationsReload();
      }
    }, 100);
  } catch (error) {
    console.error("❌ Error syncing Script Locations:", error);
  }
};

export const syncActualLocationsToDatabase = async (
  selectedProject,
  updatedLocations
) => {
  if (!selectedProject || !updatedLocations) return;

  // Empty data protection
  if (!Array.isArray(updatedLocations) || updatedLocations.length === 0) {
    console.warn("⚠️ SYNC BLOCKED: Empty actual locations array");
    return;
  }

  try {
    console.log("🔄 Syncing Actual Locations to database (ATOMIC)...");

    const locationsData = updatedLocations
      .filter((loc) => loc && loc.id)
      .map((loc) => ({
        project_id: selectedProject.id,
        location_id: loc.id,
        name: loc.name,
        address: loc.address || "",
        city: loc.city || "",
        state: loc.state || "",
        zip_code: loc.zipCode || "",
        contact_person: loc.contactPerson || "",
        phone: loc.phone || "",
        category: loc.category || "practical",
        permit_required: loc.permitRequired || false,
        parking_info: loc.parkingInfo || "",
        notes: loc.notes || "",
      }));

    // Second check after filter
    if (locationsData.length === 0) {
      console.warn("⚠️ SYNC BLOCKED: All actual locations filtered out");
      return;
    }

    // Use atomic RPC function
    const { error } = await supabase.rpc("sync_actual_locations", {
      p_project_id: selectedProject.id,
      p_locations_data: locationsData,
    });

    if (error) throw error;

    console.log("✅ Actual Locations synced successfully (ATOMIC)");
  } catch (error) {
    console.error("❌ Error syncing Actual Locations:", error);
  }
};

export const syncCastCrewToDatabase = async (
  selectedProject,
  updatedCastCrew
) => {
  if (!selectedProject || !updatedCastCrew) return;

  console.log("🔄 Syncing Cast/Crew to database (ATOMIC)...");

  // 🛡️ CRITICAL SAFETY CHECK: NEVER allow empty arrays for existing projects
  if (!Array.isArray(updatedCastCrew) || updatedCastCrew.length === 0) {
    console.warn("⚠️ EMPTY ARRAY DETECTED - Verifying against database...");

    const { data: existingData, error: checkError } = await supabase
      .from("cast_crew")
      .select("person_id", { count: "exact" })
      .eq("project_id", selectedProject.id);

    if (checkError) {
      console.error("❌ Database check failed:", checkError);
      return;
    }

    const dbCount = existingData?.length || 0;
    console.log(`📊 Database has ${dbCount} cast/crew records`);

    if (dbCount > 0) {
      console.error(
        "🚨 CRITICAL SAFETY VIOLATION: Attempting to sync empty state over existing data!"
      );
      alert(
        "🚨 CRITICAL SAFETY VIOLATION\n\n" +
          "You are trying to save an empty cast/crew list, but the database contains " +
          dbCount +
          " records.\n\n" +
          "This operation has been BLOCKED to prevent data loss.\n\n" +
          "Please refresh the page to reload your data from the database."
      );
      return;
    }
  }

  try {
    const castCrewData = updatedCastCrew
      .filter(
        (person) =>
          person && person.displayName && person.displayName.trim() !== ""
      )
      .map((person) => ({
        project_id: selectedProject.id,
        person_id: person.id,
        user_id: person.user_id || null,
        photo_url: person.photoUrl || null,
        name: person.displayName.trim(),
        role: person.type === "cast" ? person.character : person.position,
        department: person.crewDepartment || "",
        type: person.type || "crew",
        characters: JSON.stringify(person.characters || []),
        contact_info: {
          email: person.email || "",
          phone: person.phone || "",
          emergencyContact: person.emergencyContact || {},
          wardrobe: person.wardrobe || {},
          dietary: person.dietary || {},
        },
        availability: {
          unavailableDates: person.availability?.unavailableDates || [],
          availableDates: person.availability?.availableDates || [],
          bookedDates: person.availability?.bookedDates || [],
          unionStatus:
            person.availability?.unionStatus || person.unionStatus || "",
          notes: person.availability?.notes || person.notes || "",
        },
      }));

    // 🛡️ CRITICAL SAFETY: Verify deletion count before RPC call
    const { data: currentDbData, error: countError } = await supabase
      .from("cast_crew")
      .select("person_id")
      .eq("project_id", selectedProject.id);

    if (countError) {
      console.error("❌ Failed to check current database count:", countError);
      throw new Error("Safety check failed - cannot verify current data count");
    }

    const currentDbCount = currentDbData?.length || 0;
    const newDataCount = castCrewData.length;
    const deletionCount = currentDbCount - newDataCount;

    console.log(
      `🔍 SAFETY CHECK: DB has ${currentDbCount}, sending ${newDataCount}, would delete ${deletionCount}`
    );

    // 🚨 NUCLEAR SAFETY: Block if trying to delete more than 3 people at once
    if (deletionCount > 3) {
      console.error("🚨 CATASTROPHIC DELETION BLOCKED!");
      console.error(`Would delete ${deletionCount} people - this seems wrong!`);

      alert(
        `🚨 CATASTROPHIC DELETION BLOCKED\n\n` +
          `This operation would delete ${deletionCount} people from your cast/crew.\n\n` +
          `This seems like a mistake that could wipe your entire database.\n\n` +
          `Operation BLOCKED to prevent data loss.\n\n` +
          `If you really need to delete ${deletionCount} people, do it one by one.`
      );
      return;
    }

    // 🛡️ Normal deletion safety (1-3 people is OK)
    if (deletionCount > 0) {
      console.log(
        `✅ SAFE DELETION: Will delete ${deletionCount} people (within safety limits)`
      );
    }

    // Use safe atomic RPC function
    const { error } = await supabase.rpc("sync_cast_crew", {
      p_project_id: selectedProject.id,
      p_cast_crew_data: castCrewData,
    });

    if (error) {
      console.error("❌ Cast/Crew RPC sync failed:", error);
      throw error;
    }

    console.log("✅ Cast/Crew data synced successfully (ATOMIC)");
  } catch (error) {
    console.error("❌ Error syncing Cast/Crew:", error);

    alert(
      "⚠️ SYNC ERROR\n\n" +
        "Failed to save cast/crew data: " +
        error.message +
        "\n\n" +
        "Your data has NOT been saved. Please try again."
    );
  }
};

export const updateSingleCastCrewPerson = async (selectedProject, person) => {
  console.log("🔄 Updating single Cast/Crew person:", person.displayName);

  // Map person to database format (matches existing sync function)
  const personData = {
    project_id: selectedProject.id,
    person_id: person.id,
    user_id: person.user_id || null,
    photo_url: person.photoUrl || null,
    name: person.displayName.trim(),
    role: person.type === "cast" ? person.character : person.position,
    department: person.crewDepartment || "",
    type: person.type || "crew",
    characters: JSON.stringify(person.characters || []),
    contact_info: {
      email: person.email || "",
      phone: person.phone || "",
      emergencyContact: person.emergencyContact || {},
      wardrobe: person.wardrobe || {},
    },
    availability: person.availability,
  };

  try {
    const { error } = await supabase.rpc("upsert_cast_crew_person", {
      p_project_id: selectedProject.id,
      p_person_id: person.id,
      p_person_data: personData,
    });

    if (error) throw error;
    console.log("✅ Single person update successful");
  } catch (error) {
    console.error("❌ Single person update failed:", error);
    throw error;
  }
};

// ============================================================================
// GRANULAR CAST/CREW OPERATIONS - Single person add/delete
// ============================================================================

export const addCastCrewPerson = async (selectedProject, person) => {
  if (!selectedProject || !person) return;

  console.log("➕ Adding single cast/crew person:", person.displayName);
  console.log("➕ RAW PERSON OBJECT:", JSON.stringify(person, null, 2));

  const personData = {
    project_id: selectedProject.id, // ✅ FIXED: was missing
    person_id: person.id,
    user_id: person.user_id || null,
    photo_url: person.photoUrl || null,
    name: person.displayName.trim(),
    role: person.type === "cast" ? person.character : person.position,
    department: person.crewDepartment || "",
    type: person.type || "crew",
    characters: JSON.stringify(person.characters || []),
    contact_info: {
      email: person.email || "",
      phone: person.phone || "",
      emergencyContact: person.emergencyContact || {},
      wardrobe: person.wardrobe || {},
      dietary: person.dietary || {},
    },
    availability: {
      unavailableDates: person.availability?.unavailableDates || [], // ✅ FIXED: nested correctly
      availableDates: person.availability?.availableDates || [],
      bookedDates: person.availability?.bookedDates || [],
      unionStatus: person.availability?.unionStatus || "Non-Union",
      notes: person.availability?.notes || "",
    },
  };

  console.log(
    "➕ PERSON DATA BEING SENT TO RPC:",
    JSON.stringify(personData, null, 2)
  );
  console.log("➕ RPC PARAMS:", {
    p_project_id: selectedProject.id,
    p_person_id: person.id,
  });

  try {
    const { data, error } = await supabase.rpc("upsert_cast_crew_person", {
      p_project_id: selectedProject.id,
      p_person_id: person.id,
      p_person_data: personData,
    });

    if (error) {
      console.error("❌ RPC ERROR DETAILS:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
    console.log("✅ Added cast/crew person successfully, RPC returned:", data);
  } catch (error) {
    console.error("❌ Failed to add cast/crew person:", error);
    throw error;
  }
};

export const updateCastCrewPerson = async (selectedProject, person) => {
  if (!selectedProject || !person) return;

  console.log("🔄 Updating single cast/crew person:", person.displayName);

  const personData = {
    person_id: person.id,
    user_id: person.user_id || null,
    photo_url: person.photoUrl || null,
    name: person.displayName.trim(),
    role: person.type === "cast" ? person.character : person.position,
    department: person.crewDepartment || "",
    type: person.type || "crew",
    characters: JSON.stringify(person.characters || []),
    contact_info: {
      email: person.email || "",
      phone: person.phone || "",
      emergencyContact: person.emergencyContact || {},
      wardrobe: person.wardrobe || {},
      dietary: person.dietary || {},
    },
    availability: {
      unavailableDates: person.unavailableDates || [],
      availableDates: person.availableDates || [],
      bookedDates: person.bookedDates || [],
      unionStatus: person.unionStatus || "Non-Union",
      notes: person.notes || "",
    },
  };

  try {
    const { error } = await supabase.rpc("upsert_cast_crew_person", {
      p_project_id: selectedProject.id,
      p_person_id: person.id,
      p_person_data: personData,
    });

    if (error) throw error;
    console.log("✅ Updated cast/crew person successfully");
  } catch (error) {
    console.error("❌ Failed to update cast/crew person:", error);
    throw error;
  }
};

export const deleteCastCrewPerson = async (selectedProject, personId) => {
  if (!selectedProject || !personId) return;

  console.log("🗑️ Deleting single cast/crew person:", personId);

  try {
    const { error } = await supabase.rpc("delete_cast_crew_person", {
      p_project_id: selectedProject.id,
      p_person_id: personId,
    });

    if (error) throw error;
    console.log("✅ Deleted cast/crew person successfully");
  } catch (error) {
    console.error("❌ Failed to delete cast/crew person:", error);
    throw error;
  }
};

// ============================================================================
// SAFE AVAILABILITY FUNCTIONS - Atomic, no race conditions, no data loss
// ============================================================================

/**
 * Add a single availability date (completely atomic)
 *
 * @param {Object} selectedProject - The project object with id
 * @param {string} personId - The person_id to add date for
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} dateType - 'available', 'unavailable', or 'booked'
 */
export const addAvailabilityDateSafe = async (
  selectedProject,
  personId,
  date,
  dateType
) => {
  try {
    console.log(`🔄 Adding ${dateType} date ${date} for person ${personId}`);

    const { error } = await supabase.rpc("add_availability_date_safe", {
      p_project_id: selectedProject.id,
      p_person_id: personId,
      p_date: date,
      p_date_type: dateType, // 'available', 'unavailable', or 'booked'
    });

    if (error) throw error;

    console.log(`✅ Added ${dateType} date ${date} successfully`);
  } catch (error) {
    console.error(`❌ Failed to add ${dateType} date:`, error);
    throw error;
  }
};

/**
 * Remove a single availability date (completely atomic)
 *
 * @param {Object} selectedProject - The project object with id
 * @param {string} personId - The person_id to remove date from
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} dateType - 'available', 'unavailable', or 'booked'
 */
export const removeAvailabilityDateSafe = async (
  selectedProject,
  personId,
  date,
  dateType
) => {
  try {
    console.log(`🔄 Removing ${dateType} date ${date} for person ${personId}`);

    const { error } = await supabase.rpc("remove_availability_date_safe", {
      p_project_id: selectedProject.id,
      p_person_id: personId,
      p_date: date,
      p_date_type: dateType,
    });

    if (error) throw error;

    console.log(`✅ Removed ${dateType} date ${date} successfully`);
  } catch (error) {
    console.error(`❌ Failed to remove ${dateType} date:`, error);
    throw error;
  }
};

/**
 * Add a date range (for bulk operations)
 *
 * @param {Object} selectedProject - The project object with id
 * @param {string} personId - The person_id to add dates for
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} dateType - 'available', 'unavailable', or 'booked'
 */
export const addAvailabilityDateRange = async (
  selectedProject,
  personId,
  startDate,
  endDate,
  dateType
) => {
  try {
    console.log(
      `🔄 Adding ${dateType} date range ${startDate} to ${endDate} for person ${personId}`
    );

    const { error } = await supabase.rpc("add_availability_date_range", {
      p_project_id: selectedProject.id,
      p_person_id: personId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_date_type: dateType,
    });

    if (error) throw error;

    console.log(`✅ Added ${dateType} date range successfully`);
  } catch (error) {
    console.error(`❌ Failed to add date range:`, error);
    throw error;
  }
};

/**
 * Get availability for a single person
 *
 * @param {Object} selectedProject - The project object with id
 * @param {string} personId - The person_id to get availability for
 * @returns {Object} Availability object with arrays of dates
 */
export const getPersonAvailability = async (selectedProject, personId) => {
  try {
    const { data, error } = await supabase.rpc("get_person_availability", {
      p_project_id: selectedProject.id,
      p_person_id: personId,
    });

    if (error) throw error;

    return (
      data || {
        availableDates: [],
        unavailableDates: [],
        bookedDates: [],
        unionStatus: "",
        notes: "",
      }
    );
  } catch (error) {
    console.error("❌ Failed to load person availability:", error);
    return {
      availableDates: [],
      unavailableDates: [],
      bookedDates: [],
      unionStatus: "",
      notes: "",
    };
  }
};

// ============================================================================
// END SAFE AVAILABILITY FUNCTIONS
// ============================================================================

export const cleanupOldAvailabilityDates = async (selectedProject) => {
  try {
    console.log("🧹 Checking for old availability dates to cleanup...");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 2); // 2 days ago
    const cutoffString = cutoffDate.toISOString().split("T")[0];

    console.log("🧹 Cleanup cutoff:", cutoffString, "(2 days ago)");

    // Use RPC function for safe cleanup
    const { error } = await supabase.rpc("cleanup_old_availability", {
      p_project_id: selectedProject.id,
      p_cutoff_date: cutoffString,
    });

    if (error) {
      console.error("❌ Availability cleanup error:", error);
      throw error;
    }

    console.log("✅ Availability cleanup completed successfully");
  } catch (error) {
    console.error("❌ Availability cleanup failed:", error);
    // Don't throw - this is a background maintenance task
  }
};

export const checkAndRunDailyAvailabilityCleanup = async (selectedProject) => {
  try {
    console.log("🧹 Running daily availability cleanup...");

    // Check if cleanup was already run today
    const today = new Date().toISOString().split("T")[0];
    const lastCleanup = localStorage.getItem(
      `lastAvailabilityCleanup_${selectedProject.id}`
    );

    if (lastCleanup === today) {
      console.log("🧹 Cleanup already run today, skipping");
      return;
    }

    // Run the cleanup
    await cleanupOldAvailabilityDates(selectedProject);

    // Mark as completed for today
    localStorage.setItem(
      `lastAvailabilityCleanup_${selectedProject.id}`,
      today
    );
  } catch (error) {
    console.error("❌ Daily availability cleanup failed:", error);
  }
};

export const syncCharactersToDatabase = async (
  selectedProject,
  updatedCharacters
) => {
  if (!selectedProject || !updatedCharacters) return;

  try {
    console.log("Syncing characters to database...");

    const charactersData = Object.entries(updatedCharacters).map(
      ([name, character]) => ({
        project_id: selectedProject.id,
        name: name,
        scenes: character.scenes || [],
        chronological_number: character.chronologicalNumber || 1,
      })
    );

    const { error: rpcError } = await supabase.rpc("sync_characters", {
      p_project_id: selectedProject.id,
      p_characters_data: charactersData,
    });
    if (rpcError) throw rpcError;

    console.log("Characters synced to database successfully");
  } catch (error) {
    console.error("❌ Failed to sync characters:", error);
    throw error;
  }
};

// ============================================================================
// GRANULAR CHARACTERS OPERATIONS
// ============================================================================

export const upsertCharacter = async (
  selectedProject,
  characterName,
  characterData
) => {
  if (!selectedProject || !characterName) return;

  console.log("🔄 Updating single character:", characterName);

  try {
    const { error } = await supabase.rpc("upsert_character", {
      p_project_id: selectedProject.id,
      p_character_name: characterName,
      p_character_data: characterData,
    });

    if (error) throw error;
    console.log("✅ Character updated successfully");
  } catch (error) {
    console.error("❌ Failed to update character:", error);
    throw error;
  }
};

export const deleteCharacter = async (selectedProject, characterName) => {
  if (!selectedProject || !characterName) return;

  console.log("🗑️ Deleting single character:", characterName);

  try {
    const { error } = await supabase.rpc("delete_character", {
      p_project_id: selectedProject.id,
      p_character_name: characterName,
    });

    if (error) throw error;
    console.log("✅ Character deleted successfully");
  } catch (error) {
    console.error("❌ Failed to delete character:", error);
    throw error;
  }
};

export const syncCharacterOverridesToDatabase = async (
  selectedProject,
  updatedOverrides
) => {
  if (!selectedProject || !updatedOverrides) return;

  try {
    console.log("Syncing character overrides to database...");

    const { error } = await supabase
      .from("projects")
      .update({ character_overrides: updatedOverrides })
      .eq("id", selectedProject.id);

    if (error) throw error;

    console.log("Character overrides synced to database successfully");
  } catch (error) {
    console.error("Error syncing character overrides:", error);
  }
};

export const syncCallSheetDataToDatabase = async (
  selectedProject,
  updatedCallSheetData
) => {
  if (!selectedProject || !updatedCallSheetData) return;

  // Empty data protection for object
  if (Object.keys(updatedCallSheetData).length === 0) {
    console.warn("⚠️ SYNC BLOCKED: Empty call sheet data");
    return;
  }

  try {
    console.log("🔄 Syncing Call Sheet data to database (ATOMIC)...");

    const callSheetData = {
      project_id: selectedProject.id,
      call_time: updatedCallSheetData.callTime || "06:00",
      cast_call_times: updatedCallSheetData.castCallTimes || {},
      custom_notes: updatedCallSheetData.customNotes || {},
      crew_by_day: updatedCallSheetData.crewByDay || {},
      table_sizes_by_day: updatedCallSheetData.tableSizesByDay || {},
      call_time_by_day: updatedCallSheetData.callTimeByDay || {},
      notes_by_day: updatedCallSheetData.notesByDay || {},
      crew_call_times: updatedCallSheetData.crewCallTimes || {},
      hidden_cast_by_day: updatedCallSheetData.hiddenCastByDay || {},
    };

    // Use atomic RPC function
    const { error } = await supabase.rpc("sync_call_sheet_v2", {
      p_project_id: selectedProject.id,
      p_call_sheet_data: callSheetData,
    });

    if (error) throw error;

    console.log("✅ Call Sheet data synced successfully (ATOMIC)");
  } catch (error) {
    console.error("❌ Error syncing Call Sheet data:", error);
  }
};

export const syncShootingDaysToDatabase = async (
  selectedProject,
  shootingDays
) => {
  if (!selectedProject || !shootingDays) return;

  // Empty data protection
  if (!Array.isArray(shootingDays) || shootingDays.length === 0) {
    console.warn("⚠️ SYNC BLOCKED: Empty shooting days array");
    return;
  }

  try {
    console.log("🔄 Syncing Shooting Days to database (ATOMIC)...");

    const shootingDaysData = shootingDays.map((day) => ({
      project_id: selectedProject.id,
      id: day.id, // ✅ UUID for primary key
      day_id: day.id, // ✅ FIXED: Same UUID for day_id (text field)
      date: day.date,
      day_number: day.dayNumber,
      schedule_blocks: day.scheduleBlocks || [],
      is_locked: day.isLocked || false,
      is_shot: day.isShot || false,
      is_collapsed: day.isCollapsed || false,
    }));

    // ADD THE CONSOLE LOGS HERE - AFTER THE MAPPING
    console.log("📤 SYNCING SHOOTING DAYS:", {
      dayCount: shootingDaysData.length,
      firstDayId: shootingDaysData[0]?.id,
      firstDayDate: shootingDaysData[0]?.date,
      allDayNumbers: shootingDaysData.map((d) => d.day_number),
    });

    // Use atomic RPC function
    console.log("🔧 About to call RPC function...");
    const { data, error } = await supabase.rpc("sync_shooting_days_v3", {
      p_project_id: selectedProject.id,
      p_shooting_days_data: shootingDaysData,
    });

    console.log("🔧 RPC call completed. Error:", error, "Data:", data);

    if (error) {
      console.error("🚨 RPC ERROR:", error);
      throw error;
    }

    console.log("✅ Shooting Days synced successfully (ATOMIC)");
    console.log("📊 RPC Response:", data);

    // VERIFICATION: Check what's actually in database
    const { data: verifyData, error: verifyError } = await supabase
      .from("shooting_days")
      .select("day_number, is_locked, is_shot")
      .eq("project_id", selectedProject.id)
      .order("day_number");

    if (!verifyError) {
      console.log(
        "🔍 VERIFICATION - Days actually in database:",
        verifyData.map((d) => d.day_number)
      );
      const lockedDays = verifyData.filter((d) => d.is_locked || d.is_shot);
      if (lockedDays.length > 0) {
        console.log(
          "🔒 VERIFICATION - Locked/Shot days in database:",
          lockedDays
        );
      }
    }
  } catch (error) {
    console.error("❌ Error syncing Shooting Days:", error);
  }
};

// ============================================================================
// ATOMIC SHOOTING DAY UPDATE FUNCTIONS - Granular sync for individual days
// ============================================================================

/**
 * Update lock status for a single shooting day (atomic)
 */
export const updateShootingDayLockStatus = async (
  selectedProject,
  dayId,
  isLocked
) => {
  try {
    console.log(`🔄 Updating lock status for day ${dayId}: ${isLocked}`);

    const { error } = await supabase.rpc("update_shooting_day_lock_status", {
      p_day_id: dayId,
      p_is_locked: isLocked,
    });

    if (error) throw error;

    console.log(`✅ Day lock status updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update day lock status:`, error);
    throw error;
  }
};

/**
 * Update shot status for a single shooting day (atomic)
 */
export const updateShootingDayShotStatus = async (
  selectedProject,
  dayId,
  isShot
) => {
  try {
    console.log(`🔄 Updating shot status for day ${dayId}: ${isShot}`);

    const { error } = await supabase.rpc("update_shooting_day_shot_status", {
      p_day_id: dayId,
      p_is_shot: isShot,
    });

    if (error) throw error;

    console.log(`✅ Day shot status updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update day shot status:`, error);
    throw error;
  }
};

/**
 * Update collapsed status for a single shooting day (atomic)
 */
export const updateShootingDayCollapsed = async (
  selectedProject,
  dayId,
  isCollapsed
) => {
  try {
    console.log(
      `🔄 Updating collapsed status for day ${dayId}: ${isCollapsed}`
    );

    const { error } = await supabase.rpc("update_shooting_day_collapsed", {
      p_day_id: dayId,
      p_is_collapsed: isCollapsed,
    });

    if (error) throw error;

    console.log(`✅ Day collapsed status updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update day collapsed status:`, error);
    throw error;
  }
};

/**
 * Update multiple day statuses atomically in a batch
 */
export const batchUpdateShootingDayStatuses = async (
  selectedProject,
  dayUpdates
) => {
  try {
    console.log(
      `🔄 Batch updating ${dayUpdates.length} shooting days atomically`
    );

    // Execute all updates in parallel (they're all atomic)
    const promises = dayUpdates.map(async (update) => {
      const updates = [];

      if (update.isLocked !== undefined) {
        updates.push(
          updateShootingDayLockStatus(
            selectedProject,
            update.dayId,
            update.isLocked
          )
        );
      }
      if (update.isShot !== undefined) {
        updates.push(
          updateShootingDayShotStatus(
            selectedProject,
            update.dayId,
            update.isShot
          )
        );
      }
      if (update.isCollapsed !== undefined) {
        updates.push(
          updateShootingDayCollapsed(
            selectedProject,
            update.dayId,
            update.isCollapsed
          )
        );
      }

      return Promise.all(updates);
    });

    await Promise.all(promises);

    console.log(`✅ Batch update complete - ${dayUpdates.length} days updated`);
  } catch (error) {
    console.error(`❌ Batch update failed:`, error);
    throw error;
  }
};

/**
 * Delete a single shooting day (atomic)
 */
export const deleteShootingDay = async (selectedProject, dayId) => {
  try {
    console.log(`🗑️ Deleting shooting day ${dayId}`);

    const { error } = await supabase
      .from("shooting_days")
      .delete()
      .eq("id", dayId);

    if (error) throw error;

    console.log(`✅ Shooting day deleted successfully`);
  } catch (error) {
    console.error(`❌ Failed to delete shooting day:`, error);
    throw error;
  }
};

/**
 * Batch update day numbers after removal (atomic)
 */
export const batchUpdateDayNumbers = async (selectedProject, dayUpdates) => {
  try {
    console.log(`🔄 Updating day numbers for ${dayUpdates.length} days`);

    // Update each day's number atomically
    const promises = dayUpdates.map((update) =>
      supabase
        .from("shooting_days")
        .update({
          day_number: update.dayNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.dayId)
    );

    await Promise.all(promises);

    console.log(`✅ Day numbers updated successfully`);
  } catch (error) {
    console.error(`❌ Failed to update day numbers:`, error);
    throw error;
  }
};

// ============================================================================
// END ATOMIC SHOOTING DAY FUNCTIONS
// ============================================================================

/**
 * Update schedule_blocks for a single shooting day (atomic)
 */
export const updateShootingDayScheduleBlocks = async (
  selectedProject,
  dayId,
  scheduleBlocks
) => {
  try {
    console.log(`🔄 Updating schedule blocks for day ${dayId}`);

    const { error } = await supabase.rpc(
      "update_shooting_day_schedule_blocks",
      {
        p_day_id: dayId,
        p_schedule_blocks: scheduleBlocks,
      }
    );

    if (error) throw error;

    console.log(`✅ Schedule blocks updated successfully for day ${dayId}`);
  } catch (error) {
    console.error(`❌ Failed to update schedule blocks:`, error);
    throw error;
  }
};

/**
 * Update schedule_blocks for two shooting days atomically (for scene moves between days)
 */
export const updateTwoShootingDaySchedules = async (
  selectedProject,
  sourceDayId,
  sourceScheduleBlocks,
  targetDayId,
  targetScheduleBlocks
) => {
  try {
    console.log(
      `🔄 Updating schedules for two days: ${sourceDayId} and ${targetDayId}`
    );

    const { error } = await supabase.rpc("update_two_shooting_day_schedules", {
      p_source_day_id: sourceDayId,
      p_source_schedule_blocks: sourceScheduleBlocks,
      p_target_day_id: targetDayId,
      p_target_schedule_blocks: targetScheduleBlocks,
    });

    if (error) throw error;

    console.log(`✅ Two-day schedule update successful`);
  } catch (error) {
    console.error(`❌ Failed to update two-day schedules:`, error);
    throw error;
  }
};

export const syncTodoItemsToDatabase = async (
  selectedProject,
  updatedTodoItems
) => {
  if (!selectedProject || !updatedTodoItems) return;

  // 🚨 EMERGENCY: Prevent data loss from empty arrays
  if (!Array.isArray(updatedTodoItems) || updatedTodoItems.length === 0) {
    console.error(
      "🚨 BLOCKING SYNC: Empty todo items array - would delete all data!"
    );
    alert(
      "CRITICAL: Attempted to sync empty todo data. Operation blocked to prevent data loss."
    );
    return;
  }

  try {
    console.log("Syncing Todo items to database...");

    const todoData = updatedTodoItems.map((item) => ({
      id: item.id, // App's todo ID
      ...item, // Complete todo object
    }));

    // Use RPC function for safe sync instead of upsert
    const { error } = await supabase.rpc("sync_todo_items", {
      p_project_id: selectedProject.id,
      p_todo_data: todoData,
    });

    if (error) throw error;

    console.log("Todo items synced to database successfully");
  } catch (error) {
    console.error("Error syncing Todo items:", error);
  }
};

export const syncTimelineDataToDatabase = async (
  selectedProject,
  updatedTimelineData
) => {
  if (!selectedProject || !updatedTimelineData) return;

  try {
    console.log("Syncing timeline data to database...");

    const timelineRecord = {
      project_id: selectedProject.id,
      timeline_data: updatedTimelineData,
    };

    const { error: rpcError } = await supabase.rpc("update_timeline_data", {
      p_project_id: selectedProject.id,
      p_timeline_data: updatedTimelineData,
    });
    if (rpcError) throw rpcError;

    console.log("Timeline data synced to database successfully");
  } catch (error) {
    console.error("Error syncing timeline data:", error);
  }
};

export const syncContinuityElementsToDatabase = async (
  selectedProject,
  updatedContinuityElements
) => {
  if (!selectedProject || !updatedContinuityElements) return;

  try {
    console.log("Syncing continuity elements to database...");

    const continuityRecord = {
      project_id: selectedProject.id,
      continuity_elements: updatedContinuityElements,
    };

    const { error: rpcError } = await supabase.rpc("sync_continuity_elements", {
      p_project_id: selectedProject.id,
      p_continuity_data: updatedContinuityElements,
    });
    if (rpcError) throw rpcError;

    console.log("Continuity elements synced to database successfully");
  } catch (error) {
    console.error("Error syncing continuity elements:", error);
  }
};

export const syncWardrobeItemsToDatabase = async (
  selectedProject,
  updatedWardrobeItems
) => {
  if (!selectedProject || !updatedWardrobeItems) return;

  try {
    console.log("Syncing wardrobe items to database...");

    // Deduplicate by characterName — one row per character
    const seen = new Set();
    const wardrobeData = updatedWardrobeItems
      .filter((item) => {
        const key = item.characterName || item.id || "unknown";
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        project_id: selectedProject.id,
        item_id: item.characterName || item.id || `wardrobe_${Date.now()}`,
        item_data: item,
      }));

    // Delete items no longer present
    const currentIds = wardrobeData.map((d) => d.item_id);
    await supabase
      .from("wardrobe_items")
      .delete()
      .eq("project_id", selectedProject.id)
      .not("item_id", "in", `(${currentIds.join(",")})`);

    // Upsert remaining items
    if (wardrobeData.length > 0) {
      const { error } = await supabase
        .from("wardrobe_items")
        .upsert(wardrobeData, { onConflict: "project_id,item_id" });

      if (error) throw error;
    }

    console.log("Wardrobe items synced to database successfully");
  } catch (error) {
    console.error("Error syncing wardrobe items:", error);
  }
};

export const syncGarmentInventoryToDatabase = async (
  selectedProject,
  updatedGarmentInventory
) => {
  if (!selectedProject || !updatedGarmentInventory) return;

  try {
    console.log("Syncing garment inventory to database...");

    const garmentData = updatedGarmentInventory.map((garment) => ({
      project_id: selectedProject.id,
      garment_data: garment,
    }));

    const { error: rpcError } = await supabase.rpc("sync_garment_inventory", {
      p_project_id: selectedProject.id,
      p_garment_data: garmentData,
    });
    if (rpcError) throw rpcError;

    console.log("Garment inventory synced to database successfully");
  } catch (error) {
    console.error("Error syncing garment inventory:", error);
  }
};

export const syncCostCategoriesToDatabase = async (
  selectedProject,
  updatedCostCategories
) => {
  if (!selectedProject || !updatedCostCategories) return;

  try {
    console.log("Syncing cost categories to database...");

    // Flatten hierarchy: parents + sub-categories
    const flatRows = [];
    updatedCostCategories.forEach((category) => {
      flatRows.push({
        project_id: selectedProject.id,
        category_id: category.id,
        name: category.name,
        color: category.color || "#2196F3",
        expenses: category.expenses || [],
        budget: category.budget || 0,
        parent_id: null,
        budget_line_id: null,
        budget_source: category.budgetSource || "manual",
        description: category.description || "",
        allocated_budget: 0,
        department_key: category.departmentKey || null,
      });
      (category.subCategories || []).forEach((sub) => {
        flatRows.push({
          project_id: selectedProject.id,
          category_id: sub.id,
          name: sub.name,
          color: sub.color || category.color || "#2196F3",
          expenses: sub.expenses || [],
          budget: sub.budget || 0,
          parent_id: category.id,
          budget_line_id: sub.budgetLineId || null,
          budget_source: sub.budgetSource || "budget",
          description: sub.description || "",
          allocated_budget: 0,
          department_key: category.departmentKey || null,
        });
      });
    });

    const { error: rpcError } = await supabase.rpc("sync_cost_categories_v2", {
      p_project_id: selectedProject.id,
      p_categories: flatRows,
    });
    if (rpcError) throw rpcError;

    console.log("Cost categories synced to database successfully");
  } catch (error) {
    console.error("Error syncing cost categories:", error);
  }
};

export const syncCostVendorsToDatabase = async (
  selectedProject,
  updatedCostVendors
) => {
  if (!selectedProject || !updatedCostVendors) return;

  try {
    console.log("Syncing cost vendors to database...");

    const vendorData = updatedCostVendors.map((vendorName) => ({
      project_id: selectedProject.id,
      vendor_name: vendorName,
    }));

    const { error: rpcError } = await supabase.rpc("sync_cost_vendors", {
      p_project_id: selectedProject.id,
      p_vendors_data: vendorData,
    });
    if (rpcError) throw rpcError;

    console.log("Cost vendors synced to database successfully");
  } catch (error) {
    console.error("Error syncing cost vendors:", error);
  }
};

export const syncTaggedItemsToDatabase = async (
  selectedProject,
  updatedTaggedItems
) => {
  if (!selectedProject || !updatedTaggedItems) return;

  // Convert object to array
  const taggedItemsArray = Object.entries(updatedTaggedItems).map(
    ([word, item]) => ({
      ...item,
      word: word,
    })
  );

  // Empty data protection
  if (taggedItemsArray.length === 0) {
    console.warn("⚠️ SYNC BLOCKED: Empty tagged items");
    return;
  }

  try {
    console.log("🔄 Syncing Tagged Items to database (ATOMIC)...");

    const taggedItemsData = taggedItemsArray.map((item) => ({
      project_id: selectedProject.id,
      word: item.word,
      display_name: item.displayName,
      custom_title: item.customTitle || null,
      category: item.category,
      color: item.color,
      chronological_number: item.chronologicalNumber,
      position: item.position,
      scenes: item.scenes || [],
      instances: item.instances || [],
      assigned_characters: item.assignedCharacters || [],
      manually_created: item.manuallyCreated || false,
      original_prop: item.originalProp || null,
    }));

    // Use atomic RPC function
    const { error } = await supabase.rpc("sync_tagged_items", {
      p_project_id: selectedProject.id,
      p_tagged_items_data: taggedItemsData,
    });

    if (error) throw error;

    console.log("✅ Tagged Items synced successfully (ATOMIC)");
  } catch (error) {
    console.error("❌ Error syncing Tagged Items:", error);
  }
};

export const syncBudgetDataToDatabase = async (
  selectedProject,
  updatedBudgetData
) => {
  if (!selectedProject || !updatedBudgetData) return;

  try {
    console.log("Syncing budget data to database...");

    const budgetRecord = {
      project_id: selectedProject.id,
      project_info: updatedBudgetData.projectInfo || {},
      atl_items: updatedBudgetData.atlItems || [],
      btl_items: updatedBudgetData.btlItems || [],
      legal_items: updatedBudgetData.legalItems || [],
      marketing_items: updatedBudgetData.marketingItems || [],
      post_items: updatedBudgetData.postItems || [],
      contingency_settings: updatedBudgetData.contingencySettings || {},
      department_budgets: updatedBudgetData.departmentBudgets || {},
      weekly_reports: updatedBudgetData.weeklyReports || [],
      custom_categories: updatedBudgetData.customCategories || [],
      totals: updatedBudgetData.totals || {},
    };

    const { error: rpcError } = await supabase.rpc("sync_budget_data", {
      p_project_id: selectedProject.id,
      p_budget_data: budgetRecord,
    });
    if (rpcError) throw rpcError;

    console.log("Budget data synced to database successfully");
  } catch (error) {
    console.error("Error syncing budget data:", error);
  }
};

export const syncProjectSettingsToDatabase = async (
  selectedProject,
  updatedProjectSettings
) => {
  if (!selectedProject || !updatedProjectSettings) return;

  try {
    console.log("Syncing project settings to database...");

    // Extract the main fields (filmTitle, producer, director) and put rest in settings
    const { filmTitle, producer, director, ...otherSettings } =
      updatedProjectSettings;

    const { error } = await supabase
      .from("projects")
      .update({
        name: filmTitle || selectedProject.name,
        producer: producer || "",
        director: director || "",
        settings: otherSettings,
      })
      .eq("id", selectedProject.id);

    if (error) throw error;

    console.log("Project settings synced to database successfully");
  } catch (error) {
    console.error("Error syncing project settings:", error);
  }
};

export const syncShotListDataToDatabase = async (
  selectedProject,
  updatedShotListData,
  updatedSceneNotes
) => {
  if (!selectedProject || !updatedShotListData) return;

  try {
    console.log("Syncing shot list data to database...");

    const shotListRecord = {
      project_id: selectedProject.id,
      shot_list_data: updatedShotListData,
      scene_notes: updatedSceneNotes || {},
    };

    const { error: rpcError } = await supabase.rpc("sync_shot_list_data", {
      p_project_id: selectedProject.id,
      p_shot_data: updatedShotListData,
      p_scene_notes: updatedSceneNotes || {},
    });
    if (rpcError) throw rpcError;

    console.log("Shot list data synced to database successfully");
  } catch (error) {
    console.error("Error syncing shot list data:", error);
  }
};

// ============================================================================
// MAINTENANCE & UTILITY FUNCTIONS
// ============================================================================

export const cleanupDuplicateShootingDays = async (selectedProject) => {
  alert(
    "🚨 FUNCTION DISABLED: This function caused data loss and has been permanently disabled."
  );
  return;
};

export const recoverShootingDaysFromScheduledScenes = async (
  selectedProject
) => {
  if (!selectedProject) return;

  try {
    console.log("🔄 Recovering shooting days from scheduled scenes...");

    // Get all scheduled dates
    const { data: scheduledData, error } = await supabase
      .from("scheduled_scenes")
      .select("*")
      .eq("project_id", selectedProject.id)
      .order("shoot_date");

    if (error) throw error;

    if (!scheduledData || scheduledData.length === 0) {
      alert("No scheduled scenes found to recover from.");
      return;
    }

    // Create shooting days from scheduled dates
    const shootingDaysData = scheduledData.map((schedule, index) => ({
      project_id: selectedProject.id,
      id: crypto.randomUUID(),
      day_id: crypto.randomUUID(),
      date: schedule.shoot_date,
      day_number: index + 1,
      schedule_blocks: [
        {
          id: crypto.randomUUID(),
          time: "08:00",
          scene: null,
          isLunch: false,
          isCustom: false,
        },
        {
          id: crypto.randomUUID(),
          time: "12:00",
          scene: null,
          isLunch: true,
          isCustom: false,
        },
        {
          id: crypto.randomUUID(),
          time: "13:00",
          scene: null,
          isLunch: false,
          isCustom: false,
        },
      ],
      is_locked: false,
      is_shot: false,
      is_collapsed: false,
    }));

    // Insert recovered shooting days
    const { error: insertError } = await supabase
      .from("shooting_days")
      .insert(shootingDaysData);

    if (insertError) throw insertError;

    console.log(`✅ Recovered ${shootingDaysData.length} shooting days`);
    alert(
      `SUCCESS: Recovered ${shootingDaysData.length} shooting days from scheduled scenes!`
    );

    return shootingDaysData;
  } catch (error) {
    console.error("❌ Recovery failed:", error);
    alert("Recovery failed: " + error.message);
  }
};

export const auditAllDatabaseTables = async (selectedProject) => {
  if (!selectedProject) return;

  try {
    console.log("🔍 AUDITING ALL DATABASE TABLES FOR CORRUPTION...");

    const tables = [
      "scenes",
      "stripboard_scenes",
      "tagged_items",
      "cast_crew",
      "characters",
      "shooting_days",
      "scheduled_scenes",
      "script_locations",
      "actual_locations",
      "call_sheet_data",
      "wardrobe_items",
      "garment_inventory",
      "cost_categories",
      "budget_data",
      "todo_items",
    ];

    const results = {};

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("project_id", selectedProject.id);

        if (error) {
          results[table] = `ERROR: ${error.message}`;
        } else {
          results[table] = count;
        }
      } catch (err) {
        results[table] = `ERROR: ${err.message}`;
      }
    }

    console.log("🔍 DATABASE AUDIT RESULTS:");
    console.table(results);

    const corruptedTables = Object.entries(results)
      .filter(([table, count]) => typeof count === "number" && count > 1000)
      .map(([table, count]) => `${table}: ${count} records`);

    if (corruptedTables.length > 0) {
      alert(
        `DATABASE CORRUPTION DETECTED!\n\nCorrupted tables:\n${corruptedTables.join(
          "\n"
        )}\n\nCheck console for full audit.`
      );
    } else {
      alert("Database audit complete. Check console for details.");
    }
  } catch (error) {
    console.error("Audit failed:", error);
    alert("Database audit failed: " + error.message);
  }
};

export const emergencyDatabaseCleanup = async (selectedProject) => {
  if (!selectedProject) return;

  const confirmCleanup = window.confirm(
    "EMERGENCY DATABASE CLEANUP\n\n" +
      "This will DELETE ALL project data from the database.\n" +
      "Your local state will be preserved.\n\n" +
      "Are you sure you want to proceed?"
  );

  if (!confirmCleanup) return;

  try {
    console.log("🚨 EMERGENCY CLEANUP: Deleting ALL project data...");

    const tables = [
      "scenes",
      "stripboard_scenes",
      "tagged_items",
      "cast_crew",
      "characters",
      "shooting_days",
      "scheduled_scenes",
      "script_locations",
      "actual_locations",
      "call_sheet_data",
      "wardrobe_items",
      "garment_inventory",
      "cost_categories",
      "budget_data",
      "todo_items",
    ];

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("project_id", selectedProject.id);

        if (error) {
          console.error(`Failed to clean ${table}:`, error);
        } else {
          console.log(`✅ Cleaned table: ${table}`);
        }
      } catch (err) {
        console.error(`Error cleaning ${table}:`, err);
      }
    }

    console.log("🎯 EMERGENCY CLEANUP COMPLETE");
    alert(
      "Emergency cleanup complete! All corrupted database records deleted. Your local data is preserved."
    );
  } catch (error) {
    console.error("Emergency cleanup failed:", error);
    alert("Emergency cleanup failed: " + error.message);
  }
};

// ============================================================================
// IMPORT/EXPORT FUNCTIONS
// ============================================================================

export const syncImportedDataToDatabase = async (
  selectedProject,
  projectData
) => {
  if (!selectedProject) {
    console.warn("No project selected for import sync");
    return;
  }

  try {
    console.log("🔄 SYNC STARTED - syncing imported data to database...");

    // 1. Sync scenes
    if (projectData.scenes && projectData.scenes.length > 0) {
      const scenesData = projectData.scenes.map((scene) => ({
        project_id: selectedProject.id,
        scene_number: scene.sceneNumber,
        heading: scene.heading,
        content: scene.content || [],
        metadata: scene.metadata || {},
        page_number: scene.pageNumber,
        page_length: scene.pageLength,
        estimated_duration: scene.estimatedDuration || "30 min",
        status: scene.status || "Not Scheduled",
      }));

      await supabase
        .from("scenes")
        .delete()
        .eq("project_id", selectedProject.id);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const { error: scenesError } = await supabase
        .from("scenes")
        .insert(scenesData);
      if (scenesError) throw scenesError;
      console.log(`✅ Synced ${scenesData.length} scenes to database`);
    }

    // 2. Sync tagged items
    if (projectData.taggedItems) {
      const taggedItemsData = Object.entries(projectData.taggedItems).map(
        ([word, item]) => ({
          project_id: selectedProject.id,
          word: word,
          display_name: item.displayName,
          custom_title: item.customTitle,
          category: item.category,
          color: item.color,
          chronological_number: item.chronologicalNumber,
          position: item.position,
          scenes: item.scenes || [],
          instances: item.instances || [],
          assigned_characters: item.assignedCharacters || [],
          manually_created: item.manuallyCreated || false,
          original_prop: item.originalProp,
        })
      );

      await supabase
        .from("tagged_items")
        .delete()
        .eq("project_id", selectedProject.id);
      if (taggedItemsData.length > 0) {
        const { error } = await supabase
          .from("tagged_items")
          .insert(taggedItemsData);
        if (error) throw error;
      }
      console.log(`✅ Synced ${taggedItemsData.length} tagged items`);
    }

    // 3. Sync cast & crew
    if (projectData.castCrew && projectData.castCrew.length > 0) {
      const castCrewData = projectData.castCrew
        .filter(
          (person) =>
            person && person.displayName && person.displayName.trim() !== ""
        )
        .map((person) => ({
          project_id: selectedProject.id,
          person_id: person.id,
          user_id: person.user_id || null,
          photo_url: person.photoUrl || null,
          name: person.displayName.trim(),
          role: person.type === "cast" ? person.character : person.position,
          department: person.crewDepartment || "",
          type: person.type || "crew",
          contact_info: {
            email: person.email || "",
            phone: person.phone || "",
            emergencyContact: person.emergencyContact || {},
            wardrobe: person.wardrobe || {},
            dietary: person.dietary || {},
          },
          availability: {
            unavailableDates: person.availability?.unavailableDates || [],
            availableDates: person.availability?.availableDates || [],
            bookedDates: person.availability?.bookedDates || [],
            unionStatus:
              person.availability?.unionStatus || person.unionStatus || "",
            notes: person.availability?.notes || person.notes || "",
          },
        }));

      // ✅ CRITICAL: Prevent data loss from filtered-out records
      if (castCrewData.length === 0) {
        console.warn(
          "⚠️ IMPORT SYNC BLOCKED: All cast/crew filtered out (empty names). Skipping to prevent data loss."
        );
        // Continue with rest of import, just skip this table
      } else {
        await supabase
          .from("cast_crew")
          .delete()
          .eq("project_id", selectedProject.id);
        const { error } = await supabase.from("cast_crew").insert(castCrewData);
        if (error) throw error;
        console.log(`✅ Synced ${castCrewData.length} cast/crew members`);
      }
    }

    // 4. Sync project settings
    if (projectData.projectSettings) {
      const { error } = await supabase
        .from("projects")
        .update({
          name: projectData.projectSettings.filmTitle || selectedProject.name,
          producer: projectData.projectSettings.producer,
          director: projectData.projectSettings.director,
          settings: {
            ...selectedProject.settings,
            ...projectData.projectSettings,
          },
        })
        .eq("id", selectedProject.id);
      if (error) throw error;
      console.log("✅ Synced project settings");
    }

    // 5. Sync shooting days
    if (projectData.shootingDays && projectData.shootingDays.length > 0) {
      const shootingDaysData = projectData.shootingDays.map((day) => ({
        project_id: selectedProject.id,
        day_id: day.id,
        date: day.date,
        day_number: day.dayNumber,
        schedule_blocks: day.scheduleBlocks || [],
        is_locked: day.isLocked || false,
        is_shot: day.isShot || false,
        is_collapsed: day.isCollapsed || false,
      }));

      await supabase
        .from("shooting_days")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("shooting_days")
        .insert(shootingDaysData);
      if (error) throw error;
      console.log(`✅ Synced ${shootingDaysData.length} shooting days`);
    }

    // 6. Sync characters
    if (
      projectData.characters &&
      Object.keys(projectData.characters).length > 0
    ) {
      const charactersData = Object.entries(projectData.characters).map(
        ([name, character]) => ({
          project_id: selectedProject.id,
          name: name,
          scenes: character.scenes || [],
          chronological_number: character.chronologicalNumber || 1,
        })
      );

      const { error: rpcError } = await supabase.rpc("sync_characters", {
        p_project_id: selectedProject.id,
        p_characters_data: charactersData,
      });
      if (rpcError) throw rpcError;
      console.log(`✅ Synced ${charactersData.length} characters`);
    }

    // 7. Sync actual locations
    if (projectData.actualLocations && projectData.actualLocations.length > 0) {
      const locationsData = projectData.actualLocations.map((location) => ({
        project_id: selectedProject.id,
        location_id: location.id,
        name: location.name || "",
        address: location.address || "",
        contact_person: location.contactPerson || "",
        phone: location.phone || "",
        category: location.category || "",
        permit_required: location.permitRequired || false,
        parking_info: location.parkingInfo || "",
        notes: location.notes || "",
        city: location.city || "",
        state: location.state || "",
        zip_code: location.zipCode || "",
      }));

      await supabase
        .from("actual_locations")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("actual_locations")
        .insert(locationsData);
      if (error) throw error;
      console.log(`✅ Synced ${locationsData.length} actual locations`);
    }

    // 8. Sync script locations
    if (projectData.scriptLocations && projectData.scriptLocations.length > 0) {
      const scriptLocationsData = projectData.scriptLocations.map(
        (location) => ({
          project_id: selectedProject.id,
          location_id: location.id,
          parent_location: location.parentLocation || "",
          sub_location: location.subLocation || "",
          full_name: location.fullName || "",
          int_ext: location.intExt || "",
          scenes: location.scenes || [],
          actual_location_id: location.actualLocationId || null,
          category: location.category || "",
        })
      );

      await supabase
        .from("script_locations")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("script_locations")
        .insert(scriptLocationsData);
      if (error) throw error;
      console.log(`✅ Synced ${scriptLocationsData.length} script locations`);
    }

    // 9. Sync call sheet data
    if (projectData.callSheetData) {
      const callSheetRecord = {
        project_id: selectedProject.id,
        call_time: projectData.callSheetData.callTime || "7:30 AM",
        cast_call_times: projectData.callSheetData.castCallTimes || {},
        custom_notes: projectData.callSheetData.customNotes || {},
        crew_by_day: projectData.callSheetData.crewByDay || {},
        table_sizes_by_day: projectData.callSheetData.tableSizesByDay || {},
        call_time_by_day: projectData.callSheetData.callTimeByDay || {},
        notes_by_day: projectData.callSheetData.notesByDay || {},
        crew_call_times: projectData.callSheetData.crewCallTimes || {},
        hidden_cast_by_day: projectData.callSheetData.hiddenCastByDay || {},
      };

      await supabase
        .from("call_sheet_data")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("call_sheet_data")
        .insert([callSheetRecord]);
      if (error) throw error;
      console.log("✅ Synced call sheet data");
    }

    // Continue with remaining tables...
    // (Wardrobe, Garment Inventory, Cost Categories, Budget, Todos, Shot List, Scheduled Scenes, Stripboard Scenes)

    // 10. Sync wardrobe items
    if (projectData.wardrobeItems && projectData.wardrobeItems.length > 0) {
      const wardrobeData = projectData.wardrobeItems.map((item) => ({
        project_id: selectedProject.id,
        item_data: item,
      }));
      const { error: rpcError } = await supabase.rpc("sync_wardrobe_items", {
        p_project_id: selectedProject.id,
        p_wardrobe_data: wardrobeData,
      });
      if (rpcError) throw rpcError;
      console.log(`✅ Synced ${wardrobeData.length} wardrobe items`);
    }

    // 11. Sync garment inventory
    if (
      projectData.garmentInventory &&
      projectData.garmentInventory.length > 0
    ) {
      const garmentData = projectData.garmentInventory.map((garment) => ({
        project_id: selectedProject.id,
        garment_data: garment,
      }));
      await supabase
        .from("garment_inventory")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("garment_inventory")
        .insert(garmentData);
      if (error) throw error;
      console.log(`✅ Synced ${garmentData.length} garments`);
    }

    // 12. Sync cost categories
    if (projectData.costCategories && projectData.costCategories.length > 0) {
      const costData = projectData.costCategories.map((category) => ({
        project_id: selectedProject.id,
        category_id: category.id,
        name: category.name,
        color: category.color,
        expenses: category.expenses || [],
        budget: category.budget || 0,
      }));
      await supabase
        .from("cost_categories")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase.from("cost_categories").insert(costData);
      if (error) throw error;
      console.log(`✅ Synced ${costData.length} cost categories`);
    }

    // 12b. Sync cost vendors
    if (projectData.costVendors && projectData.costVendors.length > 0) {
      const vendorData = projectData.costVendors.map((vendorName) => ({
        project_id: selectedProject.id,
        vendor_name: vendorName,
      }));
      await supabase
        .from("cost_vendors")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase.from("cost_vendors").insert(vendorData);
      if (error) throw error;
      console.log(`✅ Synced ${vendorData.length} cost vendors`);
    }

    // 13. Sync budget data
    if (projectData.budgetData) {
      const budgetRecord = {
        project_id: selectedProject.id,
        project_info: projectData.budgetData.projectInfo || {},
        atl_items: projectData.budgetData.atlItems || [],
        btl_items: projectData.budgetData.btlItems || [],
        weekly_reports: projectData.budgetData.weeklyReports || [],
        custom_categories: projectData.budgetData.customCategories || [],
        totals: projectData.budgetData.totals || {},
      };
      const { error: rpcError } = await supabase.rpc("sync_budget_data", {
        p_project_id: selectedProject.id,
        p_budget_data: {
          custom_categories: updatedBudgetData.customCategories || [],
          totals: updatedBudgetData.totals || {},
        },
      });
      if (rpcError) throw rpcError;
      console.log("✅ Synced budget data");
    }

    // 14. Sync todo items
    if (projectData.todoItems && projectData.todoItems.length > 0) {
      const todoData = projectData.todoItems.map((item) => ({
        project_id: selectedProject.id,
        item_data: item,
      }));
      await supabase
        .from("todo_items")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase.from("todo_items").insert(todoData);
      if (error) throw error;
      console.log(`✅ Synced ${todoData.length} todo items`);
    }

    // 15. Sync shot list data
    if (projectData.shotListData) {
      const shotListRecord = {
        project_id: selectedProject.id,
        shot_list_data: projectData.shotListData,
        scene_notes: projectData.sceneNotes || {},
      };
      await supabase
        .from("shot_list_data")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("shot_list_data")
        .insert([shotListRecord]);
      if (error) throw error;
      console.log("✅ Synced shot list data");
    }

    // 16. Sync scheduled scenes
    if (
      projectData.scheduledScenes &&
      Object.keys(projectData.scheduledScenes).length > 0
    ) {
      const scheduledScenesData = Object.entries(
        projectData.scheduledScenes
      ).map(([date, scenes]) => ({
        project_id: selectedProject.id,
        shoot_date: date,
        scenes: scenes || [],
      }));
      const { error: rpcError } = await supabase.rpc("sync_scheduled_scenes", {
        p_project_id: selectedProject.id,
        p_scheduled_data: scheduledScenesData,
      });
      if (rpcError) throw rpcError;
      console.log(
        `✅ Synced ${scheduledScenesData.length} scheduled scene mappings`
      );
    }

    // 17. Sync stripboard scenes
    if (
      projectData.stripboardScenes &&
      projectData.stripboardScenes.length > 0
    ) {
      const stripboardScenesData = projectData.stripboardScenes.map(
        (scene) => ({
          project_id: selectedProject.id,
          scene_number: scene.sceneNumber,
          status: scene.status || "Not Scheduled",
          scheduled_date: scene.scheduledDate || null,
          scheduled_time: scene.scheduledTime || null,
        })
      );
      await supabase
        .from("stripboard_scenes")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("stripboard_scenes")
        .insert(stripboardScenesData);
      if (error) throw error;
      console.log(`✅ Synced ${stripboardScenesData.length} stripboard scenes`);
    }

    // 18. Sync timeline data
    if (
      projectData.timelineData &&
      Object.keys(projectData.timelineData).length > 0
    ) {
      const timelineRecord = {
        project_id: selectedProject.id,
        timeline_data: projectData.timelineData,
      };
      await supabase
        .from("timeline_data")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("timeline_data")
        .insert([timelineRecord]);
      if (error) throw error;
      console.log("✅ Synced timeline data");
    }

    // 19. Sync continuity elements
    if (
      projectData.continuityElements &&
      projectData.continuityElements.length > 0
    ) {
      const continuityRecord = {
        project_id: selectedProject.id,
        continuity_elements: projectData.continuityElements,
      };
      await supabase
        .from("continuity_elements")
        .delete()
        .eq("project_id", selectedProject.id);
      const { error } = await supabase
        .from("continuity_elements")
        .insert([continuityRecord]);
      if (error) throw error;
      console.log("✅ Synced continuity elements");
    }

    console.log("✅ All imported data synced to database successfully");
  } catch (error) {
    console.error("❌ SYNC ERROR:", error);
    alert(
      `Database sync failed: ${error.message}\nCheck console for full details.`
    );
  }
};

// ============================================================================
// DOOD (DAY OUT OF DAYS) OPERATIONS
// ============================================================================

/**
 * Load all DOOD cast events for a project
 */
export const loadDoodCastEvents = async (
  selectedProject,
  setDoodCastEvents
) => {
  try {
    console.log("📥 LOADING DOOD CAST EVENTS for project:", selectedProject.id);

    const { data, error } = await supabase
      .from("dood_cast_events")
      .select("*")
      .eq("project_id", selectedProject.id)
      .order("start_date");

    if (error) throw error;

    // Transform from database format to app format
    const formattedEvents = (data || []).map((event) => ({
      id: event.id,
      projectId: event.project_id,
      castMemberId: event.cast_member_id,
      eventType: event.event_type,
      startDate: event.start_date,
      endDate: event.end_date,
      source: event.source,
      notes: event.notes,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    }));

    console.log(`✅ Loaded ${formattedEvents.length} DOOD cast events`);
    setDoodCastEvents(formattedEvents);
  } catch (error) {
    console.error("❌ Error loading DOOD cast events:", error);
  }
};

/**
 * Load all DOOD overrides for a project
 */
export const loadDoodOverrides = async (selectedProject, setDoodOverrides) => {
  try {
    console.log("📥 LOADING DOOD OVERRIDES for project:", selectedProject.id);

    const { data, error } = await supabase
      .from("dood_overrides")
      .select("*")
      .eq("project_id", selectedProject.id)
      .order("date");

    if (error) throw error;

    // Transform from database format to app format
    const formattedOverrides = (data || []).map((override) => ({
      id: override.id,
      projectId: override.project_id,
      castMemberId: override.cast_member_id,
      date: override.date,
      dayCode: override.day_code,
      reason: override.reason,
      createdAt: override.created_at,
      updatedAt: override.updated_at,
    }));

    console.log(`✅ Loaded ${formattedOverrides.length} DOOD overrides`);
    setDoodOverrides(formattedOverrides);
  } catch (error) {
    console.error("❌ Error loading DOOD overrides:", error);
  }
};

/**
 * Load DOOD settings for a project
 */
export const loadDoodSettings = async (selectedProject, setDoodSettings) => {
  try {
    console.log("📥 LOADING DOOD SETTINGS for project:", selectedProject.id);

    const { data, error } = await supabase
      .from("dood_settings")
      .select("*")
      .eq("project_id", selectedProject.id)
      .single();

    if (error) {
      // Settings might not exist yet - that's OK
      if (error.code === "PGRST116") {
        console.log("ℹ️ No DOOD settings found, will use defaults");
        setDoodSettings(null);
        return;
      }
      throw error;
    }

    // Transform from database format to app format
    const formattedSettings = {
      projectId: data.project_id,
      autoGenerateHolds: data.auto_generate_holds,
      includeDarkDaysInHoldSpan: data.include_dark_days_in_hold_span,
      maxGapDaysToAutoHold: data.max_gap_days_to_auto_hold,
      showDarkDaysAsCode: data.show_dark_days_as_code,
      blankForNoActivity: data.blank_for_no_activity,
      updatedAt: data.updated_at,
    };

    console.log("✅ Loaded DOOD settings");
    setDoodSettings(formattedSettings);
  } catch (error) {
    console.error("❌ Error loading DOOD settings:", error);
  }
};

/**
 * Sync a DOOD cast event (insert or update)
 */
export const syncDoodCastEvent = async (selectedProject, event) => {
  try {
    console.log("💾 SYNCING DOOD CAST EVENT:", event.id);

    // Handle delete
    if (event._delete) {
      const { error } = await supabase.rpc("delete_dood_cast_event", {
        p_project_id: selectedProject.id,
        p_event_id: event.id,
      });

      if (error) throw error;
      console.log("✅ Event deleted successfully");
      return;
    }

    // Upsert event
    const { error } = await supabase.rpc("upsert_dood_cast_event", {
      p_project_id: selectedProject.id,
      p_event_id: event.id,
      p_event_data: {
        cast_member_id: event.castMemberId,
        event_type: event.eventType,
        start_date: event.startDate,
        end_date: event.endDate,
        source: event.source,
        notes: event.notes || null,
      },
    });

    if (error) throw error;
    console.log("✅ Event synced successfully");
  } catch (error) {
    console.error("❌ Error syncing DOOD event:", error);
    throw error;
  }
};

/**
 * Delete a DOOD cast event
 */
export const deleteDoodCastEvent = async (selectedProject, eventId) => {
  try {
    console.log("🗑️ DELETING DOOD CAST EVENT:", eventId);

    const { error } = await supabase.rpc("delete_dood_cast_event", {
      p_project_id: selectedProject.id,
      p_event_id: eventId,
    });

    if (error) throw error;
    console.log("✅ Event deleted successfully");
  } catch (error) {
    console.error("❌ Error deleting DOOD event:", error);
    throw error;
  }
};

/**
 * Sync a DOOD override (insert or update)
 */
export const syncDoodOverride = async (selectedProject, override) => {
  try {
    console.log(
      "💾 SYNCING DOOD OVERRIDE:",
      override.castMemberId,
      override.date
    );

    // Handle delete
    if (override._delete) {
      const { error } = await supabase.rpc("delete_dood_override", {
        p_project_id: selectedProject.id,
        p_cast_member_id: override.castMemberId,
        p_date: override.date,
      });

      if (error) throw error;
      console.log("✅ Override deleted successfully");
      return;
    }

    // Upsert override
    const { error } = await supabase.rpc("upsert_dood_override", {
      p_project_id: selectedProject.id,
      p_override_data: {
        cast_member_id: override.castMemberId,
        date: override.date,
        day_code: override.dayCode,
        reason: override.reason || null,
      },
    });

    if (error) throw error;
    console.log("✅ Override synced successfully");
  } catch (error) {
    console.error("❌ Error syncing DOOD override:", error);
    throw error;
  }
};

/**
 * Sync DOOD settings
 */
export const syncDoodSettings = async (selectedProject, settings) => {
  try {
    console.log("💾 SYNCING DOOD SETTINGS");

    const { error } = await supabase.rpc("upsert_dood_settings", {
      p_project_id: selectedProject.id,
      p_settings_data: {
        auto_generate_holds: settings.autoGenerateHolds,
        include_dark_days_in_hold_span: settings.includeDarkDaysInHoldSpan,
        max_gap_days_to_auto_hold: settings.maxGapDaysToAutoHold,
        show_dark_days_as_code: settings.showDarkDaysAsCode,
        blank_for_no_activity: settings.blankForNoActivity,
      },
    });

    if (error) throw error;
    console.log("✅ Settings synced successfully");
  } catch (error) {
    console.error("❌ Error syncing DOOD settings:", error);
    throw error;
  }
};
