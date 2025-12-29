import React, { useState, useId, useMemo } from "react";
import Button from "../ui/Button";
import FormField from "../ui/FormField";
import { useAuth } from "../../context/AuthContext";
import { useModal } from "../../hooks/useModal";
import {
  validateEmail,
  validatePassword,
  validateUsername,
  getPasswordStrength,
} from "../../utils/validation";

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
  const errorId = `${formId}-error`;

  // Password strength for signup
  const passwordStrength = useMemo(() => {
    if (mode !== "signup" || !password) return null;
    return getPasswordStrength(password);
  }, [password, mode]);

  const strengthColors = {
    Weak: "bg-red-500",
    Fair: "bg-orange-500",
    Good: "bg-yellow-500",
    Strong: "bg-green-500",
    "Very Strong": "bg-emerald-500",
  };

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
            <FormField
              label="Username"
              type="text"
              value={username}
              onChange={setUsername}
              placeholder="Choose a unique username"
              required
              validator={(v) => validateUsername(v)}
              validateOnBlur
              autoComplete="username"
            />
          )}

          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="your@email.com"
            required
            validator={(v) => validateEmail(v)}
            validateOnBlur
            autoComplete="email"
          />

          <div>
            <FormField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              required
              validator={(v) => validatePassword(v, 6)}
              validateOnBlur
              showPasswordToggle
              helpText={mode === "signup" ? "Password must be at least 6 characters" : undefined}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />

            {/* Password Strength Meter */}
            {mode === "signup" && passwordStrength && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strengthColors[passwordStrength.label]}`}
                      style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    passwordStrength.score >= 3 ? "text-green-400" :
                    passwordStrength.score >= 2 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                {passwordStrength.suggestions.length > 0 && passwordStrength.score < 3 && (
                  <p className="text-xs text-gray-500">
                    Tip: {passwordStrength.suggestions[0]}
                  </p>
                )}
              </div>
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
