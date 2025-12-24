
import React from 'react';

interface PageProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const Page: React.FC<PageProps> = ({ title, description, children }) => {
  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">{title}</h1>
        <p className="mt-2 text-lg text-gray-400">{description}</p>
      </header>
      <div className="space-y-8">
        {children}
      </div>
    </div>
  );
};

export default Page;
