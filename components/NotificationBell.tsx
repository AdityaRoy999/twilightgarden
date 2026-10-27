import {notificationPath} from '../lib/notificationRoutes';
import {useAuth} from '../contexts/AuthContext';
import { AppIcon } from './ui/Icons';
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import { BellIcon, BellIconHandle } from './ui/AnimatedIcons';

const NotificationBell: React.FC = () => {
    // Hooks cannot be conditionally called.
    // If useNotifications is undefined (outside provider), handle gracefully inside the hook or here.
    const { notifications, unreadCount, markAsRead, markAllAsRead, error } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const {user}=useAuth();
    const openNotification=(path:unknown)=>navigate(notificationPath(path,'/dashboard',user?.role));
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const bellRef = useRef<BellIconHandle>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleNotificationClick = (notification: { id: string; type: string; is_read: boolean; message: string; created_at: string }) => {
        markAsRead(notification.id);
        setIsOpen(false);

        if (notification.type.startsWith('game_invite|')) {
            // Legacy format: route embedded in type
            const route = notification.type.split('|')[1];
            if (route) openNotification(route);
        } else if (['game','game_invite'].includes(notification.type)) {
            const data = (notification as any).data;
            if (data?.url) openNotification(data.url);
            else openNotification('/games');
        } else if (notification.type === 'chat') {
            openNotification('/notes');
        } else if (notification.type === 'log') {
            openNotification('/dashboard');
        }
    };

    return (
        <div ref={dropdownRef} className="relative z-50">
            <button aria-label="Notifications" aria-expanded={isOpen}
                onClick={() => {
                    setIsOpen(!isOpen);
                    bellRef.current?.startAnimation();
                }}
                className={`relative min-h-11 min-w-11 p-2 rounded-full transition-colors flex items-center justify-center ${
                    isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-700'
                }`}
            >
                <BellIcon
                    ref={bellRef}
                    size={24}
                    isAnimated={true}
                    className={isDark ? 'text-white' : 'text-gray-700'}
                />
                <AnimatePresence>
                    {unreadCount > 0 && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="on-brand absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-[#121014]"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </motion.span>
                    )}
                </AnimatePresence>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`fixed md:absolute left-4 right-4 md:left-auto md:right-0 top-[75px] md:top-full mt-2 md:w-80 max-h-[400px] overflow-hidden rounded-2xl shadow-xl border flex flex-col z-[100] ${
                            isDark ? 'bg-surface-dark border-white/10' : 'bg-white border-gray-100'
                        }`}
                        style={{
                            maxHeight: 'min(400px, 80vh)'
                        }}
                    >
                        {/* Header */}
                        <div className={`p-4 border-b flex justify-between items-center ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                            <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => markAllAsRead()}
                                    className="text-xs text-primary font-semibold hover:underline"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>

                        {error && <p role="alert" className="p-3 text-sm text-red-500">{error}</p>}
                        {/* List */}
                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center flex flex-col items-center justify-center text-gray-400">
                                    <span className="app-icon-glyph text-4xl mb-2 opacity-30"><AppIcon name={"notifications_off"}/></span>
                                    <p className="text-sm">No notifications yet</p>
                                </div>
                            ) : (
                                <div>
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`p-4 border-b last:border-0 relative hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                                                !notification.is_read ? (isDark ? 'bg-white/5' : 'bg-pink-50/50') : ''
                                            } ${isDark ? 'border-white/5' : 'border-gray-50'}`}
                                        >
                                            <div className="flex gap-3 items-start">
                                                {!notification.is_read && (
                                                    <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm leading-snug break-words ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                        {(() => {
                                                            try {
                                                                const d = new Date(notification.created_at);
                                                                return isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
                                                            } catch { return ''; }
                                                        })()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NotificationBell;
