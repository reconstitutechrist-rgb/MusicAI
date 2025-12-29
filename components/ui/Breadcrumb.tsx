import React from "react";
import { useTheme } from "../../context/AppContext";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
  maxItems?: number;
}

const DefaultSeparator: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <svg
    className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator,
  className = "",
  maxItems,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Handle collapsing for long breadcrumbs
  let displayItems = items;
  let showEllipsis = false;

  if (maxItems && items.length > maxItems) {
    const firstItem = items[0];
    const lastItems = items.slice(-(maxItems - 1));
    displayItems = [firstItem, ...lastItems];
    showEllipsis = true;
  }

  // Theme-aware classes
  const clickableClasses = isDark
    ? "text-gray-400 hover:text-white"
    : "text-gray-500 hover:text-gray-900";

  const currentPageClasses = isDark
    ? "text-white font-medium"
    : "text-gray-900 font-medium";

  const nonClickableClasses = isDark ? "text-gray-400" : "text-gray-500";
  const ellipsisClasses = isDark ? "text-gray-500" : "text-gray-400";

  const separatorElement = separator || <DefaultSeparator isDark={isDark} />;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-2 flex-wrap">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const isFirst = index === 0;
          const isClickable = !isLast && (item.href || item.onClick);

          // Show ellipsis after first item when collapsed
          const showEllipsisAfter = showEllipsis && isFirst;

          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <li className="flex items-center">
                {isClickable ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`flex items-center gap-1.5 text-sm ${clickableClasses} transition-colors focus:outline-none focus:underline`}
                  >
                    {item.icon && <span className="flex-shrink-0" aria-hidden="true">{item.icon}</span>}
                    <span>{item.label}</span>
                  </button>
                ) : (
                  <span
                    className={`flex items-center gap-1.5 text-sm ${
                      isLast ? currentPageClasses : nonClickableClasses
                    }`}
                    aria-current={isLast ? "page" : undefined}
                  >
                    {item.icon && <span className="flex-shrink-0" aria-hidden="true">{item.icon}</span>}
                    <span>{item.label}</span>
                  </span>
                )}
              </li>

              {showEllipsisAfter && (
                <>
                  <li aria-hidden="true" className="flex items-center">
                    {separatorElement}
                  </li>
                  <li className={`${ellipsisClasses} text-sm`}>...</li>
                </>
              )}

              {!isLast && (
                <li aria-hidden="true" className="flex items-center">
                  {separatorElement}
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

// Home icon for breadcrumb
export const HomeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

export default Breadcrumb;
