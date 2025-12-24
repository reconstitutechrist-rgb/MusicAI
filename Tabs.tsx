
import React, { useState, ReactNode } from 'react';

interface TabsProps {
  tabs: { name: string; content: ReactNode }[];
}

const Tabs: React.FC<TabsProps> = ({ tabs }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab, index) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(index)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === index
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                }
              `}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-6">
        {tabs[activeTab].content}
      </div>
    </div>
  );
};

export default Tabs;
