import { AppIcon } from '../components/ui/Icons';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCouples } from '../contexts/CouplesContext';
import { motion } from 'framer-motion';

const JoinPartner: React.FC = () => {
  const navigate = useNavigate();
  const { joinCouple } = useCouples();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (code.length !== 6) {
      setError('Code must be 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await joinCouple(code.toUpperCase());
      // Successfully joined - navigate to partner dashboard
      navigate('/partner');
    } catch (err: any) {
      console.error('Join error:', err);
      setError(err.message || 'Invalid pairing code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background-dark text-white font-display">
      {/* Header */}
      <div className="flex items-center p-4 pb-2 justify-between z-10">
        <button 
          onClick={() => navigate('/welcome')} 
          className="text-white flex size-12 shrink-0 items-center justify-center cursor-pointer hover:bg-white/5 rounded-full transition-colors"
        >
          <span className="app-icon-glyph"><AppIcon name={"arrow_back_ios_new"}/></span>
        </button>
        <h2 className="text-white text-lg font-bold flex-1 text-center pr-12">
          Connect with Partner
        </h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Icon */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mb-8"
        >
          <span className="app-icon-glyph text-5xl text-blue-400"><AppIcon name={"favorite"}/></span>
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-1 -right-1 text-2xl"
          >

            <AppIcon name={"💙"}/>
          </motion.div>
        </motion.div>

        {/* Title */}
        <div className="text-center mb-8 max-w-sm">
          <h1 className="text-3xl font-bold mb-3">Enter Pairing Code</h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Ask your partner for their 6-character code from the app to connect your accounts.
          </p>
        </div>

        {/* Code Input */}
        <div className="w-full max-w-sm space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="w-full text-center text-3xl font-mono tracking-[0.3em] py-4 bg-white/5 border-2 border-white/10 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-white/20"
            />
            <p className="text-center text-white/40 text-xs">
              The code is case-insensitive
            </p>
          </div>

          <button
            onClick={handleJoin}
            disabled={loading || code.length !== 6}
            className="on-brand w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span className="app-icon-glyph"><AppIcon name={"link"}/></span>
                <span>Connect Now</span>
              </>
            )}
          </button>

          <p className="text-center text-white/40 text-sm pt-4">
            Don't have a code?{' '}
            <button 
              onClick={() => navigate('/signup')}
              className="text-primary font-semibold hover:underline"
            >
              Track your own cycle
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinPartner;
