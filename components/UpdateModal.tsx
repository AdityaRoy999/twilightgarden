import { MotionPortal } from './ui/MotionPortal';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertCircle, RefreshCw, X } from './ui/Icons';
import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  const {
    updateAvailable,
    isChecking,
    isDownloading,
    downloadProgress,
    downloadError,
    downloadAndInstall,
    dismissUpdate
  } = useAppUpdate();

  // If no update or still checking, render nothing.
  if (isChecking || !updateAvailable) {
    return null;
  }

  const handleUpdate = () => {
    downloadAndInstall();
  };

  return (
    <AnimatePresence>
      <MotionPortal><motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="bg-gray-900 w-full max-w-sm rounded-2xl shadow-xl border border-gray-800 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-center relative">
              {!updateAvailable.force_update && !isDownloading && (
                  <button 
                      onClick={dismissUpdate}
                      className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                  >
                      <X className="w-5 h-5" />
                  </button>
              )}
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/30">
              <Download className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Update Available</h2>
            <p className="text-white/80 font-medium">Version {updateAvailable.version_name}</p>
          </div>

            {/* Content */}
          <div className="p-6">
            <div className="bg-gray-800/50 rounded-xl p-4 mb-6 border border-gray-700/50">
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                What's New
              </h3>
              <div className="max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {updateAvailable.changelog || updateAvailable.message || "Stable improvements and various bug fixes to enhance your experience."}
                </p>
              </div>
            </div>

            {/* Error Message */}
            {downloadError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{downloadError}</p>
              </div>
            )}

            {/* Progress Bar / Action Buttons */}
            {isDownloading ? (
              <div className="space-y-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400 font-medium tracking-wide uppercase text-xs">Downloading Update</span>
                  <span className="text-indigo-400 font-bold">{downloadProgress}%</span>
                </div>
                <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress}%` }}
                    transition={{ type: "tween", ease: "linear", duration: 0.2 }}
                  />
                </div>
                <p className="text-xs text-center text-gray-500 mt-2">Please do not close the app.</p>
              </div>
            ) : (
              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleUpdate}
                  className="on-brand w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Download & Install</span>
                </button>
                
                {!updateAvailable.force_update && (
                  <button
                    onClick={dismissUpdate}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3.5 px-6 rounded-xl transition-colors"
                  >
                    Remind Me Later
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div></MotionPortal>
    </AnimatePresence>
  );
}
