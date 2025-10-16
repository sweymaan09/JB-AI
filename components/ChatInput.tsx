import React, { useRef, useState } from 'react';
import { SendIcon, PaperclipIcon, MicIcon } from './icons';

interface ChatInputProps {
    onSend: (text: string, file?: File) => void;
    isLoading: boolean;
    onMicClick: () => void;
    isRecording: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, onMicClick, isRecording }) => {
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSend = () => {
        if ((text.trim() || file) && !isLoading) {
            onSend(text.trim(), file || undefined);
            setText('');
            setFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    return (
        <div className="p-4 bg-gradient-to-t from-black/60 to-transparent backdrop-blur-sm border-t border-purple-400/20">
            {file && (
                <div className="mb-2 p-2 bg-purple-950/50 rounded-md text-sm text-gray-300">
                    Attached: {file.name}
                    <button onClick={() => setFile(null)} className="ml-2 text-red-400 font-bold">x</button>
                </div>
            )}
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    disabled={isRecording || isLoading}
                />
                <label htmlFor="file-upload" className={`p-2 text-gray-400 ${isRecording ? 'cursor-not-allowed text-gray-600' : 'hover:text-purple-400 cursor-pointer'} transition-colors`} aria-label="Attach file">
                    <PaperclipIcon />
                </label>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={isRecording ? "Listening..." : "Ask JB AI anything..."}
                    className="flex-grow p-2 bg-slate-900/50 border border-purple-800 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={1}
                    disabled={isLoading || isRecording}
                />
                 <button
                    onClick={onMicClick}
                    disabled={isLoading}
                    className={`p-3 rounded-lg transition-colors ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-green-600 text-white hover:bg-green-500'} disabled:bg-gray-500 disabled:cursor-not-allowed`}
                    aria-label={isRecording ? "Stop listening" : "Start listening"}
                >
                    <MicIcon />
                </button>
                <button
                    onClick={handleSend}
                    disabled={isLoading || (!text.trim() && !file) || isRecording}
                    className="p-3 bg-purple-600 text-white rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors"
                    aria-label="Send message"
                >
                    <SendIcon />
                </button>
            </div>
        </div>
    );
};

export default ChatInput;