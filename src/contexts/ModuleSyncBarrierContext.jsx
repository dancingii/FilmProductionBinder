// ModuleSyncBarrierContext — pending-sync barrier for safe project exit.
//
// PURPOSE
//   Normal module saves (debounced Supabase writes, immediate upserts) run
//   continuously during editing. Save/Return must not fire its flush handlers
//   while a debounce timer is still pending — that would let the flush handler
//   read stale Supabase state that the pending debounce hasn't written yet.
//
//   This context is the handshake point: modules register their current sync
//   state so AuthWrapper can wait for active writes to settle before proceeding.
//
// WHAT IT IS NOT
//   - Not a replacement for ModuleFlushContext (flush handlers still run after barriers clear).
//   - Not a general event bus.
//   - Not called during normal editing — only consulted during Save/Return.
//
// BARRIER SHAPE
//   {
//     moduleKey: string,            — e.g. "writingScript"
//     label: string,                — human-readable
//     getState: () => BarrierState, — called synchronously to read current state
//     awaitIdle: () => Promise<BarrierIdleResult>,
//                                   — await until idle or timeout; must resolve, never reject
//   }
//
// BARRIERSTATE SHAPE
//   {
//     state: "idle" | "syncing" | "dirty" | "offlineQueued" | "failed",
//     pendingCount: number,          — how many pending writes/timers
//     lastSyncedAt: string | null,   — ISO timestamp of last confirmed Supabase write
//     lastError: string | null,
//   }
//
// BARRIERIDLERESULT (from awaitIdle)
//   {
//     moduleKey: string,
//     label: string,
//     settled: boolean,              — true if reached idle cleanly
//     timedOut: boolean,
//     flushed: boolean,              — true if a pending write was triggered+confirmed
//     offlineQueued: boolean,        — true if Supabase unavailable, local fallback used
//     localOnly: boolean,            — true if result is local-only (no Supabase confirm)
//     finalState: BarrierState,      — state at resolution time
//     errorMessage: string | null,
//   }

import React, { createContext, useContext, useRef, useCallback } from "react";

// Per-barrier await timeout. Generous to accommodate MoodBoard's 2s debounce +
// the 10s Supabase timeout inside saveWritingDraftSafely.
const BARRIER_AWAIT_TIMEOUT_MS = 20_000;

const ModuleSyncBarrierContext = createContext(null);

export function ModuleSyncBarrierProvider({ children }) {
  // Map of moduleKey → { label, getState, awaitIdle }
  const barriersRef = useRef(new Map());

  const registerSyncBarrier = useCallback((moduleKey, { label, getState, awaitIdle }) => {
    barriersRef.current.set(moduleKey, { label, getState, awaitIdle });
    return () => {
      barriersRef.current.delete(moduleKey);
    };
  }, []);

  // Called by AuthWrapper before callAllFlushHandlers.
  // Returns an array of BarrierIdleResults, one per registered barrier.
  // Never throws — all barriers resolve within BARRIER_AWAIT_TIMEOUT_MS.
  const awaitAllBarriersIdle = useCallback(async () => {
    const barriers = Array.from(barriersRef.current.entries());
    if (barriers.length === 0) return [];

    return Promise.all(
      barriers.map(async ([moduleKey, { label, awaitIdle }]) => {
        const timeoutResult = {
          moduleKey,
          label,
          settled: false,
          timedOut: true,
          flushed: false,
          offlineQueued: false,
          localOnly: true,
          finalState: { state: "failed", pendingCount: 0, lastSyncedAt: null, lastError: `Barrier timed out after ${BARRIER_AWAIT_TIMEOUT_MS / 1000}s` },
          errorMessage: `${label} sync barrier timed out after ${BARRIER_AWAIT_TIMEOUT_MS / 1000}s`,
        };

        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve(timeoutResult), BARRIER_AWAIT_TIMEOUT_MS)
        );

        try {
          return await Promise.race([awaitIdle(), timeoutPromise]);
        } catch (err) {
          return {
            moduleKey,
            label,
            settled: false,
            timedOut: false,
            flushed: false,
            offlineQueued: false,
            localOnly: true,
            finalState: { state: "failed", pendingCount: 0, lastSyncedAt: null, lastError: err?.message ?? "unknown" },
            errorMessage: err?.message ?? "Barrier awaitIdle threw unexpectedly",
          };
        }
      })
    );
  }, []);

  // Read current state snapshot for all registered barriers without awaiting.
  const getBarrierSnapshots = useCallback(() => {
    return Array.from(barriersRef.current.entries()).map(([moduleKey, { label, getState }]) => ({
      moduleKey,
      label,
      ...getState(),
    }));
  }, []);

  return (
    <ModuleSyncBarrierContext.Provider value={{ registerSyncBarrier, awaitAllBarriersIdle, getBarrierSnapshots }}>
      {children}
    </ModuleSyncBarrierContext.Provider>
  );
}

export function useModuleSyncBarrier() {
  const ctx = useContext(ModuleSyncBarrierContext);
  if (!ctx) throw new Error("useModuleSyncBarrier must be used inside ModuleSyncBarrierProvider");
  return ctx;
}
