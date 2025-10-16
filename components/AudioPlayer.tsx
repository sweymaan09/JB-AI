
import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon } from './icons';

interface AudioPlayerProps {
    audioBase64: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBase64 }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioBase64) {
            const audioSrc = `data:audio/mpeg;base64,${audioBase64}`;
            if (audioRef.current) {
                audioRef.current.src = audioSrc;
                audioRef.current.onended = () => setIsPlaying(false);
            }
        }
    }, [audioBase64]);
    
    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    return (
        <div className="flex items-center gap-2 mt-2">
            <audio ref={audioRef} preload="auto"></audio>
            <button onClick={togglePlayPause} className="p-2 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors" aria-label={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="text-sm font-medium text-gray-600">Listen to JB AI</div>
        </div>
    );
};

export default AudioPlayer;
