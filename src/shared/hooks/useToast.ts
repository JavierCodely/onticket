
import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  title?: string;
  description: string;
  type: ToastType;
  duration?: number;
}

interface ToastOptions {
  title?: string;
  description: string;
  type?: ToastType;
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addToast = useCallback((options: ToastOptions) => {
    const toast: Toast = {
      id: generateId(),
      type: 'info',
      duration: 5000,
      ...options,
    };

    setToasts(current => [...current, toast]);

    // Auto-remove toast after duration
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);
    }

    return toast.id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Helper methods for different toast types
  const toast = {
    success: (description: string, title?: string) => 
      addToast({ description, title, type: 'success' }),
    
    error: (description: string, title?: string) => 
      addToast({ description, title, type: 'error', duration: 7000 }),
    
    warning: (description: string, title?: string) => 
      addToast({ description, title, type: 'warning' }),
    
    info: (description: string, title?: string) => 
      addToast({ description, title, type: 'info' }),
    
    loading: (description: string, title?: string) => 
      addToast({ description, title, type: 'info', duration: 0 }),
    
    dismiss: removeToast,
    dismissAll: clearAll,
  };

  return {
    toasts,
    toast,
    addToast,
    removeToast,
    clearAll,
  };
};
