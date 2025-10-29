import React, { useCallback, useRef, useEffect, useState } from 'react';
import { ProcessedItem, IdentifiedItemType, IdentifiedItem } from '../types';
import ImageZoomModal from './ImageZoomModal';

interface ResultsDisplayProps {
  results: ProcessedItem[];
  summary: string;
  onReset: () => void;
  onItemChange: (itemId: string, field: keyof Omit<IdentifiedItem, 'confidence' | 'boundingBox'>, value: string) => void;
  onRegenerate: (itemId: string) => void;
  onSaveItem: (itemId: string) => void;
  onCancelEdit: (itemId: string) => void;
  isProcessing: boolean;
}

const DownloadIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
);

const ResetIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 10M20 20l-1.5-1.5A9 9 0 003.5 14"></path></svg>
);

const RegenerateIcon: React.FC<{isSpinning?: boolean}> = ({ isSpinning }) => (
    <svg className={`w-4 h-4 mr-1.5 ${isSpinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 10M20 20l-1.5-1.5A9 9 0 003.5 14"></path></svg>
);

const ConfidenceMeter: React.FC<{ score: number }> = ({ score }) => {
    const percentage = Math.round(score * 100);
    const color = percentage > 85 ? 'bg-green-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-red-500';
    return (
        <div className="w-full">
            <div className="flex justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 dark:text-white">Confidence</span>
                <span className="text-xs font-medium text-gray-700 dark:text-white">{percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                <div className={`${color} h-1.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const EditableField: React.FC<{label: string, value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, ariaLabel: string}> = ({ label, value, onChange, ariaLabel }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [value]);

    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
            <textarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                className="w-full p-2 bg-gray-50 dark:bg-gray-700/50 border border-transparent rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-secondary text-sm text-gray-800 dark:text-gray-200"
                aria-label={ariaLabel}
                rows={1}
            />
        </div>
    );
}

const typeBadgeStyles: Record<IdentifiedItemType, string> = {
    Photograph: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-300',
    Illustration: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300 border-indigo-300',
    Diagram: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 border-purple-300',
    Table: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-300',
    'Chart/Graph': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300 border-cyan-300',
    Equation: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300 border-pink-300',
    Map: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-300',
    Comic: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border-orange-300',
    'Scanned Document': 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 border-slate-400',
    Other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-400'
};

const ResultCard: React.FC<{ item: ProcessedItem; onRegenerate: (id: string) => void; onItemChange: ResultsDisplayProps['onItemChange']; onSaveItem: (id: string) => void; onCancelEdit: (id: string) => void; onImageClick: (url: string) => void; }> = ({ item, onRegenerate, onItemChange, onSaveItem, onCancelEdit, onImageClick }) => {
    return (
        <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-lg border dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/50">
            <div className="p-4 flex-grow space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                         <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${ typeBadgeStyles[item.type] || typeBadgeStyles.Other }`}>
                            {item.type}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">Page/Item: {item.pageNumber}</p>
                    </div>
                    <div className="w-24 h-24 flex-shrink-0 ml-4 border dark:border-gray-600 rounded-md overflow-hidden group">
                        <img 
                            src={item.previewImage} 
                            alt={`Preview of item ${item.id}`} 
                            onClick={() => onImageClick(item.previewImage)}
                            className="w-full h-full object-contain transition-transform duration-300 ease-in-out group-hover:scale-110 cursor-pointer"
                        />
                    </div>
                </div>
                
                <EditableField label="Alt Text" value={item.altText} onChange={(e) => onItemChange(item.id, 'altText', e.target.value)} ariaLabel="Editable alt text" />
                <EditableField label="Keywords" value={item.keywords} onChange={(e) => onItemChange(item.id, 'keywords', e.target.value)} ariaLabel="Editable keywords" />
                <EditableField label="Taxonomy" value={item.taxonomy} onChange={(e) => onItemChange(item.id, 'taxonomy', e.target.value)} ariaLabel="Editable taxonomy" />
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-t dark:border-gray-700 space-y-4">
                <ConfidenceMeter score={item.confidence} />
                
                <div className="flex justify-between items-center">
                     <div className="text-xs font-medium text-secondary">
                        {item.tokensSpent.toLocaleString()} Tokens Spent
                    </div>
                    
                    {item.isEditing ? (
                        <div className="flex items-center gap-2">
                             <button onClick={() => onCancelEdit(item.id)} className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500">Cancel</button>
                             <button onClick={() => onSaveItem(item.id)} disabled={item.isSaving} className="px-3 py-1 text-xs font-medium text-white bg-primary rounded-md hover:bg-indigo-700 disabled:opacity-50">
                                {item.isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    ) : (
                         <button
                            onClick={() => onRegenerate(item.id)}
                            disabled={item.isRegenerating}
                            className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-2 focus:outline-none focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                            <RegenerateIcon isSpinning={item.isRegenerating} />
                            {item.isRegenerating ? '...' : 'Regenerate'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
};


export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, summary, onReset, onItemChange, onRegenerate, onSaveItem, onCancelEdit, isProcessing }) => {
    const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
    
    const downloadCsv = useCallback(() => {
        if (results.length === 0) return;
        const headers = ['ID', 'Type', 'Alt Text', 'Keywords', 'Taxonomy', 'Confidence'];
        const csvRows = [headers.join(',')];
        results.forEach(item => {
            const values = [
                item.pageNumber, item.type,
                `"${item.altText.replace(/"/g, '""')}"`,
                `"${item.keywords.replace(/"/g, '""')}"`,
                `"${item.taxonomy.replace(/"/g, '""')}"`,
                (item.confidence * 100).toFixed(2)
            ];
            csvRows.push(values.join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', 'alt-text-export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [results]);

    return (
        <>
            <ImageZoomModal imageUrl={zoomedImageUrl} onClose={() => setZoomedImageUrl(null)} />
            <div className="p-4 sm:p-6 md:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Processing Results</h2>
                    <div className="flex items-center gap-2">
                         <button onClick={onReset} className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700">
                            <ResetIcon/> Start Over
                        </button>
                        {results.length > 0 && (
                            <button onClick={downloadCsv} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-secondary border border-transparent rounded-lg hover:bg-emerald-600 focus:ring-4 focus:outline-none focus:ring-emerald-300 dark:focus:ring-emerald-800">
                               <DownloadIcon /> Download CSV
                            </button>
                        )}
                    </div>
                </div>
                
                {summary && (
                    <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg dark:bg-gray-900/50 dark:border-gray-700">
                        <h3 className="font-semibold text-lg text-primary mb-2">AI Summary</h3>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{summary}</p>
                    </div>
                )}

                {results.length === 0 && !isProcessing && (
                    <div className="text-center py-12"><p className="text-gray-500 dark:text-gray-400">No items found. Upload a file to get started.</p></div>
                )}
                
                {isProcessing && results.length > 0 && <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">Processing... new items will appear below as they are completed.</p>}

                {results.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {results.map((item) => (
                           <ResultCard 
                                key={item.id} 
                                item={item}
                                onRegenerate={onRegenerate}
                                onItemChange={onItemChange}
                                onSaveItem={onSaveItem}
                                onCancelEdit={onCancelEdit}
                                onImageClick={setZoomedImageUrl}
                           />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};