import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle' | 'card';
  width?: string | number;
  height?: string | number;
  className?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width,
  height,
  className = '',
  lines = 1,
}) => {
  const baseClasses = 'skeleton-pulse rounded';

  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 rounded';
      case 'circle':
        return 'rounded-full';
      case 'card':
        return 'rounded-xl';
      case 'rect':
      default:
        return 'rounded-lg';
    }
  };

  const style: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : undefined),
    height: height || (variant === 'text' ? '1rem' : variant === 'circle' ? width : undefined),
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${getVariantClasses()}`}
            style={{
              ...style,
              width: i === lines - 1 ? '75%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${getVariantClasses()} ${className}`}
      style={style}
    />
  );
};

// Pre-built skeleton compositions (theme-aware via CSS classes in index.css)
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-4 rounded-xl bg-gray-800/50 dark:bg-gray-800/50 light:bg-gray-200/50 ${className}`}>
    <Skeleton variant="rect" height={120} className="mb-4" />
    <Skeleton variant="text" lines={2} className="mb-3" />
    <div className="flex gap-2">
      <Skeleton variant="rect" width={80} height={32} />
      <Skeleton variant="rect" width={80} height={32} />
    </div>
  </div>
);

export const SkeletonList: React.FC<{ count?: number; className?: string }> = ({
  count = 3,
  className = '',
}) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 dark:bg-gray-800/30">
        <Skeleton variant="circle" width={40} height={40} />
        <div className="flex-1">
          <Skeleton variant="text" width="60%" className="mb-2" />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonMixer: React.FC<{ tracks?: number }> = ({ tracks = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: tracks }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-800/30 dark:bg-gray-800/30">
        <Skeleton variant="circle" width={48} height={48} />
        <div className="flex-1">
          <Skeleton variant="text" width="30%" className="mb-2" />
          <Skeleton variant="rect" height={8} className="rounded-full" />
        </div>
        <Skeleton variant="rect" width={60} height={32} />
      </div>
    ))}
  </div>
);

export default Skeleton;
