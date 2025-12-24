import React, { useState, ReactNode } from "react";

interface TabsProps {
  tabs: { name: string; content: ReactNode; icon?: ReactNode }[];
}

const Tabs: React.FC<TabsProps> = ({ tabs }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      {/* Tab Navigation */}
      <div className="relative">
        <nav className="flex gap-2 p-1 glass rounded-xl" aria-label="Tabs">
          {tabs.map((tab, index) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(index)}
              className={`
                relative flex items-center gap-2
                whitespace-nowrap py-3 px-5 
                font-medium text-sm
                rounded-lg
                transition-all duration-200 ease-out
                ${
                  activeTab === index
                    ? "bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-lg shadow-indigo-500/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }
              `}
            >
              {tab.icon && (
                <span
                  className={`transition-transform duration-200 ${
                    activeTab === index ? "scale-110" : ""
                  }`}
                >
                  {tab.icon}
                </span>
              )}
              {tab.name}

              {/* Active indicator dot */}
              {activeTab === index && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Decorative line below tabs */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent" />
      </div>

      {/* Tab Content with fade animation */}
      <div className="mt-6 animate-fade-in-up" key={activeTab}>
        {tabs[activeTab].content}
      </div>
    </div>
  );
};

export default Tabs;
