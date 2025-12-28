import React, { useState, useId } from "react";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import { useModal } from "../../hooks/useModal";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = "signin" | "signup";

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signIn, signUp, isConfigured } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Generate unique IDs for form fields
  const formId = useId();
  const usernameId = `${formId}-username`;
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const passwordHintId = `${formId}-password-hint`;
  const errorId = `${formId}-error`;

  // Use modal accessibility hook
  const { modalRef, overlayProps, contentProps, closeButtonProps, titleProps } = useModal({
    isOpen,
    onClose,
    descriptionId: error ? errorId : undefined,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === "signin") {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error);
        } else {
          onClose();
        }
      } else {
        if (!username.trim()) {
          setError("Username is required");
          setIsLoading(false);
          return;
        }
        if (username.length < 3) {
          setError("Username must be at least 3 characters");
          setIsLoading(false);
          return;
        }
        const result = await signUp(email, password, username);
        if (result.error) {
          setError(result.error);
        } else {
          setSuccess(true);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
    setSuccess(false);
  };

  if (!isConfigured) {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        {...overlayProps}
      >
        <div
          ref={modalRef as React.RefObject<HTMLDivElement>}
          {...contentProps}
          className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700"
        >
          <h2 {...titleProps} className="text-2xl font-bold text-white mb-4">
            Community Features Unavailable
          </h2>
          <p className="text-gray-400 mb-6">
            Supabase is not configured. To enable community features, please add
            your Supabase credentials to the environment variables:
          </p>
          <div className="bg-gray-900 rounded-lg p-4 mb-6 font-mono text-sm text-gray-300">
            <p>VITE_SUPABASE_URL=your-url</p>
            <p>VITE_SUPABASE_ANON_KEY=your-key</p>
          </div>
          <Button {...closeButtonProps} variant="secondary" className="w-full">
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
        {...overlayProps}
      >
        <div
          ref={modalRef as React.RefObject<HTMLDivElement>}
          {...contentProps}
          className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700"
        >
          <div className="text-center">
            <div className="text-5xl mb-4" role="img" aria-label="Email icon">✉️</div>
            <h2 {...titleProps} className="text-2xl font-bold text-white mb-4">
              Check Your Email
            </h2>
            <p className="text-gray-400 mb-6">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>.
              Please check your email to complete your registration.
            </p>
            <Button onClick={onClose} className="w-full">
              Got it
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      {...overlayProps}
    >
      <div
        ref={modalRef as React.RefObject<HTMLDivElement>}
        {...contentProps}
        className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 {...titleProps} className="text-2xl font-bold text-white">
            {mode === "signin" ? "Welcome Back" : "Join the Community"}
          </h2>
          <button
            {...closeButtonProps}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label
                htmlFor={usernameId}
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Username
              </label>
              <input
                id={usernameId}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Choose a unique username"
                required={mode === "signup"}
                autoComplete="username"
              />
            </div>
          )}

          <div>
            <label
              htmlFor={emailId}
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Email
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label
              htmlFor={passwordId}
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-700/50 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
              required
              minLength={6}
              aria-describedby={mode === "signup" ? passwordHintId : undefined}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {mode === "signup" && (
              <p id={passwordHintId} className="mt-1 text-xs text-gray-500">
                Password must be at least 6 characters
              </p>
            )}
          </div>

          {error && (
            <div
              id={errorId}
              role="alert"
              aria-live="assertive"
              className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
            >
              {error}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full">
            {mode === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {/* Switch mode */}
        <div className="mt-6 text-center">
          <p className="text-gray-400">
            {mode === "signin"
              ? "Don't have an account?"
              : "Already have an account?"}
            <button
              type="button"
              onClick={switchMode}
              className="ml-2 text-indigo-400 hover:text-indigo-300 font-medium focus:outline-none focus:underline"
            >
              {mode === "signin" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
