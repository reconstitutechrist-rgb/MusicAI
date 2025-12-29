import { useEffect, useCallback, useState } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  category: "navigation" | "playback" | "editing" | "general";
  action: () => void;
}

interface ShortcutConfig {
  [id: string]: Omit<KeyboardShortcut, "action">;
}

// Default shortcuts configuration
const DEFAULT_SHORTCUTS: ShortcutConfig = {
  showHelp: {
    key: "?",
    shift: true,
    description: "Show keyboard shortcuts",
    category: "general",
  },
  save: {
    key: "s",
    ctrl: true,
    description: "Save/export current work",
    category: "general",
  },
  toggleTheme: {
    key: "t",
    ctrl: true,
    shift: true,
    description: "Toggle dark/light theme",
    category: "general",
  },
  playPause: {
    key: " ",
    description: "Play/pause audio",
    category: "playback",
  },
  stop: {
    key: "Escape",
    description: "Stop playback",
    category: "playback",
  },
  navCreate: {
    key: "1",
    description: "Go to Compose",
    category: "navigation",
  },
  navLab: {
    key: "2",
    description: "Go to Lyric Lab",
    category: "navigation",
  },
  navProduce: {
    key: "3",
    description: "Go to Production",
    category: "navigation",
  },
  navRemix: {
    key: "4",
    description: "Go to Remix Studio",
    category: "navigation",
  },
  navAnalyze: {
    key: "5",
    description: "Go to Audio Critic",
    category: "navigation",
  },
  navVideo: {
    key: "6",
    description: "Go to Video",
    category: "navigation",
  },
  navMarket: {
    key: "7",
    description: "Go to Marketing",
    category: "navigation",
  },
  navAssist: {
    key: "8",
    description: "Go to Assistant",
    category: "navigation",
  },
  navCommunity: {
    key: "9",
    description: "Go to Community",
    category: "navigation",
  },
  undo: {
    key: "z",
    ctrl: true,
    description: "Undo last action",
    category: "editing",
  },
  redo: {
    key: "z",
    ctrl: true,
    shift: true,
    description: "Redo last action",
    category: "editing",
  },
};

// Storage key for custom shortcuts
const SHORTCUTS_STORAGE_KEY = "muse-keyboard-shortcuts";

// Load custom shortcuts from localStorage
function loadCustomShortcuts(): Partial<ShortcutConfig> {
  try {
    const stored = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn("Failed to load custom shortcuts:", error);
  }
  return {};
}

// Save custom shortcuts to localStorage
function saveCustomShortcuts(shortcuts: Partial<ShortcutConfig>): void {
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (error) {
    console.warn("Failed to save custom shortcuts:", error);
  }
}

// Format shortcut for display
export function formatShortcut(shortcut: Omit<KeyboardShortcut, "action" | "description" | "category">): string {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.alt) parts.push("Alt");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.meta) parts.push("Cmd");

  // Format special keys
  let keyDisplay = shortcut.key;
  switch (shortcut.key) {
    case " ":
      keyDisplay = "Space";
      break;
    case "Escape":
      keyDisplay = "Esc";
      break;
    case "ArrowUp":
      keyDisplay = "Up";
      break;
    case "ArrowDown":
      keyDisplay = "Down";
      break;
    case "ArrowLeft":
      keyDisplay = "Left";
      break;
    case "ArrowRight":
      keyDisplay = "Right";
      break;
    default:
      keyDisplay = keyDisplay.toUpperCase();
  }

  parts.push(keyDisplay);
  return parts.join(" + ");
}

