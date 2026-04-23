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

root.render(
  isMobile ? (
    <MobileApp />
  ) : (
    <AuthWrapper>
      <App />
    </AuthWrapper>
  )
);