import { AppIcon } from './Icons';
import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
    src: string;
    isMe: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, isMe }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
             setCurrentTime(audio.currentTime);
             setProgress((audio.currentTime / audio.duration) * 100);
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const formatTime = (time: number) => {
        if(isNaN(time)) return "0:00";
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (audioRef.current) {
            const time = (val / 100) * duration;
            audioRef.current.currentTime = time;
            setProgress(val);
        }
    };

    return (
        <div className={`flex items-center gap-3 p-2 rounded-xl min-w-[240px] ${isMe ? 'bg-pink-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <button 
                onClick={togglePlay}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isMe ? 'bg-white text-pink-600' : 'on-brand bg-pink-500 text-white'}`}
            >
                <span className="app-icon-glyph text-2xl"><AppIcon name={isPlaying ? 'pause' : 'play_arrow'}/></span>
            </button>

            <div className="flex-1 flex flex-col gap-1">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={progress || 0}
                    onChange={handleSeek}
                    className={`w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full ${isMe ? '[&::-webkit-slider-thumb]:bg-white' : '[&::-webkit-slider-thumb]:bg-pink-500'}`}
                />
                <div className={`flex justify-between text-[10px] font-medium ${isMe ? 'text-pink-100' : 'text-gray-500'}`}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            <audio ref={audioRef} src={src} preload="metadata" />
        </div>
    );
};
