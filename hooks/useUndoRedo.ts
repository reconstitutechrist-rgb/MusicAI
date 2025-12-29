import { useState, useCallback, useEffect, useRef } from "react";

export interface UndoRedoOptions {
  maxHistory?: number;
  debounceMs?: number;
}

export interface UndoRedoReturn<T> {
  state: T;
  set: (newState: T | ((prevState: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  reset: (newState: T) => void;
  canUndo: boolean;
  canRedo: boolean;
  historyLength: number;
  currentIndex: number;
}

/**
 * Generic undo/redo hook with configurable history limit and debouncing
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UndoRedoOptions = {}
): UndoRedoReturn<T> {
  const { maxHistory = 50, debounceMs = 0 } = options;

  const [history, setHistory] = useState<T[]>([initialState]);
  const [index, setIndex] = useState(0);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<string>(JSON.stringify(initialState));

  const state = history[index];

  const set = useCallback(
    (newState: T | ((prevState: T) => T)) => {
      const resolvedState =
        newState instanceof Function ? newState(history[index]) : newState;

      // Skip if state hasn't actually changed
      const newValueStr = JSON.stringify(resolvedState);
      if (newValueStr === lastValueRef.current) return;

      const doSet = () => {
        lastValueRef.current = newValueStr;
        setHistory((prevHistory) => {
          // Remove any forward history
          const newHistory = prevHistory.slice(0, index + 1);
          newHistory.push(resolvedState);

          // Limit history size
          if (newHistory.length > maxHistory) {
            return newHistory.slice(-maxHistory);
          }
          return newHistory;
        });
        setIndex((prevIndex) => Math.min(prevIndex + 1, maxHistory - 1));
      };

      if (debounceMs > 0) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(doSet, debounceMs);
      } else {
        doSet();
      }
    },
    [history, index, maxHistory, debounceMs]
  );

  const undo = useCallback(() => {
    setIndex((prevIndex) => {
      const newIndex = Math.max(0, prevIndex - 1);
      lastValueRef.current = JSON.stringify(history[newIndex]);
      return newIndex;
    });
  }, [history]);

  const redo = useCallback(() => {
    setIndex((prevIndex) => {
      const newIndex = Math.min(history.length - 1, prevIndex + 1);
      lastValueRef.current = JSON.stringify(history[newIndex]);
      return newIndex;
    });
  }, [history.length]);

  const reset = useCallback((newState: T) => {
    lastValueRef.current = JSON.stringify(newState);
    setHistory([newState]);
    setIndex(0);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    reset,
    canUndo: index > 0,
    canRedo: index < history.length - 1,
    historyLength: history.length,
    currentIndex: index,
  };
}

/**
 * Hook for keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z)
 */
export function useUndoRedoKeyboard(
  undo: () => void,
  redo: () => void,
  canUndo: boolean,
  canRedo: boolean,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo: Ctrl+Shift+Z or Cmd+Shift+Z
          if (canRedo) redo();
        } else {
          // Undo: Ctrl+Z or Cmd+Z
          if (canUndo) undo();
        }
      }
      // Also support Ctrl+Y for redo (Windows convention)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo, enabled]);
}

/**
 * Combined hook that provides undo/redo state with keyboard shortcuts
 */
export function useUndoRedoWithKeyboard<T>(
  initialState: T,
  options: UndoRedoOptions & { keyboardEnabled?: boolean } = {}
): UndoRedoReturn<T> {
  const { keyboardEnabled = true, ...undoRedoOptions } = options;
  const undoRedo = useUndoRedo(initialState, undoRedoOptions);

  useUndoRedoKeyboard(
    undoRedo.undo,
    undoRedo.redo,
    undoRedo.canUndo,
    undoRedo.canRedo,
    keyboardEnabled
  );

  return undoRedo;
}

export default useUndoRedo;
