export type IdentifiedItemType = 'Image' | 'Table' | 'Equation' | 'Map' | 'Comics' | 'Other';

export interface IdentifiedItem {
  type: IdentifiedItemType;
  altText: string;
  keywords: string; // Comma-separated
  taxonomy: string; // Breadcrumb style, e.g., "Category > Subcategory"
}

export interface ProcessedItem extends IdentifiedItem {
  id: string; // Unique identifier for each processed item
  pageNumber: number; // Page number for PDFs or index for other sources
  previewImage: string; // base64 string
  isRegenerating?: boolean; // Flag for regeneration state
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