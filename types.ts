
export interface LessonStep {
    explanation: string;
    check_question: string;
}

export interface StructuredResponseData {
    lesson_title: string;
    lesson_steps: LessonStep[];
    real_life_example: string;
    motivational_quote: string;
    voice_script_ssml: string;
}

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    structuredResponse?: StructuredResponseData;
    audioBase64?: string;
}
