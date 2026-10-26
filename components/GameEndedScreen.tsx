import { AppIcon } from './ui/Icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const GameEndedScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Navigate to the correct games page based on user role
    const getGamesPath = () => {
        if (user?.role === 'partner') return '/partner/games';
        if (user?.role === 'admin') return '/admin/games';
        return '/games';
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
            <div className="text-6xl mb-6"><AppIcon name={"🎮"}/></div>
            <h2 className="text-lg font-semibold mb-6 text-gray-300">Game ended. Your partner may have left.</h2>
            <button
                onClick={() => navigate(getGamesPath())}
                className="px-8 py-3 rounded-2xl bg-[#b85b7a] text-white font-bold shadow-lg hover:brightness-105 active:scale-95 transition-transform"
            >
                Back to Games
            </button>
        </div>
    );
};

export default GameEndedScreen;
