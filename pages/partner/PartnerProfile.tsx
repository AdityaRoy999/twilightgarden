import { AppIcon } from '../../components/ui/Icons';
import { uploadAvatar } from '../../lib/media';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, Lock } from '../../components/ui/Icons';
// PartnerProfile cleanup
import { useCouples } from '../../contexts/CouplesContext';
import { SyncHistoryModal } from '../../components/SyncHistoryModal';

const PartnerProfile: React.FC = () => {
  const { user, signOut } = useAuth();
    const { theme, toggleTheme, primaryColor, updatePrimaryColor, animationsEnabled, updateAnimationsEnabled, solidNavBg, updateSolidNavBg } = useTheme();
  const { hasCloudBackup } = useCouples();
  const navigate = useNavigate();
  const [showSyncModal, setShowSyncModal] = useState(false);
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [partnerNickname, setPartnerNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets = [
    '#c33367', // Rose
    '#ec4899', // Hot Pink
    '#d946ef', // Fuchsia
    '#8b5cf6', // Violet
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#0ea5e9', // Sky
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
  ];

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        const profile = data as any;
        setFullName(profile.full_name || '');
        setBio(profile.bio || '');
        setStatus(profile.status || '');
        setAvatarUrl(profile.avatar_url);
        setPartnerNickname(profile.partner_nickname || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      if (!user) throw new Error('Please sign in.');
      const url = await uploadAvatar(event.target.files[0], user.id);
      setAvatarUrl(url);

    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    setSaveMessage(null);
    try {
        const updates = {
            id: user.id,
            full_name: fullName,
            bio: bio,
            status: status,
            avatar_url: avatarUrl,
            partner_nickname: partnerNickname,
            updated_at: new Date().toISOString(),
        } as any;

        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) throw error;

        setSaveMessage('Profile updated successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
    } catch (error: any) {
        alert('Error updating profile: ' + error.message);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
      try {
          await signOut();
          navigate('/login');
      } catch (error) {
          console.error("Error signing out:", error);
      }
  };

  const handleToggleAnimations = async () => {
      const newValue = !animationsEnabled;
      updateAnimationsEnabled(newValue);

      const { error } = await supabase.auth.updateUser({
          data: { animationsEnabled: newValue }
      });
      if (error) {
          console.error('Failed to sync animation setting', error);
      }
  };

  const handleToggleSolidNav = async () => {
      const newValue = !solidNavBg;
      updateSolidNavBg(newValue);

      const { error } = await supabase.auth.updateUser({
          data: { solidNavBg: newValue }
      });
      if (error) {
          console.error('Failed to sync solid nav setting', error);
      }
  };

  return (
    <div className={`animate-slideIn font-display flex flex-col min-h-screen transition-colors duration-300 pb-24 relative overflow-x-hidden bg-background-dark`}>
      {/* Header */}
      <header className={`sticky top-0 z-20 px-6 pt-6 pb-2 transition-colors duration-300 bg-background-dark/95`}>
         <div className="flex items-center justify-between mb-4">
            <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                {activeTab === 'profile' ? 'Public Profile' : 'Settings'}
            </h2>
             {/* Dynamic Icon based on tab? Or just spacer */}
             <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                 <span className={`app-icon-glyph ${isDark ? 'text-white' : 'text-gray-600'}`}><AppIcon name={activeTab === 'profile' ? 'person' : 'settings'}/></span>
             </div>
         </div>

         {/* Tabs */}
         <div className={`flex p-1 rounded-2xl mb-6 ${isDark ? 'bg-surface-dark' : 'bg-gray-100'}`}>
            <button
                onClick={() => setActiveTab('profile')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all relative ${
                    activeTab === 'profile' ? 'text-white' : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800')
                }`}
            >
                {activeTab === 'profile' && (
                    <motion.div
                        layoutId="activeTabProfile"
                        className="absolute inset-0 rounded-xl shadow-md bg-primary"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                )}
                <span className="relative z-10">Public Profile</span>
            </button>
            <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all relative ${
                    activeTab === 'settings' ? 'text-white' : (isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800')
                }`}
            >
                 {activeTab === 'settings' && (
                    <motion.div
                        layoutId="activeTabProfile"
                        className="absolute inset-0 rounded-xl shadow-md bg-primary"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                )}
                <span className="relative z-10">App Settings</span>
            </button>
         </div>
      </header>

      <main className="flex-1 px-6 pt-6">
        <AnimatePresence mode="wait">
            {activeTab === 'profile' ? (
                <motion.div
                    key="profile"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-col items-center gap-6"
                >
                    {/* Avatar Section */}
                    <div className="relative group">
                    <div className={`relative w-32 h-32 rounded-full p-1 border-2 border-dashed ${isDark ? 'border-white/20' : 'border-gray-300'}`}>
                        <img
                        src={avatarUrl || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}
                        alt="Profile"
                        className="w-full h-full rounded-full object-cover shadow-lg"
                        />
                        {uploading && (
                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleAvatarClick}
                        disabled={uploading}
                        className={`on-brand absolute bottom-1 right-1 flex items-center justify-center p-2.5 rounded-full shadow-lg border-[3px] active:scale-95 transition-all cursor-pointer hover:scale-105 bg-primary text-white ${isDark ? 'border-[#121014]' : 'border-[#FDFCF8]'}`}
                    >
                        <span className="app-icon-glyph text-[18px]"><AppIcon name={"photo_camera"}/></span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                    />
                    </div>

                    {/* Form Fields */}
                    <div className="w-full flex flex-col gap-5">
                         {/* Name */}
                         <div className="space-y-2">
                             <label className={`text-xs font-bold ml-1 uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Full Name</label>
                             <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className={`w-full h-14 pl-4 pr-12 rounded-2xl border font-medium focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none ${
                                    isDark ? 'bg-surface-dark border-white/10 text-white' : 'bg-white border-gray-200 text-[var(--text-primary)]'
                                }`}
                                placeholder="Enter your name"
                             />
                         </div>


                         {/* Bio */}
                         <div className="space-y-2">
                             <label className={`text-xs font-bold ml-1 uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Bio</label>
                             <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                className={`w-full h-32 pl-4 pr-4 py-4 rounded-2xl border font-medium focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none resize-none leading-relaxed ${
                                    isDark ? 'bg-surface-dark border-white/10 text-white' : 'bg-white border-gray-200 text-[var(--text-primary)]'
                                }`}
                                placeholder="Write a short bio..."
                             />
                         </div>

                         <button
                            onClick={handleSave}
                            disabled={isLoading || uploading}
                            className="on-brand w-full h-14 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:pointer-events-none"
                         >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : saveMessage ? (
                                <>
                                    <span className="app-icon-glyph text-[20px]"><AppIcon name={"check_circle"}/></span>
                                    <span>Saved!</span>
                                </>
                            ) : (
                                <span>Save Changes</span>
                            )}
                         </button>
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col gap-8"
                >
                    {/* General Section */}
                    <section>
                        <h3 className={`text-sm font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>General</h3>
                        <div className={`p-4 rounded-2xl shadow-sm border mb-6 flex flex-col gap-4 ${isDark ? 'bg-surface-dark border-white/5' : 'bg-white border-gray-100'}`}>
                             <div className="flex flex-col gap-2">
                                <label className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Partner Nickname</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="e.g. Puchii, Tutii"
                                        value={partnerNickname}
                                        onChange={(e) => setPartnerNickname(e.target.value)}
                                        onBlur={handleSave} // Auto-save on blur
                                        className={`w-full h-12 pl-4 pr-10 rounded-xl border focus:ring-2 focus:ring-primary/20 outline-none transition-all ${
                                            isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                                        }`}
                                    />
                                    <span className="app-icon-glyph absolute right-3 top-3 text-gray-400 pointer-events-none"><AppIcon name={"edit_note"}/></span>
                                </div>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Notifications will use this name.</p>
                            </div>
                        </div>

                         <div className={`rounded-2xl overflow-hidden shadow-sm border mb-6 ${isDark ? 'bg-surface-dark border-white/5' : 'bg-white border-gray-100'}`}>
                            <div
                                className={`flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group`}
                                onClick={() => navigate('/partner/notifications')}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${isDark ? 'bg-white/5 text-pink-400' : 'bg-pink-50 text-pink-500'}`}>
                                        <span className="app-icon-glyph"><AppIcon name={"notifications"}/></span>
                                    </div>
                                    <div>
                                        <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notifications</h4>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Manage alerts</p>
                                    </div>
                                </div>
                                <span className="app-icon-glyph text-gray-400"><AppIcon name={"chevron_right"}/></span>
                            </div>
                        </div>
                    </section>

                    {/* Appearance Section */}
                    <section>
                        <h3 className={`text-sm font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Appearance</h3>

                        {/* Dark Mode Toggle */}
                        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border mb-4 ${isDark ? 'bg-surface-dark border-white/5' : 'bg-white border-gray-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                                    <span className="app-icon-glyph"><AppIcon name={"dark_mode"}/></span>
                                </div>
                                <div>
                                    <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Dark Mode</h4>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Easier on the eyes</p>
                                </div>
                            </div>
                            <button
                                onClick={toggleTheme}
                                className={`w-12 h-7 rounded-full transition-colors relative ${isDark ? 'bg-primary' : 'bg-gray-300'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-transform ${isDark ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>

                        {/* Animations Toggle */}
                        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border mb-4 ${isDark ? 'bg-surface-dark border-white/5' : 'bg-white border-gray-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                    <span className="app-icon-glyph"><AppIcon name={animationsEnabled ? 'animation' : 'stop_circle'}/></span>
                                </div>
                                <div>
                                    <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Enable Animations</h4>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Fluid app interactions</p>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleAnimations}
                                className={`w-12 h-7 rounded-full transition-colors relative ${animationsEnabled ? 'bg-primary' : 'bg-gray-300'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-transform ${animationsEnabled ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>

                        {/* Solid Nav Bg Toggle */}
                        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border mb-4 ${isDark ? 'bg-surface-dark border-white/5' : 'bg-white border-gray-100'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                                    <span className="app-icon-glyph"><AppIcon name={solidNavBg ? 'layers_clear' : 'blur_on'}/></span>
                                </div>
                                <div>
                                    <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Solid Navbar Bg</h4>
                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Remove glassblur effect</p>
                                </div>
                            </div>
                            <button
                                onClick={handleToggleSolidNav}
                                className={`w-12 h-7 rounded-full transition-colors relative ${solidNavBg ? 'bg-primary' : 'bg-gray-300'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-transform ${solidNavBg ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>

                        {/* Accent Color */}
                         <div className={`p-5 rounded-2xl shadow-sm border ${isDark ? 'bg-surface-dark border-white/5' : 'bg-white border-gray-100'}`}>
                            <h4 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Accent Color</h4>
                            <div className="grid grid-cols-5 gap-4 sm:gap-5">
                                {presets.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => updatePrimaryColor(color)}
                                        className={`w-full aspect-square rounded-xl transition-all flex items-center justify-center relative ${
                                            primaryColor === color
                                                ? 'ring-2 ring-offset-2 ring-primary scale-105 shadow-lg z-10'
                                                : 'hover:scale-105'
                                        } ${isDark ? 'ring-offset-[#1E1E1E]' : 'ring-offset-white'}`}
                                        style={{ backgroundColor: color }}
                                    >
                                        {primaryColor === color && (
                                            <span className="app-icon-glyph text-white text-sm drop-shadow-md"><AppIcon name={"check"}/></span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Security Section */}
                    <section>
                         <h3 className={`text-sm font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Security</h3>
                         <div className={`rounded-2xl overflow-hidden shadow-sm border ${isDark ? 'bg-surface-dark border-white/5' : 'bg-white border-gray-100'}`}>
                            <div
                                className="flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                                onClick={() => setShowSyncModal(true)}
                                role="button" tabIndex={0} aria-label="Chat backup"
                                onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setShowSyncModal(true);}}}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${isDark ? 'bg-white/5 text-pink-400' : 'bg-pink-50 text-pink-500'}`}>
                                        <Shield className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Chat backup</h4>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {hasCloudBackup ? 'Backup on' : 'Optional · restore chats on a new device'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!hasCloudBackup && (
                                        <span className="px-2 py-0.5 bg-primary/10 text-primary dark:text-pink-300 text-[10px] font-bold rounded-full">Set up</span>
                                    )}
                                    <span className="app-icon-glyph text-gray-400"><AppIcon name={"chevron_right"}/></span>
                                </div>
                            </div>
                         </div>
                    </section>

                    {/* Account Section */}
                    <section>
                         <h3 className={`text-sm font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Account</h3>

                         <div className={`p-1 rounded-2xl overflow-hidden shadow-sm border ${isDark ? 'bg-surface-dark border-white/5' : 'bg-white border-gray-100'}`}>
                             <button
                                onClick={handleSignOut}
                                className={`w-full p-4 flex items-center justify-between transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                             >
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500">
                                         <span className="app-icon-glyph"><AppIcon name={"logout"}/></span>
                                     </div>
                                     <div className="text-left">
                                         <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Sign Out</h4>
                                         <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Log out of your account</p>
                                     </div>
                                 </div>
                                 <span className="app-icon-glyph text-gray-400"><AppIcon name={"chevron_right"}/></span>
                             </button>
                         </div>
                    </section>
                </motion.div>
            )}
        </AnimatePresence>
      <p className="solar-attribution">Solar icons by <a href="https://www.figma.com/community/file/1166831539721848736" target="_blank" rel="noreferrer">480 Design</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p></main>

      <SyncHistoryModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </div>
  );
};

export default PartnerProfile;
