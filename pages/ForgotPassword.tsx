import { AppIcon } from '../components/ui/Icons';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { recoveringPassword, completePasswordRecovery } = useAuth();
  const [step, setStep] = useState<1 | 2>(() => window.location.hash.includes('reset-password') ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/#/reset-password` });
      if (error) throw error;
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!recoveringPassword) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'recovery',
      });
      if (verifyError) throw verifyError;
      }

      // 2. Update Password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      // Success
      completePasswordRecovery();
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="safe-screen recovery-screen min-h-screen bg-background-dark text-white flex flex-col p-6 font-display">
      <button
        onClick={() => step === 1 ? navigate('/login') : setStep(1)}
        className="self-start p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
      >
        <span className="app-icon-glyph"><AppIcon name={"arrow_back"}/></span>
      </button>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full gap-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {step === 1 ? 'Forgot Password?' : 'Reset Password'}
          </h1>
          <p className="text-gray-400">
            {step === 1
              ? "Enter your email to receive a recovery code."
              : `Enter the code sent to ${email} and your new password.`}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 ? (
             <motion.form
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSendCode}
                className="flex flex-col gap-4"
             >
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="on-brand w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </motion.form>
          ) : (
            <motion.form
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleResetPassword}
                className="flex flex-col gap-4"
             >
               {!recoveringPassword && <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">Recovery Code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors tracking-widest text-center text-lg font-mono"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>}

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-300">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="on-brand w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ForgotPassword;
