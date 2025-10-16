
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ChatInput from './components/ChatInput';
import { generateInteractiveLesson, generateFollowUpResponse, InteractivePrompt } from './services/geminiService';
import FloatingSymbols from './components/FloatingSymbols';
import { RestartIcon, PlayIcon, PauseIcon } from './components/icons';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';

// --- Audio Encoding/Decoding Helpers ---
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodePcmData(data: Uint8Array, ctx: AudioContext, sampleRate: number = 24000): Promise<AudioBuffer> {
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
const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};


const MENTOR_IMAGE_URL = 'https://i.postimg.cc/4NkRjJkS/Whats-App-Image-2025-10-16-at-18-17-26_354dd894.jpg';

type Status = 'idle' | 'thinking' | 'talking' | 'paused' | 'awaiting_answer' | 'responding' | 'listening' | 'live_connecting';

const Avatar = ({ status, onClick, hasAudio }: { status: Status, onClick: () => void, hasAudio: boolean }) => {
    const auraClasses: Record<Status, string> = {
        idle: 'animate-[aura-pulse_4s_infinite]',
        talking: 'animate-[talking-aura-pulse_2s_infinite]',
        responding: 'animate-[talking-aura-pulse_2s_infinite]',
        thinking: '',
        paused: 'animate-[aura-pulse_4s_infinite]',
        awaiting_answer: 'animate-[aura-pulse_4s_infinite]',
        listening: 'animate-[talking-aura-pulse_2s_infinite]',
        live_connecting: '',
    };

    const isTalking = status === 'talking' || status === 'responding';
    const isPlayable = status === 'paused' || (status === 'idle' && hasAudio);

    return (
        <div 
          className="relative w-64 h-64 md:w-80 md:h-80 flex justify-center items-center cursor-pointer group"
          onClick={onClick}
          role="button"
          aria-label={isTalking ? "Pause audio" : "Play audio"}
        >
            <div className="absolute inset-[-8px] z-0 rounded-full bg-[conic-gradient(from_90deg_at_50%_50%,#0ea5e9_0%,#a855f7_25%,#ec4899_50%,#f97316_100%)] animate-[rotate-glow_10s_linear_infinite] blur-xl opacity-75"></div>
            <div className="absolute inset-[-4px] z-0 rounded-full bg-[conic-gradient(from_90deg_at_50%_50%,#0ea5e9_0%,#a855f7_25%,#ec4899_50%,#f97316_100%)] animate-[rotate-glow_12s_linear_infinite_reverse] blur-lg opacity-80"></div>
            
            <div className={`absolute inset-0 rounded-full ${auraClasses[status]}`}></div>
            <div
                className="relative z-10 w-full h-full rounded-full bg-cover bg-center border-4 border-slate-700/50 shadow-2xl brightness-110 contrast-110"
                style={{ backgroundImage: `url(${MENTOR_IMAGE_URL})` }}
            />
            {(status === 'thinking' || status === 'live_connecting') && (
                <div className="absolute z-20 inset-[-10px] border-4 border-transparent border-t-yellow-300 rounded-full animate-spin"></div>
            )}
            
            {isPlayable && (
                <div className="absolute z-20 inset-0 flex items-center justify-center rounded-full bg-black/50 group-hover:bg-black/60 transition-colors">
                    <PlayIcon className="w-16 h-16 text-white" />
                </div>
            )}

            {isTalking && (
                <div className="absolute z-20 inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <PauseIcon className="w-16 h-16 text-white" />
                </div>
            )}
        </div>
    );
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  
  // Refs for Lesson Mode
  const lessonAudioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lessonPromptsRef = useRef<InteractivePrompt[]>([]);
  const pauseTimeRef = useRef<number>(0);
  const playbackStartedAtRef = useRef<number>(0);
  
  // Refs for Voice Chat Mode
  const liveSessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const liveAudioSources = useRef(new Set<AudioBufferSourceNode>()).current;
  const nextStartTimeRef = useRef(0);
  
  useEffect(() => {
    // Initialize lesson audio context on mount
    if (!lessonAudioContextRef.current) {
        lessonAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  }, []);

  // --- Lesson Mode Logic ---
  const stopPlayback = useCallback((clearState = false) => {
    if (sourceNodeRef.current) {
        sourceNodeRef.current.onended = null;
        try { sourceNodeRef.current.stop(); } catch (e) {}
        sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
    }
    if (clearState) {
        pauseTimeRef.current = 0;
        setCurrentTime(0);
        setDuration(0);
        setAudioBase64(null);
        lessonPromptsRef.current = [];
    }
  }, []);

  const playAudio = useCallback((startTime?: number) => {
    if (!audioBufferRef.current || !lessonAudioContextRef.current) return;
    stopPlayback();
    const audioContext = lessonAudioContextRef.current;
    if (audioContext.state === 'suspended') { audioContext.resume(); }
    const offset = startTime !== undefined ? startTime : pauseTimeRef.current;
    const source = audioContext.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(audioContext.destination);
    source.start(0, offset);
    sourceNodeRef.current = source;
    playbackStartedAtRef.current = audioContext.currentTime;
    pauseTimeRef.current = offset;
    setStatus('talking');
    const updateProgress = () => {
        if (!sourceNodeRef.current || !lessonAudioContextRef.current) return;
        const elapsedTime = lessonAudioContextRef.current.currentTime - playbackStartedAtRef.current;
        const newCurrentTime = Math.min(pauseTimeRef.current + elapsedTime, duration);
        setCurrentTime(newCurrentTime);
        if (lessonPromptsRef.current.length > 0 && newCurrentTime >= lessonPromptsRef.current[0].time_in_seconds) {
            const nextPrompt = lessonPromptsRef.current.shift();
            if (nextPrompt) {
                pauseAudio();
                setStatus('awaiting_answer');
                setCurrentQuestion(nextPrompt.question);
                return;
            }
        }
        animationFrameRef.current = requestAnimationFrame(updateProgress);
    };
    updateProgress();
    source.onended = () => {
        if (sourceNodeRef.current === source) {
            stopPlayback();
            setStatus('idle');
            setCurrentTime(duration);
            pauseTimeRef.current = 0;
        }
    };
  }, [duration, stopPlayback]);

  const pauseAudio = useCallback(() => {
      if (!sourceNodeRef.current || !lessonAudioContextRef.current || status !== 'talking') return;
      const elapsedTime = lessonAudioContextRef.current.currentTime - playbackStartedAtRef.current;
      const newPauseTime = pauseTimeRef.current + elapsedTime;
      stopPlayback();
      pauseTimeRef.current = newPauseTime;
      setCurrentTime(newPauseTime);
      setStatus('paused');
  }, [status, stopPlayback]);
  
  // --- Voice Chat Mode Logic ---
  const stopVoiceChat = useCallback(() => {
    if (liveSessionPromiseRef.current) {
        liveSessionPromiseRef.current.then(session => session.close());
        liveSessionPromiseRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if(scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    liveAudioSources.forEach(source => source.stop());
    liveAudioSources.clear();
    nextStartTimeRef.current = 0;
    setStatus('idle');
  }, [liveAudioSources]);

  const startVoiceChat = useCallback(async () => {
    setStatus('live_connecting');
    stopPlayback(true);

    try {
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        liveSessionPromiseRef.current = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                systemInstruction: 'You are "JB AI" in Voice Chat Mode. Act as Jeetu Bhaiya. Be a friendly, emotional, and motivating mentor. Keep responses short, natural, and conversational in Hinglish. Listen carefully and respond quickly with empathy and humor.'
            },
            callbacks: {
                onopen: () => {
                    setStatus('listening');
                    const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
                        const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                        
                        liveSessionPromiseRef.current?.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData && outputAudioContextRef.current) {
                         const outCtx = outputAudioContextRef.current;
                         nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                         const audioBuffer = await decodePcmData(decode(audioData), outCtx);
                         const source = outCtx.createBufferSource();
                         source.buffer = audioBuffer;
                         source.connect(outCtx.destination);
                         source.addEventListener('ended', () => liveAudioSources.delete(source));
                         source.start(nextStartTimeRef.current);
                         nextStartTimeRef.current += audioBuffer.duration;
                         liveAudioSources.add(source);
                    }
                },
                onerror: (e) => { console.error('Live session error:', e); stopVoiceChat(); },
                onclose: () => { console.log('Live session closed.'); stopVoiceChat(); },
            }
        });

    } catch (error) {
        console.error('Failed to start voice chat:', error);
        stopVoiceChat();
    }
  }, [stopVoiceChat, stopPlayback, liveAudioSources]);
  
  // --- Core Handlers ---
  const startNewLesson = async (text: string, file?: File) => {
    setStatus('thinking');
    stopPlayback(true);
    stopVoiceChat();
    setCurrentQuestion(null);

    try {
      const { audioBase64, interactivePrompts } = await generateInteractiveLesson(text, file);
      setAudioBase64(audioBase64);
      lessonPromptsRef.current = [...interactivePrompts].sort((a, b) => a.time_in_seconds - b.time_in_seconds);
      
      const audioContext = lessonAudioContextRef.current!;
      const buffer = await decodePcmData(decode(audioBase64), audioContext);
      audioBufferRef.current = buffer;
      setDuration(buffer.duration);
      playAudio(0);
    } catch (error) {
      console.error('Error generating lesson:', error);
      setStatus('idle');
    }
  };

  const handleUserAnswer = async (text: string) => {
    if (!currentQuestion) return;
    setStatus('responding');
    try {
        const { audioBase64: followUpAudio } = await generateFollowUpResponse(currentQuestion, text);
        const audioContext = lessonAudioContextRef.current!;
        const buffer = await decodePcmData(decode(followUpAudio), audioContext);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
        source.onended = () => {
            setCurrentQuestion(null);
            playAudio();
        };
    } catch (error) {
        console.error('Error generating follow-up:', error);
        setCurrentQuestion(null);
        playAudio();
    }
  };

  const handleSend = async (text: string, file?: File) => {
    if ((!text.trim() && !file) || status === 'listening') return;
    if (status === 'awaiting_answer') {
      await handleUserAnswer(text);
    } else {
      await startNewLesson(text, file);
    }
  };
  
  const handleAvatarClick = () => {
    if (status === 'talking' || status === 'responding') {
        pauseAudio();
    } else if ((status === 'idle' || status === 'paused') && audioBase64) {
        playAudio();
    }
  }

  const handleMicClick = () => {
    if (status === 'listening' || status === 'live_connecting') {
      stopVoiceChat();
    } else {
      startVoiceChat();
    }
  };
  
  return (
    <div className="h-screen w-screen bg-gradient-to-b from-[#02042b] via-[#010218] to-[#010218] text-white font-sans overflow-hidden relative flex flex-col">
      <div className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-purple-600 rounded-full filter blur-3xl animate-[pulse-aurora_8s_infinite_alternate]"></div>
          <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-cyan-600 rounded-full filter blur-3xl animate-[pulse-aurora_12s_infinite_alternate-reverse]"></div>
      </div>
      <FloatingSymbols />

      <div className="relative z-10 flex-grow flex flex-col justify-center items-center text-center p-4 overflow-y-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-300 via-pink-400 to-yellow-300 bg-clip-text text-transparent title-glow filter brightness-110">
            🌟 JB AI - YOUR PERSONAL JEETU BHAIYA 🌟
        </h1>

        <div className="my-8 flex items-center justify-center gap-4">
            <Avatar status={status} onClick={handleAvatarClick} hasAudio={!!audioBase64} />
            {audioBase64 && status !== 'thinking' && status !== 'listening' && (
                <button 
                    onClick={() => playAudio(0)} 
                    className="p-3 bg-slate-800/70 rounded-full text-cyan-300 hover:bg-slate-700 transition-colors self-end -ml-12 mb-2"
                    aria-label="Restart lesson"
                >
                    <RestartIcon className="w-6 h-6" />
                </button>
            )}
        </div>
        
        <div className="h-24 max-w-2xl flex items-center justify-center">
            <p className="font-handwriting text-2xl md:text-3xl text-cyan-200 quote-glow">
                {status === 'awaiting_answer' 
                 ? `🤔 ${currentQuestion}`
                 : "💬 “Dreams dekhe jaate hain, aims achieve kiye jaate hain.”"
                }
            </p>
        </div>
        
        {audioBase64 && status !== 'thinking' && status !== 'listening' && status !== 'live_connecting' && (
            <div className="w-full max-w-md p-2 mt-2">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={duration || 1}
                        value={currentTime}
                        onChange={(e) => {
                            const newTime = parseFloat(e.target.value);
                            pauseTimeRef.current = newTime;
                            setCurrentTime(newTime);
                            if (status !== 'talking') {
                                playAudio(newTime);
                            }
                        }}
                        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
                        aria-label="Seek audio"
                    />
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        )}
      </div>
      
      <div className="relative z-10 flex-shrink-0">
        <ChatInput 
            onSend={handleSend} 
            isLoading={status === 'thinking' || status === 'responding' || status === 'live_connecting'}
            onMicClick={handleMicClick}
            isRecording={status === 'listening'}
        />
      </div>
    </div>
  );
}

export default App;
