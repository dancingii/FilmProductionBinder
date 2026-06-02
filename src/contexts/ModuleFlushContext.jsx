// ModuleFlushContext — general module flush registry for safe project exit.
//
// Modules register an async flush handler by calling registerFlushHandler(key, label, fn).
// The handler is called once during "Save and Return to Projects" flow.
// Handlers must deregister on unmount via the returned cleanup function.
//
// Flush result shape returned by each handler:
//   {
//     key: string,            — e.g. "writingScript"
//     label: string,          — e.g. "Writing Script"
//     status: "success" | "skipped" | "blocked" | "local" | "error" | "timeout",
//     storage: "database" | "indexedDB" | "blocked" | "memory" | null,
//     localOnly: boolean,
//     errorMessage: string | null,   — r?.errorMessage takes priority over r?.databaseError?.message
//     blockedEmptySave: boolean,     — true when flush was blocked to prevent 0-node overwrite
//     skipped: boolean,              — true when handler had no changes to persist
//     timestamp: string              — ISO
//   }
//
// callAllFlushHandlers() runs all registered handlers concurrently, each
// individually timeout-protected. Returns an array of flush results.
//
// This registry has NO effect on normal editing. It is only called during
// the explicit project exit flow.

import React, { createContext, useContext, useRef, useCallback } from "react";

// Per-handler timeout for the flush registry. This is a final safety guard —
// individual handlers should have their own internal timeouts and return a clean
// localOnly/indexedDB result well before this fires. 30s gives handlers room to
// complete their own timeout+fallback cycle (e.g. 10s DB timeout + IDB write).
const FLUSH_TIMEOUT_MS = 30_000;

const ModuleFlushContext = createContext(null);

export function ModuleFlushProvider({ children }) {
  // Map of key → { label, fn }
  const handlersRef = useRef(new Map());

  const registerFlushHandler = useCallback((key, label, fn) => {
    handlersRef.current.set(key, { label, fn });
    return () => {
      handlersRef.current.delete(key);
    };
  }, []);

  const callAllFlushHandlers = useCallback(async () => {
    const handlers = Array.from(handlersRef.current.entries());
    if (handlers.length === 0) return [];

    const results = await Promise.all(
      handlers.map(async ([key, { label, fn }]) => {
        const timestamp = new Date().toISOString();
        const timeoutGuard = new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                key,
                label,
                status: "timeout",
                storage: null,
                localOnly: true,
                errorMessage: `Flush timed out after ${FLUSH_TIMEOUT_MS / 1000}s`,
                timestamp,
              }),
            FLUSH_TIMEOUT_MS
          )
        );

        try {
          const handlerResult = await Promise.race([
            Promise.resolve(fn()).then((r) => ({
              // Spread all module-specific metadata first so core fields below win.
              ...(r && typeof r === "object" ? r : {}),
              // Core normalized fields — these always override whatever r returned.
              key,
              label,
              status: r?.skipped
                ? "skipped"
                : r?.blockedEmptySave
                ? "blocked"
                : r?.localOnly
                ? "local"
                : "success",
              storage: r?.storage ?? null,
              localOnly: r?.localOnly === true,
              errorMessage: r?.errorMessage ?? r?.databaseError?.message ?? null,
              blockedEmptySave: r?.blockedEmptySave === true,
              skipped: r?.skipped === true,
              timestamp,
            })),
            timeoutGuard,
          ]);
          return handlerResult;
        } catch (err) {
          return {
            key,
            label,
            status: "error",
            storage: null,
            localOnly: true,
            errorMessage: err?.message ?? "Unknown error",
            timestamp,
          };
        }
      })
    );

    return results;
  }, []);

  return (
    <ModuleFlushContext.Provider value={{ registerFlushHandler, callAllFlushHandlers }}>
      {children}
    </ModuleFlushContext.Provider>
  );
}

export function useModuleFlush() {
  const ctx = useContext(ModuleFlushContext);
  if (!ctx) throw new Error("useModuleFlush must be used inside ModuleFlushProvider");
  return ctx;
}
