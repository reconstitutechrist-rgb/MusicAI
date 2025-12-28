import React from "react";

export interface WorkflowStep {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: React.ReactNode;
  description?: string;
}

interface WorkflowProgressProps {
  steps: WorkflowStep[];
  currentStep: string;
  completedSteps: string[];
  onStepClick?: (stepId: string) => void;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  orientation = "horizontal",
  size = "md",
  className = "",
}) => {
  const getStepStatus = (stepId: string) => {
    if (completedSteps.includes(stepId)) return "completed";
    if (stepId === currentStep) return "current";
    return "upcoming";
  };

  const sizeClasses = {
    sm: {
      container: "gap-1",
      circle: "w-6 h-6 text-xs",
      line: orientation === "horizontal" ? "h-0.5 w-8" : "w-0.5 h-8",
      label: "text-xs",
      description: "text-xs",
    },
    md: {
      container: "gap-2",
      circle: "w-8 h-8 text-sm",
      line: orientation === "horizontal" ? "h-0.5 w-12" : "w-0.5 h-12",
      label: "text-sm",
      description: "text-xs",
    },
    lg: {
      container: "gap-3",
      circle: "w-10 h-10 text-base",
      line: orientation === "horizontal" ? "h-1 w-16" : "w-1 h-16",
      label: "text-base",
      description: "text-sm",
    },
  };

  const sizes = sizeClasses[size];

  const renderStep = (step: WorkflowStep, index: number) => {
    const status = getStepStatus(step.id);
    const isLast = index === steps.length - 1;
    const isClickable = onStepClick && (status === "completed" || status === "current");

    const circleClasses = {
      completed: "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20",
      current: "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/20",
      upcoming: "bg-gray-700 text-gray-400 border border-gray-600",
    };

    const lineClasses = {
      completed: "bg-gradient-to-r from-green-500 to-emerald-500",
      current: "bg-gradient-to-r from-indigo-500/50 to-gray-700",
      upcoming: "bg-gray-700",
    };

    const labelClasses = {
      completed: "text-green-400",
      current: "text-white font-medium",
      upcoming: "text-gray-500",
    };

    const StepContent = () => (
      <div
        className={`flex items-center ${sizes.container} ${
          orientation === "vertical" ? "flex-row" : "flex-col"
        }`}
      >
        {/* Circle */}
        <div
          className={`
            ${sizes.circle} ${circleClasses[status]}
            rounded-full flex items-center justify-center
            font-semibold transition-all duration-300
            ${isClickable ? "cursor-pointer hover:scale-110" : ""}
          `}
          role={isClickable ? "button" : undefined}
          tabIndex={isClickable ? 0 : undefined}
          onClick={isClickable ? () => onStepClick(step.id) : undefined}
          onKeyDown={isClickable ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStepClick(step.id);
            }
          } : undefined}
          aria-label={`${step.label} - ${status === "completed" ? "completed" : status === "current" ? "current step" : "upcoming"}`}
          aria-current={status === "current" ? "step" : undefined}
        >
          {status === "completed" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : step.icon ? (
            <span aria-hidden="true">{step.icon}</span>
          ) : (
            <span>{index + 1}</span>
          )}
        </div>

        {/* Label */}
        <div className={orientation === "vertical" ? "ml-3" : "text-center mt-2"}>
          <p className={`${sizes.label} ${labelClasses[status]} whitespace-nowrap`}>
            {orientation === "horizontal" && size === "sm" ? (step.shortLabel || step.label) : step.label}
          </p>
          {step.description && orientation === "vertical" && (
            <p className={`${sizes.description} text-gray-500 mt-0.5`}>
              {step.description}
            </p>
          )}
        </div>
      </div>
    );

    return (
      <React.Fragment key={step.id}>
        <div
          className={`flex ${
            orientation === "horizontal" ? "flex-col items-center" : "items-start"
          }`}
        >
          <StepContent />
        </div>

        {/* Connector Line */}
        {!isLast && (
          <div
            className={`
              ${sizes.line}
              ${lineClasses[status === "completed" ? "completed" : "upcoming"]}
              ${orientation === "horizontal" ? "flex-shrink-0" : "ml-4 my-1"}
              rounded-full transition-all duration-300
            `}
            aria-hidden="true"
          />
        )}
      </React.Fragment>
    );
  };

  return (
    <nav
      aria-label="Progress"
      className={className}
    >
      <ol
        className={`flex ${
          orientation === "horizontal"
            ? "items-center justify-between"
            : "flex-col"
        }`}
        role="list"
      >
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`flex ${
              orientation === "horizontal" ? "items-center" : ""
            } ${index < steps.length - 1 ? "flex-1" : ""}`}
          >
            {renderStep(step, index)}
          </li>
        ))}
      </ol>
    </nav>
  );
};

// Preset workflow for music creation
export const MUSIC_CREATION_STEPS: WorkflowStep[] = [
  {
    id: "compose",
    label: "Compose",
    shortLabel: "Compose",
    description: "Create lyrics and melody",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    id: "produce",
    label: "Produce",
    shortLabel: "Produce",
    description: "Mix and master your track",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "video",
    label: "Video",
    shortLabel: "Video",
    description: "Create a music video",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "market",
    label: "Market",
    shortLabel: "Market",
    description: "Promote your music",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
];

export default WorkflowProgress;
