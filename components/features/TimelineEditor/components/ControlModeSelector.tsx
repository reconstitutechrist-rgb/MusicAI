import React from "react";
import { ControlMode } from "../../../../types/timeline";
import { useTimeline } from "../TimelineEditorContext";

interface ControlModeSelectorProps {
  className?: string;
}

/**
 * ControlModeSelector - Switch between Automated, AI Suggests, and Manual modes
 */
export function ControlModeSelector({
  className = "",
}: ControlModeSelectorProps) {
  const { state, actions } = useTimeline();
  const { controlMode, isAnalyzing } = state;

  const modes: {
    value: ControlMode;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      value: "automated",
      label: "Auto",
      description: "AI arranges everything based on your description",
      icon: "✨",
    },
    {
      value: "ai-suggests",
      label: "Suggest",
      description: "AI suggests, you approve and edit",
      icon: "💡",
    },
    {
      value: "manual",
      label: "Manual",
      description: "Full manual control, AI assists on request",
      icon: "🎛️",
    },
  ];

  return (
    <div
      className={`flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg ${className}`}
    >
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => actions.setControlMode(mode.value)}
          disabled={isAnalyzing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            controlMode === mode.value
              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
              : "text-white/60 hover:text-white hover:bg-white/10"
          } ${isAnalyzing ? "opacity-50 cursor-not-allowed" : ""}`}
          title={mode.description}
          aria-pressed={controlMode === mode.value}
        >
          <span>{mode.icon}</span>
          <span>{mode.label}</span>
        </button>
      ))}
    </div>
  );
}

export default ControlModeSelector;
