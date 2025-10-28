import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import { ToastMessage, ToastType } from '../types';
import { ToastContainer } from '../components/Toast';

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  // FIX: Replaced JSX with React.createElement to resolve syntax errors. JSX is not supported in .ts files.
  return React.createElement(React.Fragment, null,
    React.createElement(ToastContext.Provider, { value: { addToast } }, children),
    React.createElement(ToastContainer, { toasts: toasts, onDismiss: removeToast })
  );
};