// Check if event matches shortcut
function matchesShortcut(
  event: KeyboardEvent,
  shortcut: Omit<KeyboardShortcut, "action" | "description" | "category">
): boolean {
  const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
  const shiftMatch = !!shortcut.shift === event.shiftKey;
  const altMatch = !!shortcut.alt === event.altKey;

  // Handle special case for "?" which requires shift
  let keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
  if (shortcut.key === "?") {
    keyMatch = event.key === "?";
  } else if (shortcut.key === " ") {
    keyMatch = event.key === " " || event.code === "Space";
  }

  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

interface UseKeyboardShortcutsOptions {
  onShowHelp?: () => void;
  onSave?: () => void;
  onToggleTheme?: () => void;
  onPlayPause?: () => void;
  onStop?: () => void;
  onNavigate?: (view: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  enabled?: boolean;
}

interface UseKeyboardShortcutsReturn {
  shortcuts: ShortcutConfig;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  updateShortcut: (id: string, config: Partial<Omit<KeyboardShortcut, "action">>) => void;
  resetShortcuts: () => void;
  getShortcutsByCategory: (category: KeyboardShortcut["category"]) => Array<{ id: string } & Omit<KeyboardShortcut, "action">>;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): UseKeyboardShortcutsReturn {
  const {
    onShowHelp,
    onSave,
    onToggleTheme,
    onPlayPause,
    onStop,
    onNavigate,
    onUndo,
    onRedo,
    enabled = true,
  } = options;

  const [isEnabled, setEnabled] = useState(enabled);
  const [customShortcuts, setCustomShortcuts] = useState<Partial<ShortcutConfig>>(() => loadCustomShortcuts());

  // Merge default and custom shortcuts
  const shortcuts: ShortcutConfig = {
    ...DEFAULT_SHORTCUTS,
    ...customShortcuts,
  };

  // Handle keydown events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isEnabled) return;

      // Ignore if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow some shortcuts even in inputs
        const allowInInputs = ["save"];
        const matchedInInput = Object.entries(shortcuts).find(
          ([id, config]) => allowInInputs.includes(id) && matchesShortcut(event, config)
        );
        if (!matchedInInput) return;
      }

      // Check each shortcut
      for (const [id, config] of Object.entries(shortcuts)) {
        if (matchesShortcut(event, config)) {
          event.preventDefault();

          switch (id) {
            case "showHelp":
              onShowHelp?.();
              break;
            case "save":
              onSave?.();
              break;
            case "toggleTheme":
              onToggleTheme?.();
              break;
            case "playPause":
              onPlayPause?.();
              break;
            case "stop":
              onStop?.();
              break;
            case "navCreate":
              onNavigate?.("create");
              break;
            case "navLab":
              onNavigate?.("lab");
              break;
            case "navProduce":
              onNavigate?.("produce");
              break;
            case "navRemix":
              onNavigate?.("remix");
              break;
            case "navAnalyze":
              onNavigate?.("analyze");
              break;
            case "navVideo":
              onNavigate?.("video");
              break;
            case "navMarket":
              onNavigate?.("market");
              break;
            case "navAssist":
              onNavigate?.("assist");
              break;
            case "navCommunity":
              onNavigate?.("community");
              break;
            case "undo":
              onUndo?.();
              break;
            case "redo":
              onRedo?.();
              break;
          }
          break;
        }
      }
    },
    [isEnabled, shortcuts, onShowHelp, onSave, onToggleTheme, onPlayPause, onStop, onNavigate, onUndo, onRedo]
  );

  // Register global keydown listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Update a shortcut
  const updateShortcut = useCallback((id: string, config: Partial<Omit<KeyboardShortcut, "action">>) => {
    setCustomShortcuts((prev) => {
      const updated = {
        ...prev,
        [id]: {
          ...DEFAULT_SHORTCUTS[id],
          ...prev[id],
          ...config,
        },
      };
      saveCustomShortcuts(updated);
      return updated;
    });
  }, []);

  // Reset shortcuts to defaults
  const resetShortcuts = useCallback(() => {
    setCustomShortcuts({});
    localStorage.removeItem(SHORTCUTS_STORAGE_KEY);
  }, []);

  // Get shortcuts by category
  const getShortcutsByCategory = useCallback(
    (category: KeyboardShortcut["category"]) => {
      return Object.entries(shortcuts)
        .filter(([, config]) => config.category === category)
        .map(([id, config]) => ({ id, ...config }));
    },
    [shortcuts]
  );

  return {
    shortcuts,
    isEnabled,
    setEnabled,
    updateShortcut,
    resetShortcuts,
    getShortcutsByCategory,
  };
}

export default useKeyboardShortcuts;
