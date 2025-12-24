import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  // FIX: Add size prop to allow for different button sizes.
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  isLoading = false,
  variant = 'primary',
  // FIX: Destructure size prop with a default value.
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  // FIX: Remove size-specific classes from base and move them to a dedicated size map.
  const baseClasses = 'inline-flex items-center justify-center border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all';

  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
    secondary: 'bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-gray-500',
    ghost: 'bg-transparent text-indigo-400 hover:bg-indigo-500/10 focus:ring-indigo-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm font-medium',
    md: 'px-6 py-3 text-base font-medium',
    lg: 'px-8 py-4 text-lg font-medium',
  };

  return (
    <button
      // FIX: Apply the appropriate size class based on the prop.
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;