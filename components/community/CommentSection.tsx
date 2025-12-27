import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { Comment } from "../../types/community";
import { getComments, addComment, deleteComment } from "../../services/communityService";
import UserAvatar from "./UserAvatar";

interface CommentSectionProps {
  targetType: "ai_showcase" | "completed_collab" | "karaoke_collaboration";
  targetId: string;
  onAuthRequired: () => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  targetType,
  targetId,
  onAuthRequired,
}) => {
  const { isAuthenticated, user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    const result = await getComments(targetType, targetId);
    if (result.data) {
      setComments(result.data);
    }
    setIsLoading(false);
  }, [targetType, targetId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !user) {
      onAuthRequired();
      return;
    }

    if (!newComment.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const result = await addComment(user.id, targetType, targetId, newComment.trim());

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      // Add the new comment with user profile
      setComments((prev) => [
        ...prev,
        {
          ...result.data!,
          user: profile || undefined,
        },
      ]);
      setNewComment("");
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const result = await deleteComment(commentId);
    if (!result.error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">
        Comments ({comments.length})
      </h3>

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-shrink-0">
          {isAuthenticated && profile ? (
            <UserAvatar
              src={profile.avatarUrl}
              username={profile.username}
              size="sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-700" />
          )}
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={
              isAuthenticated ? "Add a comment..." : "Sign in to comment"
            }
            disabled={!isAuthenticated || isSubmitting}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
        </div>
        {isAuthenticated && newComment.trim() && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "..." : "Post"}
          </button>
        )}
      </form>

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-700" />
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-24 mb-2" />
                <div className="h-3 bg-gray-700 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 group">
              <UserAvatar
                src={comment.user?.avatarUrl}
                username={comment.user?.username || "?"}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">
                    {comment.user?.displayName || comment.user?.username || "Anonymous"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(comment.createdAt)}
                  </span>
                  {user?.id === comment.userId && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-gray-300 text-sm mt-0.5 break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
