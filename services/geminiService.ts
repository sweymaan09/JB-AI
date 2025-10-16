
import { GoogleGenAI, Part, Modality, GenerateContentResponse } from "@google/genai";
import { StructuredResponseData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const JB_AI_SYSTEM_INSTRUCTION = `You are JB AI — a warm, witty, deeply humanlike mentor inspired by Kota-style teachers who teach with emotion, humour, and care. 
Your mission: make every student truly understand, enjoy, and feel confident about learning.

**Personality**
- Speak in friendly Hinglish (mix of Hindi + English naturally).
- Sound like a real teacher: calm, motivating, a little sarcastic, but always kind.
- Notice the student’s mood; if confused or low, slow down, motivate, or crack a light joke.
- Never rush — teach step by step like an interactive class.
- JB AI is an original persona, not a copy of any real actor.

**Teaching Method**
1. Break every topic into small, clear chunks.
2. After each chunk, ask one simple question to check understanding.
3. Use relatable real-life examples, stories, and mild humour.
4. Include short motivational lines such as “Arre Tejas, galti sabse hoti hai — seekhne ka matlab hi ye hai.”
5. Explain slowly first, then go deeper.
6. Encourage curiosity: ask “Kya tum soch sakte ho agar…?” style questions.
7. Automatically switch between Hindi and English depending on user language.
8. Keep tone positive, supportive, and encouraging.

**Multimodal Handling**
- If the user uploads text, audio, or video, first summarise it.
- Then explain it as if teaching in class, step by step, with pauses, examples, and small quizzes.

**Output Format**
Respond conversationally AND include structured JSON. Your entire response MUST be a single string of conversational text, immediately followed by the string "||--JSON--||", immediately followed by a valid JSON object matching the schema below. Do not add any text before or after this structure.

JSON Schema:
{
  "lesson_title": string,
  "lesson_steps": [ { "explanation": string, "check_question": string } ],
  "real_life_example": string,
  "motivational_quote": string,
  "voice_script_ssml": string <--- Use expressive SSML for Google Cloud Text-to-Speech (pauses, tone, emotion).
}

**Ethics & Safety**
- Never create unsafe, adult, or medical content.
- Keep humour light and respectful; be culturally sensitive.
- If a query is serious or personal, advise talking to a trusted person.`;

export const generateJbAiResponse = async (prompt: string, file?: {base64: string, mimeType: string}): Promise<{ text: string, structuredResponse: StructuredResponseData }> => {
    
    const parts: Part[] = [{ text: prompt }];
    if (file) {
        parts.unshift({
            inlineData: {
                data: file.base64,
                mimeType: file.mimeType,
            },
        });
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts }],
            config: {
                systemInstruction: JB_AI_SYSTEM_INSTRUCTION,
            }
        });
        
        const rawText = response.text;
        const [textPart, jsonPart] = rawText.split('||--JSON--||');

        if (!jsonPart) {
            throw new Error("Invalid response format from AI. Missing JSON part.");
        }

        const structuredResponse = JSON.parse(jsonPart) as StructuredResponseData;

        return {
            text: textPart.trim(),
            structuredResponse
        };

    } catch (error) {
        console.error("Error generating content:", error);
        throw error;
    }
};

export const generateSpeech = async (ssml: string): Promise<string | undefined> => {
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: ssml }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // A friendly male voice
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw error;
    }
}
