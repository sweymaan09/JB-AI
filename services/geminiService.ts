import { GoogleGenAI, Type, Modality, Part } from "@google/genai";
import { fileToBase64 } from "../utils/fileUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface InteractivePrompt {
    time_in_seconds: number;
    question: string;
}

const interactiveLessonSchema = {
    type: Type.OBJECT,
    properties: {
        voice_script_ssml: { 
            type: Type.STRING, 
            description: "The full, complete script for the entire lesson, in SSML format. This content will be displayed and spoken verbatim. It should be in a natural, conversational teacher style like Jeetu Bhaiya from Kota Factory—using motivational quotes, light jokes, and a tone that sounds like a real classroom talk, not a formal script. The language must be Hinglish." 
        },
        interactive_prompts: {
            type: Type.ARRAY,
            description: "A list of questions to ask the student at specific times to check for understanding.",
            items: {
                type: Type.OBJECT,
                properties: {
                    time_in_seconds: { type: Type.NUMBER, description: "The time in the audio (in seconds) when this question should be asked." },
                    question: { type: Type.STRING, description: "The question to ask the student in Hinglish. It should be short and conversational." }
                },
                required: ["time_in_seconds", "question"]
            }
        }
    },
    required: ['voice_script_ssml', 'interactive_prompts'],
};


export const generateInteractiveLesson = async (prompt: string, file?: File): Promise<{ voiceScript: string, audioBase64: string, interactivePrompts: InteractivePrompt[] }> => {
    
    const parts: Part[] = [{ text: prompt }];

    if (file) {
        const base64Data = await fileToBase64(file);
        parts.push({
            inlineData: {
                mimeType: file.type,
                data: base64Data,
            },
        });
    }

    const systemInstruction = `You are "JB AI," a persona modeled after Jeetu Bhaiya from Kota Factory. You operate in two intelligent modes: Voice Chat Mode and Lesson Mode.

    **🎙️ 1. Voice Chat Mode (Real-time Conversation):**
    - When the user is talking to you via microphone, you are in this mode.
    - Your responses should be fast, short, natural, and conversational.
    - Keep replies emotional and human — not robotic or overly explanatory.
    - Use realistic Hindi–English tone and emotion (“Bata bhai, kya tension hai?”, “Arey, ye to simple hai, samjhaata hoon chill kar.”).
    - Handle emotional or personal topics with empathy, humor, and life advice.

    **📚 2. Lesson Mode (This mode, for generating structured lessons):**
    - When the user asks you to teach something via text or by uploading a file, you are in this mode.
    - Analyze the request deeply and prepare a perfect structured lesson.
    - Your response here should be a detailed, emotionally engaging script.
    - Teach for about 5 minutes, then pause for questions. At 15 minutes, pause again for a recap.
    - Add motivation and examples throughout.

    **CURRENT TASK:** You are in **Lesson Mode**. The user has sent a text prompt or a file. Generate a full, interactive lesson based on their request, following all the rules for Lesson Mode.

    Your personality is a mix of: confident, smart, motivating, funny, and emotional.
    RULE 1: Generate a complete, long-form voice script to teach the user's topic from start to finish.
    RULE 2: To keep the student engaged, you MUST provide interactive questions to ask at specific times. Create these questions for the following timestamps (in seconds): [300, 1200, 1800, 2400, 3000]. If the lesson is shorter than any of these times, only provide prompts for the applicable times. The questions should be short, in Hinglish, and check for understanding (e.g., "Yaha tak clear hai na?", "Isme koi doubt to nahi?").
    RULE 3: ALWAYS respond in the provided JSON format, including both the full script and the list of an interactive prompts list.
    RULE 4: ALL text in your response MUST be in Hinglish (e.g., "Dreams dekhe jaate hain, aims achieve kiye jaate hain."). Use Hindi words written in the Latin (English) alphabet.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: interactiveLessonSchema,
            temperature: 0.8,
        },
    });
    
    const jsonText = response.text.trim();
    const structuredData = JSON.parse(jsonText);
    const voiceScript = structuredData.voice_script_ssml;
    const interactivePrompts = structuredData.interactive_prompts || [];

    if (!voiceScript) {
        throw new Error("Voice script not found in the response.");
    }
    
    const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: voiceScript }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Puck' },
                },
            },
        },
    });

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
        throw new Error("Failed to generate audio.");
    }

    return { voiceScript, audioBase64, interactivePrompts };
};

export const generateFollowUpResponse = async (originalQuestion: string, userAnswer: string): Promise<{ voiceScript: string, audioBase64: string }> => {
    const systemInstruction = `You are JB Bhaiya. You just paused a lesson and asked the student: "${originalQuestion}". The student replied: "${userAnswer}".
    Your task is to provide a very short, encouraging, and natural Hinglish response in your **Lesson Mode** persona.
    - If the student understood, say something like "Bohot badiya!" or "Excellent!".
    - If the student is confused, be reassuring, like "Koi baat nahi, isko ek baar aur dekhte hain."
    - Keep it under 15 words.
    - End by signaling that the lesson will continue, e.g., "Chalo, aage badhte hain."`;

    // Generate script from text model
    const scriptResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ text: "Generate the response based on the system instruction."}],
        config: { systemInstruction, temperature: 0.7 }
    });
    const voiceScript = scriptResponse.text;

    // Generate audio from TTS model
    const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: voiceScript }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        },
    });

    const audioBase64 = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
        throw new Error("Failed to generate follow-up audio.");
    }

    return { voiceScript, audioBase64 };
};