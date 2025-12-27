import React, { useState, useRef, useEffect } from "react";
import Card from "../ui/Card";
import { AIShowcase } from "../../types/community";
import GenreMoodBadges from "./GenreMoodBadges";
import UserAvatar from "./UserAvatar";

interface ShowcaseCardProps {
  showcase: AIShowcase;
  onClick: () => void;
}

const ShowcaseCard: React.FC<ShowcaseCardProps> = ({ showcase, onClick }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) {
      audioRef.current = new Audio(showcase.audioUrl);
      audioRef.current.addEventListener("ended", () => setIsPlaying(false));
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <Card
      className="cursor-pointer hover:border-purple-500/50 transition-all group overflow-hidden"
      onClick={onClick}
    >
      {/* Cover Image */}
      <div className="relative -mx-4 -mt-4 mb-3 h-32 bg-gradient-to-br from-purple-500/20 to-indigo-500/20">
        {showcase.coverImageUrl ? (
          <img
            src={showcase.coverImageUrl}
            alt={showcase.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl">🎵</span>
          </div>
        )}

        {/* Play button overlay */}
        <button
          onClick={handlePlayPause}
          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
            {isPlaying ? (
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-white ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </button>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-xs text-white">
          {formatDuration(showcase.duration)}
        </div>
      </div>

      <div className="space-y-3">
        {/* Title */}
        <h3 className="text-lg font-semibold text-white group-hover:text-purple-400 transition-colors line-clamp-1">
          {showcase.title}
        </h3>

        {/* Description */}
        {showcase.description && (
          <p className="text-sm text-gray-400 line-clamp-2">
            {showcase.description}
          </p>
        )}

        {/* Badges */}
        <GenreMoodBadges genre={showcase.genre} mood={showcase.mood} size="sm" />

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            {showcase.playCount}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            {showcase.likeCount}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
          {/* Creator */}
          {showcase.creator && (
            <div className="flex items-center gap-2">
              <UserAvatar
                src={showcase.creator.avatarUrl}
                username={showcase.creator.username}
                size="sm"
              />
              <span className="text-sm text-gray-400">
                {showcase.creator.displayName || showcase.creator.username}
              </span>
            </div>
          )}

          {/* Date */}
          <span className="text-sm text-gray-500">
            {formatDate(showcase.createdAt)}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default ShowcaseCard;
