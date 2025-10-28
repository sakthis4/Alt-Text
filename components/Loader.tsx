
import React from 'react';

interface LoaderProps {
  message: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-dashed rounded-full animate-spin border-primary"></div>
        <div className="absolute top-1/2 left-1/2 w-10 h-10 -mt-5 -ml-5 border-4 border-dashed rounded-full animate-spin border-secondary"></div>
      </div>
      <p className="mt-6 text-lg font-medium text-gray-700 dark:text-gray-300">{message}</p>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Please wait, this may take a few moments...</p>
    </div>
  );
};
