
import React, { useState } from 'react';
import { StructuredResponseData } from '../types';
import { ChevronDownIcon } from './icons';

interface StructuredResponseProps {
    data: StructuredResponseData;
}

const StructuredResponse: React.FC<StructuredResponseProps> = ({ data }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className="mt-4 border border-gray-200 rounded-lg bg-white overflow-hidden">
            <button
                className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <h3 className="text-lg font-semibold font-serif text-gray-800">{data.lesson_title}</h3>
                <ChevronDownIcon className={`w-6 h-6 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="p-4 space-y-4">
                    <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Lesson Steps:</h4>
                        <ul className="space-y-3 list-decimal list-inside pl-2 text-gray-600">
                            {data.lesson_steps.map((step, index) => (
                                <li key={index}>
                                    <p className="font-medium text-gray-800">{step.explanation}</p>
                                    <p className="text-sm italic mt-1">🤔 "{step.check_question}"</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Real Life Example:</h4>
                        <p className="text-gray-600 bg-yellow-50 p-3 rounded-md border-l-4 border-yellow-300">
                            {data.real_life_example}
                        </p>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-700 mb-2">Motivational Quote:</h4>
                        <p className="text-gray-600 italic">"{data.motivational_quote}"</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StructuredResponse;
