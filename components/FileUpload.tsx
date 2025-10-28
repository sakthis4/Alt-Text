import React, { useState, useCallback } from 'react';

interface FileUploadProps {
  onProcessFile: (file: File) => void;
  onProcessImages: (files: FileList) => void;
  onProcessUrl: (url: string) => void;
}

type UploadMode = 'file' | 'images' | 'url';

const UploadIcon: React.FC = () => (
  <svg className="w-10 h-10 mb-4 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
  </svg>
);

const FileUploader: React.FC<{ onFileSelect: (file: File) => void }> = ({ onFileSelect }) => {
    const [isDragging, setIsDragging] = useState(false);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) onFileSelect(e.target.files[0]);
    };
    const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
    const handleDragIn = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items?.length > 0) setIsDragging(true); }, []);
    const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files?.length > 0) { onFileSelect(e.dataTransfer.files[0]); e.dataTransfer.clearData(); }
    }, [onFileSelect]);

    return (
        <div onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}>
            <label htmlFor="doc-file" className={`flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-primary bg-indigo-50 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-700/50'}`}>
                <UploadIcon />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">PDF or DOCX file</p>
                <input id="doc-file" type="file" className="hidden" accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} />
            </label>
        </div>
    );
};

const ImagesUploader: React.FC<{ onImagesSelect: (files: FileList) => void }> = ({ onImagesSelect }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) onImagesSelect(e.target.files);
    };
    return (
        <div>
            <label htmlFor="images-file" className="flex flex-col items-center justify-center w-full h-52 border-2 border-dashed rounded-lg cursor-pointer border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-700/50">
                <UploadIcon />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload images</span></p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Up to 10 images (PNG, JPG, WEBP)</p>
                <input id="images-file" type="file" multiple className="hidden" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
            </label>
        </div>
    );
};

const UrlUploader: React.FC<{ onUrlSubmit: (url: string) => void }> = ({ onUrlSubmit }) => {
    const [url, setUrl] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url) onUrlSubmit(url);
    };
    return (
        <form onSubmit={handleSubmit} className="h-52 flex flex-col justify-center">
            <label htmlFor="image-url" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Image URL</label>
            <div className="flex">
                <input
                    type="url"
                    id="image-url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-l-lg focus:ring-primary focus:border-primary block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                    placeholder="https://example.com/image.jpg"
                    required
                />
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-r-lg border border-primary hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-300 dark:focus:ring-indigo-800">
                    Fetch
                </button>
            </div>
             <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Enter the URL of an image to process. Note: The URL must be publicly accessible.</p>
        </form>
    );
};


export const FileUpload: React.FC<FileUploadProps> = ({ onProcessFile, onProcessImages, onProcessUrl }) => {
  const [mode, setMode] = useState<UploadMode>('file');

  const TabButton: React.FC<{ current: UploadMode, target: UploadMode, children: React.ReactNode }> = ({ current, target, children }) => (
    <button
      onClick={() => setMode(target)}
      className={`px-4 py-2 text-sm font-medium rounded-md ${current === target ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="p-8 md:p-12">
      <div className="flex justify-center mb-6 space-x-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
        <TabButton current={mode} target="file">From File</TabButton>
        <TabButton current={mode} target="images">From Images</TabButton>
        <TabButton current={mode} target="url">From URL</TabButton>
      </div>
      <div>
        {mode === 'file' && <FileUploader onFileSelect={onProcessFile} />}
        {mode === 'images' && <ImagesUploader onImagesSelect={onProcessImages} />}
        {mode === 'url' && <UrlUploader onUrlSubmit={onProcessUrl} />}
      </div>
    </div>
  );
};
