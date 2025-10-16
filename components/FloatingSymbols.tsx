import React from 'react';

// Color palette for symbols
const colors = [
  'text-cyan-400', 
  'text-yellow-300', 
  'text-orange-400', 
  'text-green-400'
];

// A curated list of fixed positions for symbols to create an attractive, balanced, and subtle layout
const symbolPlacements = [
    // --- Top Section (Above Avatar) ---
    { symbol: '🚀', style: { top: '3%', left: '5%', fontSize: '1.7rem', transform: 'rotate(-25deg)' } },
    { symbol: '🌟', style: { top: '5%', right: '7%', fontSize: '1.8rem', transform: 'rotate(20deg)' } },
    { symbol: '➗', style: { top: '12%', left: '20%', fontSize: '1.3rem', transform: 'rotate(18deg)' } },
    { symbol: '🤔', style: { top: '10%', right: '25%', fontSize: '1.8rem', transform: 'rotate(-15deg)' } },
    { symbol: 'E=mc²', style: { top: '18%', left: '30%', fontSize: '1.4rem', transform: 'rotate(10deg)' } },
    { symbol: '🧠', style: { top: '16%', right: '40%', fontSize: '2rem', transform: 'rotate(8deg)' } },

    // --- Middle Section (Around Avatar & Quote) ---
    { symbol: '⚛️', style: { top: '30%', left: '2%', fontSize: '1.8rem', transform: 'rotate(10deg)' } },
    { symbol: '📚', style: { top: '50%', left: '8%', fontSize: '1.6rem', transform: 'rotate(-15deg)' } },
    { symbol: '⚗️', style: { top: '65%', left: '4%', fontSize: '1.5rem', transform: 'rotate(25deg)' } },
    { symbol: '💡', style: { top: '28%', right: '3%', fontSize: '2.1rem', transform: 'rotate(-10deg)' } },
    { symbol: '🧬', style: { top: '52%', right: '6%', fontSize: '1.7rem', transform: 'rotate(20deg)' } },
    { symbol: '🔬', style: { top: '40%', right: '12%', fontSize: '1.7rem', transform: 'rotate(30deg)' } },

    // --- Bottom Section (Below Quote, Above Input) ---
    { symbol: '💻', style: { bottom: '22%', left: '15%', fontSize: '1.6rem', transform: 'rotate(10deg)' } },
    { symbol: '🔥', style: { bottom: '20%', right: '12%', fontSize: '2.2rem', transform: 'rotate(15deg)' } },
    { symbol: '∑', style: { bottom: '30%', left: '30%', fontSize: '1.4rem', transform: 'rotate(-5deg)' } },
    { symbol: '🤓', style: { bottom: '28%', right: '32%', fontSize: '1.8rem', transform: 'rotate(5deg)' } },
    { symbol: '💪', style: { bottom: '35%', left: '45%', fontSize: '1.6rem', transform: 'rotate(-5deg)' } },
    { symbol: '∫', style: { bottom: '33%', right: '20%', fontSize: '1.4rem', transform: 'rotate(-10deg)' } },
    
    // --- Far Bottom Corners ---
    { symbol: '🎓', style: { bottom: '18%', left: '3%', fontSize: '1.8rem', transform: 'rotate(15deg)' } },
    { symbol: '🎯', style: { bottom: '16%', right: '5%', fontSize: '1.7rem', transform: 'rotate(-10deg)' } },
    { symbol: '📈', style: { bottom: '25%', right: '45%', fontSize: '1.8rem', transform: 'rotate(-15deg)' } },
    { symbol: '📘', style: { bottom: '38%', left: '18%', fontSize: '1.5rem', transform: 'rotate(-20deg)' } },
    { symbol: 'π', style: { bottom: '15%', left: '40%', fontSize: '1.5rem', transform: 'rotate(10deg)' } },
    { symbol: '🔧', style: { bottom: '17%', right: '25%', fontSize: '1.5rem', transform: 'rotate(-12deg)' } },
];


const FloatingSymbols = () => {
    return (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none" aria-hidden="true">
            {symbolPlacements.map((item, i) => (
                <span
                    key={i}
                    className={`absolute symbol-glow ${colors[i % colors.length]}`} // Cycle through colors
                    style={{
                        ...item.style,
                        opacity: 0.2, // Lowered opacity for a more subtle effect
                    }}
                >
                    {item.symbol}
                </span>
            ))}
        </div>
    );
};

export default FloatingSymbols;
