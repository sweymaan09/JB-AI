import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import { Message } from './types';
import { createJbAiChatSession, continueJbAiChat, generateSpeech } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { Chat } from '@google/genai';

const App: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'initial',
            sender: 'ai',
            text: "Namaste! I'm JB AI, your personal mentor. Ready to learn something new today? Poochho, jo bhi doubt hai!",
        }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);

    // Initialize the chat session on component mount
    useEffect(() => {
        try {
            const chatSession = createJbAiChatSession();
            setChat(chatSession);
        } catch (error) {
            console.error("Failed to initialize chat session:", error);
             const errorMessage: Message = {
                id: 'init-error',
                sender: 'ai',
                text: "Oh ho, lagta hai connection mein kuch gadbad hai. Please refresh and try again.",
            };
            setMessages((prev) => [...prev, errorMessage]);
        }
    }, []);

    const handleSend = async (text: string, file?: File) => {
        if (!chat) {
            console.error("Chat is not initialized.");
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: "Apologies, the chat session isn't ready. Please refresh the page.",
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
        }

        setIsLoading(true);

        const userMessage: Message = {
            id: Date.now().toString(),
            sender: 'user',
            text: text,
        };
        setMessages((prev) => [...prev, userMessage]);
        
        try {
            let filePayload;
            if (file) {
                const base64 = await fileToBase64(file);
                filePayload = { base64, mimeType: file.type };
            }
            
            const { text: aiText, structuredResponse } = await continueJbAiChat(chat, text, filePayload);
            
            let audioBase64;
            if (structuredResponse?.voice_script_ssml) {
                audioBase64 = await generateSpeech(structuredResponse.voice_script_ssml);
            }

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: aiText,
                structuredResponse,
                audioBase64,
            };
            setMessages((prev) => [...prev, aiMessage]);

        } catch (error) {
            console.error("Failed to get response:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                text: "Arre yaar, something went wrong. Let's try that again, shall we?",
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ChatInterface 
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
        />
    );
};

export default App;