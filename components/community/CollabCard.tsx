import React from "react";
import Card from "../ui/Card";
import { KaraokeCollaboration, COLLAB_TYPES } from "../../types/community";
import GenreMoodBadges from "./GenreMoodBadges";
import UserAvatar from "./UserAvatar";

interface CollabCardProps {
  collab: KaraokeCollaboration;
  onClick: () => void;
}

const CollabCard: React.FC<CollabCardProps> = ({ collab, onClick }) => {
  const collabTypeLabel =
    COLLAB_TYPES.find((t) => t.value === collab.collabType)?.label ||
    collab.collabType;

  const statusColors: Record<string, string> = {
    open: "bg-green-500/20 text-green-400",
    in_progress: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-blue-500/20 text-blue-400",
    cancelled: "bg-gray-500/20 text-gray-400",
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getDeadlineInfo = () => {
    if (!collab.deadline) return null;
    const deadline = new Date(collab.deadline);
    const now = new Date();
    const daysLeft = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft < 0) return { text: "Expired", color: "text-red-400" };
    if (daysLeft === 0) return { text: "Today", color: "text-yellow-400" };
    if (daysLeft === 1) return { text: "1 day left", color: "text-yellow-400" };
    if (daysLeft <= 7)
      return { text: `${daysLeft} days left`, color: "text-orange-400" };
    return { text: formatDate(collab.deadline), color: "text-gray-400" };
  };

  const deadlineInfo = getDeadlineInfo();

  return (
    <Card
      className="cursor-pointer hover:border-indigo-500/50 transition-all group"
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
            {collab.title}
          </h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
              statusColors[collab.status]
            }`}
          >
            {collab.status.replace("_", " ")}
          </span>
        </div>

        {/* Description */}
        {collab.description && (
          <p className="text-sm text-gray-400 line-clamp-2">
            {collab.description}
          </p>
        )}

        {/* Badges */}
        <GenreMoodBadges genre={collab.genre} mood={collab.mood} size="sm" />

        {/* Meta info */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{collabTypeLabel}</span>
          {collab.bpm && (
            <span className="text-gray-500">{collab.bpm} BPM</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
          {/* Owner */}
          {collab.owner && (
            <div className="flex items-center gap-2">
              <UserAvatar
                src={collab.owner.avatarUrl}
                username={collab.owner.username}
                size="sm"
              />
              <span className="text-sm text-gray-400">
                {collab.owner.displayName || collab.owner.username}
              </span>
            </div>
          )}

          {/* Deadline or Date */}
          <div className="flex items-center gap-3 text-sm">
            {deadlineInfo ? (
              <span className={deadlineInfo.color}>{deadlineInfo.text}</span>
            ) : (
              <span className="text-gray-500">
                {formatDate(collab.createdAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default CollabCard;
