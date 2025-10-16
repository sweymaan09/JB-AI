import React, { useState, useRef, useEffect, useCallback } from 'react';
import ChatInput from './components/ChatInput';
import { generateInteractiveLesson, generateFollowUpResponse, InteractivePrompt } from './services/geminiService';
import FloatingSymbols from './components/FloatingSymbols';
import { RestartIcon, PlayIcon, PauseIcon, RewindIcon, ForwardIcon } from './components/icons';
import { GoogleGenAI, Modality } from '@google/genai';

// --- Audio Encoding/Decoding Helpers ---
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
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

type Status = 'idle' | 'thinking' | 'talking' | 'paused' | 'awaiting_answer' | 'responding';

const Avatar = ({ status, onClick, hasAudio }: { status: Status, onClick: () => void, hasAudio: boolean }) => {
    const auraClasses: Record<Status, string> = {
        idle: 'animate-[aura-pulse_4s_infinite]',
        talking: 'animate-[talking-aura-pulse_2s_infinite]',
        responding: 'animate-[talking-aura-pulse_2s_infinite]',
        thinking: '',
        paused: 'animate-[aura-pulse_4s_infinite]',
        awaiting_answer: 'animate-[aura-pulse_4s_infinite]',
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
            {status === 'thinking' && (
                <div className="absolute z-20 inset-[-10px] border-4 border-transparent border-t-yellow-300 rounded-full custom-spin"></div>
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
  const [lessonContext, setLessonContext] = useState<{ topic: string, partNumber: number } | null>(null);

  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatusMessage, setCallStatusMessage] = useState<string | null>(null);

  const lessonAudioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lessonPromptsRef = useRef<InteractivePrompt[]>([]);
  const pauseTimeRef = useRef<number>(0);
  const playbackStartedAtRef = useRef<number>(0);

  const liveSessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const outputQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  
  useEffect(() => {
    if (!lessonAudioContextRef.current) {
        lessonAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  }, []);

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
        setLessonContext(null);
    }
  }, []);

  const pauseAudio = useCallback(() => {
      if (!sourceNodeRef.current || !lessonAudioContextRef.current || status !== 'talking') return;
      const elapsedTime = lessonAudioContextRef.current.currentTime - playbackStartedAtRef.current;
      const newPauseTime = pauseTimeRef.current + elapsedTime;
      stopPlayback();
      pauseTimeRef.current = newPauseTime;
      setCurrentTime(newPauseTime);
      setStatus('paused');
  }, [status, stopPlayback]);

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
        const newCurrentTime = Math.min(pauseTimeRef.current + elapsedTime, audioBufferRef.current!.duration);
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
            if (lessonPromptsRef.current.length > 0) {
                const nextPrompt = lessonPromptsRef.current.shift();
                if (nextPrompt) {
                    setStatus('awaiting_answer');
                    setCurrentQuestion(nextPrompt.question);
                    return;
                }
            }
            setStatus('idle');
            setCurrentTime(audioBufferRef.current!.duration);
            pauseTimeRef.current = 0;
        }
    };
  }, [stopPlayback, pauseAudio]);

  const continueLesson = async () => {
    if (!lessonContext) return;
    setStatus('thinking');
    setCurrentQuestion(null);
    const newContext = { ...lessonContext, partNumber: lessonContext.partNumber + 1 };
    setLessonContext(newContext);

    try {
      const { audioBase64, interactivePrompts } = await generateInteractiveLesson(
        '', undefined, newContext
      );
      setAudioBase64(audioBase64);
      lessonPromptsRef.current = [...interactivePrompts].sort((a, b) => a.time_in_seconds - b.time_in_seconds);
      const audioContext = lessonAudioContextRef.current!;
      const buffer = await decodePcmData(decode(audioBase64), audioContext);
      audioBufferRef.current = buffer;
      setDuration(buffer.duration);
      playAudio(0);
    } catch (error) {
      console.error('Error continuing lesson:', error);
      setStatus('idle');
    }
  };

  const startNewLesson = async (text: string, file?: File) => {
    setStatus('thinking');
    stopPlayback(true);
    setCurrentQuestion(null);
    const newContext = { topic: text || file?.name || 'the uploaded content', partNumber: 1 };
    setLessonContext(newContext);

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
      setLessonContext(null);
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
            continueLesson();
        };
    } catch (error) {
        console.error('Error generating follow-up:', error);
        setCurrentQuestion(null);
        continueLesson();
    }
  };

  const handleSend = async (text: string, file?: File) => {
    if (!text.trim() && !file) return;

    if (status === 'awaiting_answer') {
        await handleUserAnswer(text);
        return;
    }

    await startNewLesson(text, file);
  };
  
  const handleAvatarClick = () => {
    if (isCallActive) return;
    if (status === 'talking' || status === 'responding') {
        pauseAudio();
    } else if ((status === 'idle' || status === 'paused') && audioBase64) {
        playAudio();
    }
  }
  
  const handleSeek = useCallback((offset: number) => {
    if (!audioBufferRef.current || !lessonAudioContextRef.current) return;
    const newTime = Math.max(0, Math.min(currentTime + offset, audioBufferRef.current.duration));
    setCurrentTime(newTime);
    pauseTimeRef.current = newTime;
    
    if (status === 'talking' || status === 'paused') {
        playAudio(newTime);
    }
  }, [currentTime, status, playAudio]);

  const endCall = useCallback(() => {
    setStatus('idle');
    setIsCallActive(false);
    setCallStatusMessage("Call ended.");
    setTimeout(() => setCallStatusMessage(null), 2000);

    if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current.onaudioprocess = null;
        scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close();
        inputAudioContextRef.current = null;
    }
    if (liveSessionRef.current) {
        try { liveSessionRef.current.close(); } catch(e) {}
        liveSessionRef.current = null;
    }
    for (const source of outputQueueRef.current) {
        try { source.stop(); } catch(e) {}
    }
    outputQueueRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const startCall = useCallback(async () => {
    setStatus('thinking');
    setCallStatusMessage("Connecting...");
    stopPlayback(true);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;

        if (!lessonAudioContextRef.current || lessonAudioContextRef.current.state === 'closed') {
            lessonAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const outputAudioContext = lessonAudioContextRef.current;
        if(outputAudioContext.state === 'suspended') outputAudioContext.resume();
        
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    setStatus('talking');
                    setIsCallActive(true);
                    setCallStatusMessage("Connected! You can start talking.");

                    const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                    mediaStreamSourceRef.current = source;
                    
                    const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = scriptProcessor;

                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createPcmBlob(inputData);
                        sessionPromise.then((session) => {
                           session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContextRef.current!.destination);
                },
                onmessage: async (message) => {
                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData) {
                        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                        const audioBuffer = await decodePcmData(decode(audioData), outputAudioContext, 24000);
                        const sourceNode = outputAudioContext.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(outputAudioContext.destination);
                        sourceNode.addEventListener('ended', () => { outputQueueRef.current.delete(sourceNode); });
                        sourceNode.start(nextStartTimeRef.current);
                        nextStartTimeRef.current += audioBuffer.duration;
                        outputQueueRef.current.add(sourceNode);
                    }
                    if (message.serverContent?.interrupted) {
                        for (const source of outputQueueRef.current) { source.stop(); }
                        outputQueueRef.current.clear();
                        nextStartTimeRef.current = 0;
                    }
                },
                onerror: (e) => {
                    console.error('Live session error:', e);
                    setCallStatusMessage("An error occurred. Please try again.");
                    endCall();
                },
                onclose: (e) => {
                    if (isCallActive) {
                       endCall();
                    }
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                systemInstruction: 'You are JB AI, a friendly and motivating mentor like Jeetu Bhaiya from Kota Factory. Engage in a natural, warm, and supportive Hinglish conversation. Treat the user like a younger sibling.'
            },
        });
        
        liveSessionRef.current = await sessionPromise;

    } catch (error) {
        console.error('Failed to start call:', error);
        setStatus('idle');
        setCallStatusMessage("Couldn't start the call. Check microphone permissions.");
        endCall();
    }
  }, [endCall, stopPlayback, isCallActive]);

  const handleCallToggle = () => {
    if (isCallActive) {
        endCall();
    } else {
        startCall();
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

        <div className="my-8 flex flex-col items-center justify-center gap-4">
            <Avatar status={status} onClick={handleAvatarClick} hasAudio={!!audioBase64} />
            {audioBase64 && status !== 'thinking' && !isCallActive && (
                <div className="flex items-center gap-6 -mt-4">
                    <button onClick={() => handleSeek(-10)} className="p-3 bg-slate-800/70 rounded-full text-cyan-300 hover:bg-slate-700 transition-colors" aria-label="Rewind 10 seconds">
                        <RewindIcon className="w-6 h-6" />
                    </button>
                    <button onClick={() => { stopPlayback(false); playAudio(0); }} className="p-4 bg-slate-800/70 rounded-full text-cyan-300 hover:bg-slate-700 transition-colors" aria-label="Restart lesson">
                        <RestartIcon className="w-8 h-8" />
                    </button>
                    <button onClick={() => handleSeek(10)} className="p-3 bg-slate-800/70 rounded-full text-cyan-300 hover:bg-slate-700 transition-colors" aria-label="Forward 10 seconds">
                        <ForwardIcon className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>
        
        <div className="h-24 max-w-2xl flex items-center justify-center p-4">
            <p className="font-handwriting text-2xl md:text-3xl text-cyan-200 quote-glow">
                {callStatusMessage
                 ? `🎤 ${callStatusMessage}`
                 : (status === 'awaiting_answer')
                 ? `🤔 ${currentQuestion}`
                 : "💬 “Don’t say dreams, say aim — dreams dekhe jaate hain, aims achieve kiye jaate hain.”"
                }
            </p>
        </div>
        
        {audioBase64 && status !== 'thinking' && !isCallActive && (
            <div className="w-full max-w-md p-2 -mt-4">
                <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={duration || 1}
                        value={currentTime}
                        onChange={(e) => {
                            const newTime = parseFloat(e.target.value);
                            setCurrentTime(newTime);
                            pauseTimeRef.current = newTime;
                            if (status === 'paused') {
                                playAudio(newTime);
                            }
                        }}
                        onMouseUp={(e) => {
                            if (status === 'talking') {
                                const newTime = parseFloat((e.target as HTMLInputElement).value);
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
            isLoading={status === 'thinking' || status === 'responding'}
            isCallActive={isCallActive}
            onCallToggle={handleCallToggle}
        />
      </div>
    </div>
  );
}

export default App;
