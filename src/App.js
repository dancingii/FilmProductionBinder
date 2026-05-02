import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  stemWord,
  measureSceneInDOM,
  calculateScenePageStats,
  estimateSceneLines,
  updateScenesWithPageData,
  parseSceneHeading,
  extractLocations,
  extractLocationsHierarchical,
  getElementStyle,
  formatElementText,
  calculateBlockLines,
  LINES_PER_PAGE,
} from "./utils.js";
import { PDFExporter } from "./utils/pdfExport";
import ToDoListModule from "./components/modules/ToDoList";
import BudgetModule from "./components/modules/Budget/Budget";
import ShotListModule from "./components/modules/ShotList/ShotList";
import TimelineModule from "./components/modules/Timeline/Timeline";
import Dashboard from "./components/modules/Dashboard/Dashboard";
import CostReportModule from "./components/modules/CostReport/CostReport";
import {
  btlDepartments,
  legalDepartments,
  additionalCategories,
} from "./components/modules/Budget/stockCategories.js";
import EditableInput from "./components/shared/EditableInput";
import ImageUpload from "./components/shared/ImageUpload";
import MultiImageUpload from "./components/shared/MultiImageUpload";
import ImageViewer from "./components/shared/ImageViewer";
import AuthWrapper from "./components/auth/AuthWrapper";
import { supabase } from "./supabase";
import * as database from "./services/database";
import {
  uploadImage,
  deleteImage,
  extractPathFromUrl,
  uploadWardrobeImage,
  uploadGarmentImage,
  uploadMultipleWardrobeImages,
  uploadMultipleGarmentImages,
  deleteMultipleImages,
  uploadPropImage,
} from "./utils/imageStorage";
import { usePresence } from "./hooks/usePresence";
import PresenceIndicator from "./components/shared/PresenceIndicator";
import DayOutOfDaysModule from "./components/modules/DayOutOfDays/DayOutOfDays";
import CalendarModule from "./components/modules/Calendar/Calendar";
import StripboardModule from "./components/modules/Stripboard/Stripboard";
import LocationsModule from "./components/modules/Locations/Locations";
import CharactersModule from "./components/modules/Characters/Characters";
import CallSheetModule from "./components/modules/CallSheet/CallSheet";
import WardrobeModule from "./components/modules/Wardrobe/Wardrobe";
import StripboardScheduleModule from "./components/modules/StripboardSchedule/StripboardSchedule";
import CastCrewModule from "./components/modules/CastCrew/CastCrew";
import Script from "./components/modules/Script/Script";
import MakeupModule from "./components/modules/Makeup/Makeup";
import ProductionDesignModule from "./components/modules/ProductionDesign/ProductionDesign";
import ReportsModule from "./components/modules/Reports/Reports";
import PropsModule from "./components/modules/Props/Props";


const canEdit = (userRole) => ["owner", "editor"].includes(userRole);
const canDelete = (userRole) => userRole === "owner";
const canManageTeam = (userRole) => userRole === "owner";
const isViewOnly = (userRole) => userRole === "viewer";

