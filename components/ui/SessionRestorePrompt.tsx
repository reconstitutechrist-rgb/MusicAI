import React from "react";
import { useSessionRestore } from "../../context/AppContext";

const SessionRestorePrompt: React.FC = () => {
  const {
    showRestorePrompt,
    savedSessionTime,
    restoreSession,
    dismissRestorePrompt,
  } = useSessionRestore();

  if (!showRestorePrompt) return null;

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  return (
    <div
      className="fixed bottom-20 right-4 z-40 max-w-sm animate-fade-in-up"
      role="alertdialog"
      aria-labelledby="restore-title"
      aria-describedby="restore-desc"
    >
      <div className="glass backdrop-blur-md rounded-xl border border-indigo-500/30 shadow-xl p-4 bg-gray-800/90">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 id="restore-title" className="text-sm font-medium text-white">
              Resume Previous Session?
            </h3>
            <p id="restore-desc" className="text-xs text-gray-400 mt-1">
              You have unsaved work from {formatTime(savedSessionTime)}. Would you like
              to continue where you left off?
            </p>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={restoreSession}
                className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                Restore
              </button>
              <button
                onClick={dismissRestorePrompt}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Start Fresh
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={dismissRestorePrompt}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionRestorePrompt;
