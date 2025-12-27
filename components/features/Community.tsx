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

// Mock data for demo mode
const MOCK_SHOWCASES = [
  {
    id: "demo-1",
    title: "Midnight Dreams",
    description: "A chill lo-fi beat with dreamy synths",
    genre: "Lo-Fi",
    mood: "Chill",
    creator: { username: "demo_producer", displayName: "Demo Producer" },
    playCount: 1234,
    likeCount: 89,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "Electric Pulse",
    description: "High-energy EDM track with heavy bass drops",
    genre: "Electronic",
    mood: "Energetic",
    creator: { username: "ai_composer", displayName: "AI Composer" },
    playCount: 567,
    likeCount: 45,
    createdAt: new Date().toISOString(),
  },
];

const MOCK_COLLABS = [
  {
    id: "collab-1",
    title: "Summer Vibes Duet",
    description: "Looking for a vocalist to add harmonies to this upbeat summer track",
    genre: "Pop",
    mood: "Happy",
    status: "open",
    owner: { username: "beat_maker", displayName: "Beat Maker" },
    partsNeeded: ["Harmony", "Ad-libs"],
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: "collab-2",
    title: "Acoustic Cover Project",
    description: "Need guitar and vocals for an acoustic cover",
    genre: "Acoustic",
    mood: "Mellow",
    status: "open",
    owner: { username: "singer_songwriter", displayName: "Singer Songwriter" },
    partsNeeded: ["Lead Vocals", "Guitar"],
    createdAt: new Date().toISOString(),
  },
];

const Community: React.FC = () => {
  const { isAuthenticated, profile, signOut, isConfigured } = useAuth();
  const [activeTab, setActiveTab] = useState<CommunityTab>("karaoke");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [demoMode, setDemoMode] = useState(!isConfigured);

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

      {/* Demo Mode Banner */}
      {demoMode && (
        <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎭</span>
            <div>
              <p className="text-amber-400 font-medium">Demo Mode</p>
              <p className="text-amber-300/70 text-sm">
                Showing sample content. {!isConfigured && "Configure Supabase to enable full functionality."}
              </p>
            </div>
          </div>
          {isConfigured && (
            <Button size="sm" variant="secondary" onClick={() => setDemoMode(false)}>
              Exit Demo
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      {demoMode ? (
        // Demo Mode Content
        activeTab === "karaoke" ? (
          <div className="space-y-4">
            {MOCK_COLLABS.map((collab) => (
              <Card key={collab.id} className="hover:border-indigo-500/30 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{collab.title}</h3>
                    <p className="text-gray-400 text-sm mt-1">{collab.description}</p>
                    <div className="flex gap-2 mt-3">
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded">
                        {collab.genre}
                      </span>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                        {collab.mood}
                      </span>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                        {collab.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">by {collab.owner.displayName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Parts: {collab.partsNeeded.join(", ")}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_SHOWCASES.map((showcase) => (
              <Card key={showcase.id} className="hover:border-purple-500/30 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{showcase.title}</h3>
                    <p className="text-gray-400 text-sm mt-1">{showcase.description}</p>
                    <div className="flex gap-2 mt-3">
                      <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded">
                        {showcase.genre}
                      </span>
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                        {showcase.mood}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">by {showcase.creator.displayName}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      <span>▶ {showcase.playCount}</span>
                      <span>❤ {showcase.likeCount}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
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
