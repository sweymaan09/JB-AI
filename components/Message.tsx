import React, { useState } from 'react';
import { Message as MessageType } from '../types';
import StructuredResponse from './StructuredResponse';
import AudioPlayer from './AudioPlayer';
import { BotIcon, UserIcon } from './icons';

interface MessageProps {
    message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const isAi = message.sender === 'ai';

    return (
        <div className={`flex items-start gap-4 my-4 ${isAi ? '' : 'flex-row-reverse'}`}>
            <div 
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isAi ? 'bg-primary text-white' : 'bg-gray-300 text-gray-700'} ${isSpeaking ? 'shadow-lg shadow-primary/50 ring-4 ring-primary/30' : ''}`}
            >
                {isAi ? <BotIcon /> : <UserIcon />}
            </div>
            <div className={`p-4 rounded-lg max-w-lg ${isAi ? 'bg-white shadow-md' : 'bg-primary text-white'}`}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p>
                {message.structuredResponse && <StructuredResponse data={message.structuredResponse} />}
                {message.audioBase64 && <AudioPlayer audioBase64={message.audioBase64} onPlayStateChange={setIsSpeaking} />}
            </div>
        </div>
    );
};

export default Message;