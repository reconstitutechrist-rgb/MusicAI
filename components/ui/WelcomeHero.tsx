import React from "react";
import {
  MusicCreationIcon,
  LyricLabIcon,
  AudioProductionIcon,
  VideoCreationIcon,
} from "../../constants";

interface WelcomeHeroProps {
  userName?: string;
  onGetStarted?: () => void;
}

const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  userName,
  onGetStarted,
}) => {
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const features = [
    {
      icon: <MusicCreationIcon className="h-6 w-6" />,
      title: "AI Composition",
      description: "Create melodies and harmonies with AI assistance",
    },
    {
      icon: <LyricLabIcon className="h-6 w-6" />,
      title: "Lyric Writing",
      description: "Generate and refine lyrics that resonate",
    },
    {
      icon: <AudioProductionIcon className="h-6 w-6" />,
      title: "Audio Production",
      description: "Mix and master your tracks professionally",
    },
    {
      icon: <VideoCreationIcon className="h-6 w-6" />,
      title: "Visual Content",
      description: "Create stunning visuals for your music",
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl glass border-gradient p-8 md:p-12 mb-8">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-pink-500/10 to-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Floating music notes decoration */}
      <div className="absolute top-8 right-8 text-4xl opacity-20 float-note">
        ♪
      </div>
      <div className="absolute top-16 right-24 text-2xl opacity-10 float-note-delayed">
        ♫
      </div>
      <div className="absolute bottom-8 left-8 text-3xl opacity-15 float-note-slow">
        ♩
      </div>

      <div className="relative z-10">
        {/* Greeting */}
        <div
          className="flex items-center gap-2 mb-4 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.1s", animationFillMode: "forwards" }}
        >
          <span className="text-sm font-medium text-indigo-400 uppercase tracking-widest">
            {greeting()}
            {userName ? `, ${userName}` : ""}
          </span>
          <span className="text-lg">✨</span>
        </div>

        {/* Main headline */}
        <h1
          className="text-3xl md:text-5xl font-extrabold mb-4 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.2s", animationFillMode: "forwards" }}
        >
          <span className="gradient-text">Welcome to MUSE AI</span>
        </h1>

        <p
          className="text-lg md:text-xl text-gray-300 max-w-2xl mb-8 leading-relaxed opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.3s", animationFillMode: "forwards" }}
        >
          Your creative AI companion for music production. Transform ideas into
          professional tracks with the power of artificial intelligence.
        </p>

        {/* Feature grid */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "0.4s", animationFillMode: "forwards" }}
        >
          {features.map((feature, index) => (
            <div
              key={index}
              className="glass rounded-xl p-4 hover-lift cursor-pointer group transition-all duration-300"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 w-fit mb-3 group-hover:from-indigo-500/30 group-hover:to-purple-500/30 transition-all">
                <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors">
                  {feature.icon}
                </span>
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        {onGetStarted && (
          <button
            onClick={onGetStarted}
            className="
              inline-flex items-center gap-2
              px-8 py-4 
              bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500
              hover:from-indigo-500 hover:via-purple-500 hover:to-pink-400
              text-white font-semibold text-lg
              rounded-xl
              shadow-lg shadow-purple-500/25
              hover:shadow-xl hover:shadow-purple-500/30
              transition-all duration-300
              hover-lift press-effect
              shine-effect
              opacity-0 animate-fade-in-up
            "
            style={{ animationDelay: "0.5s", animationFillMode: "forwards" }}
          >
            <span>Start Creating</span>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Animated wave visualizer decoration */}
      <div className="absolute bottom-4 right-8 flex items-end gap-1 opacity-30">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="w-1 bg-gradient-to-t from-indigo-500 to-purple-500 rounded-full wave-bar"
            style={{
              height: `${Math.random() * 24 + 8}px`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default WelcomeHero;
