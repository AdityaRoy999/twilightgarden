import { localDateKey } from '../lib/dates';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

interface AdminStats {
    totalUsers: number;
    activeToday: number;
}

interface AdminContextType {
    users: UserProfile[];
    stats: AdminStats;
    recentLogs: any[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, activeToday: 0 });
    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async (isBackground = false) => {
        if (!isBackground) setIsLoading(true);

        try {
            // Fetch Profiles
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .neq('role', 'admin') // Filter out admins if needed, usually admins want to see users
                .order('updated_at', { ascending: false });

            if (profilesError) throw profilesError;

            setUsers(profiles || []);

            // Fetch Logs Stats
            const today = localDateKey();
            const { data: logs, error: logsError } = await supabase
                .from('daily_logs')
                .select('*')
                .eq('date', today);

            if (!logsError) {
                setStats({
                    totalUsers: profiles?.length || 0,
                    activeToday: logs?.length || 0
                });
                setRecentLogs(logs || []);
            }

        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial Fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refreshData = async () => {
        await fetchData(true); // Background refresh
    };

    return (
        <AdminContext.Provider value={{ users, stats, recentLogs, isLoading, refreshData }}>
            {children}
        </AdminContext.Provider>
    );
};

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (context === undefined) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
};
