import React, { useState, useEffect, useRef } from 'react';
import { hexToHsv, hsvToHex } from '../../lib/colorUtils';

interface CustomColorPickerProps {
    color: string;
    onChange: (color: string) => void;
}

export const CustomColorPicker: React.FC<CustomColorPickerProps> = ({ color, onChange }) => {
    // We maintain internal HSV state for smooth dragging
    const [hsv, setHsv] = useState(hexToHsv(color));
    const [hexDraft, setHexDraft] = useState(color.replace('#', '').toUpperCase());
    const [isDraggingSat, setIsDraggingSat] = useState(false);
    const [isDraggingHue, setIsDraggingHue] = useState(false);
    
    const satAreaRef = useRef<HTMLDivElement>(null);
    const hueSliderRef = useRef<HTMLDivElement>(null);

    // Sync from external prop only when NOT dragging (to prevent jitter)
    useEffect(() => {
        setHexDraft(color.replace('#', '').toUpperCase());
        if (!isDraggingSat && !isDraggingHue) {
            setHsv(hexToHsv(color));
        }
    }, [color]);

    const handleSatChange = (clientX: number, clientY: number) => {
        if (!satAreaRef.current) return;
        const rect = satAreaRef.current.getBoundingClientRect();
        
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        // x axis is Satuation (0..100)
        // y axis is Value (100..0)
        const newS = x * 100;
        const newV = (1 - y) * 100;

        const newHsv = { ...hsv, s: newS, v: newV };
        setHsv(newHsv);
        onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
    };

    const handleHueChange = (clientX: number) => {
        if (!hueSliderRef.current) return;
        const rect = hueSliderRef.current.getBoundingClientRect();
        
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        
        const newH = x * 360;
        const newHsv = { ...hsv, h: newH };
        setHsv(newHsv);
        onChange(hsvToHex(newHsv.h, newHsv.s, newHsv.v));
    };

    // Global Event Listeners for Dragging
    useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (isDraggingSat) {
                const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
                const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
                handleSatChange(clientX, clientY);
                // Prevent scrolling on touch devices while dragging slider
                if (e.cancelable) e.preventDefault(); 
            }
            if (isDraggingHue) {
                const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
                handleHueChange(clientX);
                if (e.cancelable) e.preventDefault();
            }
        };

        const handleUp = () => {
            setIsDraggingSat(false);
            setIsDraggingHue(false);
        };

        if (isDraggingSat || isDraggingHue) {
            window.addEventListener('mousemove', handleMove, { passive: false });
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchend', handleUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDraggingSat, isDraggingHue, hsv]); 

    return (
        <div className="flex flex-col gap-5 w-full select-none">
            {/* Saturation/Value Box */}
            <div 
                ref={satAreaRef}
                data-color-area
                className="touch-none w-full h-48 rounded-2xl relative cursor-crosshair overflow-hidden shadow-sm ring-1 ring-black/5"
                style={{
                    backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                    backgroundImage: `
                        linear-gradient(to top, #000, transparent), 
                        linear-gradient(to right, #fff, transparent)
                    `
                }}
                onMouseDown={(e) => {
                    setIsDraggingSat(true);
                    handleSatChange(e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                    setIsDraggingSat(true);
                    handleSatChange(e.touches[0].clientX, e.touches[0].clientY);
                }}
            >
                <div 
                    className="absolute w-6 h-6 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_4px_rgba(0,0,0,0.5)] pointer-events-none transition-transform active:scale-125"
                    style={{
                        left: `${hsv.s}%`,
                        top: `${100 - hsv.v}%`,
                        backgroundColor: color
                    }}
                />
            </div>

            {/* Controls Row */}
            <div className="flex items-center gap-3">
                <div 
                    className="w-10 h-10 rounded-full shadow-inner ring-1 ring-black/10 flex-shrink-0"
                    style={{ backgroundColor: color }}
                />
                
                <div className="flex-1 flex flex-col gap-3">
                    {/* Hue Slider */}
                    <div className="h-6 relative">
                         <div 
                            ref={hueSliderRef}
                            className="touch-none w-full h-full rounded-full cursor-pointer relative overflow-hidden ring-1 ring-black/5"
                            style={{
                                background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
                            }}
                            onMouseDown={(e) => {
                                setIsDraggingHue(true);
                                handleHueChange(e.clientX);
                            }}
                            onTouchStart={(e) => {
                                setIsDraggingHue(true);
                                handleHueChange(e.touches[0].clientX);
                            }}
                        >
                            <div 
                                className="absolute h-full w-2 bg-white border border-gray-300 rounded-full -translate-x-1/2 shadow-sm pointer-events-none top-0"
                                style={{
                                    left: `${(hsv.h / 360) * 100}%`
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Hex Input */}
            <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-xl px-3 py-2 gap-2">
                <span className="text-gray-400 font-mono">#</span>
                <input 
                    type="text" 
                    aria-label="Hex color"
                    maxLength={6}
                    spellCheck={false}
                    value={hexDraft}
                    onBlur={() => setHexDraft(color.replace('#', '').toUpperCase())}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (/^[0-9A-Fa-f]{0,6}$/.test(val)) {
                            setHexDraft(val.toUpperCase());
                            // Only update if full 6 chars
                            if(val.length === 6) onChange('#' + val);
                        }
                    }}
                    className="bg-transparent border-none focus:ring-0 text-sm font-mono w-full text-gray-800 dark:text-gray-200 p-0 uppercase"
                />
            </div>
        </div>
    );
};
