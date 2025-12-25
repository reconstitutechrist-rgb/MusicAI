import React, { ReactNode } from "react";
import { useTheme } from "../../context/AppContext";

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
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  text,
  active,
  onClick,
}) => {
  const { theme } = useTheme();

  return (
    <li
      onClick={onClick}
      className={`
        relative flex items-center py-3 px-4 my-1 font-medium rounded-xl cursor-pointer
        transition-all duration-200 ease-out group mx-3
        ${
          active
            ? "bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-lg shadow-indigo-500/25"
            : theme === "dark"
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

      {/* Hover shine effect */}
      {!active && (
        <span className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <span
            className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent ${
              theme === "dark" ? "via-white/5" : "via-indigo-500/5"
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
