import React, { useState, useCallback } from 'react';

interface FileUploadProps {
  onProcess: (files: FileList | null, url: string | null) => void;
}

const UploadIcon: React.FC = () => (
  <svg className="w-12 h-12 mb-4 text-gray-400 dark:text-gray-500" aria-hidden="true" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 20 16">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
  </svg>
);

export const FileUpload: React.FC<FileUploadProps> = ({ onProcess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onProcess(e.target.files, null);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) onProcess(null, url);
  };

  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items?.length > 0) setIsDragging(true);
  }, []);
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      onProcess(e.dataTransfer.files, null);
      e.dataTransfer.clearData();
    }
  }, [onProcess]);

  return (
    <div className="p-8 md:p-12">
      <div 
        className="w-full"
        onDragEnter={handleDragIn} 
        onDragLeave={handleDragOut} 
        onDragOver={handleDrag} 
        onDrop={handleDrop}
      >
        <label 
          htmlFor="file-upload" 
          className={`flex flex-col items-center justify-center w-full min-h-[250px] p-6 border-3 border-dashed rounded-xl cursor-pointer transition-colors duration-300 ${isDragging ? 'border-primary bg-indigo-50 dark:bg-gray-700/50' : 'border-gray-300 dark:border-gray-600 hover:border-primary/70 dark:hover:border-primary/70 bg-gray-50 dark:bg-gray-800/50'}`}
        >
          <UploadIcon />
          <p className="mb-2 text-lg text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-primary">Click to upload</span> or drag and drop
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            PDF, DOCX, PNG, JPG, or WEBP
          </p>
          <input 
            id="file-upload" 
            type="file" 
            multiple 
            className="hidden" 
            accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp" 
            onChange={handleFileChange} 
          />
        </label>
      </div>

      <div className="flex items-center my-6">
        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
        <span className="flex-shrink mx-4 text-sm font-medium text-gray-500 dark:text-gray-400">OR</span>
        <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
      </div>

      <form onSubmit={handleUrlSubmit} className="w-full">
        <label htmlFor="image-url" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Process an Image from a URL
        </label>
        <div className="flex">
          <input
            type="url"
            id="image-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-l-lg focus:ring-primary focus:border-primary block w-full p-3 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
            placeholder="https://example.com/image.jpg"
            required
          />
          <button 
            type="submit" 
            className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-r-lg border border-primary hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 dark:focus:ring-indigo-800 transition-colors"
          >
            Fetch & Analyze
          </button>
        </div>
      </form>
    </div>
  );
};