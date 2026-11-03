import React, { useEffect, useState } from 'react';
import { AppIcon } from './Logo';
import { translations, Language } from '../lib/i18n';

const QUOTES = [
  { text: "The Earth is the cradle of humanity, but mankind cannot stay in the cradle forever.", author: "Konstantin Tsiolkovsky" },
  { text: "To confine our attention to terrestrial matters would be to limit the human spirit.", author: "Stephen Hawking" },
  { text: "Once you have tasted flight, you will forever walk the earth with your eyes turned skyward.", author: "Leonardo da Vinci" },
  { text: "That's one small step for man, one giant leap for mankind.", author: "Neil Armstrong" },
  { text: "Spaceflight will never tolerate carelessness, incapacity, and neglect.", author: "Gene Kranz" },
  { text: "There is no sound in space, but the roar of a rocket makes up for it.", author: "Unknown" },
  { text: "Any sufficiently advanced technology is indistinguishable from magic.", author: "Arthur C. Clarke" },
  { text: "If we can conquer space, we can conquer childhood hunger.", author: "Buzz Aldrin" },
];

export function SplashScreen({ lang, onComplete }: { lang: Language, onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const t = translations[lang];

  useEffect(() => {
    const duration = 2000;
    const interval = 20;
    const steps = duration / interval;
    let step = 0;
    
    const timer = setInterval(() => {
      step++;
      setProgress(Math.min(100, Math.floor((step / steps) * 100)));
      if (step >= steps) {
        clearInterval(timer);
        setTimeout(onComplete, 200);
      }
    }, interval);
    
    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Background Photo from User Workshop - Vibrant and Clear */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter contrast-110 brightness-90 scale-105 transition-transform duration-1000"
        style={{ backgroundImage: 'url(/assets/aistudio/_DSC0362_f879f6df.JPG)' }}
      />
      
      {/* Cinematic Vignette / Radial Gradient Overlay to ensure stunning contrast without any box/panel */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/50 backdrop-blur-[0.5px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.75)_100%)] pointer-events-none" />
      
      {/* Content Container (No panel box - floating with deep drop-shadows for high contrast on photo) */}
      <div className="relative z-10 flex flex-col items-center max-w-xl w-full px-6 text-center">
        
        {/* Glowing App Icon with active flame */}
        <div className="mb-6 relative hover:scale-105 transition-transform duration-300">
           <div className="absolute inset-x-0 bottom-0 top-6 rounded-[32px] bg-purple-500/50 blur-3xl animate-pulse" />
           <div className="absolute inset-x-0 bottom-[-20px] h-12 bg-orange-500/40 blur-xl animate-pulse" />
           <AppIcon size={120} className="relative z-10 shadow-[0_0_30px_rgba(168,85,247,0.6)]" />
        </div>
        
        {/* Title and Version Badge */}
        <div className="flex items-center justify-center gap-3 mb-2 flex-wrap">
          <h1 className="text-3xl sm:text-5xl font-black tracking-widest text-slate-100 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
             HERMES SIMULATOR
          </h1>
          <span className="px-3 py-1 rounded-full bg-purple-600 text-white font-mono text-xs font-extrabold border border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.8)]">
            v2.0
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-purple-300 font-mono tracking-widest text-xs sm:text-sm uppercase mb-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] font-black">
           High Efficiency Rocket Motor Emulation System
        </p>

        {/* Quote Section */}
        <div className="h-16 flex flex-col items-center justify-center mb-10 px-4">
           <p className="text-slate-100 italic text-xs sm:text-base font-serif mb-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">"{quote.text}"</p>
           <p className="text-purple-300 font-mono text-[10px] sm:text-xs tracking-widest uppercase font-bold drop-shadow">— {quote.author}</p>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-950/80 h-3 rounded-full overflow-hidden mb-3 border border-purple-500/40 shadow-[0_0_15px_rgba(0,0,0,0.8)] backdrop-blur-md">
           <div 
             className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.9)] transition-all duration-75 ease-linear"
             style={{ width: `${progress}%` }}
           />
        </div>
        
        {/* Loading Sub and Percentage */}
        <div className="flex justify-between w-full text-xs text-slate-200 font-mono drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] font-bold">
          <span className="text-purple-200">{t.loading_sub}</span>
          <span className="text-cyan-300">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
