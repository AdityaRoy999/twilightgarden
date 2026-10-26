import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../contexts/ThemeContext';
import { useTutorial } from '../../contexts/TutorialContext';
import { tutorialRegistry } from './tutorialData';

export const GlobalGameTutorial: React.FC = () => {
    const location = useLocation();
    const { primaryColor } = useTheme();
    const { isOpen, activeGameId, openTutorial, closeTutorial } = useTutorial();

    // Auto-show logic removed as per user request
    useEffect(() => {
        // Tutorials now only play when manually triggered
    }, [location.pathname]);

    const handleOpenTutorial = () => {
        if (activeGameId) openTutorial(activeGameId);
    };

    const config = activeGameId ? tutorialRegistry[activeGameId] : null;

    return (
        <>


            {/* The Tutorial Video Modal */}
            <AnimatePresence>
                {isOpen && config && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
                    >


                        <div className="relative w-full max-w-[380px] aspect-[9/16] rounded-[32px] overflow-hidden shadow-2xl border border-white/10 bg-background-dark">
                            {/* Close Button */}
                            <button
                                onClick={closeTutorial}
                                className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all active:scale-95"
                            >
                                <span className="material-symbols-outlined text-white">close</span>
                            </button>
                            
                            <video
                                src={`/tutorials/${activeGameId}.mp4`}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                                onEnded={closeTutorial}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
