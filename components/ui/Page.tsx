import React from "react";

interface PageProps {
  title: string;
  description: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const Page: React.FC<PageProps> = ({ title, description, children, icon }) => {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with artistic styling */}
      <header className="mb-10 relative">
        {/* Decorative background element */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-start gap-4">
          {icon && (
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 hidden sm:flex">
              <span className="text-indigo-400">{icon}</span>
            </div>
          )}
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              <span className="gradient-text">{title}</span>
            </h1>
            <p className="mt-2 text-base md:text-lg text-gray-400 max-w-2xl leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Subtle divider line */}
        <div className="mt-6 h-px bg-gradient-to-r from-indigo-500/30 via-purple-500/20 to-transparent" />
      </header>

      {/* Content area with staggered animation */}
      <div className="space-y-6">{children}</div>
    </div>
  );
};

export default Page;
