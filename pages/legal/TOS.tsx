import { AppIcon } from '../../components/ui/Icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';

const TOS: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background-dark text-white p-6 pb-20">
            <div className="max-w-2xl mx-auto pt-10">
                <button 
                    onClick={() => navigate(-1)} 
                    className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8 group"
                >
                    <span className="app-icon-glyph group-hover:-translate-x-1 transition-transform"><AppIcon name={"arrow_back"}/></span>
                    <span>Back</span>
                </button>

                <div className="bg-surface-dark/40 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 z-0"></div>
                    <div className="relative z-10 space-y-6">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            Terms of Service
                        </h1>
                        <p className="text-white/40 text-sm">Last Updated: February 20, 2026</p>

                        <div className="space-y-6 text-white/80 leading-relaxed text-base">
                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">1. Description of Service</h2>
                                <p>Twilight Garden is a cycle tracking and wellness application designed for individuals and couples. Features include period tracking, shared cycle insights, and AI-generated wellness suggestions.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">2. No Medical Advice</h2>
                                <p className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-primary-light">
                                    <strong>The App is not a medical device.</strong> Content provided, including AI suggestions, does not constitute medical advice. Always consult a professional for medical concerns.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">3. Partner Sharing</h2>
                                <p>By joining a "Couple," you explicitly consent to sharing your cycle and symptom data with your linked partner. You can disable this sharing ("Ghost Mode") at any time in settings.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">4. AI Features</h2>
                                <p>We use Google Gemini AI to analyze your logged symptoms and moods to provide helpful reflections. Your identity is not shared with the AI processing service.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">5. Termination</h2>
                                <p>We reserve the right to suspend or terminate access to the App for violations of these Terms or for any other reason at our discretion.</p>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            {/* Decorative background gradients */}
            <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[30%] bg-primary/10 blur-[120px] rounded-full -z-10"></div>
            <div className="fixed bottom-[-5%] left-[-5%] w-[50%] h-[40%] bg-primary/5 blur-[100px] rounded-full -z-10"></div>
        </div>
    );
};

export default TOS;
