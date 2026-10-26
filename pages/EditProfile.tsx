import { uploadAvatar } from '../lib/media';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState(''); // "Status" not explicitly in UI mock but user asked for it.
  // Wait, user asked for "bio and status". The mock has "Bio & Status" as one box.
  // I will check the mock logic. The mock had one textarea for "Bio & Status".
  // I will assume "Bio" is the main text. I'll add a separate small input for "Status" or keep them combined?
  // "only the name and the bio and status can be changed in the profile table I want also the bio status"
  // Let's add a separate Status field to be precise.

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        const profileData = data as any;
        setFullName(profileData.full_name || '');
        setBio(profileData.bio || '');
        setStatus(profileData.status || '');
        setAvatarUrl(profileData.avatar_url);
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
    try {
        const updates = {
            id: user.id,
            full_name: fullName,
            bio: bio,
            status: status,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
        } as any; // Cast mainly for the new columns if types aren't fully propagated yet

        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) throw error;

        // Update twilight_profile cache with timestamp for staleness tracking
        try {
          localStorage.setItem('twilight_profile', JSON.stringify({ ...updates, _cachedAt: Date.now() }));
        } catch {}

        // Refresh AuthContext user state + cache so all pages see the new avatar instantly
        await refreshUser();

        navigate(-1);
    } catch (error: any) {
        alert('Error updating profile: ' + error.message);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="animate-slideIn font-display flex flex-col min-h-screen bg-background-dark transition-colors duration-300 pb-6 relative overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-background-dark/95 dark:bg-background-dark/95 backdrop-blur-sm transition-colors duration-300">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[var(--text-primary)] dark:text-white text-2xl">arrow_back</span>
        </button>
        <h2 className="text-[17px] font-bold text-[var(--text-primary)] dark:text-white">Edit Profile</h2>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 px-6 pt-4 flex flex-col items-center">
        {/* Avatar Section */}
        <div className="relative mb-10 group">
          <div className="relative w-32 h-32 rounded-full p-1 border-2 border-dashed border-gray-300 dark:border-white/20">
             <img
               src={avatarUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%23ccc'%3E%3Ccircle cx='50' cy='40' r='20'/%3E%3Cellipse cx='50' cy='85' rx='30' ry='22'/%3E%3C/svg%3E"}
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
            className="on-brand absolute bottom-1 right-1 flex items-center justify-center bg-primary text-white p-2.5 rounded-full shadow-lg border-[3px] border-[#FDFCF8] dark:border-background-dark active:scale-95 transition-all cursor-pointer hover:scale-105"
           >
             <span className="material-symbols-outlined text-[18px]">photo_camera</span>
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
        <div className="w-full flex flex-col gap-6">
           {/* Full Name */}
           <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">Full Name</label>
              <div className="relative group">
                 <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-14 pl-4 pr-12 rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 text-[var(--text-primary)] dark:text-white font-medium focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none"
                    placeholder="Enter your name"
                 />
                 <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">person</span>
              </div>
           </div>

           {/* Email */}
           <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">Email Address</label>
              <div className="relative group">
                 <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full h-14 pl-4 pr-12 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-400 font-medium cursor-not-allowed shadow-none outline-none"
                 />
                 <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">mail</span>
              </div>
           </div>


           {/* Bio */}
           <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">Bio</label>
              <div className="relative group">
                 <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full h-32 pl-4 pr-4 py-4 rounded-2xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 text-[var(--text-primary)] dark:text-white font-medium focus:ring-1 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none resize-none leading-relaxed"
                    placeholder="Write a short bio..."
                 />
              </div>
              <p className="text-[10px] text-gray-400 text-right px-1">{bio.length}/150</p>
           </div>
        </div>
      </main>

      {/* Footer Action */}
      <div className="px-6 pb-8 mt-auto pt-6">
        <button
          onClick={handleSave}
          disabled={isLoading || uploading}
          className="on-brand w-full h-14 bg-primary hover:bg-[#86375a] text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <span>Save Changes</span>
              <span className="material-symbols-outlined text-[20px]">check</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default EditProfile;
