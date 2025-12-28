/**
 * Modal Accessibility Hook
 * Provides focus trap, ESC key handling, scroll lock, and focus restoration
 *
 * IMPORTANT: The dialog role and aria-modal must be on the modal CONTENT element,
 * NOT on the overlay/backdrop. Use contentProps on the modal content container.
 */

import { useEffect, useRef, useCallback } from "react";

interface UseModalOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  restoreFocus?: boolean;
  lockScroll?: boolean;
  /** Optional description element ID for aria-describedby */
  descriptionId?: string;
}

interface UseModalReturn {
  /** Ref to attach to the modal content element (the element with role="dialog") */
  modalRef: React.RefObject<HTMLElement | null>;
  /** Props for the overlay/backdrop element - handles click-outside-to-close */
  overlayProps: {
    onClick: (e: React.MouseEvent) => void;
  };
  /** Props for the modal content element - includes role="dialog" and aria attributes */
  contentProps: {
    role: "dialog";
    "aria-modal": true;
    "aria-labelledby": string;
    "aria-describedby"?: string;
    tabIndex: -1;
  };
  closeButtonProps: {
    onClick: () => void;
    "aria-label": string;
    type: "button";
  };
  titleProps: {
    id: string;
  };
  descriptionProps: {
    id: string;
  };
  /** @deprecated Use contentProps["aria-labelledby"] instead */
  getAriaLabelledBy: () => string;
}

// Get all focusable elements within a container
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]:not([disabled]):not([hidden])',
    'button:not([disabled]):not([hidden])',
    'textarea:not([disabled]):not([hidden])',
    'input:not([disabled]):not([hidden])',
    'select:not([disabled]):not([hidden])',
    '[contenteditable]:not([disabled]):not([hidden])',
    'audio[controls]:not([disabled]):not([hidden])',
    'video[controls]:not([disabled]):not([hidden])',
    '[tabindex]:not([tabindex="-1"]):not([disabled]):not([hidden])',
  ].join(', ');

  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors)
  ).filter((el) => {
    // Additional check: element must be visible (not display:none or visibility:hidden)
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

// Track number of open modals for scroll lock coordination
let openModalCount = 0;

let modalCounter = 0;

export function useModal({
  isOpen,
  onClose,
  closeOnEscape = true,
  closeOnOverlayClick = true,
  restoreFocus = true,
  lockScroll = true,
  descriptionId,
}: UseModalOptions): UseModalReturn {
  const modalRef = useRef<HTMLElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const modalId = useRef(`modal-${++modalCounter}`);
  const hasLockedScroll = useRef(false);

  // Handle ESC key press
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (closeOnEscape && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      // Focus trap - handle Tab key
      if (event.key === "Tab" && modalRef.current) {
        const focusableElements = getFocusableElements(modalRef.current);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab: move backwards
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: move forwards
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isOpen, closeOnEscape, onClose]
  );

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (closeOnOverlayClick && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  // Lock body scroll - tracks multiple modals to prevent premature unlock
  useEffect(() => {
    if (!lockScroll) return;

    if (isOpen && !hasLockedScroll.current) {
      hasLockedScroll.current = true;
      openModalCount++;

      // Only apply scroll lock on first modal
      if (openModalCount === 1) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
      }
    }

    return () => {
      if (hasLockedScroll.current) {
        hasLockedScroll.current = false;
        openModalCount--;

        // Only restore scroll when all modals are closed
        if (openModalCount === 0) {
          document.body.style.overflow = "";
          document.body.style.paddingRight = "";
        }
      }
    };
  }, [isOpen, lockScroll]);

  // Handle focus escaping the modal - redirect it back
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusIn = (event: FocusEvent) => {
      if (
        modalRef.current &&
        event.target instanceof Node &&
        !modalRef.current.contains(event.target)
      ) {
        // Focus escaped the modal, redirect it back
        const focusableElements = getFocusableElements(modalRef.current);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [isOpen]);

  // Store active element and focus modal on open
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element
      if (restoreFocus) {
        previousActiveElement.current = document.activeElement as HTMLElement;
      }

      // Focus the first focusable element in the modal
      requestAnimationFrame(() => {
        if (modalRef.current) {
          const focusableElements = getFocusableElements(modalRef.current);
          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          } else {
            // If no focusable elements, focus the modal itself
            modalRef.current.focus();
          }
        }
      });
    } else {
      // Restore focus when modal closes
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
    }
  }, [isOpen, restoreFocus]);

  // Add keydown listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  const titleId = `${modalId.current}-title`;
  const descId = descriptionId || `${modalId.current}-description`;

  return {
    modalRef,
    // Overlay props - just handles click-outside, NO role="dialog" here
    overlayProps: {
      onClick: handleOverlayClick,
    },
    // Content props - these go on the actual modal content element
    contentProps: {
      role: "dialog",
      "aria-modal": true,
      "aria-labelledby": titleId,
      "aria-describedby": descriptionId ? descId : undefined,
      tabIndex: -1,
    },
    closeButtonProps: {
      onClick: onClose,
      "aria-label": "Close dialog",
      type: "button",
    },
    titleProps: {
      id: titleId,
    },
    descriptionProps: {
      id: descId,
    },
    /** @deprecated Use contentProps["aria-labelledby"] instead */
    getAriaLabelledBy: () => titleId,
  };
}

export default useModal;
