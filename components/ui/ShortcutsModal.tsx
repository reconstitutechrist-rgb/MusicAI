import React, { useEffect, useRef } from "react";
import { useTheme } from "../../context/AppContext";
import { formatShortcut, KeyboardShortcut } from "../../hooks/useKeyboardShortcuts";
import { useModal } from "../../hooks/useModal";

interface ShortcutItemProps {
  id: string;
  shortcut: Omit<KeyboardShortcut, "action">;
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({ shortcut }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
        isDark ? "hover:bg-white/5" : "hover:bg-gray-100"
      }`}
    >
      <span className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
        {shortcut.description}
      </span>
      <kbd
        className={`px-2 py-1 rounded text-xs font-mono ${
          isDark
            ? "bg-gray-800 text-gray-300 border border-gray-700"
            : "bg-gray-100 text-gray-700 border border-gray-300"
        }`}
      >
        {formatShortcut(shortcut)}
      </kbd>
    </div>
  );
};

interface ShortcutCategoryProps {
  title: string;
  icon: React.ReactNode;
  shortcuts: Array<{ id: string } & Omit<KeyboardShortcut, "action">>;
}

const ShortcutCategory: React.FC<ShortcutCategoryProps> = ({
  title,
  icon,
  shortcuts,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (shortcuts.length === 0) return null;

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3">
        <span className={isDark ? "text-indigo-400" : "text-indigo-600"}>
          {icon}
        </span>
        <h3
          className={`text-sm font-semibold uppercase tracking-wide ${
            isDark ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {title}
        </h3>
      </div>
      <div className="space-y-1">
        {shortcuts.map((shortcut) => (
          <ShortcutItem key={shortcut.id} id={shortcut.id} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
};

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  getShortcutsByCategory: (
    category: KeyboardShortcut["category"]
  ) => Array<{ id: string } & Omit<KeyboardShortcut, "action">>;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
  getShortcutsByCategory,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const modalRef = useRef<HTMLDivElement>(null);

  // Use the modal hook for accessibility
  useModal({
    isOpen,
    onClose,
    modalRef,
  });

  // Close on escape (handled by useModal, but keeping for explicit behavior)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const navigationShortcuts = getShortcutsByCategory("navigation");
  const playbackShortcuts = getShortcutsByCategory("playback");
  const editingShortcuts = getShortcutsByCategory("editing");
  const generalShortcuts = getShortcutsByCategory("general");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl ${
          isDark ? "bg-gray-900" : "bg-white"
        }`}
      >
        {/* Header */}
        <div
          className={`sticky top-0 flex items-center justify-between px-6 py-4 border-b ${
            isDark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isDark ? "bg-indigo-500/20" : "bg-indigo-100"
              }`}
            >
              <svg
                className={`w-5 h-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <h2
              id="shortcuts-modal-title"
              className={`text-xl font-semibold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-white/10 text-gray-400 hover:text-white"
                : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"
            }`}
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-8rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column */}
            <div>
              <ShortcutCategory
                title="Navigation"
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                }
                shortcuts={navigationShortcuts}
              />
              <ShortcutCategory
                title="Playback"
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                shortcuts={playbackShortcuts}
              />
            </div>

            {/* Right column */}
            <div>
              <ShortcutCategory
                title="Editing"
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                }
                shortcuts={editingShortcuts}
              />
              <ShortcutCategory
                title="General"
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                shortcuts={generalShortcuts}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`sticky bottom-0 px-6 py-3 border-t ${
            isDark ? "border-gray-800 bg-gray-900/95" : "border-gray-200 bg-white/95"
          }`}
        >
          <p
            className={`text-xs text-center ${
              isDark ? "text-gray-500" : "text-gray-400"
            }`}
          >
            Press <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${isDark ? "bg-gray-800" : "bg-gray-100"}`}>?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
