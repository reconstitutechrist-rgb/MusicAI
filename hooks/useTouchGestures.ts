import { useRef, useEffect, useCallback, useState } from "react";

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export interface TouchGestureOptions {
  /** Minimum distance (in px) to trigger a swipe. Default: 50 */
  threshold?: number;
  /** Maximum time (in ms) for a swipe gesture. Default: 300 */
  maxTime?: number;
  /** Prevent default touch behavior. Default: false */
  preventDefault?: boolean;
  /** Disable the gestures. Default: false */
  disabled?: boolean;
}

export interface TouchGestureState {
  isSwiping: boolean;
  swipeDirection: "left" | "right" | "up" | "down" | null;
  swipeDistance: { x: number; y: number };
}

/**
 * Hook for handling touch gestures (swipe left/right/up/down)
 * @param handlers - Callback functions for each swipe direction
 * @param options - Configuration options
 * @returns Ref to attach to the element and current gesture state
 */
export function useTouchGestures<T extends HTMLElement = HTMLElement>(
  handlers: SwipeHandlers,
  options: TouchGestureOptions = {}
): {
  ref: React.RefObject<T>;
  state: TouchGestureState;
} {
  const {
    threshold = 50,
    maxTime = 300,
    preventDefault = false,
    disabled = false,
  } = options;

  const ref = useRef<T>(null);
  const [state, setState] = useState<TouchGestureState>({
    isSwiping: false,
    swipeDirection: null,
    swipeDistance: { x: 0, y: 0 },
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;
      if (preventDefault) e.preventDefault();

      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      setState({
        isSwiping: true,
        swipeDirection: null,
        swipeDistance: { x: 0, y: 0 },
      });
    },
    [disabled, preventDefault]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || !touchStartRef.current) return;
      if (preventDefault) e.preventDefault();

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Determine direction based on which axis has more movement
      let direction: "left" | "right" | "up" | "down" | null = null;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? "right" : "left";
      } else {
        direction = deltaY > 0 ? "down" : "up";
      }

      setState({
        isSwiping: true,
        swipeDirection: direction,
        swipeDistance: { x: deltaX, y: deltaY },
      });
    },
    [disabled, preventDefault]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (disabled || !touchStartRef.current) return;
      if (preventDefault) e.preventDefault();

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const timeDelta = Date.now() - touchStartRef.current.time;

      // Check if swipe meets threshold and time requirements
      if (timeDelta <= maxTime) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Determine swipe direction (horizontal vs vertical)
        if (absX > absY && absX >= threshold) {
          // Horizontal swipe
          if (deltaX > 0) {
            handlers.onSwipeRight?.();
          } else {
            handlers.onSwipeLeft?.();
          }
        } else if (absY > absX && absY >= threshold) {
          // Vertical swipe
          if (deltaY > 0) {
            handlers.onSwipeDown?.();
          } else {
            handlers.onSwipeUp?.();
          }
        }
      }

      // Reset state
      touchStartRef.current = null;
      setState({
        isSwiping: false,
        swipeDirection: null,
        swipeDistance: { x: 0, y: 0 },
      });
    },
    [disabled, preventDefault, threshold, maxTime, handlers]
  );

  const handleTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    setState({
      isSwiping: false,
      swipeDirection: null,
      swipeDistance: { x: 0, y: 0 },
    });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    element.addEventListener("touchstart", handleTouchStart, { passive: !preventDefault });
    element.addEventListener("touchmove", handleTouchMove, { passive: !preventDefault });
    element.addEventListener("touchend", handleTouchEnd, { passive: !preventDefault });
    element.addEventListener("touchcancel", handleTouchCancel);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, preventDefault]);

  return { ref, state };
}

/**
 * Hook for pull-to-refresh functionality
 */
export interface PullToRefreshOptions {
  /** Callback when pull-to-refresh is triggered */
  onRefresh: () => Promise<void> | void;
  /** Pull distance required to trigger refresh. Default: 80 */
  pullThreshold?: number;
  /** Maximum pull distance. Default: 120 */
  maxPull?: number;
  /** Disabled state. Default: false */
  disabled?: boolean;
}

export interface PullToRefreshState {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  canRefresh: boolean;
}

export function usePullToRefresh<T extends HTMLElement = HTMLElement>(
  options: PullToRefreshOptions
): {
  ref: React.RefObject<T>;
  state: PullToRefreshState;
} {
  const {
    onRefresh,
    pullThreshold = 80,
    maxPull = 120,
    disabled = false,
  } = options;

  const ref = useRef<T>(null);
  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    canRefresh: false,
  });

  const touchStartY = useRef<number | null>(null);
  const scrollTop = useRef(0);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || state.isRefreshing) return;

      const element = ref.current;
      if (!element) return;

      // Only enable pull-to-refresh when scrolled to top
      scrollTop.current = element.scrollTop;
      if (scrollTop.current > 0) return;

      touchStartY.current = e.touches[0].clientY;
      setState((prev) => ({ ...prev, isPulling: true }));
    },
    [disabled, state.isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || state.isRefreshing || touchStartY.current === null) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY.current;

      // Only allow pulling down (positive deltaY)
      if (deltaY < 0) {
        setState((prev) => ({
          ...prev,
          pullDistance: 0,
          canRefresh: false,
        }));
        return;
      }

      // Apply resistance to pull
      const resistedPull = Math.min(deltaY * 0.5, maxPull);

      setState((prev) => ({
        ...prev,
        pullDistance: resistedPull,
        canRefresh: resistedPull >= pullThreshold,
      }));
    },
    [disabled, state.isRefreshing, maxPull, pullThreshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || touchStartY.current === null) return;

    touchStartY.current = null;

    if (state.canRefresh && !state.isRefreshing) {
      setState((prev) => ({
        ...prev,
        isRefreshing: true,
        isPulling: false,
      }));

      try {
        await onRefresh();
      } finally {
        setState({
          isPulling: false,
          isRefreshing: false,
          pullDistance: 0,
          canRefresh: false,
        });
      }
    } else {
      setState({
        isPulling: false,
        isRefreshing: false,
        pullDistance: 0,
        canRefresh: false,
      });
    }
  }, [disabled, state.canRefresh, state.isRefreshing, onRefresh]);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });
    element.addEventListener("touchend", handleTouchEnd);
    element.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [disabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { ref, state };
}

/**
 * Hook to detect if the user is on a touch device
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE specific
        navigator.msMaxTouchPoints > 0
      );
    };

    checkTouch();

    // Also listen for touch events to detect touch capability
    const handleFirstTouch = () => {
      setIsTouch(true);
      window.removeEventListener("touchstart", handleFirstTouch);
    };

    window.addEventListener("touchstart", handleFirstTouch, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleFirstTouch);
    };
  }, []);

  return isTouch;
}

export default useTouchGestures;
