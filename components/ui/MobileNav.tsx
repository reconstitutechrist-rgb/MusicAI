import React, { useEffect, useRef, useCallback } from 'react';

// Inline SVG Icons
const MusicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  </svg>
);

const ShareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);

const RadioIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
  </svg>
);

const MenuIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

export type AppSection = 'music' | 'marketing' | 'production';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentSection: AppSection;
  onSectionChange: (section: AppSection) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

interface NavItem {
  id: AppSection;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  {
    id: 'music',
    label: 'Music Creation',
    icon: <MusicIcon className="w-5 h-5" />,
    description: 'Generate lyrics and music',
  },
  {
    id: 'marketing',
    label: 'Social Marketing',
    icon: <ShareIcon className="w-5 h-5" />,
    description: 'Create promotional content',
  },
  {
    id: 'production',
    label: 'Audio Production',
    icon: <RadioIcon className="w-5 h-5" />,
    description: 'Mix and master your tracks',
  },
];

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentSection,
  onSectionChange,
  isDarkMode,
  onToggleTheme,
}) => {
  const navRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Get all focusable elements within the nav
  const getFocusableElements = useCallback(() => {
    if (!navRef.current) return [];
    return Array.from(
      navRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
  }, []);

  // Handle escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap - Tab key handling
      if (e.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab from first element -> go to last
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
        // Tab from last element -> go to first
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, getFocusableElements]);

  // Focus management - focus first element when opening
  useEffect(() => {
    if (isOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNavClick = (section: AppSection) => {
    onSectionChange(section);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 overlay-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Navigation drawer */}
      <nav
        ref={navRef}
        className={`fixed inset-y-0 left-0 w-72 border-r z-50 mobile-nav-enter ${
          isDarkMode
            ? 'bg-gray-900 border-gray-700/50'
            : 'bg-white border-gray-200/50'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <MusicIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg gradient-text">MUSE AI</span>
          </div>
          <button
            ref={firstFocusableRef}
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            }`}
            aria-label="Close navigation"
          >
            <XIcon className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Navigation items */}
        <div className="p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-xl transition-all
                ${
                  currentSection === item.id
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
                    : isDarkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-100'
                }
              `}
              aria-current={currentSection === item.id ? 'page' : undefined}
            >
              <div
                className={`
                  p-2 rounded-lg
                  ${
                    currentSection === item.id
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'
                  }
                `}
              >
                {item.icon}
              </div>
              <div className="text-left">
                <div
                  className={`font-medium ${
                    currentSection === item.id
                      ? isDarkMode ? 'text-white' : 'text-gray-900'
                      : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  {item.label}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                  {item.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${
          isDarkMode ? 'border-gray-700/50' : 'border-gray-200/50'
        }`}>
          <button
            onClick={onToggleTheme}
            className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-colors ${
              isDarkMode
                ? 'bg-gray-800/50 hover:bg-gray-800'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {isDarkMode ? (
              <>
                <SunIcon className="w-5 h-5 text-yellow-400" />
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Light Mode</span>
              </>
            ) : (
              <>
                <MoonIcon className="w-5 h-5 text-indigo-400" />
                <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </nav>
    </>
  );
};

// Hamburger button component
export const HamburgerButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-lg hover:bg-gray-500/20 transition-colors ${className}`}
    aria-label="Open navigation menu"
    aria-haspopup="dialog"
  >
    <MenuIcon className="w-6 h-6" />
  </button>
);

export default MobileNav;
