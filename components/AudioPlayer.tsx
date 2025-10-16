import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlayIcon, PauseIcon } from './icons';

// Helper function to decode base64 string to Uint8Array
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Helper function to decode raw PCM data into an AudioBuffer
async function decodePcmData(
    data: Uint8Array,
    ctx: AudioContext,
): Promise<AudioBuffer> {
    const sampleRate = 24000; // Gemini TTS sample rate
    const numChannels = 1;
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
}


interface AudioPlayerProps {
    audioBase64: string;
    onPlayStateChange?: (isPlaying: boolean) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBase64, onPlayStateChange }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    
    // Using refs to hold instances that shouldn't trigger re-renders on change
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

    // Effect for handling play state changes
    useEffect(() => {
        onPlayStateChange?.(isPlaying);
    }, [isPlaying, onPlayStateChange]);

    // Decode audio data when the component receives a new base64 string
    useEffect(() => {
        if (!audioBase64) return;
        
        // Initialize AudioContext on first use
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        
        let isActive = true;

        const setupAudio = async () => {
            try {
                setIsReady(false);
                const decodedPcm = decode(audioBase64);
                const buffer = await decodePcmData(decodedPcm, audioContext);
                if (isActive) {
                    audioBufferRef.current = buffer;
                    setIsReady(true);
                }
            } catch (error) {
                console.error("Failed to decode audio data:", error);
                if (isActive) {
                    setIsReady(false);
                }
            }
        };

        setupAudio();

        return () => {
            isActive = false;
            // Stop and disconnect any existing source node on cleanup
            if (sourceNodeRef.current) {
                sourceNodeRef.current.stop();
                sourceNodeRef.current.disconnect();
                sourceNodeRef.current = null;
            }
            setIsPlaying(false);
        };
    }, [audioBase64]);
    
    const togglePlayPause = useCallback(() => {
        if (!isReady || !audioBufferRef.current || !audioContextRef.current) return;

        const audioContext = audioContextRef.current;

        // Resume context if it's suspended (e.g., due to browser autoplay policies)
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        if (isPlaying) {
            // Stop playback
            if (sourceNodeRef.current) {
                sourceNodeRef.current.stop();
                sourceNodeRef.current.disconnect();
                sourceNodeRef.current = null;
            }
            setIsPlaying(false);
        } else {
            // Start playback
            const source = audioContext.createBufferSource();
            source.buffer = audioBufferRef.current;
            source.connect(audioContext.destination);
            source.onended = () => {
                setIsPlaying(false);
                sourceNodeRef.current = null;
            };
            source.start();
            sourceNodeRef.current = source;
            setIsPlaying(true);
        }
    }, [isPlaying, isReady]);

    return (
        <div className="flex items-center gap-2 mt-2">
            <button 
                onClick={togglePlayPause} 
                className="p-2 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                aria-label={isPlaying ? "Pause" : "Play"}
                disabled={!isReady}
            >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="text-sm font-medium text-gray-600">
                {isReady ? "Listen to JB AI" : "Preparing audio..."}
            </div>
        </div>
    );
};

export default AudioPlayer;