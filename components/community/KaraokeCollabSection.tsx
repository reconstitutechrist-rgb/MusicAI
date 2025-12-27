import React, { useState, useEffect, useCallback } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import {
  KaraokeCollaboration,
  CommunityFilters,
} from "../../types/community";
import { getCollaborations } from "../../services/communityService";
import CollabCard from "./CollabCard";
import CollabFilters from "./CollabFilters";
import CreateCollabModal from "./CreateCollabModal";
import CommentSection from "./CommentSection";
import GenreMoodBadges from "./GenreMoodBadges";
import AuditionRecorder from "./AuditionRecorder";

interface KaraokeCollabSectionProps {
  onAuthRequired: () => void;
}

const KaraokeCollabSection: React.FC<KaraokeCollabSectionProps> = ({
  onAuthRequired,
}) => {
  const { isAuthenticated, user } = useAuth();
  const [collaborations, setCollaborations] = useState<KaraokeCollaboration[]>(
    []
  );
  const [filters, setFilters] = useState<CommunityFilters>({
    status: "open",
    sortBy: "newest",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCollab, setSelectedCollab] =
    useState<KaraokeCollaboration | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuditionRecorder, setShowAuditionRecorder] = useState(false);

  const loadCollaborations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getCollaborations(filters);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setCollaborations(result.data);
    }

    setIsLoading(false);
  }, [filters]);

  useEffect(() => {
    loadCollaborations();
  }, [loadCollaborations]);

  const handleCreateClick = () => {
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }
    setShowCreateModal(true);
  };

  const handleCollabClick = (collab: KaraokeCollaboration) => {
    setSelectedCollab(collab);
  };

  const handleBackToList = () => {
    setSelectedCollab(null);
  };

  // Detail view for a selected collaboration
  if (selectedCollab) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBackToList}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Collaborations
        </button>

        <Card className="p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {selectedCollab.title}
                </h2>
                {selectedCollab.owner && (
                  <p className="text-gray-400 mt-1">
                    by {selectedCollab.owner.displayName || selectedCollab.owner.username}
                  </p>
                )}
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCollab.status === "open"
                    ? "bg-green-500/20 text-green-400"
                    : selectedCollab.status === "in_progress"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {selectedCollab.status.replace("_", " ")}
              </span>
            </div>

            {/* Description */}
            {selectedCollab.description && (
              <p className="text-gray-300">{selectedCollab.description}</p>
            )}

            {/* Song details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedCollab.bpm && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">BPM</p>
                  <p className="text-lg font-semibold text-white">
                    {selectedCollab.bpm}
                  </p>
                </div>
              )}
              {selectedCollab.songKey && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Key</p>
                  <p className="text-lg font-semibold text-white">
                    {selectedCollab.songKey}
                  </p>
                </div>
              )}
              {selectedCollab.duration && (
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-lg font-semibold text-white">
                    {Math.floor(selectedCollab.duration / 60)}:
                    {(selectedCollab.duration % 60).toString().padStart(2, "0")}
                  </p>
                </div>
              )}
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Type</p>
                <p className="text-lg font-semibold text-white capitalize">
                  {selectedCollab.collabType.replace("_", " ")}
                </p>
              </div>
            </div>

            {/* Lyrics */}
            {selectedCollab.lyrics && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Lyrics</h3>
                <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm max-h-48 overflow-y-auto">
                  {selectedCollab.lyrics}
                </pre>
              </div>
            )}

            {/* Audio player */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Instrumental Track
              </h3>
              <audio
                src={selectedCollab.instrumentalUrl}
                controls
                className="w-full"
              />
            </div>

            {/* Genre/Mood badges */}
            <GenreMoodBadges genre={selectedCollab.genre} mood={selectedCollab.mood} />

            {/* Action buttons */}
            {selectedCollab.status === "open" && (
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (!isAuthenticated) {
                      onAuthRequired();
                      return;
                    }
                    setShowAuditionRecorder(true);
                  }}
                >
                  Submit Audition
                </Button>
              </div>
            )}

            {/* Audition Recorder Modal */}
            {showAuditionRecorder && user && (
              <AuditionRecorder
                collaboration={selectedCollab}
                userId={user.id}
                onClose={() => setShowAuditionRecorder(false)}
                onSuccess={() => {
                  setShowAuditionRecorder(false);
                  // Optionally refresh the collaboration to show the new submission
                  loadCollaborations();
                }}
              />
            )}

            {/* Comments */}
            <CommentSection
              targetType="karaoke_collaboration"
              targetId={selectedCollab.id}
              onAuthRequired={onAuthRequired}
            />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400">
          Find collaborations or post your own karaoke tracks
        </p>
        <Button onClick={handleCreateClick}>
          <span className="mr-2">+</span>
          Post Collaboration
        </Button>
      </div>

      {/* Filters */}
      <CollabFilters
        filters={filters}
        onFilterChange={setFilters}
        showStatus={true}
      />

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-3"></div>
              <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-2/3 mb-4"></div>
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
            Failed to load collaborations
          </h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={loadCollaborations} variant="secondary">
            Try Again
          </Button>
        </Card>
      ) : collaborations.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-5xl mb-4">🎤</div>
          <h3 className="text-lg font-medium text-white mb-2">
            No collaborations found
          </h3>
          <p className="text-gray-400 mb-4">
            {filters.search
              ? "Try adjusting your search or filters"
              : "Be the first to post a collaboration!"}
          </p>
          <Button onClick={handleCreateClick}>Post Collaboration</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collaborations.map((collab) => (
            <CollabCard
              key={collab.id}
              collab={collab}
              onClick={() => handleCollabClick(collab)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateCollabModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          loadCollaborations();
        }}
      />
    </div>
  );
};

export default KaraokeCollabSection;
