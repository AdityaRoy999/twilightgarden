import { IllustratedGuide } from '../components/wellness/IllustratedGuide';
import { SleepEnergy } from '../components/wellness/SleepEnergy';
import { WellnessIllustration } from '../components/wellness/WellnessIllustration';
import { useGeneratedText } from '../hooks/useGeneratedText';
import { useAppMotion } from '../hooks/useAppMotion';
import { springs, motionTransition } from '../lib/motion';
import { ReferenceHeading } from '../components/ui/ReferenceArt';
import { AppIcon } from '../components/ui/Icons';
import { useToday } from '../hooks/useToday';
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import NotificationBell from '../components/NotificationBell';
import {
    generateWellnessTips,
    generateEmpathyAlerts,
    analyzeSleepEnergyCorrelations,
    searchNearbyPharmacies,
    getRouteToShop,
    WellnessContext,
    NearbyShop,
    RouteGeometry,
} from '../lib/wellnessAI';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { pharmacyIcon, userIcon } from '../lib/mapIcons';

type Tab = 'tips' | 'sleep' | 'empathy' | 'shops';

const Wellness: React.FC = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { logs, getCyclePhase, cycleSettings } = useData();
    const cycleData = getCyclePhase();

    const [activeTab, setActiveTab] = useState<Tab>('tips');
    const [locationError, setError] = useState('');
    const { reduced } = useAppMotion();

    // Nearest Shops State
    const [shops, setShops] = useState<NearbyShop[]>([]);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [selectedShop, setSelectedShop] = useState<NearbyShop | null>(null);
    const [route, setRoute] = useState<RouteGeometry | null>(null);
    const [mapLoading, setMapLoading] = useState(false);

    // Build context for AI
    const todayStr = useToday();
    const todayLog = logs.find(l => l.date === todayStr);

    // Get last 15 logs for history context
    const logHistory = useMemo(() => {
        return logs
            .filter(l => l.date !== todayStr) // Exclude today
            .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
            .slice(0, 15)
            .map(l => `- ${l.date}${l.notes?.startsWith('[Sample history:') ? ' (fictional sample)' : ''}: Phase=${getCyclePhase(l.date).phase}, Moods=[${l.moods?.join(', ') || ''}], Symptoms=[${l.symptoms?.join(', ') || ''}], Energy=${l.energyLevel || 'N/A'}, Sleep=${l.sleepQuality || 'N/A'}`)
            .join('\n');
    }, [logs, todayStr, cycleSettings]);

    const ctx: WellnessContext = {
        phase: cycleData.phase,
        cycleDay: cycleData.currentDay,
        moods: todayLog?.moods || [],
        symptoms: todayLog?.symptoms || [],
        sleepQuality: todayLog?.sleepQuality,
        energyLevel: todayLog?.energyLevel,
        logHistory,
    };

    // Sleep/Energy correlations (client-side)
    const sleepData = useMemo(() => analyzeSleepEnergyCorrelations(logs), [logs]);

    const guidance = useGeneratedText({ tips: () => generateWellnessTips(ctx), empathy: () => generateEmpathyAlerts(ctx) }, JSON.stringify(ctx));
    const tipsText = guidance.entries.tips?.text || '';
    const empathyText = guidance.entries.empathy?.text || '';
    const activeGuidance = activeTab === 'tips' || activeTab === 'empathy' ? guidance.entries[activeTab] : undefined;
    const loading = activeGuidance?.status === 'loading';
    const error = activeTab === 'shops' ? locationError : activeGuidance?.error || '';
    const fetchTips = () => void guidance.request('tips', true);
    const fetchEmpathy = () => void guidance.request('empathy', true);
    useEffect(() => {
        if (activeTab === 'tips' || activeTab === 'empathy') void guidance.request(activeTab);
        if (activeTab === 'shops' && !userLocation) initShops();
    }, [activeTab, guidance.request]);

    const initShops = () => {
        setMapLoading(true);
        setError('');
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            setMapLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                setUserLocation([lat, lon]);

                const nearby = await searchNearbyPharmacies(lat, lon);
                setShops(nearby);
                setMapLoading(false);
            },
            (err) => {
                setError('Failed to get location. Please enable location services.');
                setMapLoading(false);
                console.error(err);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleShopSelect = async (shop: NearbyShop) => {
        setSelectedShop(shop);
        if (userLocation) {
            const r = await getRouteToShop(userLocation[0], userLocation[1], shop.lat, shop.lon);
            setRoute(r);
        }
    };

    const tabs: { key: Tab; label: string; icon: string }[] = [
        { key: 'tips', label: 'Tips', icon: 'spa' },
        { key: 'sleep', label: 'Sleep & Energy', icon: 'bedtime' },
        { key: 'empathy', label: 'Empathy', icon: 'favorite' },
        { key: 'shops', label: 'Nearest Pad', icon: 'location_on' },
    ];

    const renderTipsContent = () => {
        if (loading && !tipsText) return <LoadingSkeleton />;
        if (error) return <ErrorCard message={error} onRetry={fetchTips} isDark={isDark} />;

        return <IllustratedGuide text={tipsText} onRefresh={fetchTips} busy={loading}/>;
    };

    const renderSleepContent = () => <SleepEnergy data={sleepData}/>;

    const renderEmpathyContent = () => {
        if (loading && !empathyText) return <LoadingSkeleton/>;
        if (error) return <ErrorCard message={error} onRetry={fetchEmpathy} isDark={isDark}/>;
        return <div className="care-guide-view"><aside className="care-preview-banner"><AppIcon name="info" size={26}/><p>A preview of the kind of care suggestions your partner can explore. Each guide is personalized when it’s generated.</p><WellnessIllustration id="kind-message" decorative/></aside><IllustratedGuide text={empathyText} partner onRefresh={fetchEmpathy} busy={loading}/></div>;
    };

    // Helper component to recenter map when selecting a shop
    const MapUpdater = ({ center }: { center: [number, number] }) => {
        const map = useMap();
        useEffect(() => {
            map.setView(center, 15, { animate: true });
        }, [center, map]);
        return null;
    };

    const renderShopsContent = () => {
        if (mapLoading) return (
            <div className={`rounded-2xl p-8 text-center ${isDark ? 'bg-surface-dark border border-white/5' : 'bg-white border border-gray-100'} shadow-soft flex flex-col items-center justify-center min-h-[400px]`}>
                 <WellnessIllustration id="location" decorative/>
                 <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Locating Nearest Pads...</p>
                 <p className={`text-sm mt-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Finding nearby pharmacies and medical stores.</p>
            </div>
        );

        if (error) return <ErrorCard message={error} onRetry={initShops} isDark={isDark} />;

        return (
            <div className="flex flex-col md:grid md:grid-cols-[1fr_2fr] gap-6 max-w-6xl mx-auto w-full">

                {/* Left side: Cards List */}
                <div className="flex flex-col gap-4 h-[500px] overflow-y-auto no-scrollbar pr-2">
                    <div className={`rounded-2xl p-4 sticky top-0 z-10 ${isDark ? 'bg-gradient-to-br from-primary/20 to-pink-500/10 border border-primary/20 backdrop-blur-xl' : 'bg-gradient-to-br from-primary/10 to-pink-50 border border-primary/20 backdrop-blur-xl'}`}>
                        <p className={`text-sm font-bold ${isDark ? 'text-primary' : 'text-primary-dark'}`}>
                            <span className="app-icon-glyph text-sm mr-1 align-middle"><AppIcon name={"local_pharmacy"}/></span>
                            {shops.length} Pharmacies Nearby
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                            Select a pharmacy to view precise distance and routing on the map.
                        </p>
                    </div>

                    {shops.map((shop) => (
                        <div
                            key={shop.id}
                            onClick={() => handleShopSelect(shop)}
                            className={`shrink-0 rounded-2xl overflow-hidden border cursor-pointer transition-all duration-300 ${selectedShop?.id === shop.id
                                ? 'border-primary shadow-lg scale-[1.02] ring-2 ring-primary/20 ' + (isDark ? 'bg-primary/10' : 'bg-primary/5')
                                : isDark ? 'bg-surface-dark border-white/5 hover:bg-white/5' : 'bg-white border-gray-100 hover:bg-gray-50 hover:shadow-md'
                            }`}
                        >
                            {shop.imageUrl && (
                                <div className="w-full h-32 overflow-hidden bg-gray-100 dark:bg-gray-800">
                                    <img src={shop.imageUrl} alt={shop.name} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="p-4 flex flex-col gap-2">
                                <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{shop.name}</h4>
                                <div className="flex items-start gap-1">
                                    <span className="app-icon-glyph text-[14px] text-gray-400 mt-0.5"><AppIcon name={"location_on"}/></span>
                                    <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{shop.address}</p>
                                </div>
                                {shop.phoneNumber && (
                                    <div className="flex items-center gap-1">
                                        <span className="app-icon-glyph text-[14px] text-green-500"><AppIcon name={"call"}/></span>
                                        <p className={`text-xs font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{shop.phoneNumber}</p>
                                    </div>
                                )}

                                {selectedShop?.id === shop.id && route && (
                                    <div className={`mt-2 p-2 rounded-lg flex items-center justify-between ${isDark ? 'bg-black/50' : 'bg-primary/10'}`}>
                                        <div className="flex items-center gap-1.5">
                                            <span className="app-icon-glyph text-[14px] text-primary"><AppIcon name={"route"}/></span>
                                            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {(route.distance / 1000).toFixed(2)} km
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="app-icon-glyph text-[14px] text-primary"><AppIcon name={"schedule"}/></span>
                                            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {Math.round(route.duration / 60)} min
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right side: Map */}
                {userLocation && (
                    <div className={`rounded-2xl overflow-hidden h-[400px] md:h-[500px] border relative sticky top-24 ${isDark ? 'border-white/5' : 'border-gray-100'} shadow-soft z-0`}>
                        <MapContainer
                            center={userLocation}
                            zoom={14}
                            className="w-full h-full"
                            zoomControl={false}
                        >
                            {/* Free OSM Tiles */}
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                className={isDark ? 'map-tiles-dark' : ''}
                            />

                            {/* User Marker */}
                            <Marker position={userLocation} icon={userIcon}>
                                <Popup>You are here</Popup>
                            </Marker>

                            {/* Pharmacy Markers */}
                            {shops.map(shop => (
                                <Marker
                                    key={shop.id}
                                    position={[shop.lat, shop.lon]}
                                    icon={pharmacyIcon}
                                    eventHandlers={{
                                        click: () => handleShopSelect(shop),
                                    }}
                                >
                                    <Popup className="custom-popup">
                                        <div className="flex flex-col gap-1 p-1">
                                            <strong className="text-sm font-bold">{shop.name}</strong>
                                            <a
                                                href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="on-brand bg-primary text-white text-xs text-center font-bold py-1.5 mt-2 rounded-lg no-underline"
                                            >
                                                Start Navigation
                                            </a>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}

                            {/* Routing Polyline */}
                            {route && (
                                <Polyline
                                    positions={route.coordinates.map(c => [c[1], c[0]])} // OSRM is [lon,lat], Leaflet needs [lat,lon]
                                    pathOptions={{ color: 'var(--color-primary)', weight: 5, opacity: 0.8 }}
                                />
                            )}

                            {/* Recenter Map on Selected Shop */}
                            {selectedShop && <MapUpdater center={[selectedShop.lat, selectedShop.lon]} />}
                        </MapContainer>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="reference-page reference-wellness font-display flex flex-col">
            <ReferenceHeading title="Wellness" description="A little care, at your own pace." action={<NotificationBell/>}/>
            <section className="reference-card wellness-overview"><WellnessIllustration id={activeTab === 'sleep' ? 'sleep-chart' : activeTab === 'empathy' ? 'supportive-couple' : activeTab === 'shops' ? 'pharmacy' : 'gentle-stretch'} className="wellness-overview-art" decorative/><span className="reference-icon"><AppIcon name={activeTab === 'sleep' ? 'bedtime' : 'spa'} size={26}/></span><div><span className="bloom-eyebrow">Your daily rhythm</span><h2>{cycleData.phase === 'Unknown' ? 'One day at a time' : `${cycleData.phase} phase`}</h2><p>{cycleData.currentDay > 0 ? `Cycle day ${cycleData.currentDay}` : 'Start with a daily check-in'}{todayLog?.sleepHours !== undefined ? ` · ${todayLog.sleepHours}h of sleep logged` : ''}</p></div></section>

            {/* Tabs */}
            <div className="wellness-tabs">
                <div className="wellness-tab-list">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            aria-pressed={activeTab === tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex h-10 items-center gap-2 px-5 rounded-full text-sm font-semibold transition-all ${activeTab === tab.key
                                ? 'on-brand bg-primary text-white shadow-md shadow-primary/20'
                                : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                        >
                            <span className="app-icon-glyph text-base"><AppIcon name={tab.icon}/></span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <main className="wellness-content flex flex-col gap-4">
                <React.Fragment>
                    <motion.div
                        key={activeTab}
                        initial={reduced ? false : { y: 8 }}
                        animate={{ opacity: 1, y: 0 }}

                        transition={motionTransition(springs.section, reduced)}
                    >
                        {activeTab === 'tips' && renderTipsContent()}
                        {activeTab === 'sleep' && renderSleepContent()}
                        {activeTab === 'empathy' && renderEmpathyContent()}
                        {activeTab === 'shops' && renderShopsContent()}
                    </motion.div>
                </React.Fragment>
            </main>
        </div>
    );
};

// --- Sub-components ---

const LoadingSkeleton = () => (
    <section className="reference-card wellness-loading" role="status"><WellnessIllustration id="general-care" decorative/><div><h2>Putting together a little care…</h2><p>Your daily guidance is on its way. You can explore Sleep & Energy while it loads.</p></div><span className="wellness-loading-dots" aria-hidden="true"><i/><i/><i/></span></section>
);

const ErrorCard = ({ message, onRetry, isDark }: { message: string; onRetry: () => void; isDark: boolean }) => (
    <div className={`rounded-2xl p-6 text-center ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
        <span className="app-icon-glyph text-3xl text-red-400 mb-2"><AppIcon name={"error"}/></span>
        <p className={`text-sm mb-3 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{message}</p>
        <button onClick={onRetry} className="on-brand px-4 py-2 bg-primary text-white text-sm font-bold rounded-full">
            Try Again
        </button>
    </div>
);

export default Wellness;
