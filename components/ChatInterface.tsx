
import React, { useEffect, useRef } from 'react';
import { Message as MessageType } from '../types';
import Message from './Message';
import ChatInput from './ChatInput';
import { BotIcon } from './icons';

interface ChatInterfaceProps {
    messages: MessageType[];
    onSend: (text: string, file?: File) => void;
    isLoading: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSend, isLoading }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    return (
        <div className="flex flex-col h-screen max-w-4xl mx-auto bg-[#FAF8F3]">
            <header className="p-4 border-b border-gray-200 bg-white shadow-sm">
                <h1 className="text-2xl font-bold font-serif text-center text-gray-800">JB AI Mentor</h1>
                <p className="text-center text-gray-500 text-sm">Your warm, witty guide to learning.</p>
            </header>
            <main className="flex-grow p-4 overflow-y-auto">
                {messages.map((msg) => (
                    <Message key={msg.id} message={msg} />
                ))}
                {isLoading && (
                    <div className="flex items-start gap-4 my-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary text-white">
                            <BotIcon />
                        </div>
                        <div className="p-4 rounded-lg bg-white shadow-md">
                           <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-200"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-400"></span>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>
            <ChatInput onSend={onSend} isLoading={isLoading} />
        </div>
    );
};

export default ChatInterface;
