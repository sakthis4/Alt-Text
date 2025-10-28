import React from 'react';

const Icon: React.FC = () => (
  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"></path>
  </svg>
);


export const Header: React.FC = () => {
  return (
    <header className="bg-primary shadow-md">
      <div className="container mx-auto px-4 py-4 flex items-center">
        <div className="bg-white/20 p-2 rounded-lg mr-4">
            <Icon/>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          AI Image Alt Text &amp; Metadata Generator
        </h1>
      </div>
    </header>
  );
};
