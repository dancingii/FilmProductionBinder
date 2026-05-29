import React, { useEffect, useState } from "react";
import { deriveCharacterKey } from "./writingCharacterExtraction";
import { getWritingCharacterProfilesArray } from "./writingCharactersModel";
import WritingCharacterSuggestionsModal from "./WritingCharacterSuggestionsModal";

const ROLE_OPTIONS = ["", "Protagonist", "Antagonist", "Supporting", "Narrator"];

export default function WritingCharactersPanel({
  profiles,
  extractedNames,
  isViewOnly,
  isProfilesLoading,
  onCreateProfiles,
  onIgnoreSuggestions,
  onUpdateProfile,
  onRescan,
}) {
  const [showModal, setShowModal] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const [rescanTrigger, setRescanTrigger] = useState(0);
  const [bypassIgnored, setBypassIgnored] = useState(false);

  useEffect(() => {
    // Don't flash the modal while profiles are still loading from the database
    if (isProfilesLoading) return;

    const existingKeys = new Set();
    const p = profiles?.profiles || {};
    Object.keys(p).forEach((k) => existingKeys.add(k));
    Object.values(p).forEach((prof) => {
      (prof.aliases || []).forEach((a) => existingKeys.add(deriveCharacterKey(String(a).toUpperCase())));
    });
    Object.values(profiles?.resolution || {}).forEach((v) => existingKeys.add(v));
    // When the user explicitly rescans, bypass ignoredSuggestions so skipped names reappear
    if (!bypassIgnored) {
      (profiles?.ignoredSuggestions || []).forEach((k) => existingKeys.add(k));
    }

    const unresolved = [];
    extractedNames.forEach((ec) => {
      if (!existingKeys.has(ec.normalizedKey)) unresolved.push(ec);
    });

    if (unresolved.length > 0) {
      setPendingSuggestions(unresolved);
      setShowModal(true);
    } else {
      setShowModal(false);
      setPendingSuggestions([]);
    }
  }, [extractedNames, profiles, rescanTrigger, bypassIgnored, isProfilesLoading]);

  const handleConfirm = (selectedKeys) => {
    setBypassIgnored(false);
    setShowModal(false);
    setPendingSuggestions([]);
    if (selectedKeys.length > 0) onCreateProfiles(selectedKeys);
  };

  const handleDismiss = (allKeys) => {
    setBypassIgnored(false);
    setShowModal(false);
    setPendingSuggestions([]);
    onIgnoreSuggestions(allKeys);
  };

  const profileList = getWritingCharacterProfilesArray(profiles);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 10px", boxSizing: "border-box" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
        <button
          type="button"
          onClick={() => { onRescan(); setBypassIgnored(true); setRescanTrigger((n) => n + 1); }}
          style={{ fontSize: "11px", padding: "3px 10px", cursor: "pointer", border: "1px solid #ccc", borderRadius: "4px", backgroundColor: "#f5f5f5" }}
        >Rescan Script</button>
      </div>

      {/* Empty state */}
      {profileList.length === 0 && (
        <div style={{ color: "#aaa", fontSize: "12px", lineHeight: 1.5, textAlign: "center", marginTop: "24px" }}>
          No character profiles yet.
          <br />
          Add Character lines to your script, then click Rescan Script.
        </div>
      )}

      {/* Profile cards */}
      {profileList.map((prof) => (
        <ProfileCard
          key={prof.id}
          profile={prof}
          isViewOnly={isViewOnly}
          onUpdateProfile={onUpdateProfile}
        />
      ))}

      {/* Suggestions modal */}
      {showModal && pendingSuggestions.length > 0 && (
        <WritingCharacterSuggestionsModal
          suggestions={pendingSuggestions}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}

function ProfileCard({ profile, isViewOnly, onUpdateProfile }) {
  const [notesValue, setNotesValue] = useState(profile.notes || "");

  // Keep local notes in sync if profile is externally updated
  useEffect(() => { setNotesValue(profile.notes || ""); }, [profile.notes]);

  const saveNotes = () => {
    if (notesValue !== (profile.notes || "")) {
      onUpdateProfile(profile.id, { notes: notesValue });
    }
  };

  return (
    <div style={{
      border: "1px solid #e0e0e0",
      borderRadius: "6px",
      padding: "8px 10px",
      marginBottom: "8px",
      backgroundColor: "white",
    }}>
      {/* Name row */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
        <span style={{ fontWeight: "bold", fontSize: "13px", color: "#1a1a2e", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {profile.canonicalName}
        </span>
        <span style={{ fontSize: "10px", color: "#aaa", flexShrink: 0 }}>
          {profile.sceneCount} scene{profile.sceneCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* First appearance */}
      {profile.firstAppearanceSceneHeading && (
        <div style={{ fontSize: "10px", color: "#888", marginBottom: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          First: {profile.firstAppearanceSceneHeading}
        </div>
      )}

      {/* Role */}
      {!isViewOnly && (
        <select
          value={profile.role || ""}
          onChange={(e) => onUpdateProfile(profile.id, { role: e.target.value })}
          style={{ fontSize: "11px", padding: "2px 4px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "white", marginBottom: "5px", width: "100%", cursor: "pointer" }}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>{r || "— role —"}</option>
          ))}
        </select>
      )}
      {isViewOnly && profile.role && (
        <div style={{ fontSize: "11px", color: "#607D8B", marginBottom: "5px" }}>{profile.role}</div>
      )}

      {/* Notes */}
      {!isViewOnly && (
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={saveNotes}
          placeholder="Notes…"
          rows={2}
          style={{
            width: "100%", fontSize: "11px", padding: "3px 5px",
            border: "1px solid #ddd", borderRadius: "4px", resize: "vertical",
            boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.4,
          }}
        />
      )}
      {isViewOnly && profile.notes && (
        <div style={{ fontSize: "11px", color: "#555", lineHeight: 1.4 }}>{profile.notes}</div>
      )}
    </div>
  );
}
