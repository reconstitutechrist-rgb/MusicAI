import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "gradient";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  isLoading = false,
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center 
    rounded-xl font-semibold
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900
    disabled:opacity-50 disabled:cursor-not-allowed 
    transition-all duration-200 ease-out
    press-effect hover-lift
  `;

  const variantClasses = {
    primary: `
      bg-gradient-to-r from-indigo-600 to-indigo-500 
      text-white 
      hover:from-indigo-500 hover:to-indigo-400 
      focus:ring-indigo-500
      shadow-lg shadow-indigo-500/25
      hover:shadow-xl hover:shadow-indigo-500/30
    `,
    secondary: `
      glass
      text-gray-200 
      hover:bg-white/10 hover:text-white
      focus:ring-gray-500
      border border-gray-600/50 hover:border-gray-500/50
    `,
    ghost: `
      bg-transparent 
      text-indigo-400 
      hover:bg-indigo-500/10 hover:text-indigo-300
      focus:ring-indigo-500
    `,
    gradient: `
      bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500
      text-white
      hover:from-indigo-500 hover:via-purple-500 hover:to-pink-400
      focus:ring-purple-500
      shadow-lg shadow-purple-500/25
      hover:shadow-xl hover:shadow-purple-500/30
      shine-effect
    `,
  };

  const sizeClasses = {
    sm: "px-4 py-2 text-sm gap-2",
    md: "px-6 py-3 text-base gap-2",
    lg: "px-8 py-4 text-lg gap-3",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {children}
    </button>
  );
};

export default Button;
