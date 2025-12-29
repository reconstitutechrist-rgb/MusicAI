import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";

// Types
export type Theme = "dark" | "light";

interface MusicState {
  generatedLyrics: string;
  songConcept: string;
  instrumentalUrl: string;
  vocalUrl: string;
  currentView: string;
}

interface AppState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Shared music creation state
  generatedLyrics: string;
  setGeneratedLyrics: (lyrics: string) => void;
  songConcept: string;
  setSongConcept: (concept: string) => void;
  instrumentalUrl: string;
  setInstrumentalUrl: (url: string) => void;
  vocalUrl: string;
  setVocalUrl: (url: string) => void;

  // Workflow state
  currentStep: number;
  setCurrentStep: (step: number) => void;
  workflowSteps: WorkflowStep[];
  completedSteps: string[];

  // Session persistence
  hasRestoredSession: boolean;
  showRestorePrompt: boolean;
  savedSessionTime: Date | null;
  restoreSession: () => void;
  dismissRestorePrompt: () => void;
  clearSession: () => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

interface WorkflowStep {
  id: string;
  name: string;
  completed: boolean;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
  duration?: number;
}

const defaultWorkflowSteps: WorkflowStep[] = [
  { id: "compose", name: "Compose", completed: false },
  { id: "lyrics", name: "Lyrics", completed: false },
  { id: "produce", name: "Production", completed: false },
  { id: "video", name: "Video", completed: false },
  { id: "market", name: "Marketing", completed: false },
];

// Storage keys
const MUSIC_STATE_KEY = "muse-music-state";
const STORAGE_VERSION = 1;

interface StoredMusicState {
  state: MusicState;
  timestamp: number;
  version: number;
}

// Helper to load music state from localStorage
function loadMusicState(): { state: MusicState; timestamp: Date } | null {
  try {
    const stored = localStorage.getItem(MUSIC_STATE_KEY);
    if (!stored) return null;

    const data: StoredMusicState = JSON.parse(stored);
    if (data.version !== STORAGE_VERSION) return null;

    // Check if any meaningful state exists
    const hasContent =
      data.state.generatedLyrics.length > 0 ||
      data.state.songConcept.length > 0 ||
      data.state.instrumentalUrl.length > 0 ||
      data.state.vocalUrl.length > 0;

    if (!hasContent) return null;

    return {
      state: data.state,
      timestamp: new Date(data.timestamp),
    };
  } catch {
    return null;
  }
}

// Helper to save music state to localStorage
function saveMusicState(state: MusicState): void {
  try {
    const data: StoredMusicState = {
      state,
      timestamp: Date.now(),
      version: STORAGE_VERSION,
    };
    localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Failed to save music state:", error);
  }
}

