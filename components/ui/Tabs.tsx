import React, { useState, ReactNode, useRef, useCallback, KeyboardEvent } from "react";

interface TabsProps {
  tabs: { name: string; content: ReactNode; icon?: ReactNode }[];
  id?: string; // Optional ID prefix for ARIA relationships
}

const Tabs: React.FC<TabsProps> = ({ tabs, id = 'tabs' }) => {
  const [activeTab, setActiveTab] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keyboard navigation handler following WAI-ARIA Tabs Pattern
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let newIndex = currentIndex;
    const tabCount = tabs.length;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        newIndex = (currentIndex + 1) % tabCount;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = (currentIndex - 1 + tabCount) % tabCount;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = tabCount - 1;
        break;
      default:
        return;
    }

    setActiveTab(newIndex);
    tabRefs.current[newIndex]?.focus();
  }, [tabs.length]);

  const setTabRef = useCallback((el: HTMLButtonElement | null, index: number) => {
    tabRefs.current[index] = el;
  }, []);

  return (
    <div>
      {/* Tab Navigation */}
      <div className="relative">
        <nav
          className="flex gap-2 p-1 glass rounded-xl"
          role="tablist"
          aria-label="Tabs"
        >
          {tabs.map((tab, index) => {
            const tabId = `${id}-tab-${index}`;
            const panelId = `${id}-panel-${index}`;
            const isActive = activeTab === index;

            return (
              <button
                key={tab.name}
                ref={(el) => setTabRef(el, index)}
                id={tabId}
                role="tab"
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={`
                  relative flex items-center gap-2
                  whitespace-nowrap py-3 px-5
                  font-medium text-sm
                  rounded-lg
                  transition-all duration-200 ease-out
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
                  ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-lg shadow-indigo-500/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }
                `}
              >
                {tab.icon && (
                  <span
                    className={`transition-transform duration-200 ${
                      isActive ? "scale-110" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {tab.icon}
                  </span>
                )}
                {tab.name}

                {/* Active indicator dot */}
                {isActive && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Decorative line below tabs */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* Tab Content Panel */}
      <div
        id={`${id}-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${activeTab}`}
        tabIndex={0}
        className="mt-6 animate-fade-in-up focus:outline-none"
        key={activeTab}
      >
        {tabs[activeTab].content}
      </div>
    </div>
  );
};

export default Tabs;
