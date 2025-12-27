import React from "react";
import Button from "../ui/Button";

interface AuthPromptBannerProps {
  onSignIn: () => void;
  message?: string;
}

const AuthPromptBanner: React.FC<AuthPromptBannerProps> = ({
  onSignIn,
  message = "Sign in to participate in collaborations and share your music",
}) => {
  return (
    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/20">
          <svg
            className="w-5 h-5 text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <p className="text-gray-300 text-sm">{message}</p>
      </div>
      <Button onClick={onSignIn} size="sm">
        Sign In
      </Button>
    </div>
  );
};

export default AuthPromptBanner;
