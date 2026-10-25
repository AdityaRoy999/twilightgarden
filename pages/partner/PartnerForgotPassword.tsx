import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const PartnerForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/reset-password`,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Check your email for the password reset link.',
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background-dark text-white font-display">
      <div className="flex items-center p-4 pb-2 justify-between z-10">
        <button onClick={() => navigate('/partner/login')} className="text-white flex size-12 items-center justify-center hover:bg-white/5 rounded-full">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h2 className="text-lg font-bold flex-1 text-center pr-12">Reset Password</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
             <span className="material-symbols-outlined text-4xl text-blue-400">lock_reset</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Forgot Password?</h1>
          <p className="text-white/60 text-sm">Enter your email to receive a reset link.</p>
        </div>

        <form onSubmit={handleReset} className="w-full max-w-md space-y-6">
          {message && (
            <div className={`p-3 rounded-lg border text-sm text-center ${message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {message.text}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-white/70 ml-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-5 focus:border-blue-500 outline-none transition-all"
              placeholder="your@email.com"
            />
          </div>

          <button type="submit" disabled={loading} className="w-full h-14 bg-blue-500 hover:bg-blue-600 rounded-xl font-bold text-white transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
            <span>{loading ? 'Sending Link...' : 'Send Reset Link'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default PartnerForgotPassword;
