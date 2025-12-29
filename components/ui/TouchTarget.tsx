import React from "react";

/**
 * TouchTarget component ensures minimum 44x44px touch targets for accessibility.
 * WCAG 2.1 Success Criterion 2.5.5 requires a minimum target size of 44x44 CSS pixels.
 *
 * This component wraps interactive elements and expands their hit area while
 * keeping the visual appearance unchanged.
 */

interface TouchTargetProps {
  children: React.ReactNode;
  className?: string;
  /** Minimum size in pixels. Default: 44 */
  minSize?: number;
  /** Element to render. Default: "div" */
  as?: React.ElementType;
}

/**
 * Wrapper component that ensures child elements have adequate touch target size
 */
export const TouchTarget: React.FC<TouchTargetProps> = ({
  children,
  className = "",
  minSize = 44,
  as: Component = "div",
}) => {
  return (
    <Component
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{
        minWidth: `${minSize}px`,
        minHeight: `${minSize}px`,
      }}
    >
      {children}
    </Component>
  );
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  /** Size variant. Default: "md" */
  size?: "sm" | "md" | "lg";
  /** Visual style variant */
  variant?: "default" | "ghost" | "danger" | "success";
}

/**
 * IconButton with built-in 44x44px minimum touch target
 */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = "md",
  variant = "default",
  className = "",
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: "min-w-[36px] min-h-[36px] p-1.5",
    md: "min-w-[44px] min-h-[44px] p-2.5",
    lg: "min-w-[52px] min-h-[52px] p-3",
  };

  const variantClasses = {
    default: `
      text-gray-400 hover:text-white
      hover:bg-gray-700/50
      focus:ring-gray-500
    `,
    ghost: `
      text-gray-500 hover:text-gray-300
      hover:bg-gray-800/30
      focus:ring-gray-600
    `,
    danger: `
      text-red-400 hover:text-red-300
      hover:bg-red-500/10
      focus:ring-red-500
    `,
    success: `
      text-green-400 hover:text-green-300
      hover:bg-green-500/10
      focus:ring-green-500
    `,
  };

  return (
    <button
      type="button"
      className={`
        inline-flex items-center justify-center
        rounded-lg
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        touch-manipulation
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      aria-label={label}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
};

interface TouchableListItemProps {
  children: React.ReactNode;
  /** Make the entire item clickable */
  onClick?: () => void;
  /** Show active/selected state */
  isActive?: boolean;
  /** Disable the item */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * List item with proper touch target sizing and feedback
 */
export const TouchableListItem: React.FC<TouchableListItemProps> = ({
  children,
  onClick,
  isActive = false,
  disabled = false,
  className = "",
}) => {
  const baseClassName = `
    w-full min-h-[48px] px-4 py-3
    flex items-center gap-3
    text-left
    rounded-lg
    transition-colors duration-150
    touch-manipulation
    ${onClick ? "cursor-pointer" : ""}
    ${isActive
      ? "bg-indigo-500/20 text-white border border-indigo-500/30"
      : "hover:bg-gray-700/50 text-gray-300"
    }
    ${disabled ? "opacity-50 cursor-not-allowed" : ""}
    ${className}
  `;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={baseClassName}
        aria-current={isActive ? "true" : undefined}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      className={baseClassName}
      aria-current={isActive ? "true" : undefined}
    >
      {children}
    </div>
  );
};

interface SwipeActionProps {
  children: React.ReactNode;
  /** Action to show on left swipe */
  leftAction?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color?: "danger" | "success" | "warning" | "info";
  };
  /** Action to show on right swipe */
  rightAction?: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color?: "danger" | "success" | "warning" | "info";
  };
  className?: string;
}

/**
 * Container for swipeable list items with reveal actions
 * Note: This is a visual component - actual swipe handling should use useTouchGestures hook
 */
export const SwipeActionContainer: React.FC<SwipeActionProps> = ({
  children,
  leftAction,
  rightAction,
  className = "",
}) => {
  const colorClasses = {
    danger: "bg-red-500",
    success: "bg-green-500",
    warning: "bg-amber-500",
    info: "bg-blue-500",
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left action (revealed on right swipe) */}
      {leftAction && (
        <button
          onClick={leftAction.onClick}
          className={`
            absolute left-0 top-0 bottom-0
            w-20 flex flex-col items-center justify-center
            text-white text-xs font-medium
            ${colorClasses[leftAction.color || "info"]}
          `}
          aria-label={leftAction.label}
        >
          {leftAction.icon}
          <span className="mt-1">{leftAction.label}</span>
        </button>
      )}

      {/* Right action (revealed on left swipe) */}
      {rightAction && (
        <button
          onClick={rightAction.onClick}
          className={`
            absolute right-0 top-0 bottom-0
            w-20 flex flex-col items-center justify-center
            text-white text-xs font-medium
            ${colorClasses[rightAction.color || "danger"]}
          `}
          aria-label={rightAction.label}
        >
          {rightAction.icon}
          <span className="mt-1">{rightAction.label}</span>
        </button>
      )}

      {/* Main content */}
      <div className="relative bg-gray-800 transition-transform duration-200">
        {children}
      </div>
    </div>
  );
};

/**
 * Utility class names for touch-friendly styling
 */
export const touchClasses = {
  /** Minimum 44x44 touch target */
  target: "min-w-[44px] min-h-[44px]",
  /** Minimum 48x48 touch target (more comfortable) */
  targetLarge: "min-w-[48px] min-h-[48px]",
  /** Remove tap highlight on mobile */
  noHighlight: "[-webkit-tap-highlight-color:transparent]",
  /** Optimize touch scrolling */
  scroll: "touch-pan-y overscroll-contain",
  /** Disable text selection during touch */
  noSelect: "select-none",
  /** Enable touch manipulation without delay */
  manipulation: "touch-manipulation",
};

export default TouchTarget;