// Create context
const AppContext = createContext<AppState | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // Theme state with localStorage persistence
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("muse-theme");
      if (saved === "light" || saved === "dark") return saved;
      if (window.matchMedia("(prefers-color-scheme: light)").matches) {
        return "light";
      }
    }
    return "dark";
  });

  // Shared music creation state
  const [generatedLyrics, setGeneratedLyrics] = useState<string>("");
  const [songConcept, setSongConcept] = useState<string>("");
  const [instrumentalUrl, setInstrumentalUrl] = useState<string>("");
  const [vocalUrl, setVocalUrl] = useState<string>("");

  // Session persistence state
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [savedSessionTime, setSavedSessionTime] = useState<Date | null>(null);
  const [pendingRestore, setPendingRestore] = useState<MusicState | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Check for saved session on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const saved = loadMusicState();
    if (saved) {
      setPendingRestore(saved.state);
      setSavedSessionTime(saved.timestamp);
      setShowRestorePrompt(true);
    }
  }, []);

  // Debounced save effect - saves when state changes
  useEffect(() => {
    // Skip if not initialized or nothing to save
    if (!isInitializedRef.current) return;
    if (!generatedLyrics && !songConcept && !instrumentalUrl && !vocalUrl) return;

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Debounce save by 1 second
    saveTimerRef.current = setTimeout(() => {
      saveMusicState({
        generatedLyrics,
        songConcept,
        instrumentalUrl,
        vocalUrl,
        currentView: "",
      });
    }, 1000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [generatedLyrics, songConcept, instrumentalUrl, vocalUrl]);

  // Session restore handlers
  const restoreSession = useCallback(() => {
    if (pendingRestore) {
      setGeneratedLyrics(pendingRestore.generatedLyrics);
      setSongConcept(pendingRestore.songConcept);
      setInstrumentalUrl(pendingRestore.instrumentalUrl);
      setVocalUrl(pendingRestore.vocalUrl);
      setHasRestoredSession(true);
    }
    setShowRestorePrompt(false);
    setPendingRestore(null);
  }, [pendingRestore]);

  const dismissRestorePrompt = useCallback(() => {
    setShowRestorePrompt(false);
    setPendingRestore(null);
    // Clear the stored session since user dismissed it
    localStorage.removeItem(MUSIC_STATE_KEY);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(MUSIC_STATE_KEY);
    setGeneratedLyrics("");
    setSongConcept("");
    setInstrumentalUrl("");
    setVocalUrl("");
    setHasRestoredSession(false);
  }, []);

  // Workflow state
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [workflowSteps, setWorkflowSteps] =
    useState<WorkflowStep[]>(defaultWorkflowSteps);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Theme handlers
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("muse-theme", newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    document.body.style.colorScheme = theme;
  }, [theme]);

  // Toast handlers
  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Update workflow step completion when state changes
  useEffect(() => {
    setWorkflowSteps((prev) =>
      prev.map((step) => {
        switch (step.id) {
          case "compose":
            return { ...step, completed: generatedLyrics.length > 0 };
          case "lyrics":
            return { ...step, completed: generatedLyrics.length > 50 };
          case "produce":
            return {
              ...step,
              completed: instrumentalUrl.length > 0 || vocalUrl.length > 0,
            };
          default:
            return step;
        }
      }),
    );
  }, [generatedLyrics, instrumentalUrl, vocalUrl]);

  // Compute completed steps array
  const completedSteps = workflowSteps
    .filter((step) => step.completed)
    .map((step) => step.id);

  const value: AppState = {
    theme,
    setTheme,
    toggleTheme,
    generatedLyrics,
    setGeneratedLyrics,
    songConcept,
    setSongConcept,
    instrumentalUrl,
    setInstrumentalUrl,
    vocalUrl,
    setVocalUrl,
    currentStep,
    setCurrentStep,
    workflowSteps,
    completedSteps,
    hasRestoredSession,
    showRestorePrompt,
    savedSessionTime,
    restoreSession,
    dismissRestorePrompt,
    clearSession,
    toasts,
    addToast,
    removeToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Custom hook to use the context
export const useApp = (): AppState => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

// Convenience hooks
export const useTheme = () => {
  const { theme, setTheme, toggleTheme } = useApp();
  return { theme, setTheme, toggleTheme };
};

export const useToast = () => {
  const { addToast, removeToast, toasts } = useApp();
  return { addToast, removeToast, toasts };
};

export const useWorkflow = () => {
  const { currentStep, setCurrentStep, workflowSteps, completedSteps } = useApp();
  return { currentStep, setCurrentStep, workflowSteps, completedSteps };
};

export const useSessionRestore = () => {
  const {
    showRestorePrompt,
    savedSessionTime,
    restoreSession,
    dismissRestorePrompt,
    clearSession,
    hasRestoredSession,
  } = useApp();
  return {
    showRestorePrompt,
    savedSessionTime,
    restoreSession,
    dismissRestorePrompt,
    clearSession,
    hasRestoredSession,
  };
};

export const useMusicState = () => {
  const {
    generatedLyrics,
    setGeneratedLyrics,
    songConcept,
    setSongConcept,
    instrumentalUrl,
    setInstrumentalUrl,
    vocalUrl,
    setVocalUrl,
  } = useApp();
  return {
    generatedLyrics,
    setGeneratedLyrics,
    songConcept,
    setSongConcept,
    instrumentalUrl,
    setInstrumentalUrl,
    vocalUrl,
    setVocalUrl,
  };
};
