export type Preferences = {
  theme: "system" | "light" | "dark";
  density: "comfortable" | "compact";
  workspaceName: string;
  displayName: string;
};
export const preferenceKey = "recallscope.preferences.v1";
export const defaultPreferences: Preferences = {
  theme: "system",
  density: "comfortable",
  workspaceName: "Console",
  displayName: "Epsilon3096",
};
export function readPreferences(value: string | null): Preferences {
  try {
    const p = JSON.parse(value || "{}");
    return {
      theme: ["system", "light", "dark"].includes(p?.theme)
        ? p.theme
        : "system",
      density: p?.density === "compact" ? "compact" : "comfortable",
      workspaceName:
        typeof p?.workspaceName === "string" && p.workspaceName.trim()
          ? p.workspaceName.trim().slice(0, 48)
          : defaultPreferences.workspaceName,
      displayName:
        typeof p?.displayName === "string" && p.displayName.trim()
          ? p.displayName.trim().slice(0, 48)
          : defaultPreferences.displayName,
    };
  } catch {
    return defaultPreferences;
  }
}
// Runs before the first paint. Only fixed theme/density values reach attributes.
export const appearanceBootstrap = `(function(){try{var p=JSON.parse(localStorage.getItem('${preferenceKey}')||'{}');var t=['light','dark'].includes(p.theme)?p.theme:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.dataset.density=p.density==='compact'?'compact':'comfortable';}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}})();`;
