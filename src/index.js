import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "@fontsource/questrial";

import App from "./App";
import AuthWrapper from "./components/auth/AuthWrapper";
import { ModuleFlushProvider } from "./contexts/ModuleFlushContext";
import { ModuleSyncBarrierProvider } from "./contexts/ModuleSyncBarrierContext";
import MobileApp from "./components/mobile/MobileApp";
import PublicScriptShareViewer from "./components/modules/WritingScript/PublicScriptShareViewer";
import PublicMoodBoardShareViewer from "./components/modules/MoodBoard/PublicMoodBoardShareViewer";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

const isMobile =
  /iPhone|iPad|Android/i.test(navigator.userAgent) ||
  window.innerWidth < 768;

  const urlParams = new URLSearchParams(window.location.search);
const initialPropId = urlParams.get("prop");
const initialProjectId = urlParams.get("projectId");

const isPublicScriptShareRoute = /^\/share\/script\/[^/?#]+/.test(window.location.pathname);
const isPublicMoodBoardShareRoute = /^\/share\/moodboard\/[^/?#]+/.test(window.location.pathname);

  root.render(
    isPublicScriptShareRoute ? (
      <PublicScriptShareViewer />
    ) : isPublicMoodBoardShareRoute ? (
      <PublicMoodBoardShareViewer />
    ) : isMobile ? (
      <MobileApp initialPropId={initialPropId} initialProjectId={initialProjectId} />
    ) : (
      <ModuleSyncBarrierProvider>
        <ModuleFlushProvider>
          <AuthWrapper>
            <App />
          </AuthWrapper>
        </ModuleFlushProvider>
      </ModuleSyncBarrierProvider>
    )
  );
