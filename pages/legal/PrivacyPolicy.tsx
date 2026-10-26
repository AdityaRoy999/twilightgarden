import { AppIcon } from '../../components/ui/Icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
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
                    <div className="absolute inset-0 bg-blue-500/5 z-0"></div>
                    <div className="relative z-10 space-y-6">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                            Privacy Policy
                        </h1>
                        <p className="text-white/40 text-sm">Last Updated: February 20, 2026</p>

                        <div className="space-y-6 text-white/80 leading-relaxed text-base">
                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
                                <p>We collect information you provide directly to us, including account details (name, email), health and cycle data (period dates, symptoms), and partner connection information.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Information</h2>
                                <p>Your data is used to provide accurate cycle predictions, send personalized reminders, and enable sharing with your linked partner. AI-generated insights use anonymized symptom data.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">3. Data Sharing & Sharing</h2>
                                <p className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-300">
                                    <strong>Partner Visibility:</strong> If you are in "Couples Mode," your data is shared with your partner. You can use "Ghost Mode" at any time to temporarily pause sharing.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">4. Data Security</h2>
                                <p>We implement strict security measures, including database-level isolation (RLS), to ensure your health data remains private and inaccessible to unauthorized parties.</p>
                            </section>

                            <section>
                                <h2 className="text-xl font-semibold text-white mb-3">5. Data Deletion</h2>
                                <p>You have the right to delete your account and all associated health data at any time through the App settings.</p>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            {/* Decorative background gradients */}
            <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[30%] bg-blue-500/10 blur-[120px] rounded-full -z-10"></div>
            <div className="fixed bottom-[-5%] left-[-5%] w-[50%] h-[40%] bg-blue-500/5 blur-[100px] rounded-full -z-10"></div>
        </div>
    );
};

export default PrivacyPolicy;
