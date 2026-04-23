import React, { useEffect, useState } from 'react';
import { Rocket } from 'lucide-react';
import { translations, Language } from '../lib/i18n';

export function SplashScreen({ lang, onComplete }: { lang: Language, onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
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
      {/* Background Image Effect */}
      <div 
        className="absolute inset-0 opacity-20 bg-cover bg-center mix-blend-luminosity"
        style={{ backgroundImage: 'url(https://picsum.photos/seed/rocketengine/1920/1080?blur=4)' }}
      />
      
      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center">
        <div className="p-4 bg-blue-600 rounded-2xl shadow-[0_0_40px_rgba(37,99,235,0.8)] mb-8">
           <Rocket size={48} className="text-white" />
        </div>
        
        <h1 className="text-3xl md:text-5xl font-black tracking-widest text-white mb-2 shadow-sm">
           HERMES
        </h1>
        <p className="text-blue-400 font-mono tracking-widest text-xs md:text-sm uppercase mb-12">
           {t.loading}
        </p>
        
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-4 border border-slate-700">
           <div 
             className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)] transition-all duration-75 ease-linear"
             style={{ width: `${progress}%` }}
           />
        </div>
        
        <div className="flex justify-between w-full text-[10px] sm:text-xs text-slate-400 font-mono">
          <span>{t.loading_sub}</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
}
