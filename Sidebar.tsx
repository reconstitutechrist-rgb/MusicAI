
import React, { ReactNode } from 'react';

interface SidebarProps {
  children: ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  return (
    <aside className="fixed top-0 left-0 h-screen w-16 md:w-64 bg-gray-800 border-r border-gray-700 flex flex-col z-10 transition-width duration-300">
      <ul className="flex-1 mt-6 overflow-y-auto scrollbar-hide pb-4">{children}</ul>
    </aside>
  );
};

interface SidebarItemProps {
  icon: React.ReactNode;
  text: string;
  active?: boolean;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ icon, text, active, onClick }) => {
  return (
    <li
      onClick={onClick}
      className={`
        relative flex items-center py-4 px-5 my-1 font-medium rounded-md cursor-pointer
        transition-colors group mx-2
        ${active
          ? 'bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white'
          : 'hover:bg-gray-700 text-gray-400 hover:text-white'
        }
    `}
    >
      {icon}
      <span className="w-52 ml-3 hidden md:inline truncate">{text}</span>
    </li>
  );
};
