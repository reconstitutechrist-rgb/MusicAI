import React, { useId, useState, useCallback } from "react";
import { ValidationResult } from "../../utils/validation";

interface FormFieldProps {
  label: string;
  type?: "text" | "email" | "password" | "number" | "textarea" | "select";
  value: string | number;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
  helpText?: string;
  validator?: (value: string) => ValidationResult;
  validateOnBlur?: boolean;
  className?: string;
  inputClassName?: string;
  // For number inputs
  min?: number;
  max?: number;
  step?: number;
  // For textarea
  rows?: number;
  // For select
  options?: Array<{ value: string; label: string }>;
  // For password
  showPasswordToggle?: boolean;
  // Autocomplete
  autoComplete?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  disabled = false,
  error: externalError,
  helpText,
  validator,
  validateOnBlur = true,
  className = "",
  inputClassName = "",
  min,
  max,
  step,
  rows = 3,
  options = [],
  showPasswordToggle = false,
  autoComplete,
}) => {
  const id = useId();
  const inputId = `${id}-input`;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  const [internalError, setInternalError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Combine external and internal errors
  const displayError = externalError || (touched ? internalError : null);
  const hasError = !!displayError;

  // Handle validation on blur
  const handleBlur = useCallback(() => {
    setTouched(true);
    if (validateOnBlur && validator) {
      const result = validator(String(value));
      setInternalError(result.isValid ? null : result.error || null);
    }
    onBlur?.();
  }, [validateOnBlur, validator, value, onBlur]);

  // Handle change
  const handleChange = (newValue: string) => {
    onChange(newValue);
    // Clear error on change if it was valid
    if (touched && validator) {
      const result = validator(newValue);
      if (result.isValid) {
        setInternalError(null);
      }
    }
  };

  // Base input classes
  const baseInputClasses = `
    w-full px-4 py-3 rounded-xl
    bg-gray-700/50 border text-white placeholder-gray-400
    focus:outline-none focus:ring-2 focus:border-transparent
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors duration-200
    ${hasError
      ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
      : "border-gray-600 focus:ring-indigo-500/20 focus:border-indigo-500"
    }
    ${inputClassName}
  `;

  // Determine aria-describedby
  const ariaDescribedBy = [
    hasError ? errorId : null,
    helpText ? helpId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  // Render input based on type
  const renderInput = () => {
    const commonProps = {
      id: inputId,
      disabled,
      placeholder,
      "aria-invalid": hasError,
      "aria-describedby": ariaDescribedBy,
      "aria-required": required,
      onBlur: handleBlur,
      autoComplete,
    };

    if (type === "textarea") {
      return (
        <textarea
          {...commonProps}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          rows={rows}
          className={`${baseInputClasses} resize-none`}
        />
      );
    }

    if (type === "select") {
      return (
        <select
          {...commonProps}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className={baseInputClasses}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    const inputType = type === "password" && showPassword ? "text" : type;

    return (
      <div className="relative">
        <input
          {...commonProps}
          type={inputType}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          className={`${baseInputClasses} ${showPasswordToggle ? "pr-12" : ""}`}
        />
        {type === "password" && showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white focus:outline-none focus:text-white"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-300 mb-2"
      >
        {label}
        {required && <span className="text-red-400 ml-1" aria-hidden="true">*</span>}
      </label>

      {renderInput()}

      {/* Error message */}
      {hasError && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-sm text-red-400 flex items-center gap-1"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {displayError}
        </p>
      )}

      {/* Help text (only show if no error) */}
      {helpText && !hasError && (
        <p
          id={helpId}
          className="mt-2 text-xs text-gray-500"
        >
          {helpText}
        </p>
      )}
    </div>
  );
};

export default FormField;
