import { AppIcon } from './ui/Icons';
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string;
  subMessage?: string;
  isVisible: boolean;
  onClose: () => void;
  type?: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  subMessage, 
  isVisible, 
  onClose, 
  type = 'success' 
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onCloseRef.current();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-24 left-6 right-6 z-[100] flex justify-center pointer-events-none"
        >
          <div className="bg-white/95 dark:bg-background-dark/90 backdrop-blur-md text-[var(--text-primary)] dark:text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm w-full pointer-events-auto border border-black/5 dark:border-white/10">
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
            }`}>
              <span className="app-icon-glyph text-xl"><AppIcon name={type === 'success' ? 'check_circle' : 'error'}/></span>
            </div>
            <div className="flex flex-col flex-1">
              <span className="font-bold text-sm">{message}</span>
              {subMessage && (
                <span className="text-xs opacity-70 mt-0.5">{subMessage}</span>
              )}
            </div>
            <button 
              onClick={onClose}
              className="shrink-0 p-1 rounded-full hover:bg-white/10 dark:hover:bg-black/10 transition-colors"
            >
              <span className="app-icon-glyph text-lg opacity-50"><AppIcon name={"close"}/></span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
