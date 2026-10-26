import { AppIcon } from '../../components/ui/Icons';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, Notification } from '../../hooks/useNotifications';
import { useTheme } from '../../contexts/ThemeContext';
import { formatDistanceToNow } from 'date-fns';

const PartnerNotifications: React.FC = () => {
    const { notifications, markAsRead, markAllAsRead, error } = useNotifications();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    // Mark all as read when visiting the page (optional, user might want to keep some unread)
    // useEffect(() => {
    //     markAllAsRead();
    // }, []);

    const handleNotificationClick = (id: string, type: string) => {
        markAsRead(id);

        if (type.startsWith('game_invite|')) {
            // Legacy format: route embedded in type
            const route = type.split('|')[1];
            if (route) navigate(route);
        } else if (['game','game_invite'].includes(type)) {
            // New format: route in data.url
            const notif = notifications.find(n => n.id === id);
            const data = (notif as any)?.data;
            if (data?.url) navigate(data.url);
            else navigate('/partner/games');
        } else if (type === 'chat') {
            navigate('/notes');
        } else if (type === 'log') {
            navigate('/partner/dashboard');
        }
    };

    return (
        <div className={`min-h-screen transition-colors duration-300 bg-background-dark`}>
            {/* Header */}
            <header className={`sticky top-0 z-10 px-6 py-4 flex items-center gap-4 bg-background-dark/95 backdrop-blur-sm`}>
                <button
                    onClick={() => navigate(-1)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
                >
                    <span className="app-icon-glyph"><AppIcon name={"arrow_back"}/></span>
                </button>
                <h1 className={`text-xl font-bold flex-1 ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>Notifications</h1>
                <button
                    onClick={() => markAllAsRead()}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
                    title="Mark all as read"
                >
                    <span className="app-icon-glyph"><AppIcon name={"done_all"}/></span>
                </button>
            </header>

            <main className="px-6 pb-24">
                <div className="flex flex-col gap-4">
                    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
                    <AnimatePresence initial={false}>
                        {notifications.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center justify-center py-20 text-center"
                            >
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                                    <span className={`app-icon-glyph text-4xl ${isDark ? 'text-gray-600' : 'text-gray-300'}`}><AppIcon name={"notifications_off"}/></span>
                                </div>
                                <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>No notifications</h3>
                                <p className={`text-sm text-gray-500`}>You're all caught up!</p>
                            </motion.div>
                        ) : (
                            notifications.map((notification) => (
                                <motion.div
                                    key={notification.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    onClick={() => handleNotificationClick(notification.id, notification.type)}
                                    className={`relative overflow-hidden rounded-2xl p-4 shadow-sm border cursor-pointer transition-all active:scale-[0.98] ${
                                        isDark
                                            ? `bg-surface-dark border-white/5 ${!notification.is_read ? 'bg-white/5' : ''}`
                                            : `bg-white border-gray-100 ${!notification.is_read ? 'bg-pink-50/30' : ''}`
                                    }`}
                                >
                                    {!notification.is_read && (
                                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
                                    )}

                                    <div className="flex gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                            isDark ? 'bg-white/5' : 'bg-gray-50'
                                        }`}>
                                            <span className={`app-icon-glyph ${
                                                notification.type.startsWith('game_invite') ? 'text-purple-500' :
                                                notification.type === 'log' ? 'text-primary' : 'text-gray-500'
                                            }`}><AppIcon name={notification.type.startsWith('game_invite') ? 'sports_esports' :
                                                 notification.type === 'log' ? 'edit_calendar' : 'notifications'}/></span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-snug mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                {notification.message}
                                            </p>
                                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

export default PartnerNotifications;
