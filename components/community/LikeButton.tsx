import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { toggleLike } from "../../services/communityService";

interface LikeButtonProps {
  targetType: "ai_showcase" | "completed_collab";
  targetId: string;
  initialLiked?: boolean;
  likeCount: number;
  onAuthRequired: () => void;
  size?: "sm" | "md";
}

const LikeButton: React.FC<LikeButtonProps> = ({
  targetType,
  targetId,
  initialLiked = false,
  likeCount,
  onAuthRequired,
  size = "md",
}) => {
  const { isAuthenticated, user } = useAuth();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [count, setCount] = useState(likeCount);
  const [isLoading, setIsLoading] = useState(false);

  // Sync with props when they change (e.g., when parent refetches data)
  useEffect(() => {
    setIsLiked(initialLiked);
    setCount(likeCount);
  }, [initialLiked, likeCount]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated || !user) {
      onAuthRequired();
      return;
    }

    setIsLoading(true);

    const result = await toggleLike(user.id, targetType, targetId);

    if (!result.error) {
      setIsLiked(result.liked);
      setCount((prev) => (result.liked ? prev + 1 : prev - 1));
    }

    setIsLoading(false);
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-sm gap-1",
    md: "px-3 py-1.5 text-base gap-2",
  };

  const iconSize = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`flex items-center rounded-full transition-all ${sizeClasses[size]} ${
        isLiked
          ? "bg-pink-500/20 text-pink-400 hover:bg-pink-500/30"
          : "bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
      aria-label={isLiked ? "Unlike" : "Like"}
    >
      <svg
        className={`${iconSize[size]} transition-transform ${isLiked ? "scale-110" : ""}`}
        fill={isLiked ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span>{count}</span>
    </button>
  );
};

export default LikeButton;
