import { AppIcon } from '../ui/Icons';
import React from 'react';
import { motion } from 'framer-motion';
import { Product } from '../../lib/wellnessAI';
import { useTheme } from '../../contexts/ThemeContext';

interface ShoppingCardProps {
    product: Product;
    index: number;
}

export const ShoppingCard: React.FC<ShoppingCardProps> = ({ product, index }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [imgError, setImgError] = React.useState(false);

    const getSourceColor = (source: Product['source']) => {
        switch (source) {
            case 'Amazon': return 'text-yellow-500';
            case 'Flipkart': return 'text-blue-500';
            case 'Nykaa': return 'text-pink-500';
            case 'Myntra': return 'text-red-500';
            case 'Blinkit': return 'text-orange-500';
            default: return 'text-gray-400';
        }
    };

    const getSourceIcon = (source: Product['source']) => {
        switch (source) {
            case 'Amazon': return 'shopping_bag';
            case 'Flipkart': return 'local_mall';
            case 'Nykaa': return 'potted_plant';
            case 'Myntra': return 'checkroom';
            case 'Blinkit': return 'bolt';
            default: return 'shopping_cart';
        }
    };

    return (
        <motion.a
            href={product.link}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.05, 0.5) }}
            whileHover={{ y: -5 }}
            className={`group flex flex-col backdrop-blur-sm border rounded-2xl overflow-hidden transition-all shadow-lg h-full ${
                isDark 
                ? 'bg-surface-dark/40 border-white/5 hover:border-primary/30' 
                : 'bg-white border-gray-100 hover:border-primary/30 shadow-soft'
            }`}
        >
            <div className={`relative aspect-[4/5] md:aspect-square w-full overflow-hidden shrink-0 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                {product.image && !imgError ? (
                    <img
                        src={product.image}
                        alt={product.title}
                        loading="lazy"
                        onError={() => setImgError(true)}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-40">
                        <span className={`app-icon-glyph text-3xl ${getSourceColor(product.source)}`}><AppIcon name={getSourceIcon(product.source)}/></span>
                        <span className="text-[10px] text-center px-2 line-clamp-2">{product.title || 'No preview'}</span>
                    </div>
                )}
                {product.price && (
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-white/10 shadow-lg">
                        {product.price}
                    </div>
                )}
            </div>

            <div className="p-3 flex flex-col flex-grow">
                <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                    <span className={`app-icon-glyph text-[14px] ${getSourceColor(product.source)}`}><AppIcon name={getSourceIcon(product.source)}/></span>
                    <span className={getSourceColor(product.source)}>{product.source}</span>
                </div>
                <h4 className={`text-[12px] md:text-sm font-bold line-clamp-2 md:line-clamp-3 leading-snug group-hover:text-primary transition-colors flex-grow ${
                    isDark ? 'text-white' : 'text-gray-900'
                }`}>
                    {product.title}
                </h4>
            </div>
        </motion.a>
    );
};

export const ShoppingGrid: React.FC<{ products: Product[]; loading: boolean }> = ({ products, loading }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className={`aspect-[4/5] rounded-2xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                ))}
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="text-center py-8 opacity-40">
                <span className="app-icon-glyph text-4xl mb-2 flex items-center justify-center"><AppIcon name={"sentiment_dissatisfied"}/></span>
                <p className="text-sm">No live products found. Try refreshing.</p>
            </div>
        );
    }

    return (
        <div>
            <p className={`text-[11px] font-medium mb-3 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                {products.length} product{products.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {products.map((p, i) => (
                    <ShoppingCard key={(p.link || '') + i} product={p} index={i} />
                ))}
            </div>
        </div>
    );
};
