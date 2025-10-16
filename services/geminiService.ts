import { GoogleGenAI, Type, Modality, Part } from "@google/genai";
import { fileToBase64 } from "../utils/fileUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface InteractivePrompt {
    time_in_seconds: number;
    question: string;
}

const lessonPartSchema = {
    type: Type.OBJECT,
    properties: {
        voice_script_ssml: { 
            type: Type.STRING, 
            description: "The full script for this part of the lesson (approx 3-5 minutes), in SSML format. Must be in a natural, conversational Hinglish teacher style like Jeetu Bhaiya. Use stories, analogies, and motivational tone." 
        },
        interactive_prompts: {
            type: Type.ARRAY,
            description: "A list of 1-2 questions to ask the student during this lesson segment to check for understanding. These should be timed to appear near the end of the audio.",
            items: {
                type: Type.OBJECT,
                properties: {
                    time_in_seconds: { type: Type.NUMBER, description: "The time in this audio segment (in seconds) when this question should be asked." },
                    question: { type: Type.STRING, description: "The question to ask the student in Hinglish. It should be short and conversational." }
                },
                required: ["time_in_seconds", "question"]
            }
        },
    },
    required: ['voice_script_ssml'],
};


export const generateInteractiveLesson = async (
    prompt: string, 
    file?: File,
    context?: { topic: string, partNumber: number }
): Promise<{ voiceScript: string, audioBase64: string, interactivePrompts: InteractivePrompt[], finalQuestion: null }> => {
    
    const parts: Part[] = [];
    let systemInstruction: string;

    if (context) {
        // This is a continuation of a lesson
        parts.push({ text: `Continue teaching the topic: "${context.topic}". This is part ${context.partNumber} of the lesson.` });
        systemInstruction = `You are JB AI, a friendly and motivating mentor like Jeetu Bhaiya from Kota Factory. You are continuing a lesson on "${context.topic}". This is part ${context.partNumber}.
Use a warm, conversational Hinglish style. Use analogies, humor, and motivation.
Your task is to generate the script for the NEXT 3-5 minute segment of the lesson.
- At the 15-minute mark (around part 3 or 4), you should provide a recap and ask a deeper conceptual question. This is part ${context.partNumber}, so plan accordingly.
- **voice_script_ssml**: Create the SSML script for this segment. It must feel like a natural continuation.
- **interactive_prompts**: Provide 1 or 2 relevant, short, conversational questions to ask the student during this part of the lesson. If this is a recap segment, make the question more conceptual.
Your entire response MUST be a single, valid JSON object that adheres to the provided schema. Do not include any text, explanation, or markdown before or after the JSON object.`;

    } else {
        // This is the start of a new lesson
        parts.push({ text: prompt });
        if (file) {
            const base64Data = await fileToBase64(file);
            parts.push({ inlineData: { mimeType: file.type, data: base64Data } });
        }
        
        systemInstruction = `You are JB AI, an AI tutor with the persona of Jeetu Bhaiya from Kota Factory. Your task is to generate the FIRST part of a lesson plan based on the user's request.
Your entire response MUST be a single, valid JSON object that adheres to the provided schema. Do not include any text, explanation, or markdown before or after the JSON object.
Adopt a warm, motivating, emotional, and realistic Hinglish style. Treat the student like a younger sibling. Use stories, practical analogies, and humor.
Lesson requirements for this first part:
1. **Deeply analyze** the user's request, identify the core topic.
2. **Mentally plan a multi-part lesson** (e.g., basics -> details -> advanced -> recap).
3. **voice_script_ssml**: Create an engaging 3-5 minute SSML script for the FIRST part of the lesson, covering the fundamentals.
4. **interactive_prompts**: After about 3-5 minutes of teaching in this segment, include 1-2 simple questions to check for initial understanding. Timing should be near the end of the script.`;
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: lessonPartSchema,
            temperature: 0.8,
        },
    });
    
    let jsonText = response.text;
    
    // Robust JSON extraction
    const markdownMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        jsonText = markdownMatch[1];
    } else {
        const startIndex = jsonText.indexOf('{');
        const endIndex = jsonText.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            jsonText = jsonText.substring(startIndex, endIndex + 1);
        } else {
            console.error("No valid JSON structure found in response:", response.text);
            throw new Error("Model returned a non-JSON or incomplete JSON response.");
        }
    }

    let structuredData;
    try {
        structuredData = JSON.parse(jsonText);
    } catch (error) {
        console.error("Failed to parse extracted JSON:", jsonText, "Original response:", response.text, "Error:", error);
        throw new Error("Model returned malformed JSON.");
    }

    const voiceScript = structuredData.voice_script_ssml;
    const interactivePrompts = structuredData.interactive_prompts || [];
    const finalQuestion = null;

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

    return { voiceScript, audioBase64, interactivePrompts, finalQuestion };
};

export const generateFollowUpResponse = async (originalQuestion: string, userAnswer: string): Promise<{ voiceScript: string, audioBase64: string }> => {
    const systemInstruction = `You are JB AI (Jeetu Bhaiya). You are in **Lesson Mode**. You just paused a lesson and asked: "${originalQuestion}". The student replied: "${userAnswer}".
Your task is to provide a very short (under 15 words), encouraging, and natural Hinglish response.
- If the answer is correct, be encouraging: "Bohot badiya!", "Excellent beta! Sahi pakde ho."
- If the answer is wrong or confused, be reassuring: "Koi baat nahi, tension mat le. Isko ek baar aur dekhte hain."
- Maintain your warm, sibling-like persona.
- End by signaling that the lesson will continue, e.g., "Chalo, aage badhte hain."`;

    const scriptResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ text: "Generate the response based on the system instruction."}],
        config: { systemInstruction, temperature: 0.7 }
    });
    const voiceScript = scriptResponse.text;

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
