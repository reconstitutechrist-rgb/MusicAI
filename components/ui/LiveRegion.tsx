import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

interface LiveRegionContextType {
  announce: (message: string, type?: 'polite' | 'assertive') => void;
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
}

const LiveRegionContext = createContext<LiveRegionContextType | null>(null);

export const useLiveRegion = () => {
  const context = useContext(LiveRegionContext);
  if (!context) {
    throw new Error('useLiveRegion must be used within a LiveRegionProvider');
  }
  return context;
};

interface LiveRegionProviderProps {
  children: ReactNode;
}

export const LiveRegionProvider: React.FC<LiveRegionProviderProps> = ({ children }) => {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback((message: string, type: 'polite' | 'assertive' = 'polite') => {
    if (type === 'assertive') {
      // Clear first to ensure re-announcement of same message
      setAssertiveMessage('');
      setTimeout(() => setAssertiveMessage(message), 50);
    } else {
      setPoliteMessage('');
      setTimeout(() => setPoliteMessage(message), 50);
    }
  }, []);

  const announcePolite = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  const announceAssertive = useCallback((message: string) => {
    announce(message, 'assertive');
  }, [announce]);

  // Clear messages after announcement
  useEffect(() => {
    if (politeMessage) {
      const timer = setTimeout(() => setPoliteMessage(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [politeMessage]);

  useEffect(() => {
    if (assertiveMessage) {
      const timer = setTimeout(() => setAssertiveMessage(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [assertiveMessage]);

  return (
    <LiveRegionContext.Provider value={{ announce, announcePolite, announceAssertive }}>
      {children}
      {/* Polite live region - for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      {/* Assertive live region - for urgent updates */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </LiveRegionContext.Provider>
  );
};

// Standalone live region component for specific use cases
interface LiveRegionProps {
  message: string;
  type?: 'polite' | 'assertive';
  clearAfter?: number;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  type = 'polite',
  clearAfter = 1000,
}) => {
  const [displayMessage, setDisplayMessage] = useState(message);

  useEffect(() => {
    setDisplayMessage(message);
    if (clearAfter > 0 && message) {
      const timer = setTimeout(() => setDisplayMessage(''), clearAfter);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      role={type === 'assertive' ? 'alert' : 'status'}
      aria-live={type}
      aria-atomic="true"
      className="sr-only"
    >
      {displayMessage}
    </div>
  );
};

// Hook for component-level announcements with cleanup
export const useAnnounce = () => {
  const { announce } = useLiveRegion();

  return {
    onSuccess: (action: string) => announce(`${action} completed successfully`),
    onError: (action: string, error?: string) =>
      announce(`${action} failed${error ? `: ${error}` : ''}`, 'assertive'),
    onProgress: (action: string, progress: number) =>
      announce(`${action}: ${progress}% complete`),
    onLoading: (action: string) => announce(`${action}...`),
  };
};

export default LiveRegionProvider;
