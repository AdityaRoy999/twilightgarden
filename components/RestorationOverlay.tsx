import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock } from 'lucide-react';
import { useCouples } from '../contexts/CouplesContext';

const RestorationOverlay: React.FC = () => {
  const { restorationState } = useCouples();
  const { isRestoring, progress, status } = restorationState;

  return (
    <AnimatePresence>
      {isRestoring && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
        >
          {/* WhatsApp-style Blurred Background */}
          <div className="absolute inset-0 bg-background-dark/80 backdrop-blur-xl" />

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-sm bg-surface-dark rounded-3xl p-8 shadow-2xl border border-white/10 text-center overflow-hidden"
          >
            {/* Animated Shimmer Background */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-tr from-[#984369]/5 via-transparent to-transparent"
              animate={{ 
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />

            <div className="relative z-10">
              <div className="mb-6 relative inline-block">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-10 h-10 text-primary" />
                </div>
                <motion.div 
                  className="absolute -top-1 -right-1"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                >
                  <Lock className="w-6 h-6 text-amber-500" />
                </motion.div>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Restoring History</h2>
              <p className="text-white/60 text-sm mb-8 leading-relaxed">
                We're securely decrypting your messages and partner insights. This will only take a moment.
              </p>

              {/* Progress Bar Container */}
              <div className="mb-4">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider">{status}</span>
                  <span className="text-sm font-bold text-primary">{progress}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#984369] to-[#c05a8a]"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-[10px] text-white/30 uppercase tracking-[0.2em] mt-8">
                <span className="w-1 h-1 bg-white/30 rounded-full" />
                End-to-End Encrypted
                <span className="w-1 h-1 bg-white/30 rounded-full" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RestorationOverlay;
