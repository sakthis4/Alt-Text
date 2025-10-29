import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Loader } from './components/Loader';
import { Footer } from './components/Footer';
import { processPdfToImages } from './services/pdfProcessor';
import { processDocxToImages } from './services/docxProcessor';
import { generateImageAnalysis, generatePageAnalysis, generateSummary, explainError } from './services/geminiService';
import { fetchImageAsBase64 } from './services/urlProcessor';
import { ProcessedItem, ProcessingState, User, IdentifiedItem } from './types';
import { useToast, useAuth } from './hooks/useToast';

const cropImage = (
    imageBase64: string, 
    box: { x: number; y: number; width: number; height: number; }
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const buffer = 5; // Add a small buffer to prevent cutting off edges
      const sx = Math.max(0, box.x - buffer);
      const sy = Math.max(0, box.y - buffer);
      const sWidth = Math.min(img.width - sx, box.width + buffer * 2);
      const sHeight = Math.min(img.height - sy, box.height + buffer * 2);

      if (sWidth <= 0 || sHeight <= 0) return reject(new Error("Invalid crop dimensions"));

      canvas.width = sWidth;
      canvas.height = sHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context failed');
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = (err) => reject(new Error(`Image load failed for cropping.`));
    img.src = imageBase64;
  });
}


// --- LOGIN PAGE ---
const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const success = await login(username, password);
        if (!success) {
            setError('Invalid username or password.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-primary">Welcome Back</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">Log in to access the AI Tools Suite</p>
                    <p className="mt-2 text-xs text-gray-500">Hint: admin/admin123 or user/user123</p>
                </div>
                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full px-4 py-2 font-medium text-white bg-primary rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50">
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// --- ALT TEXT GENERATOR TOOL ---
const AltTextGeneratorTool: React.FC = () => {
  const [processingState, setProcessingState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [results, setResults] = useState<ProcessedItem[]>([]);
  const [summary, setSummary] = useState<string>('');
  const { addToast } = useToast();
  const { user, decrementTokens } = useAuth();
  
  const TOKENS_PER_JOB = 10;
  
  const handleReset = () => {
    setProcessingState(ProcessingState.IDLE);
    setProgressMessage('');
    setResults([]);
    setSummary('');
  };

  const handleError = async (err: unknown) => {
      console.error(err);
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      const friendlyError = await explainError(message);
      addToast(friendlyError, 'error');
      setProcessingState(ProcessingState.ERROR);
  }
  
  const handleItemChange = (itemId: string, field: keyof Omit<IdentifiedItem, 'confidence' | 'boundingBox'>, value: string) => {
    setResults(currentResults =>
      currentResults.map(item => {
        if (item.id === itemId) {
            const originalState = item.originalState ?? { 
                type: item.type, altText: item.altText, keywords: item.keywords, taxonomy: item.taxonomy 
            };
            return { ...item, [field]: value, isEditing: true, originalState };
        }
        return item;
      })
    );
  };
  
  const handleCancelEdit = (itemId: string) => {
    setResults(currentResults => currentResults.map(item => {
        if (item.id === itemId && item.isEditing && item.originalState) {
            return { ...item, ...item.originalState, isEditing: false, isSaving: false, originalState: undefined };
        }
        return item;
    }));
  };

  const handleSaveItem = async (itemId: string) => {
    setResults(prev => prev.map(r => r.id === itemId ? { ...r, isSaving: true } : r));
    await new Promise(res => setTimeout(res, 300));
    setResults(prev => {
        const newResults = prev.map(r => r.id === itemId ? { ...r, isEditing: false, isSaving: false, originalState: undefined } : r);
        addToast('Changes saved!', 'success');
        return newResults;
    });
  };

  const handleRegenerate = useCallback(async (itemId: string) => {
    const itemToRegen = results.find(r => r.id === itemId);
    if (!itemToRegen || !user) return;
    if (user.tokens < TOKENS_PER_JOB) {
        addToast(`You need at least ${TOKENS_PER_JOB} tokens.`, 'error');
        return;
    }
    setResults(prev => prev.map(r => r.id === itemId ? {...r, isRegenerating: true} : r));
    try {
        const imageToAnalyze = itemToRegen.originalPageImage && itemToRegen.boundingBox
            ? await cropImage(itemToRegen.originalPageImage, itemToRegen.boundingBox)
            : itemToRegen.previewImage;
        const analysis = await generateImageAnalysis(imageToAnalyze);
        decrementTokens(TOKENS_PER_JOB);
        setResults(prev => prev.map(r => r.id === itemId ? {
            ...r, ...analysis, isRegenerating: false, tokensSpent: r.tokensSpent + TOKENS_PER_JOB, isEditing: false, originalState: undefined
        } : r));
        addToast('Analysis regenerated!', 'success');
        if(user.tokens - TOKENS_PER_JOB < 50) addToast('Your token balance is getting low.', 'info');
    } catch (err) {
        await handleError(err);
        setResults(prev => prev.map(r => r.id === itemId ? {...r, isRegenerating: false} : r));
    }
  }, [results, addToast, user, decrementTokens]);

  const startProcessing = () => {
    handleReset();
    setProcessingState(ProcessingState.PROCESSING);
  };
  
  const finishProcessing = async (finalResults: ProcessedItem[]) => {
    if (finalResults.length > 0) {
        setProgressMessage('Generating summary...');
        const docSummary = await generateSummary(finalResults);
        setSummary(docSummary);
        addToast('Processing complete!', 'success');
        if (user && user.tokens < 50) addToast('Your token balance is getting low.', 'info');
    } else {
        addToast('No visual elements were found to process.', 'info');
    }
    setProcessingState(ProcessingState.DONE);
    setProgressMessage('');
  };
  
  const processAndAddItems = async (image: string, context: string | undefined, pageNum: number): Promise<ProcessedItem> => {
      const item = await generateImageAnalysis(image, context);
      decrementTokens(TOKENS_PER_JOB);
      const newItem: ProcessedItem = { ...item, id: `${Date.now()}-${Math.random()}`, pageNumber: pageNum, previewImage: image, tokensSpent: TOKENS_PER_JOB };
      setResults(prev => [...prev, newItem]);
      return newItem;
  };

  const handleUploads = useCallback(async (files: FileList | null, url: string | null) => {
    startProcessing();
    let finalResults: ProcessedItem[] = [];
    
    try {
        if (files) {
            const fileArray = Array.from(files);
            const docFile = fileArray.find(f => f.type === 'application/pdf' || f.name.endsWith('.docx'));
            const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

            // Handle PDF or DOCX (only one is allowed)
            if (docFile) {
                if (fileArray.length > 1) throw new Error("Please process either one document (PDF/DOCX) or multiple images at a time, but not both.");
                const isPdf = docFile.type === 'application/pdf';
                if (isPdf) {
                    setProgressMessage('Parsing PDF pages...');
                    const pageImages = await processPdfToImages(docFile);
                    for (let i = 0; i < pageImages.length; i++) {
                        if ((user?.tokens ?? 0) < TOKENS_PER_JOB) throw new Error('Processing stopped due to insufficient tokens.');
                        setProgressMessage(`Analyzing page ${i + 1} of ${pageImages.length}...`);
                        const pageImage = pageImages[i];
                        const itemsFromPage = await generatePageAnalysis(pageImage);
                        decrementTokens(TOKENS_PER_JOB); // One charge per page analysis
                        for (const item of itemsFromPage) {
                            const assetPreview = await cropImage(pageImage, item.boundingBox!);
                            const newItem: ProcessedItem = { ...item, id: `${Date.now()}-${Math.random()}`, pageNumber: i + 1, previewImage: assetPreview, originalPageImage: pageImage, tokensSpent: TOKENS_PER_JOB };
                            finalResults.push(newItem);
                            setResults(prev => [...prev, newItem].sort((a, b) => a.pageNumber - b.pageNumber));
                        }
                    }
                } else { // DOCX
                    setProgressMessage('Extracting elements from DOCX...');
                    const docxElements = await processDocxToImages(docFile);
                    if (docxElements.length === 0) addToast("No images or tables were found in the DOCX file.", "info");
                    for (let i = 0; i < docxElements.length; i++) {
                        if ((user?.tokens ?? 0) < TOKENS_PER_JOB) throw new Error('Processing stopped due to insufficient tokens.');
                        setProgressMessage(`Analyzing element ${i + 1} of ${docxElements.length}...`);
                        const element = docxElements[i];
                        const newItem = await processAndAddItems(element.image, element.context, i + 1);
                        finalResults.push(newItem);
                    }
                }
            } 
            // Handle Images
            else if (imageFiles.length > 0) {
                for (let i = 0; i < imageFiles.length; i++) {
                    if ((user?.tokens ?? 0) < TOKENS_PER_JOB) throw new Error('Processing stopped due to insufficient tokens.');
                    setProgressMessage(`Analyzing image ${i + 1} of ${imageFiles.length}...`);
                    const file = imageFiles[i];
                    const imageBase64 = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(e.target?.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    const newItem = await processAndAddItems(imageBase64, undefined, i + 1);
                    finalResults.push(newItem);
                }
            }
        } 
        // Handle URL
        else if (url) {
            if (!user || user.tokens < TOKENS_PER_JOB) throw new Error(`Insufficient tokens. You need ${TOKENS_PER_JOB} tokens.`);
            setProgressMessage('Fetching and analyzing image from URL...');
            const imageBase64 = await fetchImageAsBase64(url);
            const newItem = await processAndAddItems(imageBase64, undefined, 1);
            finalResults.push(newItem);
        }
    } catch (err) {
      await handleError(err);
    } finally {
      await finishProcessing(finalResults);
    }
  }, [addToast, user, decrementTokens]);


  return (
        <div className="w-full max-w-7xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-4 bg-gray-100 dark:bg-gray-900/50 border-b dark:border-gray-700 text-center">
                <h2 className="text-xl font-semibold">AI Image Alt Text & Metadata Generator</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Each processed asset costs {TOKENS_PER_JOB} tokens. Need more? Contact an administrator.</p>
            </div>
          {processingState === ProcessingState.IDLE && (
            <FileUpload onProcess={handleUploads} />
          )}
          {processingState === ProcessingState.PROCESSING && <div className="p-8 md:p-12"><Loader message={progressMessage} /></div>}
          {(processingState === ProcessingState.DONE || processingState === ProcessingState.ERROR || (processingState === ProcessingState.PROCESSING && results.length > 0)) && (
             <ResultsDisplay 
                results={results}
                summary={summary}
                onReset={handleReset} 
                onItemChange={handleItemChange} 
                onRegenerate={handleRegenerate}
                onSaveItem={handleSaveItem}
                onCancelEdit={handleCancelEdit}
                isProcessing={processingState === ProcessingState.PROCESSING}
             />
          )}
        </div>
  );
};


// --- HOME PAGE ---
const HomePage: React.FC<{ setPage: (page: 'tool') => void }> = ({ setPage }) => {
    return (
        <div className="w-full max-w-4xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">S4Carlisle AI Innovation Suite</h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
                Explore our collection of powerful, AI-driven tools designed to enhance accessibility and streamline content creation.
            </p>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-xl hover:shadow-2xl transition-shadow duration-300 text-left">
                    <h3 className="text-xl font-semibold text-primary">Alt Text & Metadata Generator</h3>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Automatically identify visual elements in PDFs and images, using OCR and AI to generate accurate alt text, keywords, and metadata for accessibility and SEO.
                    </p>
                    <button onClick={() => setPage('tool')} className="mt-6 px-5 py-2.5 font-medium text-white bg-primary rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-primary/50">
                        Launch Tool
                    </button>
                </div>
                 <div className="p-8 bg-white dark:bg-gray-800/50 rounded-xl shadow-xl border-2 border-dashed dark:border-gray-700 flex flex-col items-center justify-center">
                    <h3 className="text-xl font-semibold text-gray-500 dark:text-gray-400">More Tools Coming Soon...</h3>
                    <p className="mt-2 text-gray-500 dark:text-gray-500">
                        Our innovation lab is always working on the next big thing. Check back later for more AI-powered solutions.
                    </p>
                </div>
            </div>
        </div>
    );
}

// --- ADMIN PANEL ---
const AdminPanel: React.FC = () => {
    const { getUsers, addUser, deleteUser, addTokens } = useAuth();
    const { addToast } = useToast();
    const [users, setUsers] = useState<User[]>(getUsers());
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' as 'user' | 'admin', tokens: 1000 });

    const refreshUsers = () => setUsers(getUsers());

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if(!newUser.username || !newUser.password) {
            addToast("Username and password are required.", "error");
            return;
        }
        const success = addUser(newUser);
        if (success) {
            addToast(`User '${newUser.username}' created successfully.`, 'success');
            setNewUser({ username: '', password: '', role: 'user', tokens: 1000 });
            refreshUsers();
        } else {
            addToast(`Username '${newUser.username}' already exists.`, 'error');
        }
    };
    
    const handleDeleteUser = (userId: string) => {
        if(window.confirm("Are you sure you want to delete this user? This action cannot be undone.")){
            deleteUser(userId);
            addToast("User deleted.", "info");
            refreshUsers();
        }
    };
    
    const handleAddTokens = (userId: string) => {
        addTokens(userId, 1000);
        addToast("Added 1000 tokens.", "success");
        refreshUsers();
    };

    return (
        <div className="w-full max-w-5xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden p-8">
            <h2 className="text-2xl font-bold mb-6">Admin Panel</h2>
            
            {/* Add User Form */}
            <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Create New User</h3>
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                     <div>
                        <label className="block text-sm font-medium">Username</label>
                        <input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Password</label>
                        <input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Role</label>
                        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary dark:bg-gray-700 dark:border-gray-600">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" className="w-full px-4 py-2 font-medium text-white bg-primary rounded-md hover:bg-indigo-700">Add User</button>
                </form>
            </div>

            {/* Users Table */}
            <h3 className="text-lg font-semibold mb-4">Manage Users</h3>
            <div className="overflow-x-auto relative shadow-md sm:rounded-lg border dark:border-gray-700">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th className="py-3 px-6">Username</th>
                            <th className="py-3 px-6">Role</th>
                            <th className="py-3 px-6">Tokens</th>
                            <th className="py-3 px-6">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                <td className="py-4 px-6 font-medium text-gray-900 dark:text-white">{u.username}</td>
                                <td className="py-4 px-6"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'}`}>{u.role}</span></td>
                                <td className="py-4 px-6">{u.tokens.toLocaleString()}</td>
                                <td className="py-4 px-6 flex items-center gap-2">
                                    <button onClick={() => handleAddTokens(u.id)} className="px-3 py-1 text-xs font-medium text-white bg-secondary rounded hover:bg-emerald-600">Add 1k Tokens</button>
                                    <button onClick={() => handleDeleteUser(u.id)} className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}


// --- MAIN APP ROUTER ---
const App: React.FC = () => {
  const { user } = useAuth();
  const [page, setPage] = useState<'home' | 'tool' | 'admin'>('home');

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800 dark:text-gray-200">
      <Header setPage={setPage} currentPage={page} />
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center">
        {page === 'home' && <HomePage setPage={setPage} />}
        {page === 'tool' && <AltTextGeneratorTool />}
        {page === 'admin' && user.role === 'admin' && <AdminPanel />}
      </main>
      <Footer />
    </div>
  );
};

export default App;