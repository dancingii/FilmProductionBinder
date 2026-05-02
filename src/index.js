import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import AuthWrapper from "./components/auth/AuthWrapper";
import MobileApp from "./components/mobile/MobileApp";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

const isMobile =
  /iPhone|iPad|Android/i.test(navigator.userAgent) ||
  window.innerWidth < 768;

  const urlParams = new URLSearchParams(window.location.search);
  const initialPropId = urlParams.get("prop");
  
  root.render(
    isMobile ? (
      <MobileApp initialPropId={initialPropId} />
    ) : (
      <AuthWrapper>
        <App />
      </AuthWrapper>
    )
  );