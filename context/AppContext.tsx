import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

// Types
export type Theme = "dark" | "light";

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
      })
    );
  }, [generatedLyrics, instrumentalUrl, vocalUrl]);

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
  const { currentStep, setCurrentStep, workflowSteps } = useApp();
  return { currentStep, setCurrentStep, workflowSteps };
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
