import { useCallback, useEffect, useRef, useState } from "react";
import { loadWritingDraftAsync, saveWritingDraftSafely } from "./writingDraftPersistence";

export const WRITING_DRAFT_SAVE_STATUS = {
  SAVED: "saved",
  UNSAVED: "unsaved",
  SAVING: "saving",
  ERROR: "error",
};

function useWritingDraftState(project, options = {}) {
  const saveDelayMs = Number.isFinite(Number(options.saveDelayMs))
    ? Number(options.saveDelayMs)
    : 650;
  const [writingDraftNodes, setWritingDraftNodes] = useState([]);
  const [writingDraftSaveStatus, setWritingDraftSaveStatus] = useState(WRITING_DRAFT_SAVE_STATUS.SAVED);
  const writingDraftSaveTimerRef = useRef(null);
  const lastWritingDraftPayloadRef = useRef("");

  useEffect(() => {
    clearTimeout(writingDraftSaveTimerRef.current);
    let cancelled = false;

    if (!project) {
      setWritingDraftNodes([]);
      setWritingDraftSaveStatus(WRITING_DRAFT_SAVE_STATUS.SAVED);
      lastWritingDraftPayloadRef.current = "";
      return;
    }

    (async () => {
      try {
        const draft = await loadWritingDraftAsync(project);
        if (cancelled) return;
        const nodes = draft.hasUserCreatedScript && draft.nodes.length ? draft.nodes : [];

        setWritingDraftNodes(nodes);
        lastWritingDraftPayloadRef.current = JSON.stringify(nodes);
        setWritingDraftSaveStatus(WRITING_DRAFT_SAVE_STATUS.SAVED);
      } catch (err) {
        if (cancelled) return;
        console.warn("Could not load writing draft:", err);
        setWritingDraftNodes([]);
        lastWritingDraftPayloadRef.current = JSON.stringify([]);
        setWritingDraftSaveStatus(WRITING_DRAFT_SAVE_STATUS.ERROR);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [project]);

  useEffect(() => {
    return () => {
      clearTimeout(writingDraftSaveTimerRef.current);
    };
  }, []);

  const handleWritingDraftNodesChange = useCallback((nextNodes = []) => {
    const safeNodes = Array.isArray(nextNodes) ? nextNodes : [];
    const payload = JSON.stringify(safeNodes);

    setWritingDraftNodes(safeNodes);

    if (payload === lastWritingDraftPayloadRef.current) {
      setWritingDraftSaveStatus(WRITING_DRAFT_SAVE_STATUS.SAVED);
      return;
    }

    setWritingDraftSaveStatus(WRITING_DRAFT_SAVE_STATUS.UNSAVED);
    clearTimeout(writingDraftSaveTimerRef.current);

    writingDraftSaveTimerRef.current = setTimeout(() => {
      setWritingDraftSaveStatus(WRITING_DRAFT_SAVE_STATUS.SAVING);
      saveWritingDraftSafely(project, safeNodes).then(() => {
        lastWritingDraftPayloadRef.current = payload;
        setWritingDraftSaveStatus(WRITING_DRAFT_SAVE_STATUS.SAVED);
      }).catch((err) => {
        console.error("Could not save writing draft:", err);
        setWritingDraftSaveStatus(WRITING_DRAFT_SAVE_STATUS.ERROR);
      });
    }, saveDelayMs);
  }, [project, saveDelayMs]);

  return {
    writingDraftNodes,
    setWritingDraftNodes,
    writingDraftSaveStatus,
    setWritingDraftSaveStatus,
    handleWritingDraftNodesChange,
  };
}

export default useWritingDraftState;
