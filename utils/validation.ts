/**
 * Form Validation Utilities
 * Provides reusable validation functions with consistent error messages
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) {
    return { isValid: false, error: "Email is required" };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: "Please enter a valid email address" };
  }
  return { isValid: true };
}

// Password validation with strength assessment
export interface PasswordStrength {
  score: number; // 0-4
  label: "Weak" | "Fair" | "Good" | "Strong" | "Very Strong";
  suggestions: string[];
}

export function validatePassword(password: string, minLength = 6): ValidationResult {
  if (!password) {
    return { isValid: false, error: "Password is required" };
  }
  if (password.length < minLength) {
    return { isValid: false, error: `Password must be at least ${minLength} characters` };
  }
  return { isValid: true };
}

export function getPasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else suggestions.push("Use at least 8 characters");

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push("Mix uppercase and lowercase letters");

  if (/\d/.test(password)) score++;
  else suggestions.push("Add numbers");

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else suggestions.push("Add special characters (!@#$%^&*)");

  const labels: PasswordStrength["label"][] = ["Weak", "Fair", "Good", "Strong", "Very Strong"];

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    suggestions,
  };
}

// Username validation
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export function validateUsername(username: string, minLength = 3, maxLength = 30): ValidationResult {
  if (!username.trim()) {
    return { isValid: false, error: "Username is required" };
  }
  if (username.length < minLength) {
    return { isValid: false, error: `Username must be at least ${minLength} characters` };
  }
  if (username.length > maxLength) {
    return { isValid: false, error: `Username must be less than ${maxLength} characters` };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { isValid: false, error: "Username can only contain letters, numbers, underscores, and hyphens" };
  }
  return { isValid: true };
}

// BPM validation
export function validateBpm(bpm: number | string | undefined, min = 60, max = 200): ValidationResult {
  if (bpm === undefined || bpm === "") {
    return { isValid: true }; // BPM is optional
  }

  const numBpm = typeof bpm === "string" ? parseInt(bpm, 10) : bpm;

  if (isNaN(numBpm)) {
    return { isValid: false, error: "BPM must be a number" };
  }
  if (numBpm < min || numBpm > max) {
    return { isValid: false, error: `BPM must be between ${min} and ${max}` };
  }
  return { isValid: true };
}

// Required field validation
export function validateRequired(value: string, fieldName = "This field"): ValidationResult {
  if (!value.trim()) {
    return { isValid: false, error: `${fieldName} is required` };
  }
  return { isValid: true };
}

// Min length validation
export function validateMinLength(value: string, minLength: number, fieldName = "This field"): ValidationResult {
  if (value.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  return { isValid: true };
}

// Max length validation
export function validateMaxLength(value: string, maxLength: number, fieldName = "This field"): ValidationResult {
  if (value.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }
  return { isValid: true };
}

// URL validation
const URL_REGEX = /^https?:\/\/.+/;

export function validateUrl(url: string, required = false): ValidationResult {
  if (!url.trim()) {
    if (required) {
      return { isValid: false, error: "URL is required" };
    }
    return { isValid: true };
  }
  if (!URL_REGEX.test(url)) {
    return { isValid: false, error: "Please enter a valid URL starting with http:// or https://" };
  }
  return { isValid: true };
}

// File validation
export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  required?: boolean;
}

export function validateFile(file: File | null, options: FileValidationOptions = {}): ValidationResult {
  const { maxSizeMB = 50, allowedTypes, required = false } = options;

  if (!file) {
    if (required) {
      return { isValid: false, error: "File is required" };
    }
    return { isValid: true };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { isValid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }

  if (allowedTypes && allowedTypes.length > 0) {
    const isAllowedType = allowedTypes.some((type) => {
      if (type.endsWith("/*")) {
        // Match category (e.g., "audio/*")
        const category = type.replace("/*", "");
        return file.type.startsWith(category + "/");
      }
      return file.type === type;
    });

    if (!isAllowedType) {
      return { isValid: false, error: `File type not allowed. Accepted types: ${allowedTypes.join(", ")}` };
    }
  }

  return { isValid: true };
}

// Compose multiple validators
export function composeValidators(
  value: string,
  validators: Array<(value: string) => ValidationResult>
): ValidationResult {
  for (const validator of validators) {
    const result = validator(value);
    if (!result.isValid) {
      return result;
    }
  }
  return { isValid: true };
}

// Hook helper for form field state
export interface FieldState {
  value: string;
  error: string | null;
  touched: boolean;
  isValid: boolean;
}

export function createFieldState(initialValue = ""): FieldState {
  return {
    value: initialValue,
    error: null,
    touched: false,
    isValid: true,
  };
}

export function validateField(
  value: string,
  validator: (value: string) => ValidationResult,
  touched = true
): Partial<FieldState> {
  const result = validator(value);
  return {
    value,
    error: touched && !result.isValid ? result.error : null,
    touched,
    isValid: result.isValid,
  };
}
