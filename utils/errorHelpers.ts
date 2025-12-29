/**
 * Error Helper Utilities
 * Provides consistent, user-friendly error messages with actionable guidance
 */

export interface ErrorInfo {
  title: string;
  message: string;
  suggestion?: string;
  canRetry: boolean;
  retryDelay?: number; // milliseconds to wait before retry
}

/**
 * Categorizes an error and returns user-friendly information
 */
export function getErrorInfo(error: unknown, context?: string): ErrorInfo {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  // Network errors
  if (
    lowerMessage.includes("network") ||
    lowerMessage.includes("fetch") ||
    lowerMessage.includes("connection") ||
    lowerMessage.includes("offline") ||
    lowerMessage.includes("failed to fetch")
  ) {
    return {
      title: "Connection Error",
      message: "Unable to connect to the server. Please check your internet connection.",
      suggestion: "Try refreshing the page or check if you're online.",
      canRetry: true,
      retryDelay: 2000,
    };
  }

  // Timeout errors
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("took too long")
  ) {
    return {
      title: "Request Timeout",
      message: "The operation took too long to complete.",
      suggestion: "Try again with a simpler request or shorter content.",
      canRetry: true,
      retryDelay: 1000,
    };
  }

  // Rate limiting
  if (
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many requests") ||
    lowerMessage.includes("429")
  ) {
    return {
      title: "Too Many Requests",
      message: "You've made too many requests. Please wait a moment.",
      suggestion: "Wait 30 seconds before trying again.",
      canRetry: true,
      retryDelay: 30000,
    };
  }

  // Authentication errors
  if (
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("401") ||
    lowerMessage.includes("api key") ||
    lowerMessage.includes("authentication")
  ) {
    return {
      title: "Authentication Error",
      message: "There's an issue with the service credentials.",
      suggestion: "Check your API key configuration in settings.",
      canRetry: false,
    };
  }

  // Server errors
  if (
    lowerMessage.includes("500") ||
    lowerMessage.includes("502") ||
    lowerMessage.includes("503") ||
    lowerMessage.includes("504") ||
    lowerMessage.includes("server error") ||
    lowerMessage.includes("internal error")
  ) {
    return {
      title: "Server Error",
      message: "The AI service is temporarily unavailable.",
      suggestion: "Please try again in a few moments.",
      canRetry: true,
      retryDelay: 5000,
    };
  }

  // File size errors
  if (
    lowerMessage.includes("file size") ||
    lowerMessage.includes("too large") ||
    lowerMessage.includes("413") ||
    lowerMessage.includes("payload")
  ) {
    return {
      title: "File Too Large",
      message: "The file exceeds the maximum allowed size.",
      suggestion: "Try compressing the file or using a smaller one (max 50MB).",
      canRetry: false,
    };
  }

  // File format errors
  if (
    lowerMessage.includes("format") ||
    lowerMessage.includes("unsupported") ||
    lowerMessage.includes("invalid file") ||
    lowerMessage.includes("file type")
  ) {
    return {
      title: "Unsupported Format",
      message: "The file format is not supported.",
      suggestion: "Try converting to MP3, WAV, or a common audio format.",
      canRetry: false,
    };
  }

  // Quota/limit errors
  if (
    lowerMessage.includes("quota") ||
    lowerMessage.includes("limit exceeded") ||
    lowerMessage.includes("credits")
  ) {
    return {
      title: "Limit Reached",
      message: "You've reached your usage limit.",
      suggestion: "Check your account limits or upgrade your plan.",
      canRetry: false,
    };
  }

  // Content moderation
  if (
    lowerMessage.includes("content policy") ||
    lowerMessage.includes("moderation") ||
    lowerMessage.includes("inappropriate")
  ) {
    return {
      title: "Content Not Allowed",
      message: "The content doesn't meet our guidelines.",
      suggestion: "Try rephrasing your request with different content.",
      canRetry: false,
    };
  }

  // Audio processing errors
  if (
    lowerMessage.includes("audio") ||
    lowerMessage.includes("decode") ||
    lowerMessage.includes("playback")
  ) {
    return {
      title: "Audio Processing Error",
      message: `Failed to process audio${context ? ` for ${context}` : ""}.`,
      suggestion: "Try a different audio file or format.",
      canRetry: true,
      retryDelay: 1000,
    };
  }

  // Generation errors
  if (
    lowerMessage.includes("generate") ||
    lowerMessage.includes("generation") ||
    lowerMessage.includes("create")
  ) {
    return {
      title: "Generation Failed",
      message: `Failed to generate ${context || "content"}.`,
      suggestion: "Try adjusting your parameters or simplifying your request.",
      canRetry: true,
      retryDelay: 2000,
    };
  }

  // Default fallback
  return {
    title: "Something Went Wrong",
    message: context ? `Failed to ${context}.` : "An unexpected error occurred.",
    suggestion: "Please try again. If the problem persists, refresh the page.",
    canRetry: true,
    retryDelay: 2000,
  };
}

/**
 * Formats an error for display in a toast or alert
 */
export function formatErrorForToast(error: unknown, context?: string): {
  title: string;
  message: string;
} {
  const info = getErrorInfo(error, context);
  return {
    title: info.title,
    message: info.suggestion ? `${info.message} ${info.suggestion}` : info.message,
  };
}

/**
 * Creates a retry handler with exponential backoff
 */
export function createRetryHandler<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): () => Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, onRetry } = options;

  return async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          onRetry?.(attempt + 1, error);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  };
}

/**
 * Context-specific error messages for common operations
 */
export const ErrorContexts = {
  // Audio operations
  VOCAL_GENERATION: "generate vocal track",
  INSTRUMENTAL_GENERATION: "generate instrumental",
  AUDIO_UPLOAD: "upload audio file",
  AUDIO_ANALYSIS: "analyze audio",
  AUDIO_EXPORT: "export audio",
  STEM_SEPARATION: "separate audio stems",

  // Video operations
  VIDEO_GENERATION: "generate video",
  VIDEO_EXPORT: "export video",
  IMAGE_GENERATION: "generate image",
  IMAGE_UPLOAD: "upload image",

  // Content operations
  LYRICS_GENERATION: "generate lyrics",
  LYRICS_ANALYSIS: "analyze lyrics",
  MARKETING_GENERATION: "generate marketing content",

  // General
  SAVE_SESSION: "save your session",
  LOAD_SESSION: "load your session",
  API_REQUEST: "complete the request",
} as const;

export type ErrorContext = typeof ErrorContexts[keyof typeof ErrorContexts];
