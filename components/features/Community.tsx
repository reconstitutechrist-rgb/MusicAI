import React, { useState } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";
import AuthModal from "../community/AuthModal";
import AuthPromptBanner from "../community/AuthPromptBanner";
import UserAvatar from "../community/UserAvatar";
import KaraokeCollabSection from "../community/KaraokeCollabSection";
import AIShowcaseSection from "../community/AIShowcaseSection";

type CommunityTab = "karaoke" | "showcase";

const Community: React.FC = () => {
  const { isAuthenticated, profile, signOut, isConfigured } = useAuth();
  const [activeTab, setActiveTab] = useState<CommunityTab>("karaoke");
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">🎵</span>
            Community
          </h2>
          <p className="text-gray-400 mt-1">
            Collaborate with singers or showcase your AI music
          </p>
        </div>

        {/* User info or sign in */}
        {isAuthenticated && profile ? (
          <div className="flex items-center gap-3">
            <UserAvatar
              src={profile.avatarUrl}
              username={profile.username}
              size="md"
            />
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-white">
                {profile.displayName || profile.username}
              </p>
              <button
                onClick={signOut}
                className="text-xs text-gray-400 hover:text-gray-300"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowAuthModal(true)} size="sm">
            Sign In
          </Button>
        )}
      </div>

      {/* Auth prompt for non-authenticated users */}
      {!isAuthenticated && isConfigured && (
        <AuthPromptBanner onSignIn={() => setShowAuthModal(true)} />
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-700 pb-1">
        <button
          onClick={() => setActiveTab("karaoke")}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeTab === "karaoke"
              ? "bg-indigo-500/20 text-indigo-400 border-b-2 border-indigo-500"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
          }`}
        >
          <span className="mr-2">🎤</span>
          Karaoke Collaborations
        </button>
        <button
          onClick={() => setActiveTab("showcase")}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeTab === "showcase"
              ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-500"
              : "text-gray-400 hover:text-gray-300 hover:bg-gray-800/50"
          }`}
        >
          <span className="mr-2">✨</span>
          AI Music Showcase
        </button>
      </div>

      {/* Content */}
      {!isConfigured ? (
        <Card className="text-center py-12">
          <div className="text-6xl mb-4">🔧</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Setup Required
          </h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Community features require Supabase configuration. Add your
            credentials to the environment variables to enable this feature.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 max-w-sm mx-auto font-mono text-sm text-gray-300 text-left">
            <p>VITE_SUPABASE_URL=your-url</p>
            <p>VITE_SUPABASE_ANON_KEY=your-key</p>
          </div>
        </Card>
      ) : activeTab === "karaoke" ? (
        <KaraokeCollabSection
          onAuthRequired={() => setShowAuthModal(true)}
        />
      ) : (
        <AIShowcaseSection
          onAuthRequired={() => setShowAuthModal(true)}
        />
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default Community;
