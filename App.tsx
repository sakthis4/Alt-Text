import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Loader } from './components/Loader';
import { Footer } from './components/Footer';
import { processPdfToImages } from './services/pdfProcessor';
import { processDocxToImages } from './services/docxProcessor';
import { generateImageAnalysis, generatePageAnalysis } from './services/geminiService';
import { fetchImageAsBase64 } from './services/urlProcessor';
import { ProcessedItem, ProcessingState } from './types';
import { useToast } from './hooks/useToast';

const App: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [results, setResults] = useState<ProcessedItem[]>([]);
  const { addToast } = useToast();

  // Load results from localStorage on initial render
  useEffect(() => {
    try {
      const savedResults = localStorage.getItem('altTextGeneratorResults');
      if (savedResults) {
        const parsedResults = JSON.parse(savedResults);
        if (Array.isArray(parsedResults) && parsedResults.length > 0) {
            setResults(parsedResults);
            setProcessingState(ProcessingState.DONE);
        }
      }
    } catch (e) {
        console.error("Failed to load results from localStorage", e);
    }
  }, []);

  // Autosave results to localStorage whenever they change
  useEffect(() => {
    try {
        if (results.length > 0) {
            localStorage.setItem('altTextGeneratorResults', JSON.stringify(results));
        } else {
            localStorage.removeItem('altTextGeneratorResults');
        }
    } catch(e) {
        console.error("Failed to save results to localStorage", e);
    }
  }, [results]);

  const handleReset = () => {
    setProcessingState(ProcessingState.IDLE);
    setProgressMessage('');
    setResults([]);
    localStorage.removeItem('altTextGeneratorResults');
  };
  
  const handleItemChange = (itemId: string, field: keyof Omit<ProcessedItem, 'id' | 'pageNumber' | 'previewImage' | 'isRegenerating'>, value: string) => {
    setResults(currentResults =>
      currentResults.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRegenerate = useCallback(async (itemId: string) => {
    const itemToRegen = results.find(r => r.id === itemId);
    if (!itemToRegen) return;

    setResults(prev => prev.map(r => r.id === itemId ? {...r, isRegenerating: true} : r));

    try {
        // Context isn't saved, so regeneration for DOCX items won't have it. This is an acceptable trade-off for now.
        const analysis = await generateImageAnalysis(itemToRegen.previewImage);
        setResults(prev => prev.map(r => r.id === itemId ? {...r, ...analysis, isRegenerating: false} : r));
        addToast('Successfully regenerated analysis!', 'success');
    } catch (err) {
        console.error("Regeneration failed:", err);
        const message = err instanceof Error ? err.message : 'An unknown error occurred during regeneration.';
        addToast(message, 'error');
        setResults(prev => prev.map(r => r.id === itemId ? {...r, isRegenerating: false} : r));
    }
  }, [results, addToast]);
  
  const processAndSetResults = async (items: Omit<ProcessedItem, 'id'>[]) => {
    const newItemsWithIds = items.map(item => ({
      ...item,
      id: `${Date.now()}-${Math.random()}`
    }));
    setResults(prev => [...prev, ...newItemsWithIds].sort((a, b) => a.pageNumber - b.pageNumber));
  };

  const runProcessingJob = async (job: () => Promise<void>) => {
    handleReset();
    setProcessingState(ProcessingState.PROCESSING);
    try {
      await job();
      setProcessingState(ProcessingState.DONE);
      addToast('Processing complete!', 'success');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      addToast(message, 'error');
      setProcessingState(ProcessingState.ERROR);
    } finally {
      setProgressMessage('');
    }
  };

  const handleProcessFile = useCallback(async (file: File) => {
    await runProcessingJob(async () => {
        const isPdf = file.type === 'application/pdf';
        const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
        
        if (isPdf) {
            setProgressMessage('Parsing PDF pages...');
            const pageImages = await processPdfToImages(file);
            for (let i = 0; i < pageImages.length; i++) {
                setProgressMessage(`Analyzing page ${i + 1} of ${pageImages.length}...`);
                const items = await generatePageAnalysis(pageImages[i]);
                await processAndSetResults(items.map(item => ({ ...item, pageNumber: i + 1, previewImage: pageImages[i] })));
            }
        } else if (isDocx) {
            setProgressMessage('Extracting elements from DOCX...');
            const docxElements = await processDocxToImages(file);
             if (docxElements.length === 0) {
                addToast("No images or tables were found in the DOCX file.", "info");
                return;
            }
            for (let i = 0; i < docxElements.length; i++) {
                setProgressMessage(`Analyzing element ${i + 1} of ${docxElements.length}...`);
                const element = docxElements[i];
                const item = await generateImageAnalysis(element.image, element.context);
                await processAndSetResults([{ ...item, pageNumber: i + 1, previewImage: element.image }]);
            }
        } else {
             throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
        }
    });
  }, [addToast]);

  const handleProcessImages = useCallback(async (files: FileList) => {
    await runProcessingJob(async () => {
      const itemsToProcess = Array.from(files);
      const newItems: Omit<ProcessedItem, 'id'>[] = [];

      for (let i = 0; i < itemsToProcess.length; i++) {
        setProgressMessage(`Analyzing image ${i + 1} of ${itemsToProcess.length}...`);
        const file = itemsToProcess[i];
        const reader = new FileReader();
        const fileReadPromise = new Promise<string>((resolve, reject) => {
            reader.onload = e => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        const imageBase64 = await fileReadPromise;
        const analysis = await generateImageAnalysis(imageBase64);
        newItems.push({ ...analysis, pageNumber: i + 1, previewImage: imageBase64 });
      }
      await processAndSetResults(newItems);
    });
  }, [addToast]);

  const handleProcessUrl = useCallback(async (url: string) => {
     await runProcessingJob(async () => {
        setProgressMessage('Fetching and analyzing image from URL...');
        const imageBase64 = await fetchImageAsBase64(url);
        const item = await generateImageAnalysis(imageBase64);
        await processAndSetResults([{ ...item, pageNumber: 1, previewImage: imageBase64 }]);
     });
  }, [addToast]);


  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800 dark:text-gray-200">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center">
        <div className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
          {processingState === ProcessingState.IDLE && (
            <FileUpload 
              onProcessFile={handleProcessFile}
              onProcessImages={handleProcessImages}
              onProcessUrl={handleProcessUrl}
            />
          )}

          {processingState === ProcessingState.PROCESSING && (
            <div className="p-8 md:p-12">
              <Loader message={progressMessage} />
            </div>
          )}

          {(processingState === ProcessingState.DONE || processingState === ProcessingState.ERROR) && (
             <ResultsDisplay
                results={results}
                onReset={handleReset}
                onItemChange={handleItemChange}
                onRegenerate={handleRegenerate}
              />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default App;