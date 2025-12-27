import React, { useState, useRef, useEffect } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { CollabSubmission, SubmissionStatus } from "../../types/community";
import UserAvatar from "./UserAvatar";

interface SubmissionCardProps {
  submission: CollabSubmission;
  isOwner: boolean;
  onStatusChange?: (
    submissionId: string,
    status: SubmissionStatus,
    feedback?: string
  ) => void;
}

const SubmissionCard: React.FC<SubmissionCardProps> = ({
  submission,
  isOwner,
  onStatusChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState(submission.ownerFeedback || "");
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

  const statusColors: Record<SubmissionStatus, string> = {
    pending: "bg-yellow-500/20 text-yellow-400",
    accepted: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
    selected: "bg-indigo-500/20 text-indigo-400",
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePlayPause = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(submission.recordingUrl);
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

  const handleStatusUpdate = (status: SubmissionStatus) => {
    if (onStatusChange) {
      onStatusChange(submission.id, status, feedback || undefined);
      setShowFeedback(false);
    }
  };

  return (
    <Card className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {submission.singer && (
            <>
              <UserAvatar
                src={submission.singer.avatarUrl}
                username={submission.singer.username}
                size="md"
              />
              <div>
                <p className="font-medium text-white">
                  {submission.singer.displayName || submission.singer.username}
                </p>
                <p className="text-xs text-gray-400">
                  @{submission.singer.username}
                </p>
              </div>
            </>
          )}
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[submission.status]}`}
        >
          {submission.status}
        </span>
      </div>

      {/* Part name if applicable */}
      {submission.partName && (
        <p className="text-sm text-gray-400">
          Part: <span className="text-white">{submission.partName}</span>
        </p>
      )}

      {/* Enhanced badge */}
      {submission.isEnhanced && (
        <span className="inline-flex items-center gap-1 text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          AI Enhanced
        </span>
      )}

      {/* Audio player */}
      <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
        <button
          onClick={handlePlayPause}
          className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center hover:bg-indigo-600 transition-colors"
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="flex-1">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full bg-indigo-500 transition-all ${isPlaying ? "animate-pulse" : ""}`}
              style={{ width: isPlaying ? "60%" : "0%" }}
            />
          </div>
        </div>
      </div>

      {/* Feedback */}
      {submission.ownerFeedback && !isOwner && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Feedback from owner:</p>
          <p className="text-sm text-gray-300">{submission.ownerFeedback}</p>
        </div>
      )}

      {/* Owner actions */}
      {isOwner && submission.status === "pending" && (
        <>
          {showFeedback ? (
            <div className="space-y-3">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Add feedback (optional)..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleStatusUpdate("accepted")}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleStatusUpdate("rejected")}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowFeedback(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowFeedback(true)}>
                Review
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleStatusUpdate("selected")}
              >
                Select for Final Mix
              </Button>
            </div>
          )}
        </>
      )}

      {/* Timestamp */}
      <p className="text-xs text-gray-500">{formatDate(submission.createdAt)}</p>
    </Card>
  );
};

export default SubmissionCard;
