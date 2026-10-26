import { localDateKey } from '../../lib/dates';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCouples } from '../../contexts/CouplesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { calculateCyclePhase } from '../../lib/cycleUtils';
import NotificationBell from '../../components/NotificationBell';
import {
    generateEmpathyAlerts,
    generateGiftRecommendations,
    searchShoppingProducts,
    searchNearbyPharmacies,
    getRouteToShop,
    WellnessContext,
    Product,
    NearbyShop,
    RouteGeometry,
} from '../../lib/wellnessAI';
import { ShoppingGrid } from '../../components/wellness/ShoppingCards';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet's default icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icons
const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

type Tab = 'care' | 'gifts' | 'shops';

const PartnerWellness: React.FC = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { user } = useAuth();
    const { partnerProfile, partnerSettings, partnerLogs, couple } = useCouples();

    const [activeTab, setActiveTab] = useState<Tab>('care');
    const [careText, setCareText] = useState('');
    const [gifts, setGifts] = useState<Product[]>([]);
    const [platformFilter, setPlatformFilter] = useState<'All' | 'Amazon' | 'Flipkart' | 'Nykaa' | 'Myntra' | 'Blinkit'>('All');
    const [categoryFilter, setCategoryFilter] = useState<'All' | 'Jewelry' | 'Fashion' | 'Toys' | 'Comfort' | 'Food' | 'Self-care'>('All');
    const [loading, setLoading] = useState(false);
    const [shoppingLoading, setShoppingLoading] = useState(false);
    const [error, setError] = useState('');

    // Nearest Shops State
    const [shops, setShops] = useState<NearbyShop[]>([]);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [selectedShop, setSelectedShop] = useState<NearbyShop | null>(null);
    const [route, setRoute] = useState<RouteGeometry | null>(null);
    const [mapLoading, setMapLoading] = useState(false);

    // Get partner's cycle data
    const partnerCycleData = useMemo(() => {
        if (!partnerSettings?.lastPeriodStart) return null;
        try {
            return calculateCyclePhase(
                localDateKey(),
                {
                    avgCycleLength: partnerSettings.avgCycleLength || 28,
                    avgPeriodLength: partnerSettings.avgPeriodLength || 5,
                    lastPeriodStart: partnerSettings.lastPeriodStart,
                    onboardingCompleted: true,
                    irregularCycle: partnerSettings.irregularCycle || false,
                }
            );
        } catch {
            return null;
        }
    }, [partnerSettings]);

    // Build context
    const todayStr = localDateKey();
    const todayLog = partnerLogs?.find((l: any) => l.date === todayStr);
    const partnerName = partnerProfile?.full_name || 'Your Partner';

    const ctx: WellnessContext = {
        phase: partnerCycleData?.phase || 'Unknown',
        cycleDay: partnerCycleData?.currentDay || 0,
        moods: todayLog?.moods || [],
        symptoms: todayLog?.symptoms || [],
        sleepQuality: todayLog?.sleepQuality || todayLog?.sleep_quality,
        energyLevel: todayLog?.energyLevel || todayLog?.energy_level,
        partnerName,
    };

    const fetchCare = async () => {
        setLoading(true);
        setError('');
        const result = await generateEmpathyAlerts(ctx);
        if (result.error) setError(result.error);
        else setCareText(result.text);
        setLoading(false);
    };

    const fetchGifts = async () => {
        setShoppingLoading(true);
        setError('');
        try {
            const result = await generateGiftRecommendations(ctx);
            if (result.error) {
                setError(result.error);
            } else {
                const terms = result.text.split(',').map(t => t.trim()).filter(Boolean);
                console.log('AI Search Terms:', terms);

                // Fetch products for each term in parallel (now 5 platforms)
                const productPromises = terms.slice(0, 5).map(term => searchShoppingProducts(term));
                const productGroups = await Promise.all(productPromises);

                // Flatten and deduplicate by link AND normalized title
                const allProducts = productGroups.flat();
                console.log('Raw Products Found:', allProducts.length);

                const uniqueProducts = Array.from(
                    new Map(
                        allProducts.map(p => {
                            // Normalize link and title for better deduplication
                            const normalizedLink = p.link.split('?')[0]; // Remove query params
                            const key = `${normalizedLink}-${p.title.toLowerCase().trim()}`;
                            return [key, p];
                        })
                    ).values()
                );

                console.log('Unique Products After Processing:', uniqueProducts);
                setGifts(uniqueProducts);
            }
        } catch (err: any) {
            console.error('Fetch gifts error:', err);
            setError(err.message || 'Failed to load shopping gifts');
        } finally {
            setShoppingLoading(false);
        }
    };

    const filteredGifts = useMemo(() => {
        return gifts.filter(p => {
            const platformMatch = platformFilter === 'All' || p.source === platformFilter;

            // Simple category heuristic based on title/link keywords
            let categoryMatch = true;
            if (categoryFilter !== 'All') {
                const text = (p.title + ' ' + p.link).toLowerCase();
                const keywords: Record<string, string[]> = {
                    'Jewelry': ['necklace', 'earring', 'jhumka', 'jewelry', 'pendant', 'gold', 'silver', 'bangle', 'ring', 'jewel', 'nykaa fashion'],
                    'Fashion': ['dress', 'kurti', 'top', 'skirt', 'floral', 'suit', 'cloth', 'apparel', 'wear', 'biba', 'anarkali', 't-shirt', 'tshirt', 'shirt', 'saree', 'clothing', 'myntra'],
                    'Toys': ['teddy', 'bear', 'plush', 'toy', 'soft toy', 'stuffed', 'hamleys', 'doll'],
                    'Comfort': ['heating pad', 'blanket', 'candle', 'diffuser', 'pillow', 'massager', 'socks', 'patch', 'wellness'],
                    'Food': ['chocolate', 'tea', 'coffee', 'snack', 'gift box', 'sweet', 'fruit', 'amul', 'cadbury', 'ferrer'],
                    'Self-care': ['journal', 'bath', 'skincare', 'mask', 'serum', 'lotion', 'spa', 'beauty', 'face']
                };

                // Use regex with word boundaries to avoid partial matches (e.g., 'tea' in 'Tear')
                const filterKeywords = keywords[categoryFilter] || [];
                categoryMatch = filterKeywords.some(k => {
                    const regex = new RegExp(`\\b${k}\\b`, 'i');
                    return regex.test(text);
                });
            }

            return platformMatch && categoryMatch;
        });
    }, [gifts, platformFilter, categoryFilter]);

    useEffect(() => {
        if (activeTab === 'care' && !careText) fetchCare();
        if (activeTab === 'gifts' && gifts.length === 0) fetchGifts();
        if (activeTab === 'shops' && !userLocation) initShops();
    }, [activeTab]);

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
        { key: 'care', label: 'Care Guide', icon: 'favorite' },
        { key: 'gifts', label: 'Gift Ideas', icon: 'redeem' },
        { key: 'shops', label: 'Nearest Pad', icon: 'location_on' },
    ];

    // Not connected state
    if (!couple || couple.status !== 'active') {
        return (
            <div className={`flex flex-col items-center justify-center min-h-screen p-6 ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-gray-900'}`}>
                <span className="material-symbols-outlined text-5xl text-gray-400 mb-4">link_off</span>
                <h2 className="text-xl font-bold mb-2">Not Connected</h2>
                <p className={`text-sm text-center ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Connect with your partner to access personalized care guides and gift recommendations.
                </p>
            </div>
        );
    }

    // No shared data
    if (!partnerSettings && couple.share_enabled) {
        return (
            <div className={`flex flex-col items-center justify-center min-h-screen p-6 ${isDark ? 'bg-background-dark text-white' : 'bg-background-dark text-gray-900'}`}>
                <span className="material-symbols-outlined text-5xl text-gray-400 mb-4">hourglass_empty</span>
                <h2 className="text-xl font-bold mb-2">Waiting for Data</h2>
                <p className={`text-sm text-center ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    Your partner hasn't logged any cycle data yet. Check back soon!
                </p>
            </div>
        );
    }

    // Helper component to recenter map when selecting a shop
    const MapUpdater = ({ center }: { center: [number, number] }) => {
        const map = useMap();
        useEffect(() => {
            map.setView(center, 15, { animate: true });
        }, [center, map]);
        return null;
    };
    // Shops (Nearest Pad) Tab Render
    const renderShopsContent = () => {
        if (mapLoading) return (
            <div className={`rounded-2xl p-8 text-center ${isDark ? 'bg-surface-dark border border-white/5' : 'bg-white border border-gray-100'} shadow-soft flex flex-col items-center justify-center min-h-[400px]`}>
                 <span className="material-symbols-outlined text-4xl text-primary animate-spin mb-4">explore</span>
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
                            <span className="material-symbols-filled text-sm mr-1 align-middle">local_pharmacy</span>
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
                                    <span className="material-symbols-outlined text-[14px] text-gray-400 mt-0.5">location_on</span>
                                    <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{shop.address}</p>
                                </div>
                                {shop.phoneNumber && (
                                    <div className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px] text-green-500">call</span>
                                        <p className={`text-xs font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>{shop.phoneNumber}</p>
                                    </div>
                                )}

                                {selectedShop?.id === shop.id && route && (
                                    <div className={`mt-2 p-2 rounded-lg flex items-center justify-between ${isDark ? 'bg-black/50' : 'bg-primary/10'}`}>
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px] text-primary">route</span>
                                            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {(route.distance / 1000).toFixed(2)} km
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px] text-primary">schedule</span>
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
        <div className={`animate-slideIn font-display flex flex-col pb-24 min-h-screen transition-colors bg-background-dark`}>
            {/* Header */}
            <header className={`sticky top-0 z-10 flex items-center justify-between backdrop-blur-md px-6 py-4 border-b ${isDark ? 'bg-background-dark border-white/5' : 'bg-background-dark border-gray-100'}`}>
                <h1 className={`text-3xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-[var(--text-primary)]'}`}>Wellness</h1>
                <NotificationBell />
            </header>

            {/* Partner Context Banner */}
            {partnerCycleData && (
                <div className={`mx-6 mt-4 rounded-2xl p-4 ${isDark ? 'bg-gradient-to-br from-pink-500/15 to-purple-500/10 border border-pink-500/20' : 'bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100'}`}>
                    <div className="flex items-center gap-3">
                        {partnerProfile?.avatar_url ? (
                            <img src={partnerProfile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDark ? 'bg-pink-500/30' : 'bg-pink-100'}`}>
                                <span className="material-symbols-filled text-pink-400">person</span>
                            </div>
                        )}
                        <div>
                            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{partnerName}</p>
                            <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                                {partnerCycleData.phase} Phase · Day {partnerCycleData.currentDay}
                                {todayLog?.moods?.length > 0 && ` · Feeling ${todayLog.moods[0]}`}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className={`w-full overflow-x-auto no-scrollbar py-2 px-6 mt-2 mb-4 bg-background-dark`}>
                <div className="flex gap-2 min-w-max">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex h-10 items-center gap-2 px-5 rounded-full text-sm font-semibold transition-all ${activeTab === tab.key
                                ? 'on-brand bg-primary text-white shadow-md shadow-primary/20'
                                : isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <main className="flex flex-col gap-4 px-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'care' && (
                            <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
                                {loading ? (
                                    <LoadingSkeleton isDark={isDark} />
                                ) : error ? (
                                    <ErrorCard message={error} onRetry={fetchCare} isDark={isDark} />
                                ) : (
                                    <div className={`rounded-2xl p-6 md:p-8 ${isDark ? 'bg-surface-dark border border-white/5' : 'bg-white border border-gray-100'} shadow-soft`}>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                <span className="material-symbols-filled text-pink-400 mr-2 align-middle text-2xl">favorite</span>
                                                How to Support {partnerName}
                                            </h3>
                                            <button onClick={fetchCare} className="text-primary text-sm font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity bg-primary/10 px-3 py-1.5 rounded-full">
                                                <span className="material-symbols-outlined text-sm">refresh</span> Refresh
                                            </button>
                                        </div>
                                        <div className={`prose prose-sm md:prose-base max-w-none ${isDark ? 'prose-invert' : ''} leading-relaxed whitespace-pre-line`}>
                                            {careText ? <FormattedText text={careText} /> : 'Generating care guide...'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'gifts' && (
                            <div className="flex flex-col md:grid md:grid-cols-[1fr_3fr] gap-6">
                                {/* Left Sidebar (Desktop) / Top (Mobile) */}
                                <div className="flex flex-col gap-4">
                                  {/* Gift context card */}
                                  <div className={`rounded-2xl p-4 ${isDark ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20' : 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100'}`}>
                                      <p className={`text-sm ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                                          <span className="material-symbols-filled text-sm mr-1 align-middle">lightbulb</span>
                                          Personalized suggestions based on {partnerName}'s current phase and mood
                                      </p>
                                  </div>

                                  {!shoppingLoading && !error && gifts.length > 0 && (
                                     <>
                                        {/* Platform Filter */}
                                        <div className="flex flex-col gap-2">
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Platform</p>
                                            <div className="flex flex-wrap gap-2 md:flex-col md:whitespace-normal pb-1">
                                                {['All', 'Amazon', 'Flipkart', 'Nykaa', 'Myntra', 'Blinkit'].map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setPlatformFilter(p as any)}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold md:w-full md:text-left transition-all border ${
                                                            platformFilter === p
                                                            ? 'bg-primary border-primary text-white shadow-sm'
                                                            : isDark ? 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Category Filter */}
                                        <div className="flex flex-col gap-2">
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Category</p>
                                            <div className="flex flex-wrap gap-2 md:flex-col md:whitespace-normal pb-1">
                                                {['All', 'Jewelry', 'Fashion', 'Toys', 'Comfort', 'Food', 'Self-care'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setCategoryFilter(c as any)}
                                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold md:w-full md:text-left transition-all border ${
                                                            categoryFilter === c
                                                            ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                                            : isDark ? 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                     </>
                                  )}
                                </div>

                                {/* Right Content Area */}
                                <div className="flex flex-col gap-4">
                                  {shoppingLoading && gifts.length === 0 ? (
                                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                          {[1, 2, 3, 4, 5, 6].map(i => (
                                              <div key={i} className={`aspect-[4/5] rounded-2xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                                          ))}
                                      </div>
                                  ) : error ? (
                                      <ErrorCard message={error} onRetry={fetchGifts} isDark={isDark} />
                                  ) : (
                                      <div className="flex flex-col gap-4">
                                          <ShoppingGrid products={filteredGifts} loading={shoppingLoading} />

                                          {filteredGifts.length === 0 && !shoppingLoading && (
                                              <div className="text-center py-8 opacity-40">
                                                  <p className="text-xs">No items match your filters.</p>
                                              </div>
                                          )}

                                          <div className={`mt-2 p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                              <p className={`text-[11px] leading-relaxed text-center ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                                                  Shopping results from Amazon, Flipkart, Nykaa, Myntra & Blinkit. Prices and availability are live from search.
                                              </p>
                                          </div>
                                      </div>
                                  )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'shops' && renderShopsContent()}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
};

// --- Sub-components ---

const FormattedText = ({ text }: { text: string }) => {
    // Split text by ** bold syntax, including potential newlines inside
    const parts = text.split(/(\*\*[\s\S]*?\*\*)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <strong key={i} className="font-bold text-gray-900 dark:text-white" style={{ fontWeight: 800 }}>
                            {part.slice(2, -2).trim()}
                        </strong>
                    );
                }
                return part;
            })}
        </>
    );
};

const LoadingSkeleton = ({ isDark }: { isDark: boolean }) => (
    <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => (
            <div key={i} className={`rounded-2xl p-5 animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <div className={`h-4 rounded w-3/4 mb-3 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                <div className={`h-3 rounded w-full mb-2 ${isDark ? 'bg-white/5' : 'bg-gray-150'}`} />
                <div className={`h-3 rounded w-5/6 ${isDark ? 'bg-white/5' : 'bg-gray-150'}`} />
            </div>
        ))}
    </div>
);

const ErrorCard = ({ message, onRetry, isDark }: { message: string; onRetry: () => void; isDark: boolean }) => (
    <div className={`rounded-2xl p-6 text-center ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}>
        <span className="material-symbols-outlined text-3xl text-red-400 mb-2">error</span>
        <p className={`text-sm mb-3 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{message}</p>
        <button onClick={onRetry} className="on-brand px-4 py-2 bg-primary text-white text-sm font-bold rounded-full">
            Try Again
        </button>
    </div>
);

export default PartnerWellness;
