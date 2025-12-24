import React, { KeyboardEvent } from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "glass" | "gradient";
  hover?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = "",
  variant = "default",
  hover = true,
}) => {
  const baseStyles = "rounded-2xl p-6 transition-all duration-300 ease-out";

  const variants = {
    default: "glass border-dance shadow-xl shadow-black/20",
    glass:
      "bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/30",
    gradient:
      "bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 border border-gray-700/50 shadow-xl",
  };

  const hoverStyles = hover ? "hover-lift hover:border-indigo-500/30" : "";

  return (
    <div
      className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${className}`}
    >
      {children}
    </div>
  );
};

// Feature card with icon support
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  active?: boolean;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  onClick,
  active = false,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const isInteractive = !!onClick;

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-pressed={isInteractive ? active : undefined}
      className={`
        glass rounded-2xl p-6 transition-all duration-300 ease-out
        hover-lift border-dance group
        ${active ? "ring-2 ring-indigo-500 bg-indigo-500/10" : ""}
        ${isInteractive ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900" : ""}
      `}
    >
      <div className="flex items-start gap-4">
        <div
          className={`
          p-3 rounded-xl transition-all duration-300
          ${
            active
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
              : "bg-gray-700/50 text-gray-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-400"
          }
        `}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-lg group-hover:text-indigo-300 transition-colors">
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-400 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

// Stats card for displaying metrics
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
}) => {
  const trendColors = {
    up: "text-green-400",
    down: "text-red-400",
    neutral: "text-gray-400",
  };

  return (
    <div className="glass rounded-xl p-4 hover-lift">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <div
        className={`mt-2 text-2xl font-bold ${
          trend ? trendColors[trend] : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
};

export default Card;
