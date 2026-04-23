import React, { useState, useEffect, useRef } from 'react';
import { SimulationResults } from '../lib/types';
import { EngineViewer } from './EngineViewer';
import { GrainViewer } from './GrainViewer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function PlaybackWrapper({ results, t_parent }: { results: SimulationResults, t_parent?: any }) {
  const t = t_parent || {
    play: "Play",
    pause: "Pause",
    restart: "Restart",
    speed: "Speed",
    real_time: "Real"
  };

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [timeIndex, setTimeIndex] = useState(0);
  
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const simulatedTimeRef = useRef<number>(0);

  useEffect(() => {
    setTimeIndex(0);
    setIsPlaying(false);
    simulatedTimeRef.current = 0;
  }, [results]);

  useEffect(() => {
    if (!isPlaying || !results || !results.t) return;
    
    simulatedTimeRef.current = results.t[timeIndex] || 0;
    previousTimeRef.current = performance.now();

    const animate = (time: number) => {
      const deltaTime = (time - previousTimeRef.current!) / 1000;
      simulatedTimeRef.current += deltaTime * speed;
      
      setTimeIndex(prev => {
        let newIndex = prev;
        while (newIndex < results.t.length - 1 && results.t[newIndex] < simulatedTimeRef.current) {
           newIndex++;
        }
        if (newIndex >= results.t.length - 1) {
           setIsPlaying(false); // Can trigger an update, safe to return immediately
           return results.t.length - 1;
        }
        return newIndex;
      });
      
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, speed, results]);

  const handlePlayToggle = () => {
    if (!isPlaying && timeIndex >= results.t.length - 1) {
      // Restart from beginning if at the end
      setTimeIndex(0);
      simulatedTimeRef.current = 0;
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeIndex(Number(e.target.value));
    setIsPlaying(false);
  };

  if (!results || !results.t) return null;

  return (
    <div className="flex flex-col gap-4 w-full h-full min-h-[300px] shrink-0 pb-4 overflow-hidden">
      
      {/* Global Controls */}
      <div className="flex-none flex items-center gap-4 bg-white p-3 rounded-lg border border-neutral-200 shadow-sm shrink-0">
         <Button onClick={handlePlayToggle} className="w-24 h-8 bg-blue-600 hover:bg-blue-700">
            {isPlaying ? t.pause : timeIndex === results.t.length - 1 ? t.restart : t.play}
         </Button>
         <div className="flex-1 px-2">
           <input 
             type="range" 
             min="0" 
             max={results.t.length - 1} 
             value={timeIndex} 
             onChange={handleSeek} 
             className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
           />
           <div className="flex justify-between text-[10px] text-neutral-500 mt-1 font-mono">
             <span>0.000 s</span>
             <span className="font-semibold text-neutral-800 text-xs">{Number(results.t[timeIndex] || 0).toFixed(3)} s</span>
             <span>{(results.summary.t_quemado || results.t[results.t.length-1]).toFixed(3)} s</span>
           </div>
         </div>
         
         <div className="flex items-center gap-2 w-[120px]">
           <Label className="text-[10px]">{t.speed}</Label>
           <Select value={String(speed)} onValueChange={v => setSpeed(Number(v))}>
              <SelectTrigger className="h-7 text-[10px] border-neutral-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white text-[10px]">
                <SelectItem value="0.25">0.25x</SelectItem>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="1">1.0x ({t.real_time})</SelectItem>
                <SelectItem value="2">2.0x</SelectItem>
                <SelectItem value="4">4.0x</SelectItem>
                <SelectItem value="8">8.0x</SelectItem>
              </SelectContent>
           </Select>
         </div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-4 min-h-0 overflow-y-auto no-scrollbar pb-2">
        <div className="flex-1 min-h-[200px] p-0.5">
           <EngineViewer results={results} timeIndex={timeIndex} t={t} />
        </div>
        <div className="flex-1 min-h-[200px] p-0.5">
           <GrainViewer results={results} timeIndex={timeIndex} t={t} />
        </div>
      </div>
    </div>
  );
}
