/**
 * Autosave Hook
 * Provides automatic state persistence to localStorage with debouncing
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface UseAutosaveOptions<T> {
  /** Unique key for localStorage */
  key: string;
  /** Initial state if nothing is saved */
  initialState: T;
  /** Debounce delay in ms (default: 1000) */
  debounceMs?: number;
  /** Whether to show restore prompt on load */
  showRestorePrompt?: boolean;
  /** Callback when state is restored */
  onRestore?: (state: T) => void;
  /** Callback when state is saved */
  onSave?: (state: T) => void;
}

interface UseAutosaveReturn<T> {
  /** Current state */
  state: T;
  /** Set state (will trigger autosave) */
  setState: React.Dispatch<React.SetStateAction<T>>;
  /** Whether there's a pending save */
  isSaving: boolean;
  /** Whether state was restored from storage */
  wasRestored: boolean;
  /** Manually save current state */
  save: () => void;
  /** Clear saved state */
  clear: () => void;
  /** Reset to initial state */
  reset: () => void;
  /** Check if there's saved state available */
  hasSavedState: boolean;
  /** Timestamp of last save */
  lastSaved: Date | null;
}

interface StoredData<T> {
  state: T;
  timestamp: number;
  version: number;
}

const STORAGE_VERSION = 1;

export function useAutosave<T>({
  key,
  initialState,
  debounceMs = 1000,
  showRestorePrompt = false,
  onRestore,
  onSave,
}: UseAutosaveOptions<T>): UseAutosaveReturn<T> {
  const [state, setState] = useState<T>(initialState);
  const [isSaving, setIsSaving] = useState(false);
  const [wasRestored, setWasRestored] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasSavedState, setHasSavedState] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const storageKey = `autosave_${key}`;

  // Check for saved state on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored) as StoredData<T>;

        // Check version compatibility
        if (data.version === STORAGE_VERSION && data.state !== undefined) {
          setHasSavedState(true);

          if (showRestorePrompt) {
            // Let the consumer handle the restore prompt
            setHasSavedState(true);
          } else {
            // Auto-restore
            setState(data.state);
            setWasRestored(true);
            setLastSaved(new Date(data.timestamp));
            onRestore?.(data.state);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to restore autosaved state:", error);
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, showRestorePrompt, onRestore]);

  // Save function
  const save = useCallback(() => {
    try {
      const data: StoredData<T> = {
        state,
        timestamp: Date.now(),
        version: STORAGE_VERSION,
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
      setLastSaved(new Date());
      setHasSavedState(true);
      onSave?.(state);
    } catch (error) {
      console.warn("Failed to save state:", error);
    }
    setIsSaving(false);
  }, [state, storageKey, onSave]);

  // Debounced save effect
  useEffect(() => {
    // Skip initial render
    if (!isInitializedRef.current) return;

    setIsSaving(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      save();
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [state, debounceMs, save]);

  // Clear saved state
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasSavedState(false);
      setLastSaved(null);
    } catch (error) {
      console.warn("Failed to clear saved state:", error);
    }
  }, [storageKey]);

  // Reset to initial state
  const reset = useCallback(() => {
    setState(initialState);
    clear();
    setWasRestored(false);
  }, [initialState, clear]);

  return {
    state,
    setState,
    isSaving,
    wasRestored,
    save,
    clear,
    reset,
    hasSavedState,
    lastSaved,
  };
}

/**
 * Hook for restoring session with user confirmation
 */
export function useSessionRestore<T>({
  key,
  initialState,
  onRestore,
}: {
  key: string;
  initialState: T;
  onRestore?: (state: T) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [savedState, setSavedState] = useState<T | null>(null);
  const [savedTimestamp, setSavedTimestamp] = useState<Date | null>(null);

  const storageKey = `autosave_${key}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data: StoredData<T> = JSON.parse(stored);
        if (data.version === STORAGE_VERSION && data.state !== undefined) {
          setSavedState(data.state);
          setSavedTimestamp(new Date(data.timestamp));
          setShowPrompt(true);
        }
      }
    } catch (error) {
      console.warn("Failed to check for saved session:", error);
    }
  }, [storageKey]);

  const restore = useCallback(() => {
    if (savedState) {
      onRestore?.(savedState);
      setShowPrompt(false);
    }
  }, [savedState, onRestore]);

  const dismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    showPrompt,
    savedState,
    savedTimestamp,
    restore,
    dismiss,
  };
}

export default useAutosave;
