import React, { useRef, useState } from 'react';
import { SendIcon, PaperclipIcon, MicIcon } from './icons';

interface ChatInputProps {
    onSend: (text: string, file?: File) => void;
    isLoading: boolean;
    isCallActive: boolean;
    onCallToggle: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ 
    onSend, 
    isLoading,
    isCallActive,
    onCallToggle
}) => {
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
            <div className="max-w-3xl mx-auto">
                {isCallActive ? (
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={onCallToggle}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white transition-all duration-300 bg-red-600 hover:bg-red-500`}
                            aria-label="End call"
                        >
                            <MicIcon />
                            <span>End Call</span>
                        </button>
                    </div>
                ) : (
                    <>
                        {file && (
                            <div className="mb-2 p-2 bg-purple-950/50 rounded-md text-sm text-gray-300">
                                Attached: {file.name}
                                <button 
                                    onClick={() => {
                                        setFile(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }} 
                                    className="ml-2 text-red-400 font-bold"
                                >
                                    x
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                                disabled={isLoading}
                            />
                            <label htmlFor="file-upload" className={`p-3 text-gray-400 ${isLoading ? 'cursor-not-allowed text-gray-600' : 'hover:text-purple-400 cursor-pointer'} transition-colors`} aria-label="Attach file">
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
                                placeholder="Start a lesson or ask a question..."
                                className="flex-grow p-2 bg-slate-900/50 border border-purple-800 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                rows={1}
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={isLoading || (!text.trim() && !file)}
                                className="p-3 bg-purple-600 text-white rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed hover:bg-purple-500 transition-colors"
                                aria-label="Send message"
                            >
                                <SendIcon />
                            </button>
                            <button
                                onClick={onCallToggle}
                                disabled={isLoading}
                                className="p-3 bg-green-600 text-white rounded-full disabled:bg-gray-500 hover:bg-green-500 transition-colors"
                                aria-label="Start voice conversation"
                            >
                                <MicIcon />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChatInput;
