"use client";
import { useEffect, useState } from "react";
import {
  Check,
  Monitor,
  Moon,
  Sun,
  SlidersHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  defaultPreferences,
  preferenceKey,
  readPreferences,
  type Preferences,
} from "@/lib/preferences";
import Modal from "./modal";

export function usePreferences() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    try {
      setPreferences(readPreferences(localStorage.getItem(preferenceKey)));
    } catch {
      setStorageAvailable(false);
    }
    setInitialized(true);
    const sync = (event: StorageEvent) => {
      if (event.key === preferenceKey)
        setPreferences(readPreferences(event.newValue));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!initialized) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme =
        preferences.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preferences.theme;
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.density = preferences.density;
      setResolvedTheme(theme);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preferences.theme, preferences.density, initialized]);
  function updatePreferences(patch: Partial<Preferences>) {
    const next = readPreferences(JSON.stringify({ ...preferences, ...patch }));
    setPreferences(next);
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(next));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }
  return { preferences, resolvedTheme, updatePreferences, storageAvailable };
}

export default function PreferencesPanel({
  preferences,
  onChange,
  onClose,
  storageAvailable,
  onReset,
  onClear,
  ready,
}: {
  preferences: Preferences;
  onChange: (p: Partial<Preferences>) => void;
  onClose: () => void;
  storageAvailable: boolean;
  onReset: () => void;
  onClear: () => void;
  ready: boolean;
}) {
  const [workspaceName, setWorkspaceName] = useState(preferences.workspaceName);
  const [displayName, setDisplayName] = useState(preferences.displayName);
  return (
    <Modal title="Make it your workspace" label="PREFERENCES" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onChange({ workspaceName, displayName });
          onClose();
        }}
      >
        <div className="modal-body preferences-body">
          <fieldset>
            <legend>Appearance</legend>
            <p>Choose what feels right for your day.</p>
            <div className="appearance-options">
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Night", icon: Moon },
                  { value: "system", label: "System", icon: Monitor },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  type="button"
                  key={value}
                  className={preferences.theme === value ? "selected" : ""}
                  aria-pressed={preferences.theme === value}
                  onClick={() => onChange({ theme: value })}
                >
                  <Icon size={21} />
                  <span>{label}</span>
                  {preferences.theme === value && <Check size={14} />}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Workspace details</legend>
            <p>
              These names personalize this browser. They do not change your
              source records.
            </p>
            <label className="field-label" htmlFor="workspace-name">
              Workspace name
            </label>
            <input
              id="workspace-name"
              className="form-control"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              maxLength={48}
              required
            />
            <label className="field-label" htmlFor="display-name">
              Your display name
            </label>
            <input
              id="display-name"
              className="form-control"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={48}
              required
            />
          </fieldset>
          <fieldset>
            <legend>
              <SlidersHorizontal size={16} /> Layout density
            </legend>
            <div className="segmented">
              {(["comfortable", "compact"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={preferences.density === d}
                  onClick={() => onChange({ density: d })}
                >
                  {d === "comfortable" ? "Comfortable" : "Compact"}
                </button>
              ))}
            </div>
          </fieldset>
          {!storageAvailable && (
            <p className="inline-error" role="status">
              Browser storage is unavailable. Preferences will last until this
              page is closed.
            </p>
          )}
          <details className="workspace-data">
            <summary>Workspace data</summary>
            <p>
              These actions replace the current records, decisions and reports.
              You’ll confirm before anything changes.
            </p>
            <div className="data-actions">
              <button type="button" disabled={!ready} onClick={onReset}>
                <RotateCcw size={16} /> Load sample records
              </button>
              <button type="button" disabled={!ready} onClick={onClear}>
                <Trash2 size={16} /> Clear workspace
              </button>
            </div>
          </details>
        </div>
        <div className="modal-footer">
          <p>Preferences are saved on this device.</p>
          <button
            className="button primary"
            type="submit"
            disabled={!workspaceName.trim() || !displayName.trim()}
          >
            Save preferences
          </button>
        </div>
      </form>
    </Modal>
  );
}