function App({ selectedProject, userRole, user }) {
  // Removed app render logging - causing sync loops
  // console.log("🔄 App render:", { projectId: selectedProject?.id, userRole });
  // Database-synced scenes state
  const [scenes, setScenes] = useState([]);
  const [scenesLoaded, setScenesLoaded] = useState(false);
  const [isSavingScenes, setIsSavingScenes] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeProgress, setSummarizeProgress] = useState({
    current: 0,
    total: 0,
  });

  // Sync lock flags to prevent realtime reload loops
  const syncLocks = useRef({
    castCrew: false,
    scenes: false,
    stripboardScenes: false,
    shootingDays: false,
    scheduledScenes: false,
    characters: false,
    taggedItems: false,
    scriptLocations: false,
    actualLocations: false,
    callSheet: false,
    wardrobe: false,
    garmentInventory: false,
    costCategories: false,
    costVendors: false,
    budget: false,
    shotList: false,
    timeline: false,
    continuity: false,
    todoItems: false,
  });

  const initialLoadComplete = useRef(false);

  // Clear scroll position flags on page load/refresh
  useEffect(() => {
    // Clear Stripboard Schedule flags so it auto-scrolls on reload
    sessionStorage.removeItem("stripboard-schedule-scroll-position");
    sessionStorage.removeItem("stripboard-schedule-has-auto-scrolled");
    // Clear Stripboard position so it starts at top on reload
    sessionStorage.removeItem("stripboard-scroll-position");
  }, []); // Empty array = runs once on page load

  // Centered alert/confirm modal
  const [appAlert, setAppAlert] = useState(null);
  const showAlert = (message) =>
    new Promise((res) =>
      setAppAlert({
        message,
        onOk: () => {
          setAppAlert(null);
          res(true);
        },
        onCancel: null,
      })
    );
  const showConfirm = (message, confirmLabel = "OK", cancelLabel = "Cancel") =>
    new Promise((res) =>
      setAppAlert({
        message,
        onOk: () => {
          setAppAlert(null);
          res(true);
        },
        onCancel: () => {
          setAppAlert(null);
          res(false);
        },
        confirmLabel,
        cancelLabel,
      })
    );

  // Load scenes from database when project is selected
  useEffect(() => {
    console.log("🚨 USEEFFECT TRIGGERED - selectedProject:", selectedProject);
    if (!selectedProject) return;

    // Check if daily availability cleanup is needed
    database.checkAndRunDailyAvailabilityCleanup(selectedProject);

    // Skip reload if initial load is complete and any sync is active
    if (initialLoadComplete.current) {
      const anySyncActive = Object.values(syncLocks.current).some(
        (lock) => lock === true
      );
      if (anySyncActive) {
        console.log("⏸️ SKIPPING data reload - sync in progress");
        return;
      }
    }
    database.loadScenesFromDatabase(
      selectedProject,
      setScenes,
      setScenesLoaded,
      (loadedScenes) => {
        database.loadStripboardScenesAfterScenes(
          selectedProject,
          loadedScenes,
          setStripboardScenes
        );
      }
    );
    database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
    database.loadTaggedItemsFromDatabase(
      selectedProject,
      setTaggedItems,
      calculateCategoryNumbers
    );
    database.loadProjectSettingsFromDatabase(
      selectedProject,
      setProjectSettings,
      setCharacterSceneOverrides
    );
    database.loadShootingDaysFromDatabase(selectedProject, setShootingDays);
    database.loadCharactersFromDatabase(selectedProject, setCharacters);
    database.loadScriptLocationsFromDatabase(
      selectedProject,
      setScriptLocations
    );
    database.loadActualLocationsFromDatabase(
      selectedProject,
      setActualLocations
    );
    database.loadCallSheetDataFromDatabase(selectedProject, setCallSheetData);
    database.loadWardrobeItemsFromDatabase(selectedProject, setWardrobeItems);
    database.loadGarmentInventoryFromDatabase(
      selectedProject,
      setGarmentInventory
    );
    database.loadCostCategoriesFromDatabase(selectedProject, setCostCategories);
    database.loadCostVendorsFromDatabase(selectedProject, setCostVendors);
    database.loadBudgetDataFromDatabase(selectedProject, setBudgetData);
    database.loadTodoItemsFromDatabase(selectedProject, setTodoItems);
    database.loadShotListDataFromDatabase(
      selectedProject,
      setShotListData,
      setSceneNotes
    );
    database.loadScheduledScenesFromDatabase(
      selectedProject,
      setScheduledScenes
    );
    database.loadContinuityElementsFromDatabase(
      selectedProject,
      setContinuityElements
    );
    database.loadDoodCastEvents(selectedProject, setDoodCastEvents);
    database.loadDoodOverrides(selectedProject, setDoodOverrides);
    database.loadDoodSettings(selectedProject, setDoodSettings);

    // Mark initial load as complete
    initialLoadComplete.current = true;

    // Set up real-time subscriptions for all 20 tables
    console.log(
      "🔴 Setting up realtime subscriptions for project:",
      selectedProject.id
    );

    const channels = [];

    // 1. Scenes
    const scenesChannel = supabase
      .channel(`scenes_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scenes",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Scenes changed by another user");

          if (syncLocks.current.scenes) {
            console.log("⏭️ SKIPPING Scenes reload - sync lock active");
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.scenesReloadTimeout) {
            clearTimeout(window.scenesReloadTimeout);
          }

          window.scenesReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Scenes from database (after 500ms debounce)"
            );
            database.loadScenesFromDatabase(
              selectedProject,
              setScenes,
              setScenesLoaded,
              (loadedScenes) => {
                database.loadStripboardScenesAfterScenes(
                  selectedProject,
                  loadedScenes,
                  setStripboardScenes
                );
              }
            );
            window.scenesReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(scenesChannel);

    // 2. Stripboard scenes
    const stripboardChannel = supabase
      .channel(`stripboard_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stripboard_scenes",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Stripboard changed");

          // EMERGENCY: Check ALL sync locks to prevent cascading loops
          if (
            syncLocks.current.stripboardScenes ||
            syncLocks.current.scenes ||
            syncLocks.current.shootingDays ||
            syncLocks.current.scheduledScenes
          ) {
            console.log(
              "⏭️ SKIPPING Stripboard reload - sync operations active"
            );
            return;
          }

          if (window.stripboardReloadTimeout) {
            clearTimeout(window.stripboardReloadTimeout);
          }

          window.stripboardReloadTimeout = setTimeout(() => {
            // Double-check locks before executing
            if (
              syncLocks.current.stripboardScenes ||
              syncLocks.current.scenes ||
              syncLocks.current.shootingDays ||
              syncLocks.current.scheduledScenes
            ) {
              console.log("⏭️ ABORTING Stripboard reload - sync still active");
              window.stripboardReloadTimeout = null;
              return;
            }

            console.log(
              "✅ Loading Stripboard from database (after 500ms debounce)"
            );
            database.loadStripboardScenesAfterScenes(
              selectedProject,
              scenes,
              setStripboardScenes
            );
            window.stripboardReloadTimeout = null;
          }, 1000); // Increased debounce to 1 second
        }
      )
      .subscribe();
    channels.push(stripboardChannel);

    // 3. Shooting days
    const shootingDaysChannel = supabase
      .channel(`shooting_days_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shooting_days",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Shooting days changed");

          // ✅ CHECK SYNC LOCK FIRST - BEFORE ANY DEBOUNCE
          if (syncLocks.current.shootingDays) {
            console.log("⏭️ SKIPPING reload - shooting days sync lock active");
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.shootingDaysReloadTimeout) {
            clearTimeout(window.shootingDaysReloadTimeout);
          }

          window.shootingDaysReloadTimeout = setTimeout(() => {
            // ✅ DOUBLE-CHECK SYNC LOCK AGAIN INSIDE TIMEOUT
            if (syncLocks.current.shootingDays) {
              console.log("⏭️ ABORTING reload - sync lock still active");
              window.shootingDaysReloadTimeout = null;
              return;
            }

            console.log(
              "✅ Loading Shooting days from database (after 500ms debounce)"
            );
            database.loadShootingDaysFromDatabase(
              selectedProject,
              setShootingDays
            );
            window.shootingDaysReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(shootingDaysChannel);

    // 4. Scheduled scenes - WITH DEBOUNCING
    const scheduledChannel = supabase
      .channel(`scheduled_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scheduled_scenes",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Scheduled scenes changed");
          if (syncLocks.current.scheduledScenes) {
            console.log(
              "⏭️ SKIPPING Scheduled scenes reload - sync lock active"
            );
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.scheduledScenesReloadTimeout) {
            clearTimeout(window.scheduledScenesReloadTimeout);
          }

          window.scheduledScenesReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Scheduled scenes from database (debounced)"
            );
            database.loadScheduledScenesFromDatabase(
              selectedProject,
              setScheduledScenes
            );
            window.scheduledScenesReloadTimeout = null;
          }, 500); // Wait 500ms after last change before reloading
        }
      )
      .subscribe();
    channels.push(scheduledChannel);

    // 5. Cast & Crew - WITH SYNC LOCK FIX
    const castCrewChannel = supabase
      .channel(`cast_crew_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cast_crew",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Cast/Crew changed");

          if (syncLocks.current.castCrew) {
            console.log("⏭️ SKIPPING Cast/Crew reload - sync lock active");
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.castCrewReloadTimeout) {
            clearTimeout(window.castCrewReloadTimeout);
          }

          window.castCrewReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Cast/Crew from database (another user changed it)"
            );
            database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
            window.castCrewReloadTimeout = null;
          }, 500); // Wait 500ms after last change before reloading
        }
      )
      .subscribe();
    channels.push(castCrewChannel);

    // 5b. Cast/Crew Availability - Separate channel for availability changes
    const availabilityChannel = supabase
      .channel(`cast_crew_availability_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cast_crew_availability",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Availability changed");

          if (syncLocks.current.castCrew) {
            console.log("⏭️ SKIPPING Availability reload - sync lock active");
            return;
          }

          // Debounce: Clear any pending reload and schedule a new one
          if (window.availabilityReloadTimeout) {
            clearTimeout(window.availabilityReloadTimeout);
          }

          window.availabilityReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Reloading Cast/Crew (availability changed by another user)"
            );
            database.loadCastCrewFromDatabase(selectedProject, setCastCrew);
            window.availabilityReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(availabilityChannel);

    // 6. Characters
    const charactersChannel = supabase
      .channel(`characters_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "characters",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Characters changed");
          if (syncLocks.current.characters) {
            console.log("⏭️ SKIPPING Characters reload - sync lock active");
            return;
          }
          if (window.charactersReloadTimeout) {
            clearTimeout(window.charactersReloadTimeout);
          }
          window.charactersReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Characters from database (after 500ms debounce)"
            );
            database.loadCharactersFromDatabase(selectedProject, setCharacters);
            window.charactersReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(charactersChannel);

    // 7. Tagged items
    const taggedItemsChannel = supabase
      .channel(`tagged_items_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tagged_items",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Tagged items changed");
          if (syncLocks.current.taggedItems) {
            console.log(
              "⏭️ SKIPPING Tagged items reload - sync lock active (flagging missed update)"
            );
            syncLocks.current.taggedItemsMissedUpdate = true;
            return;
          }

          if (syncLocks.current.taggedItemsDebounce) {
            clearTimeout(syncLocks.current.taggedItemsDebounce);
          }
          syncLocks.current.taggedItemsDebounce = setTimeout(() => {
            console.log(
              "✅ Loading Tagged items from database (after 500ms debounce)"
            );
            database.loadTaggedItemsFromDatabase(
              selectedProject,
              setTaggedItems,
              calculateCategoryNumbers
            );
          }, 500);
        }
      )
      .subscribe();
    channels.push(taggedItemsChannel);

    // 8. Script locations
    const scriptLocChannel = supabase
      .channel(`script_loc_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "script_locations",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Script locations changed");

          if (syncLocks.current.scriptLocations) {
            console.log(
              "⏭️ SKIPPING Script locations reload - sync lock active"
            );
            return;
          }

          if (window.scriptLocationsReloadTimeout) {
            clearTimeout(window.scriptLocationsReloadTimeout);
          }

          window.scriptLocationsReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Script locations from database (after 500ms debounce)"
            );
            database.loadScriptLocationsFromDatabase(
              selectedProject,
              setScriptLocations
            );
            window.scriptLocationsReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(scriptLocChannel);

    // Set up global reload function for post-sync forced reloads
    window.forceScriptLocationsReload = () => {
      if (!syncLocks.current.scriptLocations) {
        console.log("✅ Force-reloading Script locations from database");
        database.loadScriptLocationsFromDatabase(
          selectedProject,
          setScriptLocations
        );
      } else {
        console.log("⏭️ SKIPPING force reload - sync lock active");
      }
    };

    // 9. Actual locations
    const actualLocChannel = supabase
      .channel(`actual_loc_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "actual_locations",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Actual locations changed");

          if (syncLocks.current.actualLocations) {
            console.log(
              "⏭️ SKIPPING Actual locations reload - sync lock active"
            );
            return;
          }

          console.log("✅ Loading Actual locations from database IMMEDIATELY");
          database.loadActualLocationsFromDatabase(
            selectedProject,
            setActualLocations
          );
        }
      )
      .subscribe();
    channels.push(actualLocChannel);

    // 10. Call sheet
    const callSheetChannel = supabase
      .channel(`call_sheet_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sheet_data",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Call sheet changed");

          // Check if we're currently syncing - if so, skip reload to prevent race condition
          if (syncLocks.current.callSheet) {
            console.log("⏸️ SKIPPING reload - sync in progress");
            return;
          }

          console.log("✅ Loading Call sheet from database IMMEDIATELY");
          database.loadCallSheetDataFromDatabase(
            selectedProject,
            setCallSheetData
          );
        }
      )
      .subscribe();
    channels.push(callSheetChannel);

    // 11. Wardrobe
    const wardrobeChannel = supabase
      .channel(`wardrobe_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wardrobe_items",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Wardrobe changed");
          if (syncLocks.current.wardrobeItems) {
            console.log("⏭️ SKIPPING wardrobe reload - sync lock active");
            return;
          }
          if (window.wardrobeItemsReloadTimeout) {
            clearTimeout(window.wardrobeItemsReloadTimeout);
          }
          window.wardrobeItemsReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Wardrobe items from database (after 500ms debounce)"
            );
            database.loadWardrobeItemsFromDatabase(
              selectedProject,
              setWardrobeItems
            );
            window.wardrobeItemsReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(wardrobeChannel);

    // 12. Garment inventory
    const garmentChannel = supabase
      .channel(`garment_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "garment_inventory",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Garment inventory changed");
          if (syncLocks.current.garmentInventory) {
            console.log("⏭️ SKIPPING garment reload - sync lock active");
            return;
          }

          // Add debounce to prevent infinite loops
          if (window.garmentInventoryReloadTimeout) {
            clearTimeout(window.garmentInventoryReloadTimeout);
          }

          window.garmentInventoryReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading garment inventory from database (after 500ms debounce)"
            );
            database.loadGarmentInventoryFromDatabase(
              selectedProject,
              setGarmentInventory
            );
            window.garmentInventoryReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(garmentChannel);

    // 13. Cost categories
    const costCatChannel = supabase
      .channel(`cost_cat_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cost_categories",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Cost categories changed");
          database.loadCostCategoriesFromDatabase(
            selectedProject,
            setCostCategories
          );
        }
      )
      .subscribe();
    channels.push(costCatChannel);

    // 14. Cost vendors
    const costVendChannel = supabase
      .channel(`cost_vend_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cost_vendors",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Cost vendors changed");
          database.loadCostVendorsFromDatabase(selectedProject, setCostVendors);
        }
      )
      .subscribe();
    channels.push(costVendChannel);

    // 15. Budget
    const budgetChannel = supabase
      .channel(`budget_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "budget_data",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Budget changed");
          if (syncLocks.current.budget) {
            console.log("⏭️ SKIPPING budget reload - sync lock active");
            return;
          }
          database.loadBudgetDataFromDatabase(selectedProject, setBudgetData);
        }
      )
      .subscribe();
    channels.push(budgetChannel);

    // 16. Shot list
    const shotListChannel = supabase
      .channel(`shot_list_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shot_list_data",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Shot list changed");

          if (syncLocks.current.shotList) {
            console.log("⏭️ SKIPPING Shot list reload - sync lock active");
            return;
          }

          if (window.shotListReloadTimeout) {
            clearTimeout(window.shotListReloadTimeout);
          }

          window.shotListReloadTimeout = setTimeout(() => {
            console.log(
              "✅ Loading Shot list from database (after 500ms debounce)"
            );
            database.loadShotListDataFromDatabase(
              selectedProject,
              setShotListData,
              setSceneNotes
            );
            window.shotListReloadTimeout = null;
          }, 500);
        }
      )
      .subscribe();
    channels.push(shotListChannel);

    // 17. Timeline
    const timelineChannel = supabase
      .channel(`timeline_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "timeline_data",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Timeline changed");
          database.loadTimelineDataFromDatabase(
            selectedProject,
            setTimelineData
          );
        }
      )
      .subscribe();
    channels.push(timelineChannel);

    // 18. Continuity
    const continuityChannel = supabase
      .channel(`continuity_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "continuity_elements",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Continuity changed");
          database.loadContinuityElementsFromDatabase(
            selectedProject,
            setContinuityElements
          );
        }
      )
      .subscribe();
    channels.push(continuityChannel);

    // 19. Todo items
    const todoChannel = supabase
      .channel(`todo_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "todo_items",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Todo items changed");
          if (syncLocks.current.todoItems) {
            console.log("⏭️ SKIPPING todo reload - sync lock active");
            return;
          }
          database.loadTodoItemsFromDatabase(selectedProject, setTodoItems);
        }
      )
      .subscribe();
    channels.push(todoChannel);

    // 20. Project members
    const membersChannel = supabase
      .channel(`members_${selectedProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_members",
          filter: `project_id=eq.${selectedProject.id}`,
        },
        (payload) => {
          console.log("🔴 REALTIME: Project members changed");
        }
      )
      .subscribe();
    channels.push(membersChannel);

    console.log("🔴 All 20 realtime channels subscribed");

    // Debug: Check subscription status
    setTimeout(() => {
      console.log("🔴 REALTIME DEBUG: Checking channel statuses...");
      channels.forEach((channel, index) => {
        console.log(
          `Channel ${index + 1}: ${channel.topic}, State: ${channel.state}`
        );
      });
    }, 3000);

    return () => {
      console.log("🔴 Unsubscribing from all realtime channels");
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [selectedProject?.id]);

  const saveScenesDatabase = async (updatedScenes) => {
    syncLocks.current.scenes = true;
    console.log("🔒 Scenes sync lock ENABLED");

    await database.saveScenesDatabase(
      selectedProject,
      updatedScenes,
      scenesLoaded,
      isSavingScenes,
      setIsSavingScenes
    );

    syncLocks.current.scenes = false;
    console.log("🔓 Scenes sync lock RELEASED");
  };

  const syncShootingDaysToDatabase = async (updatedShootingDays) => {
    syncLocks.current.shootingDays = true;
    console.log("🔒 Shooting days sync lock ENABLED");

    try {
      await database.syncShootingDaysToDatabase(
        selectedProject,
        updatedShootingDays
      );
      // Release lock immediately after sync completes
      syncLocks.current.shootingDays = false;
      console.log("🔓 Shooting days sync lock RELEASED (immediate)");
    } catch (error) {
      // Release immediately on error
      syncLocks.current.shootingDays = false;
      console.log("🔓 Shooting days sync lock RELEASED (error)");
      throw error;
    }
  };

  const syncStripboardScenesToDatabase = async (updatedStripboardScenes) => {
    syncLocks.current.stripboardScenes = true;
    console.log("🔒 Stripboard scenes sync lock ENABLED");

    await database.syncStripboardScenesToDatabase(
      selectedProject,
      updatedStripboardScenes
    );

    syncLocks.current.stripboardScenes = false;
    console.log("🔓 Stripboard scenes sync lock RELEASED");
  };

  const syncScheduledScenesToDatabase = async (updatedScheduledScenes) => {
    syncLocks.current.scheduledScenes = true;
    console.log("🔒 Scheduled scenes sync lock ENABLED");

    await database.syncScheduledScenesToDatabase(
      selectedProject,
      updatedScheduledScenes
    );

    syncLocks.current.scheduledScenes = false;
    console.log("🔓 Scheduled scenes sync lock RELEASED");
  };

  const syncScriptLocationsToDatabase = async (updatedLocations) => {
    syncLocks.current.scriptLocations = true;
    console.log("🔒 Script locations sync lock ENABLED");

    await database.syncScriptLocationsToDatabase(
      selectedProject,
      updatedLocations
    );

    syncLocks.current.scriptLocations = false;
    console.log("🔓 Script locations sync lock RELEASED");
  };

  const syncActualLocationsToDatabase = async (updatedLocations) => {
    syncLocks.current.actualLocations = true;
    console.log("🔒 Actual locations sync lock ENABLED");

    await database.syncActualLocationsToDatabase(
      selectedProject,
      updatedLocations
    );

    syncLocks.current.actualLocations = false;
    console.log("🔓 Actual locations sync lock RELEASED");
  };

  const syncCastCrewToDatabase = async (updatedCastCrew) => {
    syncLocks.current.castCrew = true;
    console.log("🔒 Cast/Crew sync lock ENABLED");

    try {
      await database.syncCastCrewToDatabase(selectedProject, updatedCastCrew);

      // Release lock immediately after sync completes
      syncLocks.current.castCrew = false;
      console.log("🔓 Cast/Crew sync lock RELEASED (immediate)");
    } catch (error) {
      console.error("❌ Error syncing Cast/Crew:", error);
      syncLocks.current.castCrew = false;
      console.log("🔓 Cast/Crew sync lock RELEASED (error)");
    }
  };

  const syncCallSheetDataToDatabase = async (updatedCallSheetData) => {
    syncLocks.current.callSheet = true;
    console.log("🔒 CallSheet sync lock ENABLED");

    try {
      await database.syncCallSheetDataToDatabase(
        selectedProject,
        updatedCallSheetData
      );
      console.log("✅ CallSheet sync completed");
    } catch (error) {
      console.error("❌ CallSheet sync failed:", error);
    } finally {
      syncLocks.current.callSheet = false;
      console.log("🔓 CallSheet sync lock RELEASED");
    }
  };

  const syncAllShootingDaysToDatabase = async (daysToSync = null) => {
    syncLocks.current.shootingDays = true;
    console.log("🔒 Shooting days sync lock ENABLED");

    try {
      // CRITICAL: Use provided data or fall back to state
      const dataToSync = daysToSync || shootingDays;
      console.log(
        `🔧 Syncing ${dataToSync.length} shooting days (${
          daysToSync ? "FRESH DATA" : "from state"
        })`
      );

      // CRITICAL: Deep UUID conversion before database sync
      console.log("🔧 Converting all shooting day IDs to UUIDs before sync...");

      const ensureAllUUIDs = (obj) => {
        if (!obj) return obj;

        const isValidUUID = (str) => {
          if (typeof str !== "string") return false;
          return str.match(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          );
        };

        const toUUID = (id) => {
          if (isValidUUID(id)) return id;
          return crypto.randomUUID();
        };

        // Check if value is a bigint ID (from Date.now())
        const isBigintID = (val) => {
          return typeof val === "number" && val > 1000000000000;
        };

        if (Array.isArray(obj)) {
          return obj.map((item) => ensureAllUUIDs(item));
        }

        if (typeof obj === "object" && obj !== null) {
          const newObj = { ...obj };

          Object.keys(newObj).forEach((key) => {
            const value = newObj[key];

            // AGGRESSIVE: Convert ANY number > 1000000000000 to UUID
            if (typeof value === "number" && value > 1000000000000) {
              console.log(`🔧 AGGRESSIVE: Converting ${key}: ${value} to UUID`);
              newObj[key] = toUUID(value);
            }
            // Convert ALL potential ID fields to UUID
            else if (
              key === "id" ||
              key.endsWith("Id") ||
              key.endsWith("_id") ||
              key === "blockId" ||
              key.includes("id") ||
              key.includes("Id")
            ) {
              if (!isValidUUID(value)) {
                console.log(`🔧 Converting ID field ${key}: ${value} to UUID`);
                newObj[key] = toUUID(value);
              }
            }
            // Recursively convert nested objects
            else if (typeof value === "object" && value !== null) {
              newObj[key] = ensureAllUUIDs(value);
            }
          });

          return newObj;
        }

        return obj;
      };

      const uuidConvertedShootingDays = ensureAllUUIDs(dataToSync);
      console.log("✅ UUID conversion complete - syncing to database");

      // EMERGENCY DEBUG: Dump ENTIRE structure to find hidden bigints
      console.log("🚨 Syncing shooting days - bigint check complete");

      const checkForBigints = (obj, path = "") => {
        if (typeof obj === "number" && obj > 1000000000000) {
          console.error(`🚨 BIGINT FOUND at ${path}: ${obj} (${typeof obj})`);
        }

        if (typeof obj === "object" && obj !== null) {
          Object.keys(obj).forEach((key) => {
            checkForBigints(obj[key], `${path}.${key}`);
          });
        }
      };

      console.log(
        `🔍 Bigint structure check complete for ${uuidConvertedShootingDays.length} days`
      );
      // Run bigint check silently
      uuidConvertedShootingDays.forEach((day, index) => {
        checkForBigints(day, `day[${index}]`);
      });

      // Also dump first day as JSON to see full structure
      if (uuidConvertedShootingDays.length > 0) {
        console.log("🔍 FIRST DAY SUMMARY:", {
          id: uuidConvertedShootingDays[0]?.id,
          date: uuidConvertedShootingDays[0]?.date,
          dayNumber: uuidConvertedShootingDays[0]?.dayNumber,
          blocksCount:
            uuidConvertedShootingDays[0]?.scheduleBlocks?.length || 0,
        });
      }

      await database.syncShootingDaysToDatabase(
        selectedProject,
        uuidConvertedShootingDays
      );
      console.log("✅ Shooting days synced successfully");
    } catch (error) {
      console.error("❌ CRITICAL: Shooting days sync failed:", error);
      // Continue without throwing to prevent cascade failures
    } finally {
      syncLocks.current.shootingDays = false;
      console.log("🔓 Shooting days sync lock RELEASED");
    }
  };

  const syncTimelineDataToDatabase = async (updatedTimelineData) => {
    await database.syncTimelineDataToDatabase(
      selectedProject,
      updatedTimelineData
    );
  };

  const syncContinuityElementsToDatabase = async (
    updatedContinuityElements
  ) => {
    await database.syncContinuityElementsToDatabase(
      selectedProject,
      updatedContinuityElements
    );
  };

  const syncTodoItemsToDatabase = async (updatedTodoItems) => {
    syncLocks.current.todoItems = true;
    console.log("🔒 Todo items sync lock ENABLED");

    try {
      await database.syncTodoItemsToDatabase(selectedProject, updatedTodoItems);
    } finally {
      syncLocks.current.todoItems = false;
      console.log("🔓 Todo items sync lock RELEASED");
    }
  };

  const handleDeleteTodoItem = async (taskId, updatedItems) => {
    syncLocks.current.todoItems = true;
    console.log("🔒 Todo items sync lock ENABLED (delete:", taskId, ")");
    try {
      await database.deleteTodoItem(selectedProject, taskId);
    } catch (error) {
      console.error("❌ Failed to delete todo item:", error);
    } finally {
      syncLocks.current.todoItems = false;
      console.log("🔓 Todo items sync lock RELEASED (delete)");
    }
  };

  const syncProjectSettingsToDatabase = async (updatedProjectSettings) => {
    await database.syncProjectSettingsToDatabase(
      selectedProject,
      updatedProjectSettings
    );
  };

  const syncCharactersToDatabase = async (updatedCharacters) => {
    syncLocks.current.characters = true;
    console.log("🔒 Characters sync lock ENABLED");

    await database.syncCharactersToDatabase(selectedProject, updatedCharacters);

    syncLocks.current.characters = false;
    console.log("🔓 Characters sync lock RELEASED");
  };

  const handleDeleteCharacter = async (characterName, updatedCharacters) => {
    syncLocks.current.characters = true;
    console.log("🔒 Characters sync lock ENABLED (delete:", characterName, ")");
    try {
      // Atomically delete the character row from the database
      await database.deleteCharacter(selectedProject, characterName);
      // If scenes were reassigned, sync the updated characters state
      if (updatedCharacters && Object.keys(updatedCharacters).length > 0) {
        await database.syncCharactersToDatabase(
          selectedProject,
          updatedCharacters
        );
      }
    } catch (error) {
      console.error("❌ Failed to delete character:", error);
    } finally {
      syncLocks.current.characters = false;
      console.log("🔓 Characters sync lock RELEASED (delete)");
    }
  };

  const syncCharacterOverridesToDatabase = async (updatedOverrides) => {
    await database.syncCharacterOverridesToDatabase(
      selectedProject,
      updatedOverrides
    );
  };

  const syncWardrobeItemsToDatabase = async (updatedWardrobeItems) => {
    syncLocks.current.wardrobeItems = true;
    console.log("🔒 Wardrobe sync lock ENABLED");
    await database.syncWardrobeItemsToDatabase(
      selectedProject,
      updatedWardrobeItems
    );
    syncLocks.current.wardrobeItems = false;
    console.log("🔓 Wardrobe sync lock RELEASED");
  };

  const syncGarmentInventoryToDatabase = async (updatedGarmentInventory) => {
    // Enable sync lock
    syncLocks.current.garmentInventory = true;
    console.log("🔒 Garment inventory sync lock ENABLED");

    await database.syncGarmentInventoryToDatabase(
      selectedProject,
      updatedGarmentInventory
    );

    // Release sync lock immediately
    syncLocks.current.garmentInventory = false;
    console.log("🔓 Garment inventory sync lock RELEASED");
  };

  const syncCostCategoriesToDatabase = async (updatedCostCategories) => {
    await database.syncCostCategoriesToDatabase(
      selectedProject,
      updatedCostCategories
    );
  };

  const syncCostVendorsToDatabase = async (updatedCostVendors) => {
    await database.syncCostVendorsToDatabase(
      selectedProject,
      updatedCostVendors
    );
  };

  const syncTaggedItemsToDatabase = async (updatedTaggedItems) => {
    syncLocks.current.taggedItems = true;
    console.log("🔒 Tagged items sync lock ENABLED");

    await database.syncTaggedItemsToDatabase(
      selectedProject,
      updatedTaggedItems
    );

    syncLocks.current.taggedItems = false;
    console.log("🔓 Tagged items sync lock RELEASED");

    // If any realtime events arrived while locked, reload now to catch up
    if (syncLocks.current.taggedItemsMissedUpdate) {
      syncLocks.current.taggedItemsMissedUpdate = false;
      console.log("🔄 Reloading tagged items — missed update during lock");
      database.loadTaggedItemsFromDatabase(
        selectedProject,
        setTaggedItems,
        calculateCategoryNumbers
      );
    }
  };

  const syncBudgetDataToDatabase = async (updatedBudgetData) => {
    syncLocks.current.budget = true;
    console.log("🔒 Budget sync lock ENABLED");

    try {
      await database.syncBudgetDataToDatabase(
        selectedProject,
        updatedBudgetData
      );
      // Sync budget departments to cost categories
      const updatedCostCats = syncBudgetToCostCategories(
        updatedBudgetData,
        costCategories
      );
      setCostCategories(updatedCostCats);
      await database.syncCostCategoriesToDatabase(
        selectedProject,
        updatedCostCats
      );
    } finally {
      syncLocks.current.budget = false;
      console.log("🔓 Budget sync lock RELEASED");
    }
  };

  // Sync budget departments to cost categories (budget → cost report)
  const syncBudgetToCostCategories = React.useCallback(
    (updatedBudgetData, currentCostCategories) => {
      const allSections = [
        { items: updatedBudgetData.btlItems || [], prefix: "btl" },
        { items: updatedBudgetData.legalItems || [], prefix: "legal" },
        { items: updatedBudgetData.marketingItems || [], prefix: "marketing" },
        { items: updatedBudgetData.postItems || [], prefix: "post" },
      ];

      const departmentBudgets = updatedBudgetData.departmentBudgets || {};
      const existingCategories = [...(currentCostCategories || [])];

      // Build a map of department keys that should exist
      const budgetDeptKeys = new Set();

      allSections.forEach(({ items, prefix }) => {
        items
          .filter((item) => item.type === "non-personnel")
          .forEach((item) => {
            if (!item.category) return;
            // Derive department name from item category by matching stockCategories
            const deptKey = `${prefix}_${item.category}`;
            budgetDeptKeys.add(deptKey);
          });
      });

      // For each btl department in stockCategories, create/update parent category
      const allDeptMaps = [
        { map: btlDepartments, prefix: "btl" },
        { map: legalDepartments, prefix: "legal" },
        ...Object.entries(additionalCategories || {}).map(([k, v]) => ({
          map: { [k]: v },
          prefix: k === "MARKETING, EPK, & PR" ? "marketing" : "post",
        })),
      ];

      let updatedCategories = [...existingCategories];

      allDeptMaps.forEach(({ map, prefix }) => {
        Object.entries(map).forEach(([deptName, deptItems]) => {
          const deptKey = `${prefix}_${deptName}`;
          const deptBudget = departmentBudgets[`${prefix}_${deptName}`] || 0;

          // Get all non-personnel items in this dept from budget
          const itemsKey = `${prefix}Items`;
          const budgetItems = (updatedBudgetData[itemsKey] || []).filter(
            (item) => {
              if (item.type !== "non-personnel") return false;
              const stockItems = Array.isArray(deptItems)
                ? deptItems
                : Object.values(deptItems).flat();
              return stockItems.some((s) => s.category === item.category);
            }
          );

          if (budgetItems.length === 0 && deptBudget === 0) return;

          // Find or create parent category
          let parentCat = updatedCategories.find(
            (c) => c.departmentKey === deptKey
          );
          if (!parentCat) {
            parentCat = {
              id: `dept_${deptKey}_${Date.now()}`,
              name: deptName,
              color: "#2196F3",
              expenses: [],
              budget: deptBudget,
              budgetSource: "budget",
              departmentKey: deptKey,
              description: "",
              subCategories: [],
            };
            updatedCategories.push(parentCat);
          } else {
            // Update budget from budget module
            parentCat = { ...parentCat, budget: deptBudget };
            updatedCategories = updatedCategories.map((c) =>
              c.departmentKey === deptKey ? parentCat : c
            );
          }

          // Sync sub-categories from budget line items
          const existingParent = updatedCategories.find(
            (c) => c.departmentKey === deptKey
          );
          const existingSubs = existingParent?.subCategories || [];

          const newSubs = budgetItems.map((item) => {
            const existing = existingSubs.find(
              (s) => s.budgetLineId === item.id
            );
            return existing
              ? {
                  ...existing,
                  name: item.name || item.category,
                  budget: item.budgetAmount || 0,
                }
              : {
                  id: `sub_${item.id || Date.now()}_${Math.random()
                    .toString(36)
                    .substr(2, 5)}`,
                  name: item.name || item.category,
                  color: "#64B5F6",
                  expenses: [],
                  budget: item.budgetAmount || 0,
                  budgetLineId: item.id,
                  budgetSource: "budget",
                  description: item.notes || "",
                  parentId: existingParent?.id,
                };
          });

          updatedCategories = updatedCategories.map((c) =>
            c.departmentKey === deptKey
              ? { ...c, budget: deptBudget, subCategories: newSubs }
              : c
          );
        });
      });

      // Keep manual (non-budget) categories unchanged
      return updatedCategories;
    },
    []
  );

  const syncShotListDataToDatabase = async (
    updatedShotListData,
    updatedSceneNotes
  ) => {
    syncLocks.current.shotList = true;
    console.log("🔒 Shot list sync lock ENABLED");

    await database.syncShotListDataToDatabase(
      selectedProject,
      updatedShotListData,
      updatedSceneNotes
    );

    syncLocks.current.shotList = false;
    console.log("🔓 Shot list sync lock RELEASED");
  };

  const cleanupDuplicateShootingDays = async () => {
    await database.cleanupDuplicateShootingDays(selectedProject);
  };

  const debugShootingDaysState = () => {
    console.log("🔍 LOCAL SHOOTING DAYS STATE DEBUG:");
    console.log("Total shootingDays length:", shootingDays.length);
    console.log(
      "Shooting days by ID:",
      shootingDays.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        date: day.date,
        isLocked: day.isLocked,
        isShot: day.isShot,
      }))
    );

    // Group by day number to find local duplicates
    const dayGroups = {};
    shootingDays.forEach((day) => {
      if (!dayGroups[day.dayNumber]) {
        dayGroups[day.dayNumber] = [];
      }
      dayGroups[day.dayNumber].push(day);
    });

    console.log(
      "Days grouped by dayNumber:",
      Object.keys(dayGroups).map(
        (dayNum) => `Day ${dayNum}: ${dayGroups[dayNum].length} copies`
      )
    );

    // Find duplicates
    const duplicates = Object.entries(dayGroups).filter(
      ([dayNum, days]) => days.length > 1
    );
    if (duplicates.length > 0) {
      console.log("🚨 FOUND LOCAL DUPLICATES:");
      duplicates.forEach(([dayNum, days]) => {
        console.log(
          `Day ${dayNum} has ${days.length} copies with IDs:`,
          days.map((d) => d.id)
        );
      });
    }

    alert(
      `Local state has ${shootingDays.length} shooting days. Check console for details.`
    );
  };

  const auditAllDatabaseTables = async () => {
    await database.auditAllDatabaseTables(selectedProject);
  };

  const emergencyDatabaseCleanup = async () => {
    await database.emergencyDatabaseCleanup(selectedProject);
  };

  // Shooting days sync removed - will be implemented properly with existing database pattern

  const syncImportedDataToDatabase = async (projectData) => {
    await database.syncImportedDataToDatabase(selectedProject, projectData);
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeModule, setActiveModule] = React.useState("Dashboard");
  const [stripboardScenes, setStripboardScenes] = useState([]);
  const [scheduledScenes, setScheduledScenes] = useState({});
  React.useEffect(() => {
    console.log(
      "🔍 scheduledScenes type:",
      Array.isArray(scheduledScenes) ? "ARRAY (WRONG)" : "OBJECT (CORRECT)"
    );
    console.log("🔍 scheduledScenes keys:", Object.keys(scheduledScenes));
  }, [scheduledScenes]);
  const [scriptLocations, setScriptLocations] = useState([]);
  const [taggedItems, setTaggedItems] = useState({});
  const [showTagDropdown, setShowTagDropdown] = useState(null);
  const [actualLocations, setActualLocations] = useState([]);
  const [shootingDays, setShootingDays] = useState([
    {
      id: 1,
      date: new Date().toISOString().split("T")[0],
      dayNumber: 1,
      scheduleBlocks: [],
    },
  ]);
  const [castCrew, setCastCrew] = useState([]);
  const [doodCastEvents, setDoodCastEvents] = useState([]);
  const [doodOverrides, setDoodOverrides] = useState([]);
  const [doodSettings, setDoodSettings] = useState(null);
  const [crewSortOrder, setCrewSortOrder] = useState([
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
  ]);
  const [characters, setCharacters] = useState({});
  const [characterSceneOverrides, setCharacterSceneOverrides] = useState({});
  const [shotListData, setShotListData] = useState({});
  const [sceneNotes, setSceneNotes] = useState({});
  const [todoItems, setTodoItems] = useState([]);
  const [todoCategories, setTodoCategories] = useState([
    "Pre-Production",
    "Production",
    "Post-Production",
    "Art",
    "Stunts",
    "Locations",
    "Leads",
    "Office",
    "Rentals",
  ]);
  const [timelineData, setTimelineData] = useState({});
  const [continuityElements, setContinuityElements] = useState([]);
  const [budgetData, setBudgetData] = useState({
    projectInfo: {},
    atlItems: [],
    btlItems: [],
    weeklyReports: [],
    customCategories: [],
    totals: {
      atlTotal: 0,
      btlTotal: 0,
      grandTotal: 0,
      paidTotal: 0,
      unpaidTotal: 0,
    },
  });

  // Add this diagnostic useEffect right after state declarations
  React.useEffect(() => {
    console.log("📝 todoItems state changed:", todoItems);
    console.log("📝 todoItems length:", todoItems.length);
  }, [todoItems]);
  const [projectSettings, setProjectSettings] = useState({
    filmTitle: "",
    producer: "",
    director: "",
  });
  const [costCategories, setCostCategories] = useState([
    {
      id: "general",
      name: "General",
      color: "#2196F3",
      expenses: [],
      budget: 0,
    },
    {
      id: "meals",
      name: "Meals/Crafty",
      color: "#2E7D32",
      expenses: [],
      budget: 0,
    },
    {
      id: "equipment",
      name: "Equipment",
      color: "#FF9800",
      expenses: [],
      budget: 0,
    },
    {
      id: "wardrobe",
      name: "Wardrobe",
      color: "#9C27B0",
      expenses: [],
      budget: 0,
    },
    {
      id: "proddesign",
      name: "Production Design",
      color: "#F44336",
      expenses: [],
      budget: 0,
    },
    { id: "misc", name: "Misc", color: "#607D8B", expenses: [], budget: 0 },
  ]);
  const [costVendors, setCostVendors] = useState([
    "Cash",
    "Credit Card",
    "Check",
    "Venmo",
    "PayPal",
  ]);

  const [callSheetData, setCallSheetData] = React.useState({
    callTime: "7:30 AM",
    castCallTimes: {},
    customNotes: {},
    crewByDay: {}, // Object with dayId as key, crew data as value
    tableSizesByDay: {}, // Object with dayId as key, table sizes as value
    callTimeByDay: {},
    notesByDay: {},
    crewCallTimes: {},
    hiddenCastByDay: {},
  });

  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [garmentInventory, setGarmentInventory] = useState([]);
  const [garmentCategories, setGarmentCategories] = useState([
    "shirt",
    "pants",
    "dress",
    "skirt",
    "shoes",
    "coat/sweater",
    "socks/tights",
    "underwear",
    "misc",
  ]);

  // Global editing state tracker for real-time collaboration
  const [editingLocks, setEditingLocks] = useState({});
  // Structure: { 'tableName_recordId': { userId, timestamp, fieldName } }

  // Lock a record for editing
  const lockRecordForEditing = (tableName, recordId, fieldName = null) => {
    const lockKey = `${tableName}_${recordId}`;
    setEditingLocks((prev) => ({
      ...prev,
      [lockKey]: {
        userId: user?.id,
        timestamp: Date.now(),
        fieldName: fieldName,
      },
    }));
    console.log(`🔒 Locked ${tableName} record ${recordId} for editing`);
  };

  // Release edit lock after save completes
  const releaseEditLock = (tableName, recordId) => {
    const lockKey = `${tableName}_${recordId}`;
    setEditingLocks((prev) => {
      const updated = { ...prev };
      delete updated[lockKey];
      return updated;
    });
    console.log(`🔓 Released lock on ${tableName} record ${recordId}`);
  };

  // Check if a record is being edited locally
  const isRecordLocked = (tableName, recordId) => {
    const lockKey = `${tableName}_${recordId}`;
    const lock = editingLocks[lockKey];

    // Clean up stale locks (older than 30 seconds)
    if (lock && Date.now() - lock.timestamp > 30000) {
      releaseEditLock(tableName, recordId);
      return false;
    }

    return !!lock;
  };

  // Load jsPDF and html2pdf libraries dynamically
  React.useEffect(() => {
    if (!window.jspdf) {
      console.log("Loading jsPDF library...");
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      script.async = true;
      script.onload = () => {
        console.log("jsPDF library loaded successfully");
      };
      script.onerror = () => {
        console.error("Failed to load jsPDF library");
      };
      document.head.appendChild(script);
    }

    if (!window.html2pdf) {
      console.log("Loading html2pdf library...");
      const script2 = document.createElement("script");
      script2.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script2.async = true;
      script2.onload = () => {
        console.log("html2pdf library loaded successfully");
      };
      script2.onerror = () => {
        console.error("Failed to load html2pdf library");
      };
      document.head.appendChild(script2);
    }
  }, []);

  // updateScenesWithPageData function moved to utils.js

  const autoDetectCharacters = () => {
    const detectedCharacters = {};
    let characterOrder = 1;

    const cleanCharacterName = (rawName) => {
      let cleaned = rawName.replace(/\s*\([^)]*\)/g, "");
      cleaned = cleaned.replace(/[.,!?;:]$/, "");
      cleaned = cleaned.trim().toUpperCase();
      const excludeWords = ["FADE", "CUT", "SCENE", "TITLE", "END"];
      if (cleaned.length < 1 || excludeWords.includes(cleaned)) {
        return null;
      }
      return cleaned;
    };

    // PASS 1: Scan ALL dialogue blocks in script order
    scenes.forEach((scene) => {
      scene.content.forEach((block) => {
        if (block.type === "Character") {
          const characterName = cleanCharacterName(block.text);
          if (characterName) {
            if (!detectedCharacters[characterName]) {
              detectedCharacters[characterName] = {
                name: characterName,
                scenes: [],
                chronologicalNumber: characterOrder++,
              };
            }
            if (
              !detectedCharacters[characterName].scenes.includes(
                scene.sceneNumber
              )
            ) {
              detectedCharacters[characterName].scenes.push(scene.sceneNumber);
            }
          }
        }
      });
    });

    // PASS 2: Scan action lines for character mentions
    scenes.forEach((scene) => {
      scene.content.forEach((block) => {
        if (block.type === "Action") {
          Object.keys(detectedCharacters).forEach((characterName) => {
            const regex = new RegExp(`\\b${characterName}\\b`, "i");
            if (regex.test(block.text)) {
              if (
                !detectedCharacters[characterName].scenes.includes(
                  scene.sceneNumber
                )
              ) {
                detectedCharacters[characterName].scenes.push(
                  scene.sceneNumber
                );
              }
            }
          });
        }
      });
    });

    setCharacters(detectedCharacters);
    console.log("Characters detected:", detectedCharacters);
  };

  const getFinalCharacterScenes = (characterName) => {
    const autoDetectedScenes = characters[characterName]?.scenes || [];
    const overrides = characterSceneOverrides[characterName] || {};

    let finalScenes = [...autoDetectedScenes];

    // Apply removals
    if (overrides.removedScenes) {
      finalScenes = finalScenes.filter(
        (scene) => !overrides.removedScenes.includes(scene)
      );
    }

    // Apply additions
    if (overrides.addedScenes) {
      overrides.addedScenes.forEach((scene) => {
        if (!finalScenes.includes(scene)) {
          finalScenes.push(scene);
        }
      });
    }

    return finalScenes.sort((a, b) => a - b);
  };

  // No auto-saving for shooting days - sync only on specific actions

  const tagCategories = [
    { name: "Props", color: "#FF6B6B" },
    { name: "Production Design", color: "#4ECDC4" },
    { name: "Makeup", color: "#FF9F43" },
    { name: "Locations", color: "#45B7D1" },
    { name: "Vehicles", color: "#96CEB4" },
    { name: "Wardrobe", color: "#FFEAA7" },
    { name: "Cast", color: "#DDA0DD" },
    { name: "Animals", color: "#98D8C8" },
    { name: "Special Effects", color: "#F7DC6F" },
    { name: "Stunts", color: "#BB8FCE" },
    { name: "Extras", color: "#85C1E9" },
  ];

  const untagWordInstance = (word, sceneIndex, blockIndex, wordIndex) => {
    const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
    const instanceId = `${sceneIndex}-${blockIndex}-${wordIndex}`;

    if (taggedItems[cleanWord]) {
      const currentItem = taggedItems[cleanWord];
      const updatedInstances = currentItem.instances.filter(
        (id) => id !== instanceId
      );

      setTaggedItems((prev) => {
        const newTaggedItems = { ...prev };

        if (updatedInstances.length === 0) {
          // If no instances left, remove the entire word
          delete newTaggedItems[cleanWord];
        } else {
          // Update with remaining instances
          newTaggedItems[cleanWord] = {
            ...currentItem,
            instances: updatedInstances,
          };
        }

        return newTaggedItems;
      });
    }
    setShowTagDropdown(null);
  };

  const getWordPosition = (word) => {
    // Find the position of this word in the entire script
    let position = 0;
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const scene = scenes[sceneIndex];
      for (
        let blockIndex = 0;
        blockIndex < scene.content.length;
        blockIndex++
      ) {
        const block = scene.content[blockIndex];
        const words = block.text.split(/(\s+)/).filter((w) => w.trim() !== "");
        for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
          const currentWord = words[wordIndex]
            .toLowerCase()
            .replace(/[^\w]/g, "");
          if (currentWord === word.toLowerCase().replace(/[^\w]/g, "")) {
            return position;
          }
          if (currentWord !== "") {
            position++;
          }
        }
      }
    }
    return position;
  };

  const findAllWordInstances = (targetWord) => {
    const cleanTargetWord = stemWord(
      targetWord.toLowerCase().replace(/[^\w]/g, "")
    );
    const instances = [];
    const foundScenes = [];

    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const scene = scenes[sceneIndex];
      let sceneHasWord = false;

      for (
        let blockIndex = 0;
        blockIndex < scene.content.length;
        blockIndex++
      ) {
        const block = scene.content[blockIndex];
        const words = block.text.split(/(\s+)/);

        for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
          const word = words[wordIndex];
          if (word.trim() === "") continue; // Skip whitespace

          const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
          if (cleanWord === cleanTargetWord) {
            const instanceId = `${sceneIndex}-${blockIndex}-${wordIndex}`;
            instances.push(instanceId);
            if (!sceneHasWord) {
              foundScenes.push(scene.sceneNumber);
              sceneHasWord = true;
            }
          }
        }
      }
    }

    return { instances, scenes: foundScenes };
  };

  const stemWord = (word) => {
    // Simple English stemming rules for common plurals and variations
    const stemmingRules = [
      // Irregular plurals (handle these first)
      { pattern: /^children$/, stem: "child" },
      { pattern: /^people$/, stem: "person" },
      { pattern: /^men$/, stem: "man" },
      { pattern: /^women$/, stem: "woman" },
      { pattern: /^feet$/, stem: "foot" },
      { pattern: /^teeth$/, stem: "tooth" },
      { pattern: /^geese$/, stem: "goose" },
      { pattern: /^mice$/, stem: "mouse" },

      // -ies endings (ladies -> lady, stories -> story)
      { pattern: /ies$/, stem: (word) => word.slice(0, -3) + "y" },

      // -ves endings (knives -> knife, wolves -> wolf)
      { pattern: /ves$/, stem: (word) => word.slice(0, -3) + "f" },

      // -es endings (boxes -> box, glasses -> glass)
      { pattern: /(s|x|z|ch|sh)es$/, stem: (word) => word.slice(0, -2) },

      // Regular -s plurals (cars -> car, dogs -> dog)
      { pattern: /s$/, stem: (word) => word.slice(0, -1) },

      // -ing endings (running -> run, walking -> walk)
      {
        pattern: /ing$/,
        stem: (word) => {
          const base = word.slice(0, -3);
          // Handle doubled consonants (running -> run, not runn)
          if (
            base.length >= 2 &&
            base[base.length - 1] === base[base.length - 2]
          ) {
            return base.slice(0, -1);
          }
          return base;
        },
      },

      // -ed endings (walked -> walk, moved -> move)
      {
        pattern: /ed$/,
        stem: (word) => {
          const base = word.slice(0, -2);
          // Handle doubled consonants (stopped -> stop, not stopp)
          if (
            base.length >= 2 &&
            base[base.length - 1] === base[base.length - 2]
          ) {
            return base.slice(0, -1);
          }
          return base;
        },
      },
    ];

    // Apply stemming rules in order
    for (const rule of stemmingRules) {
      if (typeof rule.stem === "string") {
        // Direct replacement for irregular words
        if (rule.pattern.test(word)) {
          return rule.stem;
        }
      } else {
        // Function-based stemming
        if (rule.pattern.test(word)) {
          return rule.stem(word);
        }
      }
    }

    // If no rules match, return the original word
    return word;
  };

  const calculateCategoryNumbers = (taggedItems) => {
    console.log(
      "🔧 Starting category number calculation for",
      Object.keys(taggedItems).length,
      "items"
    );

    const categoryCounts = {};
    const updatedItems = {};

    // Sort all items by chronological order to maintain creation sequence
    const sortedEntries = Object.entries(taggedItems).sort(
      (a, b) =>
        (a[1].chronologicalNumber || 999) - (b[1].chronologicalNumber || 999)
    );

    console.log("🔧 Sorted entries count:", sortedEntries.length);

    sortedEntries.forEach(([word, item]) => {
      const category = item.category || "Uncategorized";
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;

      updatedItems[word] = {
        ...item,
        categoryNumber: categoryCounts[category],
      };

      // Debug first few items
      if (categoryCounts[category] <= 3) {
        console.log(
          `🔧 ${category} #${categoryCounts[category]}: ${word} (was #${item.chronologicalNumber})`
        );
      }
    });

    console.log("🔧 Final category counts:", categoryCounts);
    console.log("🔧 Updated items count:", Object.keys(updatedItems).length);

    return updatedItems;
  };

  const tagWord = (word, category) => {
    const cleanWord = stemWord(word.toLowerCase().replace(/[^\w]/g, ""));
    const categoryData = tagCategories.find((cat) => cat.name === category);

    if (!taggedItems[cleanWord]) {
      const wordPosition = getWordPosition(word);

      // Find all instances of this word
      const { instances, scenes: foundScenes } = findAllWordInstances(word);

      console.log(`Found instances for "${cleanWord}":`, instances);

      // Calculate new chronological number based on position
      const existingItems = Object.entries(taggedItems);
      let chronologicalNumber = 1;

      for (const [existingWord, existingItem] of existingItems) {
        const existingPosition = getWordPosition(existingItem.displayName);
        if (existingPosition < wordPosition) {
          chronologicalNumber++;
        }
      }

      // Create new tagged item with all instances
      const newItem = {
        displayName: word,
        category: category,
        color: categoryData.color,
        chronologicalNumber: chronologicalNumber,
        position: wordPosition,
        scenes: foundScenes,
        instances: instances,
      };

      // Update existing items that come after this position
      const updatedItems = { ...taggedItems };
      for (const [existingWord, existingItem] of Object.entries(updatedItems)) {
        const existingPosition = getWordPosition(existingItem.displayName);
        if (existingPosition > wordPosition) {
          updatedItems[existingWord] = {
            ...existingItem,
            chronologicalNumber: existingItem.chronologicalNumber + 1,
          };
        }
      }

      // Add new item
      updatedItems[cleanWord] = newItem;

      // Calculate category numbers for all items
      const itemsWithCategoryNumbers = calculateCategoryNumbers(updatedItems);
      setTaggedItems(itemsWithCategoryNumbers);
      syncTaggedItemsToDatabase(itemsWithCategoryNumbers);
    }

    setShowTagDropdown(null);
  };

  const isWordInstanceTagged = (
    cleanWord,
    sceneIndex,
    blockIndex,
    wordIndex
  ) => {
    const instanceId = `${sceneIndex}-${blockIndex}-${wordIndex}`;
    return (
      taggedItems[cleanWord] &&
      taggedItems[cleanWord].instances.includes(instanceId)
    );
  };

  // parseSceneHeading and extractLocations functions moved to utils.js

  const scheduleScene = (sceneIndex, date, time = null) => {
    const updatedStripboard = [...stripboardScenes];
    const scene = updatedStripboard[sceneIndex];
    updatedStripboard[sceneIndex].scheduledDate = date;
    updatedStripboard[sceneIndex].scheduledTime = time;

    // Only change status to "Scheduled" if it's currently "Not Scheduled"
    // Preserve "Pickups" and "Reshoot" statuses
    const newStatus =
      scene.status === "Not Scheduled" ? "Scheduled" : scene.status;
    updatedStripboard[sceneIndex].status = newStatus;

    setStripboardScenes(updatedStripboard);

    // ATOMIC: Update only this scene's schedule
    database
      .updateStripboardSceneSchedule(
        selectedProject,
        scene.sceneNumber.toString(),
        newStatus,
        date,
        time
      )
      .catch((error) => {
        console.error("❌ Atomic scene schedule update failed:", error);
      });

    // Also update main scenes status
    const updatedMainScenes = [...scenes];
    const mainSceneIndex = updatedMainScenes.findIndex(
      (s) => s.sceneNumber.toString() === scene.sceneNumber.toString()
    );
    if (mainSceneIndex !== -1) {
      updatedMainScenes[mainSceneIndex].status = newStatus;
      setScenes(updatedMainScenes);

      database
        .updateSceneStatus(
          selectedProject,
          scene.sceneNumber.toString(),
          newStatus
        )
        .catch((error) => {
          console.error("❌ Atomic main scene status update failed:", error);
        });
    }

    const newScheduled = { ...scheduledScenes };

    // Remove scene from ALL dates first (prevents duplicates)
    Object.keys(newScheduled).forEach((existingDate) => {
      newScheduled[existingDate] = newScheduled[existingDate].filter(
        (s) => s.sceneNumber !== scene.sceneNumber
      );
      if (newScheduled[existingDate].length === 0) {
        delete newScheduled[existingDate];
      }
    });

    // Add scene to new date
    if (!newScheduled[date]) {
      newScheduled[date] = [];
    }
    newScheduled[date].push(updatedStripboard[sceneIndex]);

    setScheduledScenes(newScheduled);

    // Sync to database
    syncScheduledScenesToDatabase(newScheduled);
  };

  const unscheduleScene = (sceneIndex) => {
    // Check if sceneIndex is valid
    if (sceneIndex === -1 || !stripboardScenes[sceneIndex]) {
      console.warn("Scene not found for unscheduling");
      return;
    }

    const updatedStripboard = [...stripboardScenes];
    const scene = updatedStripboard[sceneIndex];
    const preservedStatus = scene.status; // Capture current status

    updatedStripboard[sceneIndex].scheduledDate = null;
    updatedStripboard[sceneIndex].scheduledTime = null;

    // Only reset status to "Not Scheduled" if it was "Scheduled"
    // Preserve "Pickups" and "Reshoot" statuses
    if (updatedStripboard[sceneIndex].status === "Scheduled") {
      updatedStripboard[sceneIndex].status = "Not Scheduled";
    }

    setStripboardScenes(updatedStripboard);

    // Use atomic update instead of full sync - this preserves status correctly
    database.updateStripboardSceneSchedule(
      selectedProject,
      scene.sceneNumber.toString(),
      updatedStripboard[sceneIndex].status, // Use the preserved/updated status
      null, // Clear date
      null // Clear time
    );

    const newScheduled = { ...scheduledScenes };
    Object.keys(newScheduled).forEach((date) => {
      newScheduled[date] = newScheduled[date].filter(
        (scene) =>
          scene.sceneNumber !== updatedStripboard[sceneIndex].sceneNumber
      );
      if (newScheduled[date].length === 0) {
        delete newScheduled[date];
      }
    });

    setScheduledScenes(newScheduled);

    // Sync to database
    syncScheduledScenesToDatabase(newScheduled);
  };

  const summarizeScenesWithAI = async (scenesToSummarize) => {
    setIsSummarizing(true);
    setSummarizeProgress({ current: 0, total: scenesToSummarize.length });
    console.log(
      "🎬 Starting AI summarization for",
      scenesToSummarize.length,
      "scenes"
    );

    // Give React time to render the progress toast before starting
    await new Promise((resolve) => setTimeout(resolve, 300));

    const updatedScenes = scenesToSummarize.map((s) => ({ ...s }));

    for (let i = 0; i < scenesToSummarize.length; i++) {
      const scene = scenesToSummarize[i];
      setSummarizeProgress({ current: i + 1, total: scenesToSummarize.length });

      try {
        const sceneText = (scene.content || [])
          .map((block) => block.text || "")
          .join("\n")
          .trim();

        if (!sceneText) continue;

        const response = await fetch("/.netlify/functions/summarize-scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            heading: scene.heading,
            content: sceneText,
          }),
        });

        const data = await response.json();
        const summary = (data.summary || "").replace(/^#+\s.*\n*/gm, "").trim();

        if (summary) {
          updatedScenes[i] = { ...updatedScenes[i], description: summary };

          // Update state incrementally so descriptions appear live
          setScenes((prev) =>
            prev.map((s) =>
              s.sceneNumber === scene.sceneNumber
                ? { ...s, description: summary }
                : s
            )
          );
        }
      } catch (err) {
        console.error(
          `❌ Failed to summarize scene ${scene.sceneNumber}:`,
          err
        );
      }
    }

    // Final save to database with all descriptions
    // Keep sync lock active during the entire save + reload cycle
    syncLocks.current.scenes = true;
    console.log("🔒 Summarization: Scenes sync lock ENABLED for final save");

    await database.saveScenesDatabase(
      selectedProject,
      updatedScenes,
      scenesLoaded,
      false,
      setIsSavingScenes
    );

    console.log("✅ Descriptions saved — reloading scenes from database");

    // Force reload scenes from DB so UI reflects saved descriptions
    await database.loadScenesFromDatabase(
      selectedProject,
      setScenes,
      setScenesLoaded,
      (loadedScenes) => {
        database.loadStripboardScenesAfterScenes(
          selectedProject,
          loadedScenes,
          setStripboardScenes
        );
      }
    );

    syncLocks.current.scenes = false;
    console.log("🔓 Summarization: Scenes sync lock RELEASED");

    setIsSummarizing(false);
    setSummarizeProgress({ current: 0, total: 0 });
    console.log("✅ AI scene summarization complete — descriptions loaded");
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const paragraphs = Array.from(xmlDoc.getElementsByTagName("Paragraph"));

        const parsedScenes = [];
        let currentScene = null;
        let sceneNumber = 1;

        paragraphs.forEach((para) => {
          const type = para.getAttribute("Type");
          let content = para.textContent.trim();

          if (!content) return;

          // Debug: Log ALL paragraph types to find title page
          console.log(
            "Paragraph type:",
            type,
            "| Content:",
            content.substring(0, 40)
          );

          // Filter out title page elements (including null types)
          const titlePageTypes = [
            "Title",
            "Credit",
            "Author",
            "Contact",
            "Copyright",
            "Draft date",
            "More Title",
            null, // Add null to catch title page elements with no type
          ];
          if (titlePageTypes.includes(type)) {
            console.log("🚫 FILTERED OUT:", type, content.substring(0, 40));
            return; // Skip title page elements
          }

          const formatting = {};
          const textElements = para.getElementsByTagName("Text");
          if (textElements.length > 0) {
            const textElement = textElements[0];
            if (textElement.getAttribute("Style")) {
              const style = textElement.getAttribute("Style");
              formatting.bold = style.includes("Bold");
              formatting.italic = style.includes("Italic");
              formatting.underline = style.includes("Underline");
            }
          }

          if (type === "Scene Heading") {
            if (currentScene) {
              currentScene.sceneNumber = sceneNumber++;
              parsedScenes.push(currentScene);
            }

            const headingText = content.toUpperCase();
            const metadata = parseSceneHeading(headingText);
            currentScene = {
              heading: headingText,
              content: [],
              metadata: metadata,
              sceneNumber: sceneNumber,
              estimatedDuration: "30 min",
              status: "Not Scheduled",
            };
          } else if (currentScene) {
            // Don't add null-type paragraphs to scene content (title page elements)
            if (type === null) {
              console.log(
                "🚫 SKIPPING null-type content:",
                content.substring(0, 40)
              );
              return;
            }

            if (type === "Character") {
              content = content.toUpperCase();
            }

            currentScene.content.push({
              type,
              text: content,
              formatting:
                Object.keys(formatting).length > 0 ? formatting : null,
            });
          }
        });

        if (currentScene) {
          currentScene.sceneNumber = sceneNumber;
          parsedScenes.push(currentScene);
        }

        // Calculate page data for all scenes
        const scenesWithPageData = parsedScenes.map((scene, index) => {
          try {
            const sceneStats = calculateScenePageStats(
              index,
              parsedScenes,
              107
            );
            return {
              ...scene,
              pageNumber: sceneStats.startPage,
              pageLength: sceneStats.pageLength,
            };
          } catch (error) {
            console.warn(
              `Error calculating page stats for scene ${index}:`,
              error
            );
            return {
              ...scene,
              pageNumber: 1,
              pageLength: "1/8",
            };
          }
        });

        setScenes(scenesWithPageData);
        setStripboardScenes([...scenesWithPageData]); // Initial setup with page data
        saveScenesDatabase(scenesWithPageData);

        const detectedLocations = extractLocationsHierarchical(parsedScenes);
        setScriptLocations(detectedLocations);
        syncScriptLocationsToDatabase(detectedLocations);
        console.log(
          `Auto-detected ${detectedLocations.length} locations on script upload`
        );

        // Auto-detect characters after loading scenes
        const detectedCharacters = {};
        let characterOrder = 1;

        const cleanCharacterName = (rawName) => {
          let cleaned = rawName.replace(/\s*\([^)]*\)/g, "");
          cleaned = cleaned.replace(/[.,!?;:]$/, "");
          cleaned = cleaned.trim().toUpperCase();
          const excludeWords = ["FADE", "CUT", "SCENE", "TITLE", "END"];
          if (cleaned.length < 1 || excludeWords.includes(cleaned)) {
            return null;
          }
          return cleaned;
        };

        // PASS 1: Scan dialogue blocks
        parsedScenes.forEach((scene) => {
          scene.content.forEach((block) => {
            if (block.type === "Character") {
              const characterName = cleanCharacterName(block.text);
              if (characterName) {
                if (!detectedCharacters[characterName]) {
                  detectedCharacters[characterName] = {
                    name: characterName,
                    scenes: [],
                    chronologicalNumber: characterOrder++,
                  };
                }
                if (
                  !detectedCharacters[characterName].scenes.includes(
                    scene.sceneNumber
                  )
                ) {
                  detectedCharacters[characterName].scenes.push(
                    scene.sceneNumber
                  );
                }
              }
            }
          });
        });

        // PASS 2: Scan action lines
        parsedScenes.forEach((scene) => {
          scene.content.forEach((block) => {
            if (block.type === "Action") {
              Object.keys(detectedCharacters).forEach((characterName) => {
                const regex = new RegExp(`\\b${characterName}\\b`, "i");
                if (regex.test(block.text)) {
                  if (
                    !detectedCharacters[characterName].scenes.includes(
                      scene.sceneNumber
                    )
                  ) {
                    detectedCharacters[characterName].scenes.push(
                      scene.sceneNumber
                    );
                  }
                }
              });
            }
          });
        });

        setCharacters(detectedCharacters);
        syncCharactersToDatabase(detectedCharacters);
        console.log(
          `Auto-detected ${
            Object.keys(detectedCharacters).length
          } characters on script upload`
        );

        setCurrentIndex(0);

        // Offer AI summarization
        const confirmed = window.confirm(
          `Script imported successfully — ${
            scenesWithPageData.length
          } scenes loaded.\n\nWould you like Claude to automatically summarize each scene and populate the description column?\n\nThis runs in the background and takes about ${Math.ceil(
            (scenesWithPageData.length * 1.5) / 60
          )} minute(s). You can keep using the app while it runs.`
        );
        if (confirmed) {
          setTimeout(() => {
            summarizeScenesWithAI(scenesWithPageData);
          }, 50);
        }
      } catch (err) {
        alert("Failed to parse .fdx file. Please check the file format.");
      }
    };

    reader.readAsText(file);
  };

  const handleSingleSceneUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const paragraphs = Array.from(xmlDoc.getElementsByTagName("Paragraph"));

        const parsedScenes = [];
        let currentScene = null;

        paragraphs.forEach((para) => {
          const type = para.getAttribute("Type");
          let content = para.textContent.trim();

          if (!content) return;

          // Debug: Log ALL paragraph types to find title page
          console.log(
            "Paragraph type:",
            type,
            "| Content:",
            content.substring(0, 40)
          );

          // Filter out title page elements (including null types)
          const titlePageTypes = [
            "Title",
            "Credit",
            "Author",
            "Contact",
            "Copyright",
            "Draft date",
            "More Title",
            null, // Add null to catch title page elements with no type
          ];
          if (titlePageTypes.includes(type)) {
            console.log("🚫 FILTERED OUT:", type, content.substring(0, 40));
            return; // Skip title page elements
          }

          const formatting = {};
          const textElements = para.getElementsByTagName("Text");
          if (textElements.length > 0) {
            const textElement = textElements[0];
            if (textElement.getAttribute("Style")) {
              const style = textElement.getAttribute("Style");
              formatting.bold = style.includes("Bold");
              formatting.italic = style.includes("Italic");
              formatting.underline = style.includes("Underline");
            }
          }

          if (type === "Scene Heading") {
            if (currentScene) {
              parsedScenes.push(currentScene);
            }

            const headingText = content.toUpperCase();
            const metadata = parseSceneHeading(headingText);
            currentScene = {
              heading: headingText,
              content: [],
              metadata: metadata,
              sceneNumber: scenes[currentIndex].sceneNumber, // Keep original scene number
              estimatedDuration: "30 min",
              status: "Not Scheduled",
            };
          } else if (currentScene) {
            // Don't add null-type paragraphs to scene content (title page elements)
            if (type === null) {
              console.log(
                "🚫 SKIPPING null-type content:",
                content.substring(0, 40)
              );
              return;
            }

            if (type === "Character") {
              content = content.toUpperCase();
            }

            currentScene.content.push({
              type,
              text: content,
              formatting:
                Object.keys(formatting).length > 0 ? formatting : null,
            });
          }
        });

        if (currentScene) {
          parsedScenes.push(currentScene);
        }

        if (parsedScenes.length === 1) {
          // Replace current scene with uploaded scene
          const newScene = parsedScenes[0];

          // Preserve original scene metadata
          const originalScene = scenes[currentIndex];
          newScene.sceneNumber = originalScene.sceneNumber;
          newScene.status = originalScene.status;
          newScene.pageNumber = originalScene.pageNumber;
          newScene.pageLength = originalScene.pageLength;

          // Update scenes array
          const updatedScenes = [...scenes];
          updatedScenes[currentIndex] = newScene;
          setScenes(updatedScenes);

          // Update stripboard scenes
          const updatedStripboard = [...stripboardScenes];
          updatedStripboard[currentIndex] = {
            ...updatedStripboard[currentIndex],
            ...newScene,
          };
          setStripboardScenes(updatedStripboard);

          // Recalculate page data for the replaced scene
          const updatedScenesWithPageData = updatedScenes.map(
            (scene, index) => {
              if (index === currentIndex) {
                try {
                  const sceneStats = calculateScenePageStats(
                    index,
                    updatedScenes,
                    107
                  );
                  return {
                    ...scene,
                    pageNumber: sceneStats.startPage,
                    pageLength: sceneStats.pageLength,
                  };
                } catch (error) {
                  return scene;
                }
              }
              return scene;
            }
          );

          setScenes(updatedScenesWithPageData);

          console.log(
            "Original scene content blocks:",
            originalScene.content.length
          );
          console.log("New scene content blocks:", newScene.content.length);
          console.log(
            "Scene replacement completed for scene:",
            newScene.sceneNumber
          );
          alert(
            `Scene ${newScene.sceneNumber} replaced successfully!\nOriginal: ${originalScene.content.length} blocks\nNew: ${newScene.content.length} blocks`
          );
        } else {
          alert("Error: The uploaded file must contain exactly one scene.");
        }
      } catch (err) {
        alert("Failed to parse .fdx file. Please check the file format.");
      }
    };

    reader.readAsText(file);
  };

  const autoDetectCharactersFromScenes = (scenesToProcess) => {
    const detectedCharacters = {};
    let characterOrder = 1;

    // Clean character name function
    const cleanCharacterName = (rawName) => {
      let cleaned = rawName.replace(/\s*\([^)]*\)/g, "");
      cleaned = cleaned.replace(/[.,!?;:]$/, "");
      cleaned = cleaned.trim().toUpperCase();

      const excludeWords = ["FADE", "CUT", "SCENE", "TITLE", "END"];
      if (cleaned.length < 1 || excludeWords.includes(cleaned)) {
        return null;
      }
      return cleaned;
    };

    // PASS 1: Scan ALL dialogue blocks in script order
    scenesToProcess.forEach((scene) => {
      scene.content.forEach((block) => {
        if (block.type === "Character") {
          const characterName = cleanCharacterName(block.text);

          if (characterName) {
            if (!detectedCharacters[characterName]) {
              detectedCharacters[characterName] = {
                name: characterName,
                scenes: [],
                chronologicalNumber: characterOrder++,
              };
            }

            if (
              !detectedCharacters[characterName].scenes.includes(
                scene.sceneNumber
              )
            ) {
              detectedCharacters[characterName].scenes.push(scene.sceneNumber);
            }
          }
        }
      });
    });

    // PASS 2: Scan action lines for character mentions
    scenesToProcess.forEach((scene) => {
      scene.content.forEach((block) => {
        if (block.type === "Action") {
          Object.keys(detectedCharacters).forEach((characterName) => {
            const regex = new RegExp(`\\b${characterName}\\b`, "i");
            if (regex.test(block.text)) {
              if (
                !detectedCharacters[characterName].scenes.includes(
                  scene.sceneNumber
                )
              ) {
                detectedCharacters[characterName].scenes.push(
                  scene.sceneNumber
                );
              }
            }
          });
        }
      });
    });

    setCharacters(detectedCharacters);
    console.log("Characters auto-detected:", detectedCharacters);
  };

  // ADD THESE FUNCTIONS RIGHT HERE (after line 2615):
  const exportProject = () => {
    const appData = {
      scenes,
      taggedItems,
      stripboardScenes,
      scheduledScenes,
      shootingDays,
      scriptLocations,
      actualLocations,
      currentIndex,
      castCrew,
      characters,
      shotListData,
      sceneNotes,
      projectSettings,
      costCategories,
      costVendors,
      callSheetData,
      wardrobeItems,
      garmentInventory,
      garmentCategories,
      todoItems,
      todoCategories,
      timelineData,
      continuityElements,
      budgetData,
      exportInfo: {
        exportDate: new Date().toISOString(),
        version: "1.0",
        appName: "Film Production Binder",
      },
    };

    // Generate timestamp filename (e.g., "sep-7-25-850pm")
    const now = new Date();
    const monthNames = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const month = monthNames[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear().toString().slice(-2);
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    hours = hours ? hours : 12; // 12 hour format

    const timestamp = `${month}-${day}-${year}-${hours}${minutes}${ampm}`;
    const filename = `film-project-${timestamp}.json`;

    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create a download link with the timestamped filename
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;

    // For modern browsers, this should trigger the save dialog
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    // Show confirmation with the filename
    alert(`Project exported as: ${filename}`);
  };

  const importProject = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const projectData = JSON.parse(e.target.result);

        // Validate the data structure
        if (
          !projectData.exportInfo ||
          projectData.exportInfo.appName !== "Film Production Binder"
        ) {
          alert("Invalid project file format");
          return;
        }

        // Restore all state
        if (projectData.scenes) {
          setScenes(projectData.scenes);
        }

        // Restore stripboard scenes with their status data
        if (projectData.stripboardScenes) {
          console.log(
            "📋 Stripboard scene statuses in import:",
            projectData.stripboardScenes
              .slice(0, 5)
              .map((s) => `Scene ${s.sceneNumber}: ${s.status}`)
          );
          // Use stripboard scenes directly - they contain the correct status information
          setStripboardScenes(projectData.stripboardScenes);
          console.log(
            "✅ Restored stripboard scenes with statuses:",
            projectData.stripboardScenes
              .filter((s) => s.status !== "Not Scheduled")
              .slice(0, 5)
              .map((s) => `Scene ${s.sceneNumber}: ${s.status}`)
          );
        } else if (projectData.scenes) {
          // Fallback: create stripboard scenes from main scenes if no stripboard data exists
          setStripboardScenes([...projectData.scenes]);
          console.log(
            "⚠️ No stripboard scenes found, using main scenes as fallback"
          );
        }
        if (projectData.taggedItems) setTaggedItems(projectData.taggedItems);
        if (projectData.scheduledScenes)
          setScheduledScenes(projectData.scheduledScenes);
        if (projectData.shootingDays) setShootingDays(projectData.shootingDays);
        if (projectData.scriptLocations)
          setScriptLocations(projectData.scriptLocations);
        if (projectData.castCrew) setCastCrew(projectData.castCrew);
        if (projectData.currentIndex !== undefined)
          setCurrentIndex(projectData.currentIndex);
        if (projectData.actualLocations)
          setActualLocations(projectData.actualLocations);
        if (projectData.characters) setCharacters(projectData.characters);
        if (projectData.shotListData) setShotListData(projectData.shotListData);
        if (projectData.sceneNotes) setSceneNotes(projectData.sceneNotes);
        if (projectData.projectSettings)
          setProjectSettings(projectData.projectSettings);
        if (projectData.costCategories)
          setCostCategories(projectData.costCategories);
        if (projectData.costVendors) setCostVendors(projectData.costVendors);
        if (projectData.wardrobeItems)
          setWardrobeItems(projectData.wardrobeItems);
        if (projectData.garmentInventory)
          setGarmentInventory(projectData.garmentInventory);
        if (projectData.garmentCategories)
          setGarmentCategories(projectData.garmentCategories);
        if (projectData.todoItems) setTodoItems(projectData.todoItems);
        if (projectData.todoCategories)
          setTodoCategories(projectData.todoCategories);
        if (projectData.timelineData) setTimelineData(projectData.timelineData);
        if (projectData.continuityElements)
          setContinuityElements(projectData.continuityElements);
        if (projectData.budgetData) setBudgetData(projectData.budgetData);
        if (projectData.callSheetData)
          setCallSheetData(projectData.callSheetData);

        // Sync imported data to database
        try {
          console.log("🔄 Starting database sync for imported data...");
          await database.syncImportedDataToDatabase(
            selectedProject,
            projectData
          );
          console.log("✅ Database sync completed successfully");
        } catch (syncError) {
          console.error("❌ Database sync failed:", syncError);
          alert(
            `Import completed but database sync failed: ${syncError.message}`
          );
          return;
        }

        alert(
          `Project imported successfully!\nExported: ${new Date(
            projectData.exportInfo.exportDate
          ).toLocaleDateString()}\nData synced to cloud database.`
        );
      } catch (error) {
        alert("Failed to import project file. Please check the file format.");
        console.error("Import error:", error);
      }
    };

    reader.readAsText(file);

    // Clear the input so the same file can be imported again
    event.target.value = "";
  };

  const repairScheduledScenesFromStripboard = async () => {
    if (!selectedProject || !stripboardScenes.length || !shootingDays.length) {
      alert("Data not loaded yet. Please wait and try again.");
      return;
    }

    try {
      console.log(
        "REPAIRING: Clearing and rebuilding scheduled_scenes from actual schedule data..."
      );

      // Step 1: Clear existing scheduled_scenes data completely
      await supabase
        .from("scheduled_scenes")
        .delete()
        .eq("project_id", selectedProject.id);

      console.log("REPAIRING: Cleared existing scheduled scenes data");

      // Step 2: Only use scenes that have EXPLICIT scheduledDate
      const scheduledScenesMap = {};

      stripboardScenes.forEach((scene) => {
        // Only include scenes with explicit scheduled dates that exist in shooting days
        if (
          scene.scheduledDate &&
          shootingDays.some((day) => day.date === scene.scheduledDate)
        ) {
          if (!scheduledScenesMap[scene.scheduledDate]) {
            scheduledScenesMap[scene.scheduledDate] = [];
          }
          scheduledScenesMap[scene.scheduledDate].push(scene.sceneNumber);
          console.log(
            `REPAIRING: Scene ${scene.sceneNumber} scheduled for ${scene.scheduledDate}`
          );
        }
      });

      console.log(
        "REPAIRING: Found explicit scheduled scenes for",
        Object.keys(scheduledScenesMap).length,
        "dates"
      );

      console.log("REPAIR: Found scheduled scenes map:", scheduledScenesMap);

      if (Object.keys(scheduledScenesMap).length > 0) {
        // Clear existing scheduled_scenes data
        await supabase
          .from("scheduled_scenes")
          .delete()
          .eq("project_id", selectedProject.id);

        // Insert rebuilt data
        const scheduledScenesData = Object.entries(scheduledScenesMap).map(
          ([date, scenes]) => ({
            project_id: selectedProject.id,
            shoot_date: date,
            scenes: scenes || [],
          })
        );

        const { error } = await supabase
          .from("scheduled_scenes")
          .insert(scheduledScenesData);

        if (error) throw error;

        // Update local state
        setScheduledScenes(scheduledScenesMap);

        console.log(
          `REPAIR COMPLETED: Rebuilt ${scheduledScenesData.length} scheduled scene mappings`
        );
        alert(
          `Repair completed! Found ${scheduledScenesData.length} scheduled shooting days. Check Reports module now.`
        );
      } else {
        console.log("REPAIR: No scheduled scenes with dates found");
        alert(
          "No scheduled scenes with dates found. Your scenes may need to be re-scheduled in StripboardSchedule module."
        );
      }
    } catch (error) {
      console.error("REPAIR ERROR:", error);
      alert(`Repair failed: ${error.message}`);
    }
  };

  const updateStripboardScene = (sceneIndex, field, value) => {
    setStripboardScenes((prevScenes) => {
      const updatedScenes = [...prevScenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        [field]: value,
      };

      // Update the main scenes array and save to database
      if (
        field === "status" ||
        field === "manualTimeOfDay" ||
        field === "description" ||
        field === "notes" ||
        field === "heading"
      ) {
        console.log(`🔄 Updating scene ${sceneIndex} ${field} to: ${value}`);
        setScenes((prevMainScenes) => {
          const updatedMainScenes = [...prevMainScenes];

          if (field === "heading") {
            const intExt = value.intExt || "";
            const location = value.location || "";
            const timeOfDay = value.timeOfDay || "";
            const modifier = value.modifier || "";
            const fullHeading = `${intExt} ${location}${
              timeOfDay ? ` - ${timeOfDay}` : ""
            }${modifier ? ` - ${modifier}` : ""}`.trim();
            updatedScenes[sceneIndex] = {
              ...updatedScenes[sceneIndex],
              heading: fullHeading,
              metadata: {
                ...updatedScenes[sceneIndex].metadata,
                intExt,
                location,
                timeOfDay,
              },
            };
          } else if (field === "status") {
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              status: value,
            };
          } else if (field === "manualTimeOfDay") {
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              manualTimeOfDay: value,
              metadata: {
                ...updatedMainScenes[sceneIndex].metadata,
                timeOfDay: value,
              },
            };
          } else if (field === "description") {
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              description: value,
            };
          } else if (field === "notes") {
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              notes: value,
            };
          }

          console.log(
            `💾 Saving scene ${field} update to database for scene: ${updatedMainScenes[sceneIndex]?.sceneNumber}`
          );
          const sceneNumber = updatedMainScenes[sceneIndex]?.sceneNumber;
          console.log(
            `💾 Saving scene ${field} update to database for scene: ${sceneNumber}`
          );

          // ATOMIC SYNC - Update only this scene in BOTH tables
          if (field === "status") {
            Promise.all([
              database.updateSceneStatus(selectedProject, sceneNumber, value),
              database.updateStripboardSceneStatus(
                selectedProject,
                sceneNumber,
                value
              ),
            ]).catch((error) => {
              console.error("❌ Atomic scene status update failed:", error);
              alert("⚠️ Failed to save scene status. Please try again.");
            });
          } else if (field === "manualTimeOfDay") {
            database
              .updateSceneTimeOfDay(selectedProject, sceneNumber, value)
              .catch((error) => {
                console.error(
                  "❌ Atomic scene time of day update failed:",
                  error
                );
                alert("⚠️ Failed to save time of day. Please try again.");
              });
          } else if (field === "description") {
            database
              .updateSceneDescription(selectedProject, sceneNumber, value)
              .catch((error) => {
                console.error(
                  "❌ Atomic scene description update failed:",
                  error
                );
                alert("⚠️ Failed to save description. Please try again.");
              });
          } else if (field === "notes") {
            database
              .updateSceneNotes(selectedProject, sceneNumber, value)
              .catch((error) => {
                console.error("❌ Atomic scene notes update failed:", error);
                alert("⚠️ Failed to save notes. Please try again.");
              });
          } else if (field === "heading") {
            const intExt = value.intExt || "";
            const location = value.location || "";
            const timeOfDay = value.timeOfDay || "";
            const modifier = value.modifier || "";
            const fullHeading = `${intExt} ${location}${
              timeOfDay ? ` - ${timeOfDay}` : ""
            }${modifier ? ` - ${modifier}` : ""}`.trim();
            updatedMainScenes[sceneIndex] = {
              ...updatedMainScenes[sceneIndex],
              heading: fullHeading,
              metadata: {
                ...updatedMainScenes[sceneIndex].metadata,
                intExt,
                location,
                timeOfDay,
              },
            };
            database
              .updateSceneHeading(
                selectedProject,
                sceneNumber,
                fullHeading,
                intExt,
                location,
                timeOfDay,
                modifier
              )
              .catch((error) => {
                console.error("❌ Atomic scene heading update failed:", error);
                alert("⚠️ Failed to save heading. Please try again.");
              });
          }

          return updatedMainScenes;
        });
      }

      return updatedScenes;
    });
  };

  // Props module callback functions
  const onUpdatePropTitle = (propWord, newTitle) => {
    setTaggedItems((prev) => {
      const updated = {
        ...prev,
        [propWord]: {
          ...prev[propWord],
          customTitle: newTitle,
        },
      };
      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onRemovePropFromScene = (propWord, sceneIndex) => {
    setTaggedItems((prev) => {
      const item = prev[propWord];
      if (!item || !item.instances) return prev;

      const updatedInstances = item.instances.filter((instanceId) => {
        const instanceSceneIndex = parseInt(instanceId.split("-")[0]);
        return instanceSceneIndex !== sceneIndex;
      });

      const updatedScenes = item.scenes.filter((sceneNum) => {
        return sceneNum !== scenes[sceneIndex]?.sceneNumber;
      });

      let updated;
      if (updatedInstances.length === 0) {
        updated = { ...prev };
        delete updated[propWord];
      } else {
        updated = {
          ...prev,
          [propWord]: {
            ...item,
            instances: updatedInstances,
            scenes: updatedScenes,
          },
        };
      }

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreatePropVariant = (originalPropWord, variantName) => {
    const originalItem = taggedItems[originalPropWord];
    if (!originalItem) return;

    const variantKey = stemWord(
      variantName.toLowerCase().replace(/[^\w]/g, "")
    );
    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const originalPosition = getWordPosition(originalItem.displayName);

    const variantItem = {
      displayName: variantName,
      category: originalItem.category,
      color: originalItem.color,
      chronologicalNumber: chronologicalNumber,
      position: originalPosition + 0.1,
      scenes: [],
      instances: [],
      customTitle: variantName,
      originalProp: originalPropWord,
    };

    const updated = {
      ...taggedItems,
      [variantKey]: variantItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  const onAddPropToScene = (propWord, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    setTaggedItems((prev) => {
      const item = prev[propWord];
      if (!item) return prev;

      const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;
      const updatedInstances = [...(item.instances || []), syntheticInstanceId];
      const updatedScenes = [...(item.scenes || [])];

      if (!updatedScenes.includes(scene.sceneNumber)) {
        updatedScenes.push(scene.sceneNumber);
      }

      const updated = {
        ...prev,
        [propWord]: {
          ...item,
          instances: updatedInstances,
          scenes: updatedScenes.sort((a, b) => a - b),
        },
      };

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreateNewProp = (
    propName,
    sceneIndex,
    confirmedSceneNumbers,
    instanceChars
  ) => {
    const propsCategory = tagCategories.find((cat) => cat.name === "Props");
    const propColor = propsCategory?.color || "#FF6B6B";

    // Build scene numbers array — either from confirmed viewer selections or legacy single scene
    let sceneNumbers = [];
    if (confirmedSceneNumbers && confirmedSceneNumbers.length > 0) {
      sceneNumbers = confirmedSceneNumbers;
    } else if (sceneIndex !== null && sceneIndex !== undefined) {
      const scene = scenes[sceneIndex];
      if (scene) sceneNumbers = [scene.sceneNumber];
    }

    // Derive unique characters assigned across all confirmed instances
    const allAssignedChars = instanceChars
      ? [...new Set(Object.values(instanceChars).filter(Boolean))]
      : [];

    // Build the key for taggedItems
    const cleanWord = `custom_prop_${propName
      .toLowerCase()
      .replace(/[^\w]/g, "_")}_${Date.now()}`;
    const existingItems = Object.entries(taggedItems);
    const chronologicalNumber = existingItems.length + 1;
    const syntheticInstanceId = `manual-${Date.now()}`;

    const newItem = {
      displayName: propName,
      category: "Props",
      color: propColor,
      chronologicalNumber,
      position: 0,
      scenes: sceneNumbers,
      instances: [syntheticInstanceId],
      customTitle: propName,
      manuallyCreated: true,
      assignedCharacters: allAssignedChars,
    };

    const updated = {
      ...taggedItems,
      [cleanWord]: newItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
    return cleanWord;
  };

  // Production Design module callback functions
  const onUpdatePDTitle = (pdWord, newTitle) => {
    setTaggedItems((prev) => {
      const updated = {
        ...prev,
        [pdWord]: {
          ...prev[pdWord],
          customTitle: newTitle,
        },
      };
      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onRemovePDFromScene = (pdWord, sceneIndex) => {
    setTaggedItems((prev) => {
      const item = prev[pdWord];
      if (!item || !item.instances) return prev;

      const updatedInstances = item.instances.filter((instanceId) => {
        const instanceSceneIndex = parseInt(instanceId.split("-")[0]);
        return instanceSceneIndex !== sceneIndex;
      });

      const updatedScenes = item.scenes.filter((sceneNum) => {
        return sceneNum !== scenes[sceneIndex]?.sceneNumber;
      });

      let updated;
      if (updatedInstances.length === 0) {
        updated = { ...prev };
        delete updated[pdWord];
      } else {
        updated = {
          ...prev,
          [pdWord]: {
            ...item,
            instances: updatedInstances,
            scenes: updatedScenes,
          },
        };
      }

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreatePDVariant = (originalPDWord, variantName) => {
    const originalItem = taggedItems[originalPDWord];
    if (!originalItem) return;

    const variantKey = stemWord(
      variantName.toLowerCase().replace(/[^\w]/g, "")
    );
    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const originalPosition = getWordPosition(originalItem.displayName);

    const variantItem = {
      displayName: variantName,
      category: originalItem.category,
      color: originalItem.color,
      chronologicalNumber: chronologicalNumber,
      position: originalPosition + 0.1,
      scenes: [],
      instances: [],
      customTitle: variantName,
      originalProp: originalPDWord,
    };

    const updated = {
      ...taggedItems,
      [variantKey]: variantItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  const onAddPDToScene = (pdWord, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    setTaggedItems((prev) => {
      const item = prev[pdWord];
      if (!item) return prev;

      const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;
      const updatedInstances = [...(item.instances || []), syntheticInstanceId];
      const updatedScenes = [...(item.scenes || [])];

      if (!updatedScenes.includes(scene.sceneNumber)) {
        updatedScenes.push(scene.sceneNumber);
      }

      const updated = {
        ...prev,
        [pdWord]: {
          ...item,
          instances: updatedInstances,
          scenes: updatedScenes.sort((a, b) => a - b),
        },
      };

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreateNewPD = (itemName, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    const cleanWord = stemWord(itemName.toLowerCase().replace(/[^\w]/g, ""));

    if (taggedItems[cleanWord]) {
      onAddPDToScene(cleanWord, sceneIndex);
      return;
    }

    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const position = getWordPosition(itemName);
    const pdCategory = tagCategories.find(
      (cat) => cat.name === "Production Design"
    );
    const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;

    const newItem = {
      displayName: itemName,
      category: "Production Design",
      color: pdCategory?.color || "#9C27B0",
      chronologicalNumber: chronologicalNumber,
      position: position,
      scenes: [scene.sceneNumber],
      instances: [syntheticInstanceId],
      customTitle: itemName,
      manuallyCreated: true,
    };

    const updated = {
      ...taggedItems,
      [cleanWord]: newItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  // Makeup module callback functions
  const onUpdateMakeupTitle = (makeupWord, newTitle) => {
    setTaggedItems((prev) => {
      const updated = {
        ...prev,
        [makeupWord]: {
          ...prev[makeupWord],
          customTitle: newTitle,
        },
      };
      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onRemoveMakeupFromScene = (makeupWord, sceneIndex) => {
    setTaggedItems((prev) => {
      const item = prev[makeupWord];
      if (!item || !item.instances) return prev;

      const updatedInstances = item.instances.filter((instanceId) => {
        const instanceSceneIndex = parseInt(instanceId.split("-")[0]);
        return instanceSceneIndex !== sceneIndex;
      });

      const updatedScenes = item.scenes.filter((sceneNum) => {
        return sceneNum !== scenes[sceneIndex]?.sceneNumber;
      });

      let updated;
      if (updatedInstances.length === 0) {
        updated = { ...prev };
        delete updated[makeupWord];
      } else {
        updated = {
          ...prev,
          [makeupWord]: {
            ...item,
            instances: updatedInstances,
            scenes: updatedScenes,
          },
        };
      }

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreateMakeupVariant = (originalMakeupWord, variantName) => {
    const originalItem = taggedItems[originalMakeupWord];
    if (!originalItem) return;

    const variantKey = stemWord(
      variantName.toLowerCase().replace(/[^\w]/g, "")
    );
    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const originalPosition = getWordPosition(originalItem.displayName);

    const variantItem = {
      displayName: variantName,
      category: originalItem.category,
      color: originalItem.color,
      chronologicalNumber: chronologicalNumber,
      position: originalPosition + 0.1,
      scenes: [],
      instances: [],
      customTitle: variantName,
      originalProp: originalMakeupWord,
    };

    const updated = {
      ...taggedItems,
      [variantKey]: variantItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  const onAddMakeupToScene = (makeupWord, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    setTaggedItems((prev) => {
      const item = prev[makeupWord];
      if (!item) return prev;

      const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;
      const updatedInstances = [...(item.instances || []), syntheticInstanceId];
      const updatedScenes = [...(item.scenes || [])];

      if (!updatedScenes.includes(scene.sceneNumber)) {
        updatedScenes.push(scene.sceneNumber);
      }

      const updated = {
        ...prev,
        [makeupWord]: {
          ...item,
          instances: updatedInstances,
          scenes: updatedScenes.sort((a, b) => a - b),
        },
      };

      syncTaggedItemsToDatabase(updated);
      return updated;
    });
  };

  const onCreateNewMakeup = (itemName, sceneIndex) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    const cleanWord = stemWord(itemName.toLowerCase().replace(/[^\w]/g, ""));

    if (taggedItems[cleanWord]) {
      onAddMakeupToScene(cleanWord, sceneIndex);
      return;
    }

    const existingItems = Object.entries(taggedItems);
    let chronologicalNumber = existingItems.length + 1;
    const position = getWordPosition(itemName);
    const makeupCategory = tagCategories.find((cat) => cat.name === "Makeup");
    const syntheticInstanceId = `${sceneIndex}-manual-${Date.now()}`;

    const newItem = {
      displayName: itemName,
      category: "Makeup",
      color: makeupCategory?.color || "#FF9F43",
      chronologicalNumber: chronologicalNumber,
      position: position,
      scenes: [scene.sceneNumber],
      instances: [syntheticInstanceId],
      customTitle: itemName,
      manuallyCreated: true,
    };

    const updated = {
      ...taggedItems,
      [cleanWord]: newItem,
    };
    setTaggedItems(updated);
    syncTaggedItemsToDatabase(updated);
  };

  const onSceneNumberChange = async (sceneIndex, newNumber) => {
    console.log(
      "🎬 Scene renumbering:",
      scenes[sceneIndex].sceneNumber,
      "→",
      newNumber
    );

    const oldSceneNumber = scenes[sceneIndex].sceneNumber;

    // Parse scene numbers to handle letters (29A, 30B, etc.)
    const parseSceneNumber = (sceneNum) => {
      const match = String(sceneNum).match(/^(\d+)([A-Z]*)$/);
      if (match) {
        return {
          numeric: parseInt(match[1]),
          letter: match[2] || "",
          full: String(sceneNum),
        };
      }
      return {
        numeric: parseInt(sceneNum) || 1,
        letter: "",
        full: String(sceneNum),
      };
    };

    const oldParsed = parseSceneNumber(oldSceneNumber);
    const newParsed = parseSceneNumber(newNumber);

    // Determine if this creates an insertion (like 30→29A)
    const isInsertion =
      newParsed.numeric < oldParsed.numeric ||
      (newParsed.numeric === oldParsed.numeric &&
        newParsed.letter &&
        !oldParsed.letter);

    // Update scenes with proper shifting logic
    const updatedScenes = scenes.map((scene, index) => {
      if (index === sceneIndex) {
        // Target scene gets the new number
        return { ...scene, sceneNumber: newNumber };
      }

      if (isInsertion) {
        // Scenes AFTER the target scene (higher index) shift DOWN by 1
        if (index > sceneIndex) {
          const sceneNum = parseSceneNumber(scene.sceneNumber);
          return {
            ...scene,
            sceneNumber: (sceneNum.numeric - 1).toString() + sceneNum.letter,
          };
        }
      }

      return scene;
    });

    // Sort scenes by scene number for proper order
    updatedScenes.sort((a, b) => {
      const aNum = parseSceneNumber(a.sceneNumber);
      const bNum = parseSceneNumber(b.sceneNumber);

      if (aNum.numeric === bNum.numeric) {
        return aNum.letter.localeCompare(bNum.letter);
      }
      return aNum.numeric - bNum.numeric;
    });

    // Update scenes state
    setScenes(updatedScenes);

    // Update stripboard scenes with the same logic
    const updatedStripboard = stripboardScenes.map((stripScene) => {
      if (stripScene.sceneNumber === oldSceneNumber) {
        return { ...stripScene, sceneNumber: newNumber };
      }

      if (isInsertion) {
        // Find the original scene index to determine what to shift
        const originalSceneIndex = scenes.findIndex(
          (s) => s.sceneNumber === stripScene.sceneNumber
        );
        if (originalSceneIndex > sceneIndex) {
          const sceneNum = parseSceneNumber(stripScene.sceneNumber);
          return {
            ...stripScene,
            sceneNumber: (sceneNum.numeric - 1).toString() + sceneNum.letter,
          };
        }
      }

      return stripScene;
    });

    setStripboardScenes(updatedStripboard);

    // Sync both to database
    await saveScenesDatabase(updatedScenes);
    await syncStripboardScenesToDatabase(updatedStripboard);

    console.log("✅ Scene renumbering complete with proper shifting");
  };

  const updateCrewCallTime = (crewId, newCallTime) => {
    const newCallSheetData = {
      ...callSheetData,
      crewCallTimes: {
        ...callSheetData.crewCallTimes,
        [crewId]: newCallTime,
      },
    };

    setCallSheetData(newCallSheetData);

    // ADD SYNC CALL
    syncCallSheetDataToDatabase(newCallSheetData);
  };

  // ESC key closes tag dropdown
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      setShowTagDropdown(null);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const renderModule = () => {
    if (!activeModule || activeModule === "Dashboard") {
      return (
        <Dashboard
          user={user}
          selectedProject={selectedProject}
          todoItems={todoItems}
          shootingDays={shootingDays}
          scheduledScenes={scheduledScenes}
          stripboardScenes={stripboardScenes}
          callSheetData={callSheetData}
          castCrew={castCrew}
          scenes={scenes}
          costCategories={costCategories}
          characters={characters}
          userRole={userRole}
          setActiveModule={setActiveModule}
          canEdit={canEdit}
          isViewOnly={isViewOnly}
          projectSettings={projectSettings}
          setProjectSettings={setProjectSettings}
          syncProjectSettingsToDatabase={syncProjectSettingsToDatabase}
        />
      );
    }

    switch (activeModule) {
      case "Script":
        return (
          <Script
            scenes={scenes}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            handleFileUpload={handleFileUpload}
            handleSingleSceneUpload={handleSingleSceneUpload}
            taggedItems={taggedItems}
            tagCategories={tagCategories}
            showTagDropdown={showTagDropdown}
            setShowTagDropdown={setShowTagDropdown}
            tagWord={tagWord}
            untagWordInstance={untagWordInstance}
            isWordInstanceTagged={isWordInstanceTagged}
            onSceneNumberChange={onSceneNumberChange}
            stripboardScenes={stripboardScenes}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            selectedProject={selectedProject}
            user={user}
          />
        );
        case "Stripboard":
          return (
            <StripboardModule
              scenes={stripboardScenes}
              onLocationClick={() => setActiveModule("Locations")}
              taggedItems={taggedItems}
              characters={characters}
              castCrew={castCrew}
              wardrobeItems={wardrobeItems}
              onUpdateScene={updateStripboardScene}
              shootingDays={shootingDays}
              userRole={userRole}
              canEdit={canEdit(userRole)}
              isViewOnly={isViewOnly(userRole)}
            />
          );
      case "StripboardSchedule":
        return (
          <StripboardScheduleModule
            selectedProject={selectedProject}
            syncLocks={syncLocks}
            stripboardScenes={stripboardScenes}
            scheduledScenes={scheduledScenes}
            onScheduleScene={scheduleScene}
            onUnscheduleScene={unscheduleScene}
            shootingDays={shootingDays}
            setShootingDays={setShootingDays}
            setScheduledScenes={setScheduledScenes}
            setStripboardScenes={setStripboardScenes}
            scriptLocations={scriptLocations}
            scenes={scenes}
            setScenes={setScenes}
            onUpdateScene={updateStripboardScene}
            onSyncAllShootingDays={syncAllShootingDaysToDatabase}
            saveScenesDatabase={saveScenesDatabase}
            onSyncStripboardScenes={syncStripboardScenesToDatabase}
            onSyncScheduledScenes={syncScheduledScenesToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            syncShootingDays={syncShootingDaysToDatabase}
          />
        );
      case "Calendar":
        return (
          <CalendarModule
            scheduledScenes={scheduledScenes}
            todoItems={todoItems}
            castCrew={castCrew}
            shootingDays={shootingDays}
            stripboardScenes={stripboardScenes}
            doodCastEvents={doodCastEvents}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );

      case "Day Out of Days":
        return (
          <DayOutOfDaysModule
            selectedProject={selectedProject}
            castCrew={castCrew}
            shootingDays={shootingDays}
            characters={characters}
            stripboardScenes={stripboardScenes}
            scheduledScenes={scheduledScenes}
            doodCastEvents={doodCastEvents}
            setDoodCastEvents={setDoodCastEvents}
            doodOverrides={doodOverrides}
            setDoodOverrides={setDoodOverrides}
            doodSettings={doodSettings}
            setDoodSettings={setDoodSettings}
            onSyncDoodCastEvent={(event) =>
              database.syncDoodCastEvent(selectedProject, event)
            }
            onSyncDoodOverride={(override) =>
              database.syncDoodOverride(selectedProject, override)
            }
            onSyncDoodSettings={(settings) =>
              database.syncDoodSettings(selectedProject, settings)
            }
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );

      case "CallSheet":
        // Debug log removed

        return (
          <CallSheetModule
            scenes={scenes}
            shootingDays={shootingDays}
            castCrew={castCrew}
            onUpdateCastCrew={(updatedCastCrew) => {
              setCastCrew(updatedCastCrew);
            }}
            characters={characters}
            stripboardScenes={stripboardScenes}
            scheduledScenes={scheduledScenes}
            projectSettings={projectSettings}
            setProjectSettings={setProjectSettings}
            callSheetData={callSheetData}
            setCallSheetData={setCallSheetData}
            updateCrewCallTime={updateCrewCallTime}
            wardrobeItems={wardrobeItems}
            scriptLocations={scriptLocations}
            actualLocations={actualLocations}
            getFinalCharacterScenes={getFinalCharacterScenes}
            syncCallSheetData={syncCallSheetDataToDatabase}
            selectedProject={selectedProject}
            taggedItems={taggedItems}
          />
        );

      case "Cast & Crew":
        return (
          <CastCrewModule
            scenes={scenes}
            castCrew={castCrew}
            setCastCrew={setCastCrew}
            crewSortOrder={crewSortOrder}
            setCrewSortOrder={setCrewSortOrder}
            onSyncCastCrew={syncCastCrewToDatabase}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            selectedProject={selectedProject}
            user={user}
            moduleCharacters={characters}
          />
        );

      case "Characters":
        return (
          <CharactersModule
            characters={characters}
            setCharacters={setCharacters}
            characterSceneOverrides={characterSceneOverrides}
            setCharacterSceneOverrides={setCharacterSceneOverrides}
            getFinalCharacterScenes={getFinalCharacterScenes}
            scenes={scenes}
            castCrew={castCrew}
            setCastCrew={setCastCrew}
            wardrobeItems={wardrobeItems}
            garmentInventory={garmentInventory}
            taggedItems={taggedItems}
            continuityElements={continuityElements}
            stripboardScenes={stripboardScenes}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onUpdateCharacters={syncCharactersToDatabase}
            onDeleteCharacter={handleDeleteCharacter}
            onUpdateCharacterOverrides={syncCharacterOverridesToDatabase}
            syncCastCrewToDatabase={syncCastCrewToDatabase}
            selectedProject={selectedProject}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );

      case "Props":
        return (
          <PropsModule
            taggedItems={taggedItems}
            scenes={scenes}
            characters={characters}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onUpdatePropTitle={onUpdatePropTitle}
            onRemovePropFromScene={onRemovePropFromScene}
            onCreatePropVariant={onCreatePropVariant}
            onAddPropToScene={onAddPropToScene}
            onCreateNewProp={onCreateNewProp}
            onUpdateTaggedItems={setTaggedItems}
            onSyncTaggedItems={syncTaggedItemsToDatabase}
            stemWord={stemWord}
            projectSettings={projectSettings}
            onDeleteProp={async (word) => {
              // State + renumbering is handled in Props.js before this is called.
              // This callback is responsible only for removing the DB row.
              try {
                await database.deleteTaggedItem(selectedProject, word);
              } catch (e) {
                console.error("❌ Failed to delete prop:", e);
              }
            }}
            showConfirm={showConfirm}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            onUploadPropImage={async (propWord, file) => {
              const result = await uploadPropImage(
                file,
                selectedProject.id,
                propWord,
                `prop_${Date.now()}.jpg`
              );
              return result?.url || null;
            }}
            onDeletePropImage={async (url) => {
              await deleteMultipleImages([url]);
            }}
          />
        );
      case "Makeup":
        return (
          <MakeupModule
            taggedItems={taggedItems}
            scenes={scenes}
            characters={characters}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onUpdateMakeupTitle={onUpdateMakeupTitle}
            onRemoveMakeupFromScene={onRemoveMakeupFromScene}
            onCreateMakeupVariant={onCreateMakeupVariant}
            onAddMakeupToScene={onAddMakeupToScene}
            onCreateNewMakeup={onCreateNewMakeup}
            onUpdateTaggedItems={setTaggedItems}
            onSyncTaggedItems={syncTaggedItemsToDatabase}
            stemWord={stemWord}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Production Design":
        return (
          <ProductionDesignModule
            taggedItems={taggedItems}
            scenes={scenes}
            scriptLocations={scriptLocations}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onUpdatePDTitle={onUpdatePDTitle}
            onRemovePDFromScene={onRemovePDFromScene}
            onCreatePDVariant={onCreatePDVariant}
            onAddPDToScene={onAddPDToScene}
            onCreateNewPD={onCreateNewPD}
            onUpdateTaggedItems={setTaggedItems}
            onSyncTaggedItems={syncTaggedItemsToDatabase}
            stemWord={stemWord}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "ShotList":
        return (
          <ShotListModule
            stripboardScenes={stripboardScenes}
            characters={characters}
            castCrew={castCrew}
            shootingDays={shootingDays}
            scheduledScenes={scheduledScenes}
            shotListData={shotListData}
            setShotListData={setShotListData}
            sceneNotes={sceneNotes}
            setSceneNotes={setSceneNotes}
            onSyncShotListData={syncShotListDataToDatabase}
            userRole={userRole}
            canEdit={canEdit}
            isViewOnly={isViewOnly}
            selectedProject={selectedProject}
            user={user}
          />
        );
      case "Locations":
        return (
          <LocationsModule
            scenes={stripboardScenes}
            mainScenes={scenes}
            setMainScenes={setScenes}
            saveScenesDatabase={saveScenesDatabase}
            scriptLocations={scriptLocations}
            setScriptLocations={setScriptLocations}
            actualLocations={actualLocations}
            setActualLocations={setActualLocations}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onSyncScriptLocations={syncScriptLocationsToDatabase}
            onSyncActualLocations={syncActualLocationsToDatabase}
            selectedProject={selectedProject}
            onUpdateSceneHeading={(
              sceneNumber,
              heading,
              intExt,
              location,
              timeOfDay,
              modifier
            ) =>
              database
                .updateSceneHeading(
                  selectedProject,
                  sceneNumber,
                  heading,
                  intExt,
                  location,
                  timeOfDay,
                  modifier
                )
                .then(() => {
                  setScenes((prev) =>
                    prev.map((s) =>
                      String(s.sceneNumber) === String(sceneNumber)
                        ? {
                            ...s,
                            heading,
                            metadata: {
                              ...s.metadata,
                              intExt,
                              location,
                              timeOfDay,
                              modifier,
                            },
                          }
                        : s
                    )
                  );
                })
                .catch((e) => console.error("❌ Heading update failed:", e))
            }
            onUpdateSceneTimeOfDay={(sceneNumber, timeOfDay) =>
              database
                .updateSceneTimeOfDay(selectedProject, sceneNumber, timeOfDay)
                .then(() => {
                  setScenes((prev) =>
                    prev.map((s) =>
                      String(s.sceneNumber) === String(sceneNumber)
                        ? {
                            ...s,
                            metadata: { ...s.metadata, timeOfDay },
                            manualTimeOfDay: timeOfDay,
                          }
                        : s
                    )
                  );
                })
                .catch((e) => console.error("❌ Time of day update failed:", e))
            }
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Cost Report":
        return (
          <CostReportModule
            costCategories={costCategories}
            setCostCategories={setCostCategories}
            costVendors={costVendors}
            setCostVendors={setCostVendors}
            budgetData={budgetData}
            setBudgetData={setBudgetData}
            onSyncBudgetData={syncBudgetDataToDatabase}
            selectedProject={selectedProject}
            scenes={scenes}
            shootingDays={shootingDays}
            castCrew={castCrew}
            crewSortOrder={crewSortOrder}
            onSyncCostCategories={syncCostCategoriesToDatabase}
            onSyncCostVendors={syncCostVendorsToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Wardrobe":
        return (
          <WardrobeModule
            scenes={scenes}
            characters={characters}
            wardrobeItems={wardrobeItems}
            setWardrobeItems={setWardrobeItems}
            garmentInventory={garmentInventory}
            setGarmentInventory={setGarmentInventory}
            garmentCategories={garmentCategories}
            setGarmentCategories={setGarmentCategories}
            setActiveModule={setActiveModule}
            setCurrentIndex={setCurrentIndex}
            onSyncWardrobeItems={syncWardrobeItemsToDatabase}
            onSyncGarmentInventory={syncGarmentInventoryToDatabase}
            castCrew={castCrew}
            setCastCrew={setCastCrew}
            selectedProject={selectedProject}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Reports":
        return (
          <ReportsModule
            shootingDays={shootingDays}
            scheduledScenes={scheduledScenes}
            stripboardScenes={stripboardScenes}
            taggedItems={taggedItems}
            wardrobeItems={wardrobeItems}
            garmentInventory={garmentInventory}
            scenes={scenes}
            projectSettings={projectSettings}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "ToDoList":
        return (
          <ToDoListModule
            todoItems={todoItems}
            setTodoItems={setTodoItems}
            todoCategories={todoCategories}
            setTodoCategories={setTodoCategories}
            castCrew={castCrew}
            syncTodoItemsToDatabase={syncTodoItemsToDatabase}
            onDeleteTodoItem={handleDeleteTodoItem}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
            selectedProject={selectedProject}
            user={user}
          />
        );
      case "Timeline":
        return (
          <TimelineModule
            scenes={scenes}
            characters={characters}
            castCrew={castCrew}
            stripboardScenes={stripboardScenes}
            timelineData={timelineData}
            setTimelineData={setTimelineData}
            continuityElements={continuityElements}
            setContinuityElements={setContinuityElements}
            onSyncTimelineData={syncTimelineDataToDatabase}
            onSyncContinuityElements={syncContinuityElementsToDatabase}
            onUpdateScenes={(updatedScenes) => {
              setScenes(updatedScenes);
              saveScenesDatabase(updatedScenes);
            }}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      case "Budget":
        return (
          <BudgetModule
            budgetData={budgetData}
            setBudgetData={setBudgetData}
            onSyncBudgetData={syncBudgetDataToDatabase}
            userRole={userRole}
            canEdit={canEdit(userRole)}
            isViewOnly={isViewOnly(userRole)}
          />
        );
      default:
        return <div>Select a module</div>;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        position: "fixed",
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "120px",
          backgroundColor: "#FFE5B4",
          paddingTop: "10px",
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "fixed",
          left: 0,
          top: "44px",
          bottom: 0,
          zIndex: 1000,
          overflowY: "auto",
        }}
      >
        {/* Export/Import Section */}
        {canEdit(userRole) && (
          <div
            style={{
              marginBottom: "10px",
              borderBottom: "1px solid #ccc",
              paddingBottom: "10px",
            }}
          >
            <button
              onClick={exportProject}
              style={{
                margin: "2px 0",
                padding: "6px 4px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "1px solid #45a049",
                cursor: "pointer",
                fontSize: "10px",
                width: "100px",
                fontWeight: "bold",
              }}
            >
              Export
            </button>

            <label style={{ display: "block" }}>
              <input
                type="file"
                accept=".json"
                onChange={importProject}
                style={{ display: "none" }}
              />
              <div
                style={{
                  margin: "2px 0",
                  padding: "6px 4px",
                  backgroundColor: "#2196F3",
                  color: "white",
                  border: "1px solid #1976D2",
                  cursor: "pointer",
                  fontSize: "10px",
                  width: "100px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                Import
              </div>
            </label>
          </div>
        )}

        {/* Maintenance & Debug Buttons - Commented out for production */}
        {/* DEBUG & MAINTENANCE BUTTONS - Hidden in production but preserved for emergency use */}
        {/* Uncomment buttons below for debugging or maintenance operations */}
        {/*
          <button
            onClick={cleanupDuplicateShootingDays}
            style={{
              margin: "2px 0",
              padding: "6px 4px",
              backgroundColor: "#9C27B0",
              color: "white",
              border: "1px solid #7B1FA2",
              cursor: "pointer",
              fontSize: "10px",
              width: "100px",
              fontWeight: "bold",
            }}
          >
            Cleanup Days
          </button>

          <button
            onClick={debugShootingDaysState}
            style={{
              margin: "2px 0",
              padding: "6px 4px",
              backgroundColor: "#FF5722",
              color: "white",
              border: "1px solid #D84315",
              cursor: "pointer",
              fontSize: "10px",
              width: "100px",
              fontWeight: "bold",
            }}
          >
            Debug Days
          </button>

          <button
            onClick={auditAllDatabaseTables}
            style={{
              margin: "2px 0",
              padding: "6px 4px",
              backgroundColor: "#FF5722",
              color: "white",
              border: "1px solid #D84315",
              cursor: "pointer",
              fontSize: "10px",
              width: "100px",
              fontWeight: "bold",
            }}
          >
            Audit DB
          </button>

          <button
            onClick={emergencyDatabaseCleanup}
            style={{
              margin: "2px 0",
              padding: "6px 4px",
              backgroundColor: "#F44336",
              color: "white",
              border: "1px solid #D32F2F",
              cursor: "pointer",
              fontSize: "10px",
              width: "100px",
              fontWeight: "bold",
            }}
          >
            Emergency Cleanup
          </button>
          */}

        {/*
<button
  onClick={repairScheduledScenesFromStripboard}
  style={{
    margin: "2px 0",
    padding: "6px 4px",
    backgroundColor: "#FF9800",
    color: "white",
    border: "1px solid #F57C00",
    cursor: "pointer",
    fontSize: "10px",
    width: "100px",
    fontWeight: "bold",
  }}
>
  Repair Reports
</button>

<button
  onClick={() => {
    console.log("=== BEFORE CALCULATION ===");
    console.log("TaggedItems count:", Object.keys(taggedItems).length);
    console.log("Sample items:", Object.entries(taggedItems).slice(0,3).map(([word, item]) => ({
      word,
      category: item.category,
      chronologicalNumber: item.chronologicalNumber,
      categoryNumber: item.categoryNumber
    })));
    
    const itemsWithCategoryNumbers = calculateCategoryNumbers(taggedItems);
    
    console.log("=== AFTER CALCULATION ===");
    console.log("Sample items with category numbers:", Object.entries(itemsWithCategoryNumbers).slice(0,3).map(([word, item]) => ({
      word,
      category: item.category,
      chronologicalNumber: item.chronologicalNumber,
      categoryNumber: item.categoryNumber
    })));
    
    setTaggedItems(itemsWithCategoryNumbers);
    alert("Category numbers recalculated! Check console for details.");
  }}
  style={{
    margin: "2px 0",
    padding: "6px 4px",
    backgroundColor: "#9C27B0",
    color: "white",
    border: "1px solid #7B1FA2",
    cursor: "pointer",
    fontSize: "10px",
    width: "100px",
    fontWeight: "bold",
  }}
>
  Fix Numbers
</button>
*/}

        <div style={{ marginBottom: "10px" }}>
          <strong>Modules:</strong>
        </div>

        <div
          style={{
            fontSize: "9px",
            color: "#666",
            marginBottom: "8px",
            textAlign: "center",
          }}
        >
          v
          {localStorage.getItem("appVersion")
            ? new Date(
                parseInt(localStorage.getItem("appVersion"))
              ).toLocaleDateString()
            : "loading..."}
        </div>

        <button
          onClick={() => setActiveModule("Dashboard")}
          style={{
            margin: "5px 0",
            padding: "8px 4px",
            backgroundColor:
              activeModule === "Dashboard" ? "#ddd" : "transparent",
            border: "1px solid #ccc",
            cursor: "pointer",
            fontWeight: activeModule === "Dashboard" ? "bold" : "normal",
            fontSize: "11px",
            width: "100px",
          }}
        >
          🏠 Home
        </button>

        {[
          "Script",
          "Stripboard",
          "StripboardSchedule",
          "Calendar",
          "Day Out of Days",
          "Cast & Crew",
          "Characters",
          "Locations",
          "CallSheet",
          "ShotList",
          "ToDoList",
          "Timeline",
          "Props",
          "Makeup",
          "Production Design",
          "Wardrobe",
          "Cost Report",
          "Reports",
          "Budget",
        ]
          .filter((mod) => mod !== "Dashboard")
          .map((mod) => (
            <button
              key={mod}
              onClick={() => setActiveModule(mod)}
              style={{
                margin: "5px 0",
                padding: "8px 4px",
                backgroundColor: activeModule === mod ? "#ddd" : "transparent",
                border: "1px solid #ccc",
                cursor: "pointer",
                fontWeight: activeModule === mod ? "bold" : "normal",
                fontSize: "11px",
                width: "100px",
              }}
            >
              {mod}
            </button>
          ))}
      </div>

      <div
        style={{
          marginLeft: "120px",
          width: "calc(100vw - 120px)",
          maxWidth: "calc(100vw - 120px)",
          padding: activeModule === "Script" ? "10px" : "0",
          fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          boxSizing: "border-box",
          position: "fixed",
          top: "44px",
          right: "0",
          bottom: "0",
          overflow: "hidden",
        }}
      >
        {renderModule()}
      </div>

      {/* Centered Alert/Confirm Modal */}
      {appAlert && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 99998,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") appAlert.onOk();
            if (e.key === "Escape" && appAlert.onCancel) appAlert.onCancel();
          }}
          tabIndex={-1}
          ref={(el) => el && el.focus()}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "8px",
              padding: "0",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            {/* Header bar matching app style */}
            <div
              style={{
                backgroundColor:
                  appAlert.confirmLabel === "Delete" ? "#f44336" : "#2196F3",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "15px",
                  fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
                }}
              >
                {appAlert.confirmLabel === "Delete"
                  ? "Confirm Delete"
                  : "Confirm"}
              </span>
              {appAlert.onCancel && (
                <button
                  onClick={appAlert.onCancel}
                  style={{
                    backgroundColor: "transparent",
                    border: "none",
                    color: "white",
                    fontSize: "20px",
                    cursor: "pointer",
                    lineHeight: 1,
                    padding: "0 2px",
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: "24px 24px 20px" }}>
              <p
                style={{
                  margin: "0 0 22px",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  color: "#333",
                  fontFamily: "'Century Gothic', 'Futura', 'Arial', sans-serif",
                }}
              >
                {appAlert.message}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                {appAlert.onCancel && (
                  <button
                    onClick={appAlert.onCancel}
                    style={{
                      padding: "8px 18px",
                      backgroundColor: "white",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontFamily:
                        "'Century Gothic', 'Futura', 'Arial', sans-serif",
                      color: "#555",
                    }}
                  >
                    {appAlert.cancelLabel || "Cancel"}
                  </button>
                )}
                <button
                  autoFocus
                  onClick={appAlert.onOk}
                  style={{
                    padding: "8px 20px",
                    backgroundColor:
                      appAlert.confirmLabel === "Delete"
                        ? "#f44336"
                        : "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "bold",
                    fontFamily:
                      "'Century Gothic', 'Futura', 'Arial', sans-serif",
                  }}
                >
                  {appAlert.confirmLabel || "OK"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* AI Summarization Progress Toast */}
      {isSummarizing && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#1a1a2e",
            color: "white",
            padding: "14px 18px",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 99999,
            minWidth: "260px",
            fontSize: "13px",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>✨</span>
            AI Summarizing Scenes...
          </div>
          <div style={{ marginBottom: "8px", color: "#ccc", fontSize: "12px" }}>
            Scene {summarizeProgress.current} of {summarizeProgress.total}
          </div>
          <div
            style={{
              backgroundColor: "#333",
              borderRadius: "4px",
              height: "6px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                backgroundColor: "#2196F3",
                height: "100%",
                width: `${
                  summarizeProgress.total > 0
                    ? Math.round(
                        (summarizeProgress.current / summarizeProgress.total) *
                          100
                      )
                    : 0
                }%`,
                transition: "width 0.3s ease",
                borderRadius: "4px",
              }}
            />
          </div>
          <div style={{ marginTop: "6px", color: "#aaa", fontSize: "11px" }}>
            You can keep working — descriptions will appear as they complete.
          </div>
        </div>
      )}
    </div>
  );
}

export default App;