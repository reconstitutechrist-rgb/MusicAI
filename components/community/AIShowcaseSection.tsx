import React, { useState, useEffect, useCallback } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import { AIShowcase, CommunityFilters } from "../../types/community";
import { getShowcases } from "../../services/communityService";
import ShowcaseCard from "./ShowcaseCard";
import CollabFilters from "./CollabFilters";
import GenreMoodBadges from "./GenreMoodBadges";
import UserAvatar from "./UserAvatar";
import CreateShowcaseModal from "./CreateShowcaseModal";
import LikeButton from "./LikeButton";
import CommentSection from "./CommentSection";

interface AIShowcaseSectionProps {
  onAuthRequired: () => void;
}

const AIShowcaseSection: React.FC<AIShowcaseSectionProps> = ({
  onAuthRequired,
}) => {
  const { isAuthenticated } = useAuth();
  const [showcases, setShowcases] = useState<AIShowcase[]>([]);
  const [filters, setFilters] = useState<CommunityFilters>({
    sortBy: "newest",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShowcase, setSelectedShowcase] = useState<AIShowcase | null>(
    null
  );
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadShowcases = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getShowcases(filters);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setShowcases(result.data);
    }

    setIsLoading(false);
  }, [filters]);

  useEffect(() => {
    loadShowcases();
  }, [loadShowcases]);

  const handleUploadClick = () => {
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }
    setShowUploadModal(true);
  };

  const handleShowcaseClick = (showcase: AIShowcase) => {
    setSelectedShowcase(showcase);
  };

  const handleBackToList = () => {
    setSelectedShowcase(null);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Detail view for a selected showcase
  if (selectedShowcase) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Showcase
        </button>

        <Card className="p-6">
          <div className="space-y-6">
            {/* Cover and title */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* Cover image */}
              <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex-shrink-0">
                {selectedShowcase.coverImageUrl ? (
                  <img
                    src={selectedShowcase.coverImageUrl}
                    alt={selectedShowcase.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl">🎵</span>
                  </div>
                )}
              </div>

              {/* Title and creator */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {selectedShowcase.title}
                </h2>
                {selectedShowcase.creator && (
                  <div className="flex items-center gap-3 mb-4">
                    <UserAvatar
                      src={selectedShowcase.creator.avatarUrl}
                      username={selectedShowcase.creator.username}
                      size="md"
                    />
                    <div>
                      <p className="text-white font-medium">
                        {selectedShowcase.creator.displayName ||
                          selectedShowcase.creator.username}
                      </p>
                      <p className="text-sm text-gray-400">
                        @{selectedShowcase.creator.username}
                      </p>
                    </div>
                  </div>
                )}
                <GenreMoodBadges
                  genre={selectedShowcase.genre}
                  mood={selectedShowcase.mood}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-gray-400">
              <span className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                </svg>
                {selectedShowcase.playCount} plays
              </span>
              <span className="flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                {selectedShowcase.likeCount} likes
              </span>
              <span>{formatDuration(selectedShowcase.duration)}</span>
            </div>

            {/* Description */}
            {selectedShowcase.description && (
              <p className="text-gray-300">{selectedShowcase.description}</p>
            )}

            {/* Song details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedShowcase.bpm && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">BPM</p>
                  <p className="text-lg font-semibold text-white">
                    {selectedShowcase.bpm}
                  </p>
                </div>
              )}
              {selectedShowcase.songKey && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Key</p>
                  <p className="text-lg font-semibold text-white">
                    {selectedShowcase.songKey}
                  </p>
                </div>
              )}
              {selectedShowcase.styleDescription && (
                <div className="bg-gray-800/50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-500">Style</p>
                  <p className="text-sm text-white">
                    {selectedShowcase.styleDescription}
                  </p>
                </div>
              )}
            </div>

            {/* Lyrics */}
            {selectedShowcase.lyrics && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Lyrics
                </h3>
                <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm max-h-48 overflow-y-auto">
                  {selectedShowcase.lyrics}
                </pre>
              </div>
            )}

            {/* Audio player */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Listen
              </h3>
              <audio
                src={selectedShowcase.audioUrl}
                controls
                className="w-full"
              />
            </div>

            {/* Like button */}
            <div className="flex gap-3">
              <LikeButton
                targetType="ai_showcase"
                targetId={selectedShowcase.id}
                initialLiked={selectedShowcase.isLikedByUser}
                likeCount={selectedShowcase.likeCount}
                onAuthRequired={onAuthRequired}
              />
            </div>

            {/* Comments */}
            <CommentSection
              targetType="ai_showcase"
              targetId={selectedShowcase.id}
              onAuthRequired={onAuthRequired}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with upload button */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400">
          Discover AI-generated music from the community
        </p>
        <Button onClick={handleUploadClick}>
          <span className="mr-2">+</span>
          Share Your Music
        </Button>
      </div>

      {/* Filters - without status */}
      <CollabFilters
        filters={filters}
        onFilterChange={setFilters}
        showStatus={false}
      />

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-32 bg-gray-700 rounded -mx-4 -mt-4 mb-3"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-700 rounded w-16"></div>
                <div className="h-6 bg-gray-700 rounded w-20"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="text-center py-12">
          <div className="text-5xl mb-4">😕</div>
          <h3 className="text-lg font-medium text-white mb-2">
            Failed to load showcase
          </h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={loadShowcases} variant="secondary">
            Try Again
          </Button>
        </Card>
      ) : showcases.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-5xl mb-4">✨</div>
          <h3 className="text-lg font-medium text-white mb-2">
            No tracks yet
          </h3>
          <p className="text-gray-400 mb-4">
            {filters.search
              ? "Try adjusting your search or filters"
              : "Be the first to share your AI-generated music!"}
          </p>
          <Button onClick={handleUploadClick}>Share Your Music</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {showcases.map((showcase) => (
            <ShowcaseCard
              key={showcase.id}
              showcase={showcase}
              onClick={() => handleShowcaseClick(showcase)}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <CreateShowcaseModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          loadShowcases();
        }}
      />
    </div>
  );
};

export default AIShowcaseSection;
