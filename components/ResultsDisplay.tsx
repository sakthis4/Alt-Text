import React, { useCallback, useRef, useEffect } from 'react';
import { ProcessedItem, IdentifiedItemType } from '../types';

interface ResultsDisplayProps {
  results: ProcessedItem[];
  onReset: () => void;
  onItemChange: (itemId: string, field: keyof Omit<ProcessedItem, 'id' | 'pageNumber' | 'previewImage' | 'isRegenerating'>, value: string) => void;
  onRegenerate: (itemId: string) => void;
}

const DownloadIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
);

const ResetIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 10M20 20l-1.5-1.5A9 9 0 003.5 14"></path></svg>
);

const RegenerateIcon: React.FC<{isSpinning?: boolean}> = ({ isSpinning }) => (
    <svg className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M20 20v-5h-5M4 4l1.5 1.5A9 9 0 0120.5 10M20 20l-1.5-1.5A9 9 0 003.5 14"></path></svg>
);


const EditableField: React.FC<{value: string, onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, ariaLabel: string}> = ({ value, onChange, ariaLabel }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className="w-full p-1 bg-transparent rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-secondary text-gray-700 dark:text-gray-300"
            aria-label={ariaLabel}
            rows={1}
        />
    );
}

const typeBadgeStyles: Record<IdentifiedItemType, string> = {
    Image: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    Table: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    Equation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    Map: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    Comics: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
    Other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, onReset, onItemChange, onRegenerate }) => {
    const downloadCsv = useCallback(() => {
        if (results.length === 0) return;

        const headers = ['ID', 'Type', 'Alt Text', 'Keywords', 'Taxonomy'];
        const csvRows = [headers.join(',')];

        results.forEach(item => {
            const values = [
                item.pageNumber, item.type,
                `"${item.altText.replace(/"/g, '""')}"`,
                `"${item.keywords.replace(/"/g, '""')}"`,
                `"${item.taxonomy.replace(/"/g, '""')}"`,
            ];
            csvRows.push(values.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'alt-text-export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [results]);

    const tableColumns = ["Page / Item", "Type", "Preview", "Alt Text", "Keywords", "Taxonomy", "Actions"];

    return (
        <>
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

                {results.length === 0 && (
                    <div className="text-center py-12"><p className="text-gray-500 dark:text-gray-400">No items found. Upload a file to get started.</p></div>
                )}

                {results.length > 0 && (
                     <div className="overflow-x-auto relative shadow-md sm:rounded-lg border dark:border-gray-700">
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    {tableColumns.map(col => <th key={col} scope="col" className={`py-3 px-6 ${col === 'Page / Item' ? 'text-center' : ''}`}>{col}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((item) => (
                                    <tr key={item.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 align-top">
                                        <td className="py-4 px-6 font-medium text-gray-900 dark:text-white text-center">{item.pageNumber}</td>
                                        <td className="py-4 px-6">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ typeBadgeStyles[item.type] || typeBadgeStyles.Other }`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 relative">
                                            <img 
                                                src={item.previewImage} 
                                                alt={`Preview of item ${item.id}`} 
                                                className="w-24 h-auto object-contain border dark:border-gray-600 rounded-md transition-transform duration-200 ease-in-out hover:scale-[4.375] hover:z-10"
                                            />
                                        </td>
                                        <td className="py-4 px-6"><EditableField value={item.altText} onChange={(e) => onItemChange(item.id, 'altText', e.target.value)} ariaLabel="Editable alt text" /></td>
                                        <td className="py-4 px-6"><EditableField value={item.keywords} onChange={(e) => onItemChange(item.id, 'keywords', e.target.value)} ariaLabel="Editable keywords" /></td>
                                        <td className="py-4 px-6"><EditableField value={item.taxonomy} onChange={(e) => onItemChange(item.id, 'taxonomy', e.target.value)} ariaLabel="Editable taxonomy" /></td>
                                        <td className="py-4 px-6">
                                            <button
                                                onClick={() => onRegenerate(item.id)}
                                                disabled={item.isRegenerating}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                aria-label="Regenerate analysis for this item"
                                            >
                                                <RegenerateIcon isSpinning={item.isRegenerating} />
                                                {item.isRegenerating ? 'Regenerating...' : 'Regenerate'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
};