import React from 'react';

interface ImageZoomModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Using a separate effect for the event listener is a good practice.
  React.useEffect(() => {
    const downHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }
    window.addEventListener('keydown', downHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zoomed-image-description"
    >
      <div
        className="relative p-2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-5xl max-h-[95vh] flex pointer-events-auto"
        onKeyDown={handleKeyDown}
      >
        <img src={imageUrl} alt="Zoomed preview" id="zoomed-image-description" className="max-w-full max-h-[90vh] object-contain" />
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 p-1.5 text-white bg-gray-800 rounded-full hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white dark:bg-gray-600 dark:hover:bg-gray-500"
          aria-label="Close zoomed image"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ImageZoomModal;