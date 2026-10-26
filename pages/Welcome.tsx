import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FeatureCarousel } from '../components/FeatureCarousel';

const Welcome: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="reference-welcome relative flex min-h-dvh w-full flex-col bg-background-dark text-white font-display overflow-x-clip">
      {/* Fixed Background Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-accent-teal/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[20%] left-[-10%] w-[300px] h-[300px] bg-accent-ochre/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-[40%] left-[20%] w-[200px] h-[200px] bg-primary/15 rounded-full blur-[90px]"></div>
      </div>

      {/* Scrollable Content */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-6 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-12">
        <div className="flex w-full shrink-0 flex-col items-center">
            <FeatureCarousel />
        </div>

        <div className="w-full shrink-0">
          <div className="flex flex-col gap-4 max-w-sm mx-auto">
            {/* Primary CTA - For cycle tracking */}
            <button
              onClick={() => navigate('/signup')}
              className="on-brand relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-[1.2rem] h-[3.75rem] px-5 bg-primary hover:bg-[#c95b80] active:scale-[0.98] transition-all duration-200 text-white shadow-lg shadow-primary/20 ring-1 ring-white/10"
            >
              <span className="text-[17px] font-bold leading-normal tracking-wide">Track My Cycle</span>
              <span className="ml-2 text-lg">🌸</span>
            </button>

            {/* Secondary CTA - For partners */}
            <button
              onClick={() => navigate('/signup?mode=partner')}
              className="relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-[1.2rem] h-[3.75rem] px-5 bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all duration-200 text-white border border-white/20"
            >
              <span className="text-[17px] font-bold leading-normal tracking-wide">Join as Partner</span>
              <span className="ml-2 text-lg">💙</span>
            </button>

            <button onClick={() => navigate('/login')} className="text-white/40 text-[15px] font-medium hover:text-white transition-colors mt-2">
              Already have an account?{' '}
              <span className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">Log in</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
