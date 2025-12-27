import React from "react";
import { Genre, Mood, GENRES, MOODS } from "../../types/community";

interface GenreMoodBadgesProps {
  genre: Genre;
  mood: Mood;
  size?: "sm" | "md";
}

const GenreMoodBadges: React.FC<GenreMoodBadgesProps> = ({
  genre,
  mood,
  size = "md",
}) => {
  const genreLabel = GENRES.find((g) => g.value === genre)?.label || genre;
  const moodLabel = MOODS.find((m) => m.value === mood)?.label || mood;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  return (
    <div className="flex flex-wrap gap-2">
      <span
        className={`${sizeClasses[size]} rounded-full bg-indigo-500/20 text-indigo-400 font-medium`}
      >
        {genreLabel}
      </span>
      <span
        className={`${sizeClasses[size]} rounded-full bg-purple-500/20 text-purple-400 font-medium`}
      >
        {moodLabel}
      </span>
    </div>
  );
};

export default GenreMoodBadges;
