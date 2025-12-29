import React, { ReactNode } from "react";
import { useTheme, useRecentProjects, RecentProject } from "../../context/AppContext";

interface SidebarProps {
  children: ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const { theme } = useTheme();

  return (
    <aside className="fixed top-0 left-0 h-screen w-20 md:w-72 glass flex flex-col z-20 transition-all duration-300 ease-in-out">
      {/* Decorative gradient line on the right edge */}
      <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-indigo-500/50 via-purple-500/30 to-transparent" />

      {/* Subtle ambient glow at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

      <nav className="flex-1 overflow-y-auto scrollbar-hide pb-6 relative">
        {children}
      </nav>

      {/* Bottom decorative element */}
      <div
        className={`p-4 border-t hidden md:block ${
          theme === "dark" ? "border-gray-700/50" : "border-gray-200/50"
        }`}
      >
        <div
          className={`flex items-center gap-2 text-xs ${
            theme === "dark" ? "text-gray-500" : "text-gray-600"
          }`}
        >
          <div className="flex gap-0.5">
            <span className="w-1 h-3 bg-indigo-500 rounded-full wave-bar" />
            <span className="w-1 h-3 bg-purple-500 rounded-full wave-bar" />
            <span className="w-1 h-3 bg-pink-500 rounded-full wave-bar" />
            <span className="w-1 h-3 bg-purple-500 rounded-full wave-bar" />
            <span className="w-1 h-3 bg-indigo-500 rounded-full wave-bar" />
          </div>
          <span className="opacity-60">Making music magic</span>
        </div>
      </div>
    </aside>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  text: string;
  active?: boolean;
  onClick?: () => void;
  shortcut?: string; // Keyboard shortcut hint (e.g., "1", "Ctrl+S")
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  text,
  active,
  onClick,
  shortcut,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Build tooltip text with shortcut hint
  const tooltipText = shortcut ? `${text} (${shortcut})` : text;

  return (
    <li
      onClick={onClick}
      title={tooltipText}
      className={`
        relative flex items-center py-3 px-4 my-1 font-medium rounded-xl cursor-pointer
        transition-all duration-200 ease-out group mx-3
        ${
          active
            ? "bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-lg shadow-indigo-500/25"
            : isDark
              ? "hover:bg-white/5 text-gray-400 hover:text-white"
              : "hover:bg-indigo-50 text-gray-600 hover:text-indigo-700"
        }
    `}
    >
      {/* Active indicator bar */}
      {active && <span className="sidebar-indicator" />}

      {/* Icon with subtle glow when active */}
      <span
        className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
          active ? "drop-shadow-lg" : ""
        }`}
      >
        {icon}
      </span>

      <span className="w-44 ml-3 hidden md:inline truncate font-medium">
        {text}
      </span>

      {/* Shortcut badge - visible on hover */}
      {shortcut && (
        <span
          className={`absolute right-3 hidden md:flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono px-1.5 py-0.5 rounded ${
            active
              ? "bg-white/20 text-white"
              : isDark
                ? "bg-white/10 text-gray-400"
                : "bg-gray-200 text-gray-500"
          }`}
        >
          {shortcut}
        </span>
      )}

      {/* Hover shine effect */}
      {!active && (
        <span className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <span
            className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent ${
              isDark ? "via-white/5" : "via-indigo-500/5"
            } to-transparent`}
          />
        </span>
      )}
    </li>
  );
};

interface SidebarSectionProps {
  title: string;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ title }) => {
  const { theme } = useTheme();

  return (
    <div className="px-6 py-3 mt-4 first:mt-0">
      <span
        className={`text-[10px] font-bold uppercase tracking-widest hidden md:block ${
          theme === "dark" ? "text-gray-500" : "text-gray-500"
        }`}
      >
        {title}
      </span>
      <div className="hidden md:block mt-2 h-px w-8 bg-gradient-to-r from-indigo-500/50 to-transparent" />
    </div>
  );
};

// Recent Projects Section
interface RecentProjectsSectionProps {
  onProjectClick: (project: RecentProject) => void;
  maxItems?: number;
}

export const RecentProjectsSection: React.FC<RecentProjectsSectionProps> = ({
  onProjectClick,
  maxItems = 5,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { recentProjects, removeRecentProject, clearRecentProjects } = useRecentProjects();

  if (recentProjects.length === 0) {
    return null;
  }

  const displayedProjects = recentProjects.slice(0, maxItems);

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Get icon for project type
  const getProjectIcon = (type: RecentProject["type"]) => {
    switch (type) {
      case "lyrics":
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case "instrumental":
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        );
      case "vocal":
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        );
      case "project":
      default:
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        );
    }
  };

  return (
    <div className="px-3 py-3 mt-4 hidden md:block">
      <div className="flex items-center justify-between px-3 mb-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            isDark ? "text-gray-500" : "text-gray-500"
          }`}
        >
          Recent
        </span>
        {recentProjects.length > 0 && (
          <button
            onClick={clearRecentProjects}
            className={`text-[10px] transition-colors ${
              isDark
                ? "text-gray-600 hover:text-gray-400"
                : "text-gray-400 hover:text-gray-600"
            }`}
            title="Clear all recent projects"
          >
            Clear
          </button>
        )}
      </div>
      <div className="space-y-1">
        {displayedProjects.map((project) => (
          <div
            key={project.id}
            className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
              isDark
                ? "hover:bg-white/5 text-gray-400 hover:text-white"
                : "hover:bg-indigo-50 text-gray-600 hover:text-indigo-700"
            }`}
            onClick={() => onProjectClick(project)}
          >
            <span className={`flex-shrink-0 ${isDark ? "text-indigo-400" : "text-indigo-500"}`}>
              {getProjectIcon(project.type)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{project.title}</p>
              <p
                className={`text-[10px] ${
                  isDark ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {formatRelativeTime(project.timestamp)}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeRecentProject(project.id);
              }}
              className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${
                isDark
                  ? "hover:bg-white/10 text-gray-500 hover:text-white"
                  : "hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              }`}
              title="Remove from recent"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
