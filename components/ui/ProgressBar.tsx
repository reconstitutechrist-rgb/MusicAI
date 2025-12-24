import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  indeterminate?: boolean;
  className?: string;
  stages?: { label: string; completed: boolean }[];
}

const variantColors = {
  default: {
    bar: 'bg-gradient-to-r from-indigo-500 to-purple-500',
    track: 'bg-gray-700/50',
    text: 'text-indigo-400',
  },
  success: {
    bar: 'bg-gradient-to-r from-green-500 to-emerald-500',
    track: 'bg-gray-700/50',
    text: 'text-green-400',
  },
  warning: {
    bar: 'bg-gradient-to-r from-yellow-500 to-orange-500',
    track: 'bg-gray-700/50',
    text: 'text-yellow-400',
  },
  error: {
    bar: 'bg-gradient-to-r from-red-500 to-pink-500',
    track: 'bg-gray-700/50',
    text: 'text-red-400',
  },
};

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercentage = false,
  variant = 'default',
  size = 'md',
  indeterminate = false,
  className = '',
  stages,
}) => {
  const colors = variantColors[variant];
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full ${className}`} role="progressbar" aria-valuenow={clampedProgress} aria-valuemin={0} aria-valuemax={100}>
      {/* Header with label and percentage */}
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-300">{label}</span>
          )}
          {showPercentage && !indeterminate && (
            <span className={`text-sm font-medium ${colors.text}`}>
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}

      {/* Progress track */}
      <div className={`w-full ${colors.track} rounded-full overflow-hidden ${sizeClasses[size]}`}>
        {indeterminate ? (
          <div
            className={`h-full w-1/4 ${colors.bar} rounded-full progress-indeterminate`}
          />
        ) : (
          <div
            className={`h-full ${colors.bar} rounded-full transition-all duration-300 ease-out`}
            style={{ width: `${clampedProgress}%` }}
          />
        )}
      </div>

      {/* Stage indicators */}
      {stages && stages.length > 0 && (
        <div className="flex justify-between mt-3">
          {stages.map((stage, index) => (
            <div key={index} className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full transition-colors ${
                  stage.completed
                    ? colors.bar
                    : 'bg-gray-600'
                }`}
              />
              <span
                className={`text-xs mt-1 ${
                  stage.completed ? colors.text : 'text-gray-500'
                }`}
              >
                {stage.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Circular progress variant
interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  showPercentage?: boolean;
  className?: string;
}

const circularColors = {
  default: 'stroke-indigo-500',
  success: 'stroke-green-500',
  warning: 'stroke-yellow-500',
  error: 'stroke-red-500',
};

export const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 48,
  strokeWidth = 4,
  variant = 'default',
  showPercentage = false,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const offset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Background circle */}
        <circle
          className="stroke-gray-700/50"
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className={`${circularColors[variant]} transition-all duration-300 ease-out`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      {showPercentage && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-300">
          {Math.round(clampedProgress)}%
        </span>
      )}
    </div>
  );
};

export default ProgressBar;
