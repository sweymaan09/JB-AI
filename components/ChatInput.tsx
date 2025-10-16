
import React, { useRef, useState } from 'react';
import { SendIcon, PaperclipIcon } from './icons';

interface ChatInputProps {
    onSend: (text: string, file?: File) => void;
    isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
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
        <div className="p-4 bg-white border-t border-gray-200">
            {file && (
                <div className="mb-2 p-2 bg-gray-100 rounded-md text-sm text-gray-700">
                    Attached: {file.name}
                    <button onClick={() => setFile(null)} className="ml-2 text-red-500 font-bold">x</button>
                </div>
            )}
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                />
                <label htmlFor="file-upload" className="p-2 text-gray-500 hover:text-primary cursor-pointer transition-colors" aria-label="Attach file">
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
                    placeholder="Ask JB AI anything..."
                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={1}
                    disabled={isLoading}
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || (!text.trim() && !file)}
                    className="p-3 bg-primary text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                    aria-label="Send message"
                >
                    <SendIcon />
                </button>
            </div>
        </div>
    );
};

export default ChatInput;
