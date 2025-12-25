/**
 * Environment Variable Validation Utility
 * Provides type-safe validation for required environment variables
 */

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Required environment variables for core functionality
 */
const REQUIRED_ENV_VARS = ["VITE_GEMINI_API_KEY"] as const;

/**
 * Optional environment variables that enhance functionality
 */
const OPTIONAL_ENV_VARS = ["VITE_ELEVENLABS_API_KEY"] as const;

/**
 * Validate all required environment variables
 * Call this early in the app initialization to catch missing config
 */
export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || typeof value !== "string" || value.trim() === "") {
      missing.push(varName);
    }
  }

  // Check optional variables and warn if missing
  for (const varName of OPTIONAL_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || typeof value !== "string" || value.trim() === "") {
      warnings.push(
        `${varName} is not configured. Some features may be unavailable.`,
      );
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get a required environment variable with validation
 * Throws if the variable is not set
 */
export function getRequiredEnv(varName: string): string {
  const value = import.meta.env[varName];
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Required environment variable ${varName} is not configured. ` +
        `Please add it to your .env file.`,
    );
  }
  return value;
}

/**
 * Get an optional environment variable
 * Returns undefined if not set, does not throw
 */
export function getOptionalEnv(varName: string): string | undefined {
  const value = import.meta.env[varName];
  if (!value || typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  return value;
}

/**
 * Check if a specific feature is available based on its env var
 */
export function isFeatureAvailable(featureEnvVar: string): boolean {
  const value = import.meta.env[featureEnvVar];
  return !!value && typeof value === "string" && value.trim() !== "";
}

/**
 * Log validation results to console (for development)
 */
export function logValidationResults(result: EnvValidationResult): void {
  if (!result.isValid) {
    console.error(
      "❌ Missing required environment variables:",
      result.missing.join(", "),
    );
    console.error(
      "Please create a .env file with the required variables. " +
        "See .env.example for reference.",
    );
  }

  if (result.warnings.length > 0) {
    console.warn("⚠️ Environment warnings:");
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
  }

  if (result.isValid && result.warnings.length === 0) {
    console.log("✓ All environment variables configured correctly");
  }
}
