export type IdentifiedItemType = 'Photograph' | 'Illustration' | 'Diagram' | 'Table' | 'Chart/Graph' | 'Equation' | 'Map' | 'Comic' | 'Scanned Document' | 'Other';

export interface IdentifiedItem {
  type: IdentifiedItemType;
  altText: string;
  keywords: string; // Comma-separated
  taxonomy: string; // Breadcrumb style, e.g., "Category > Subcategory"
  confidence: number; // Score from 0.0 to 1.0
  boundingBox?: { x: number; y: number; width: number; height: number; }; // Optional bounding box for elements on a page
}

export interface ProcessedItem extends IdentifiedItem {
  id: string; // Unique identifier for each processed item
  pageNumber: number; // Page number for PDFs or index for other sources
  previewImage: string; // base64 string of the CROPPED asset
  originalPageImage?: string; // base64 string of the original page, for reprocessing
  isRegenerating?: boolean; // Flag for regeneration state
  tokensSpent: number;
  isEditing?: boolean;
  isSaving?: boolean;
  // Store original values for cancel functionality
  originalState?: Omit<IdentifiedItem, 'confidence' | 'boundingBox'>;
}

export enum ProcessingState {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  ERROR = 'ERROR'
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

export interface User {
    id: string;
    username: string;
    password?: string; // Should not be stored long-term, but used for creation
    role: 'admin' | 'user';
    tokens: number;
}

export interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    decrementTokens: (amount: number) => void;
    getUsers: () => User[];
    addUser: (user: Omit<User, 'id'>) => boolean;
    deleteUser: (userId: string) => void;
    addTokens: (userId: string, amount: number) => void;
}