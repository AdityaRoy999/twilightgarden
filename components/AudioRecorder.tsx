import { AppIcon } from './ui/Icons';
import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface AudioRecorderProps {
    onSend: (blob: Blob) => void;
    onCancel: () => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onSend, onCancel }) => {
    const { primaryColor } = useTheme();
    const [isRecording, setIsRecording] = useState(true);
    const [recordingTime, setRecordingTime] = useState(0);
    
    // Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);
    const animationFrameRef = useRef<number>(0);

    // Timer Logic - fixed to clear properly on stop
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    // Setup and cleanup
    useEffect(() => {
        startRecording();
        return () => {
            stopMedia();
        };
    }, []);

    const stopMedia = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            // Audio Context for Visualizer
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64; // Smaller fftSize for fewer bars
            analyser.smoothingTimeConstant = 0.8;
            analyserRef.current = analyser;
            
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            // Media Recorder
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorder.start();
            draw();

        } catch (err) {
            console.error('Error accessing microphone:', err);
            onCancel();
        }
    };

    const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const renderFrame = () => {
            animationFrameRef.current = requestAnimationFrame(renderFrame);
            if (!analyserRef.current) return;
            
            analyserRef.current.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Calculate visuals
            const centerY = canvas.height / 2;
            const barCount = 16; 
            const barWidth = 4;
            const gap = 4;
            const totalWidth = barCount * (barWidth + gap);
            const startX = (canvas.width - totalWidth) / 2;

            // Gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
            gradient.addColorStop(0, primaryColor); 
            // Create a darker version for gradient end? 
            // Simple approach: use same color or hardcode black/white mix if complex
            // For now just solid primary logic or slight variation
            gradient.addColorStop(1, primaryColor); 
            ctx.fillStyle = gradient;

            // Draw bars
            for (let i = 0; i < barCount; i++) {
                // Use data points from the lower frequencies (voice range)
                // Skip the first few which are often DC offset/rumble
                const dataIndex = Math.floor(i + 2);
                let value = dataArray[dataIndex] || 0;
                
                // Scale value
                let percent = value / 255;
                percent = Math.max(0.1, percent); // Minimum height
                
                // Height expands from center
                const height = percent * canvas.height * 0.9;
                
                const x = startX + i * (barWidth + gap);
                const y = centerY - height / 2;
                
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, height, 4);
                ctx.fill();
            }
        };

        renderFrame();
    };

    const handleStop = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsRecording(false); // This triggers the useEffect to clear interval
            stopMedia(); // Stop visualizer
            
            // Clear canvas
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if(ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }
    };

    const handleSend = () => {
        const finalize = () => {
             const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
             onSend(blob);
        };

        if(isRecording && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            stopMedia();
            // Wait for data
            setTimeout(finalize, 200);
        } else {
             finalize();
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-3 w-full bg-white dark:bg-surface-dark p-3 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-xl animate-in slide-in-from-bottom-5 duration-300">
            <button 
                onClick={onCancel} 
                className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors flex-shrink-0"
            >
                <span className="app-icon-glyph"><AppIcon name={"delete"}/></span>
            </button>

            <div className="flex-1 flex items-center gap-4 h-12 overflow-hidden relative bg-gray-50 dark:bg-background-dark rounded-2xl px-3 border border-gray-100 dark:border-gray-800">
                {isRecording ? (
                     <div className="flex-1 h-full flex items-center justify-center">
                         <canvas 
                            ref={canvasRef} 
                            width={200} 
                            height={48} 
                            className="w-full h-full object-contain" 
                        />
                     </div>
                ) : (
                    <div className="flex-1 text-center text-gray-500 font-medium text-sm">
                        Voice Message Recorded
                    </div>
                )}
                
                <div className={`tabular-nums font-mono font-bold text-sm ${isRecording ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>
                    {formatTime(recordingTime)}
                </div>
            </div>

            {isRecording ? (
                <button
                    onClick={handleStop}
                    className="on-brand w-12 h-12 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg shadow-red-500/30 scale-100 hover:scale-110 transition-all flex-shrink-0"
                >
                    <span className="app-icon-glyph"><AppIcon name={"stop"}/></span>
                </button>
            ) : (
                <button 
                    onClick={handleSend}
                    className="on-brand w-12 h-12 flex items-center justify-center bg-primary text-white rounded-full hover:brightness-110 shadow-lg shadow-primary/30 scale-100 hover:scale-110 transition-all flex-shrink-0"
                >
                    <span className="app-icon-glyph"><AppIcon name={"send"}/></span>
                </button>
            )}
        </div>
    );
};
