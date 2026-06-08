import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Volume2, X } from 'lucide-react';

interface DailyGreetingToastProps {
  isLight: boolean;
}

export default function DailyGreetingToast({ isLight }: DailyGreetingToastProps) {
  const [isOpen, setIsOpen] = useState(false);
  const greetingText = "Today is a fresh opportunity to reach new heights. Set your target, stay focused, and make every effort count.";

  const playChimeSound = (): Promise<void> => {
    return new Promise((resolve) => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          resolve();
          return;
        }
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        
        const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.04);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        
        // A clear, premium, elegant rising chime:
        // C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz) -> C6 (1046.50Hz)
        playTone(523.25, now + 0.0, 0.22, 0.1);
        playTone(659.25, now + 0.08, 0.22, 0.1);
        playTone(783.99, now + 0.16, 0.25, 0.1);
        playTone(1046.50, now + 0.24, 0.45, 0.12);
        
        setTimeout(() => {
          resolve();
        }, 400);
      } catch (e) {
        resolve();
      }
    });
  };

  useEffect(() => {
    // Check if we already greeted today
    const localStorageKey = 'overdesk_last_greeting_date';
    const todayStr = new Date().toDateString(); // e.g. "Mon Jun 08 2026"
    const lastGreetingDate = localStorage.getItem(localStorageKey);

    if (lastGreetingDate !== todayStr) {
      setIsOpen(true);
      // Save today's date so we only do it once a day
      localStorage.setItem(localStorageKey, todayStr);

      // Attempt to speak
      triggerSpeechFlow(greetingText);
    }
  }, []);

  const triggerSpeechFlow = (text: string) => {
    const playAndSpeak = async () => {
      await playChimeSound();
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      // Cancel active speech so they don't overlap
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.pitch = 1.05;
      utterance.volume = 0.9;

      // Select a premium natural sounding voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => 
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')) && v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    // If voices aren't loaded yet (Chrome/Safari sometimes load asynchronously)
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        playAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      playAndSpeak();
    }

    // Workaround for browser security (SpeechSynthesis blocked until click)
    const handleFirstInteraction = () => {
      playAndSpeak();
      document.removeEventListener('pointerdown', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    // Register simple one-off interaction listeners to ensure it speaks even if auto-playback is initially blocked
    document.addEventListener('pointerdown', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
  };

  const speakAgain = () => {
    triggerSpeechFlow(greetingText);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute bottom-4 left-4 right-4 z-[99]"
      >
        <div
          className={`relative border rounded-2xl p-4 mr-1 ml-1 flex flex-col gap-2.5 shadow-2xl transition-all select-none ${
            isLight
              ? 'bg-slate-50/98 border-slate-200 text-slate-900'
              : 'bg-zinc-950/95 border-violet-500/20 text-zinc-100'
          }`}
          style={{
            backdropFilter: 'blur(12px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}
        >
          {/* Top Line: Title & Close Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-violet-400">
              <Sparkles size={14} className="animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#a78bfa]">
                AI Daily Greeting
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className={`p-1 rounded-full transition-colors ${
                isLight 
                  ? 'hover:bg-slate-200/50 text-slate-400 hover:text-slate-700' 
                  : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <X size={12} />
            </button>
          </div>

          {/* Greeting Text Message */}
          <p className={`text-xs font-semibold leading-relaxed tracking-normal ${
            isLight ? 'text-slate-800' : 'text-zinc-200'
          }`}>
            "{greetingText}"
          </p>

          {/* Controls: Replay button */}
          <div className="flex items-center justify-end gap-2 mt-0.5">
            <button
              onClick={speakAgain}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-wide uppercase transition-all active:scale-95 ${
                isLight
                  ? 'bg-violet-100 hover:bg-violet-200 text-violet-700'
                  : 'bg-violet-500/15 border border-violet-500/20 hover:bg-violet-500/25 text-violet-300'
              }`}
            >
              <Volume2 size={12} />
              Speak Again
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
