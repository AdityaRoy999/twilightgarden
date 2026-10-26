import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MessageAction {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

interface MessageContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  actions: MessageAction[];
  /** Position anchor: 'left' for partner messages, 'right' for own messages */
  anchor: 'left' | 'right';
  /** Y position (px from top of viewport) */
  y: number;
  /** X position (px from left of viewport) */
  x: number;
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  isOpen,
  onClose,
  actions,
  anchor,
  y,
  x,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Small delay to avoid the same event that opened the menu from closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // If menu overflows bottom, flip above
    if (rect.bottom > vh - 20) {
      menuRef.current.style.top = `${Math.max(20, y - rect.height)}px`;
    }
    // If menu overflows right
    if (rect.right > vw - 12) {
      menuRef.current.style.left = `${vw - rect.width - 12}px`;
    }
    // If menu overflows left
    if (rect.left < 12) {
      menuRef.current.style.left = '12px';
    }
  }, [isOpen, y, x]);

  const visibleActions = actions.filter(a => !a.hidden);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-[2px]"
            onClick={onClose}
          />
          {/* Menu */}
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
            style={{
              position: 'fixed',
              top: y,
              left: anchor === 'right' ? undefined : x,
              right: anchor === 'right' ? (window.innerWidth - x) : undefined,
              transformOrigin: anchor === 'right' ? 'top right' : 'top left',
            }}
            className="z-[201] min-w-[200px] max-w-[240px] bg-white dark:bg-surface-dark rounded-2xl shadow-[0_8px_40px_-8px_rgba(0,0,0,0.3)] dark:shadow-[0_8px_40px_-8px_rgba(0,0,0,0.6)] border border-gray-100 dark:border-gray-800 overflow-hidden"
          >
            <div className="py-1.5">
              {visibleActions.map((action, i) => (
                <React.Fragment key={action.label}>
                  {/* Separator before Delete (last danger action) */}
                  {action.danger && i > 0 && (
                    <div className="mx-3 my-1 border-t border-gray-100 dark:border-gray-700/50" />
                  )}
                  <button
                    onClick={() => {
                      action.onClick();
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 text-left transition-colors active:scale-[0.98] ${
                      action.danger
                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[20px] ${
                      action.danger ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {action.icon}
                    </span>
                    <span className="text-[15px] font-medium">{action.label}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MessageContextMenu;
