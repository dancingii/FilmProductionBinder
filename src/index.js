import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import AuthWrapper from "./components/auth/AuthWrapper";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <AuthWrapper>
    <App />
  </AuthWrapper>
);
