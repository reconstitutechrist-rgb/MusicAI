import React, { useState, useEffect } from "react";
import { getErrorInfo, ErrorInfo } from "../../utils/errorHelpers";
import Button from "./Button";

interface ErrorDisplayProps {
  error: unknown;
  context?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: "inline" | "banner" | "toast";
  className?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  context,
  onRetry,
  onDismiss,
  variant = "inline",
  className = "",
}) => {
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (error) {
      setErrorInfo(getErrorInfo(error, context));
    } else {
      setErrorInfo(null);
    }
  }, [error, context]);

  // Handle countdown and trigger retry when countdown completes
  useEffect(() => {
    if (retryCountdown !== null && retryCountdown > 0) {
      const timer = setTimeout(() => {
        setRetryCountdown(retryCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (retryCountdown === 0) {
      // Countdown finished, now execute retry
      setRetryCountdown(null);
      if (onRetry) {
        setIsRetrying(true);
        Promise.resolve(onRetry()).finally(() => {
          setIsRetrying(false);
        });
      }
    }
  }, [retryCountdown, onRetry]);

  if (!errorInfo) return null;

  const handleRetry = () => {
    if (!onRetry || isRetrying || retryCountdown !== null) return;

    // If there's a retry delay, start countdown first
    if (errorInfo.retryDelay && errorInfo.retryDelay > 1000) {
      setRetryCountdown(Math.ceil(errorInfo.retryDelay / 1000));
    } else {
      // No delay, retry immediately
      setIsRetrying(true);
      Promise.resolve(onRetry()).finally(() => {
        setIsRetrying(false);
      });
    }
  };

  const baseClasses = {
    inline: "p-4 rounded-xl",
    banner: "p-4 rounded-lg border-l-4",
    toast: "p-3 rounded-lg shadow-lg",
  };

  const colorClasses = "bg-red-500/10 border border-red-500/30 text-red-400";

  return (
    <div
      className={`${baseClasses[variant]} ${colorClasses} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Error Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-red-300">{errorInfo.title}</h4>
          <p className="text-sm text-red-400/90 mt-1">{errorInfo.message}</p>
          {errorInfo.suggestion && (
            <p className="text-xs text-red-400/70 mt-1">{errorInfo.suggestion}</p>
          )}

          {/* Actions */}
          {(errorInfo.canRetry && onRetry) || onDismiss ? (
            <div className="flex items-center gap-2 mt-3">
              {errorInfo.canRetry && onRetry && (
                <Button
                  onClick={handleRetry}
                  disabled={isRetrying || retryCountdown !== null}
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                >
                  {isRetrying ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-1 h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Retrying...
                    </>
                  ) : retryCountdown !== null ? (
                    `Wait ${retryCountdown}s`
                  ) : (
                    <>
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Try Again
                    </>
                  )}
                </Button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-xs text-red-400/70 hover:text-red-300 transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Close button for banner/toast variants */}
        {onDismiss && variant !== "inline" && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 text-red-400/50 hover:text-red-300 transition-colors rounded"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;
