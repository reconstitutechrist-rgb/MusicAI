import React, { useState, useEffect } from "react";
import { useToast, Toast as ToastType } from "../../context/AppContext";

// Inline SVG Icons
const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

// Extended Toast interface with action support
export interface ToastWithAction extends ToastType {
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Individual Toast component
interface ToastItemProps extends ToastWithAction {
  onRemove: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({
  type,
  title,
  message,
  duration = 5000,
  action,
  onRemove,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        onRemove();
      }, 200); // Match animation duration

      return () => clearTimeout(timer);
    }
  }, [isExiting, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
  };

  const icons = {
    success: <CheckCircleIcon className="w-5 h-5 text-green-400" />,
    error: <XCircleIcon className="w-5 h-5 text-red-400" />,
    warning: <AlertCircleIcon className="w-5 h-5 text-yellow-400" />,
    info: <InfoIcon className="w-5 h-5 text-blue-400" />,
  };

  const borderColors = {
    success: "border-green-500/30 bg-green-500/10",
    error: "border-red-500/30 bg-red-500/10",
    warning: "border-yellow-500/30 bg-yellow-500/10",
    info: "border-blue-500/30 bg-blue-500/10",
  };

  return (
    <div
      className={`
        pointer-events-auto max-w-sm w-full glass backdrop-blur-sm
        rounded-xl border ${borderColors[type]} shadow-xl p-4
        ${isExiting ? "animate-fade-out" : "animate-fade-in-up"}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0" aria-hidden="true">{icons[type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          {message && <p className="text-sm text-gray-400 mt-1">{message}</p>}
          {action && (
            <button
              onClick={() => {
                action.onClick();
                handleClose();
              }}
              className="mt-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:underline"
            >
              {action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          aria-label="Dismiss notification"
        >
          <XIcon className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
};

// Toast Container - Uses AppContext's toast system
const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Convenience hook for showing toasts with common patterns
export const useToastHelpers = () => {
  const { addToast } = useToast();

  return {
    success: (title: string, message?: string) =>
      addToast({ type: "success", title, message }),
    error: (title: string, message?: string) =>
      addToast({ type: "error", title, message, duration: 6000 }),
    warning: (title: string, message?: string) =>
      addToast({ type: "warning", title, message }),
    info: (title: string, message?: string) =>
      addToast({ type: "info", title, message }),
  };
};

export default ToastContainer;
