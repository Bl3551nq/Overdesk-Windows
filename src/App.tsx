import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Moon, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  RotateCcw, 
  Play, 
  Pause, 
  SlidersHorizontal,
  FolderLock,
  X,
  Mic
} from 'lucide-react';
import { Category, AppState } from './types';
import { DEFAULT_CATEGORIES, ACCENT_PRESETS } from './data';
import { 
  warmAudioContext, 
  playTick, 
  playCancel, 
  playChime, 
  playBellTick, 
  playBellOnce 
} from './utils/audio';
import EditPanel from './components/EditPanel';
import AboutOverlay from './components/AboutOverlay';
import ColorPickerPopup from './components/ColorPickerPopup';
import { TypewriterText } from './components/TypewriterText';
import { OverdeskLogo } from './components/OverdeskLogo';
import LicenseGate from './components/LicenseGate';
import { OfflineVoiceEngine } from './utils/offlineVoice';

const STORE_KEY = 'overdesk_react_v2';

export default function App() {
  const [isActivated, setIsActivated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('overdesk_license_verified');
      return saved === 'true';
    } catch (e) {}
    return false;
  });

  const handleLicenseActivated = (key: string) => {
    localStorage.setItem('overdesk_license_verified', 'true');
    localStorage.setItem('overdesk_license_key', key);
    setIsActivated(true);
  };

  // Load State
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.categories) return parsed.categories;
      }
    } catch (e) {}
    return DEFAULT_CATEGORIES;
  });

  const [step, setStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return JSON.parse(saved).step || 0;
    } catch (e) {}
    return 0;
  });

  const [isDone, setIsDone] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return JSON.parse(saved).isDone || false;
    } catch (e) {}
    return false;
  });

  const [isLight, setIsLight] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return JSON.parse(saved).isLight || false;
    } catch (e) {}
    return false;
  });

  const [idleAnim, setIdleAnim] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return saved.includes('idleAnim') ? JSON.parse(saved).idleAnim : true;
    } catch (e) {}
    return true;
  });

  const [soundOn, setSoundOn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return saved.includes('soundOn') ? JSON.parse(saved).soundOn : true;
    } catch (e) {}
    return true;
  });

  const [voiceOn, setVoiceOn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return JSON.parse(saved).voiceOn || false;
    } catch (e) {}
    return false;
  });

  const [accentIdx, setAccentIdx] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return JSON.parse(saved).accentIdx ?? 0;
    } catch (e) {}
    return 0;
  });

  const [selectedBell, setSelectedBell] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return JSON.parse(saved).selectedBell || 'school_bell';
    } catch (e) {}
    return 'school_bell';
  });

  const [timerTarget, setTimerTarget] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return JSON.parse(saved).timerTarget ?? 300;
    } catch (e) {}
    return 300;
  });

  const [timerVisible, setTimerVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) return saved.includes('timerVisible') ? JSON.parse(saved).timerVisible : true;
    } catch (e) {}
    return true;
  });

  // UI state
  const [posX, setPosX] = useState(() => Math.round((window.innerWidth - 320) / 2));
  const [posY, setPosY] = useState(() => Math.round((window.innerHeight - 380) / 2));
  const [cardWidth, setCardWidth] = useState(320);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<{ cat: Category; rect: DOMRect } | null>(null);
  const [updaterMessage, setUpdaterMessage] = useState<string>('');
  const [updaterReady, setUpdaterReady] = useState<boolean>(false);

  // Floating Mini-Icon Drag
  const [miniX, setMiniX] = useState(40);
  const [miniY, setMiniY] = useState(40);
  const [isDraggingMini, setIsDraggingMini] = useState(false);
  const miniDragOffset = useRef({ x: 0, y: 0 });
  const miniDidMove = useRef(false);

  // Dragging Card
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Resizing Card
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(320);

  // References & Electron Detection
  const cardRef = useRef<HTMLDivElement>(null);
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  const lastIgnoreRef = useRef<boolean | null>(null);

  // Timer run variables
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [isEditingTimer, setIsEditingTimer] = useState(false);
  const [editHoursStr, setEditHoursStr] = useState("00");
  const [editMinutesStr, setEditMinutesStr] = useState("00");
  const [editSecondsStr, setEditSecondsStr] = useState("00");

  // Voice indicators
  const [voiceHeardLabel, setVoiceHeardLabel] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [voiceActiveTrigger, setVoiceActiveTrigger] = useState<boolean>(false);
  const voiceTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }
  }, []);

  // Listen for auto-updater events in Electron
  useEffect(() => {
    if (!isElectron) return;

    let unsubscribeMsg: (() => void) | undefined;
    let unsubscribeDownloaded: (() => void) | undefined;

    try {
      if ((window as any).electronAPI?.onUpdaterMessage) {
        unsubscribeMsg = (window as any).electronAPI.onUpdaterMessage((text: string) => {
          setUpdaterMessage(text);
        });
      }
      if ((window as any).electronAPI?.onUpdaterDownloaded) {
        unsubscribeDownloaded = (window as any).electronAPI.onUpdaterDownloaded((text: string) => {
          setUpdaterReady(true);
          setUpdaterMessage(text);
        });
      }
    } catch (err) {
      console.error('Failed to subscribe to auto-updater events:', err);
    }

    return () => {
      if (unsubscribeMsg) unsubscribeMsg();
      if (unsubscribeDownloaded) unsubscribeDownloaded();
    };
  }, [isElectron]);

  // Active task queue
  const queue = buildQueue();

  function buildQueue() {
    const q: { text: string; cat: string; color: string }[] = [];
    categories.forEach((cat) => {
      if (cat.active) {
        cat.tasks.forEach((t) => {
          q.push({ text: t, cat: cat.label, color: cat.color });
        });
      }
    });
    return q;
  }

  const [customAccent, setCustomAccent] = useState<string | null>(null);

  // Save State on Change
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        categories, step, isDone, isLight, idleAnim, soundOn, voiceOn, accentIdx, selectedBell, timerTarget, timerVisible
      }));
    } catch (e) {}
  }, [categories, step, isDone, isLight, idleAnim, soundOn, voiceOn, accentIdx, selectedBell, timerTarget, timerVisible]);

  // Accent Color implementation in CSS (Presets + Custom)
  useEffect(() => {
    if (accentIdx === -1 && customAccent) {
      const r = parseInt(customAccent.slice(1, 3), 16);
      const g = parseInt(customAccent.slice(3, 5), 16);
      const b = parseInt(customAccent.slice(5, 7), 16);
      const rgba = `rgba(${r},${g},${b},0.9)`;
      const root = document.documentElement;
      root.style.setProperty('--accent', rgba);
      root.style.setProperty('--accent-soft', `rgba(${r},${g},${b},0.18)`);
      root.style.setProperty('--glow', `rgba(${r},${g},${b},0.8)`);
      root.style.setProperty('--glowfade', `rgba(${r},${g},${b},0.22)`);
      root.style.setProperty('--ibg', rgba);
    } else {
      const p = ACCENT_PRESETS[accentIdx] || ACCENT_PRESETS[0];
      const root = document.documentElement;
      root.style.setProperty('--accent', p.rgba);
      root.style.setProperty('--accent-soft', p.rgba.replace(/[\d.]+\)$/, '0.18)'));
      root.style.setProperty('--glow', p.glow);
      root.style.setProperty('--glowfade', p.glowf);
      root.style.setProperty('--ibg', p.rgba);
    }
  }, [accentIdx, customAccent]);

  // Timer Tick
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          const next = prev + 1;
          const remaining = timerTarget - next;
          if (remaining === 1) {
            playBellTick(selectedBell, soundOn);
          }
          if (remaining <= 0) {
            setTimerRunning(false);
            if (interval) clearInterval(interval);
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerTarget, selectedBell, soundOn]);

  const skipTimerResetRef = useRef(false);

  // Start timer automatically when task slides
  const startTimerForTask = () => {
    setTimerSeconds(0);
    setTimerRunning(true);
    const now = new Date();
    setTimerStartedAt(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  useEffect(() => {
    if (queue.length > 0 && !isDone) {
      if (skipTimerResetRef.current) {
        skipTimerResetRef.current = false;
      } else {
        startTimerForTask();
      }
    }
  }, [step, isDone]);

  // Web Speech API Voice Recognition Configuration
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognitionRef = useRef<any | null>(null);
  const offlineVoiceRef = useRef<OfflineVoiceEngine | null>(null);

  // Maintain actual voice action & state refs to prevent constant re-initialization of microphone
  const voiceStateRef = useRef({ soundOn, selectedBell });
  const voiceActionsRef = useRef({ handleAdvance, handleGoBack, setTimerRunning, setTimerSeconds });

  useEffect(() => {
    voiceStateRef.current = { soundOn, selectedBell };
  }, [soundOn, selectedBell]);

  useEffect(() => {
    voiceActionsRef.current = { handleAdvance, handleGoBack, setTimerRunning, setTimerSeconds };
  }, [handleAdvance, handleGoBack, setTimerRunning, setTimerSeconds]);

  useEffect(() => {
    if (!voiceOn) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onstart = null;
        try {
          recognitionRef.current.stop();
        } catch (err) {}
        recognitionRef.current = null;
      }
      if (offlineVoiceRef.current) {
        offlineVoiceRef.current.stop();
        offlineVoiceRef.current = null;
      }
      setVoiceError(null);
      return;
    }

    // 1. Initialize and start the offline local signal parsing voice engine (always works completely offline!)
    if (!offlineVoiceRef.current) {
      const offlineEngine = new OfflineVoiceEngine();
      
      offlineEngine.onCommand = (cmd: string) => {
        console.log("Offline engine command triggered:", cmd);
        if (cmd === "Next") {
          skipTimerResetRef.current = true;
          voiceActionsRef.current.handleAdvance();
          setVoiceActiveTrigger(true);
          if (voiceTimeout.current) clearTimeout(voiceTimeout.current);
          voiceTimeout.current = setTimeout(() => setVoiceActiveTrigger(false), 1000);
        } else if (cmd === "Back") {
          skipTimerResetRef.current = true;
          voiceActionsRef.current.handleGoBack();
          setVoiceActiveTrigger(true);
          if (voiceTimeout.current) clearTimeout(voiceTimeout.current);
          voiceTimeout.current = setTimeout(() => setVoiceActiveTrigger(false), 1000);
        }
      };

      offlineEngine.onState = (status: string) => {
        setVoiceError(status);
      };

      offlineVoiceRef.current = offlineEngine;
      offlineEngine.start().catch((err) => {
        console.log("Failed starting offline phonetic audio listener:", err);
      });
    }

    // 2. Fallback/Concurrent Web Speech recognition
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = false; // More responsive, instant triggers across safari & mobile chrome
        rec.interimResults = false;
        rec.lang = 'en-US';
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          // Active
        };

        rec.onresult = (e: any) => {
          // With continuous = false, there is usually exactly one final result
          const result = e.results[0];
          if (!result || !result[0]) return;
          const speech = result[0].transcript.toLowerCase().trim();
          console.log('Online Speech heard transcript:', speech);
          
          let recognizedCmd = '';
          if (
            speech.includes('next') || 
            speech.includes('forward') || 
            speech.includes('advance') || 
            speech.includes('skip') || 
            speech.includes('done') || 
            speech.includes('complete') || 
            speech === 'ok' || 
            speech === 'okay' ||
            speech.includes('text') ||
            speech.includes('necks') ||
            speech.includes('neks') ||
            speech.includes('nest') ||
            speech.includes('net') ||
            speech.includes('makes') ||
            speech.includes('mixed') ||
            speech.includes('legs')
          ) {
            recognizedCmd = 'Next';
            skipTimerResetRef.current = true;
            voiceActionsRef.current.handleAdvance();
          } else if (
            speech.includes('back') || 
            speech.includes('previous') || 
            speech.includes('prev') || 
            speech.includes('go back') ||
            speech.includes('bag') ||
            speech.includes('pack') ||
            speech.includes('black') ||
            speech.includes('beck') ||
            speech.includes('return')
          ) {
            recognizedCmd = 'Back';
            skipTimerResetRef.current = true;
            voiceActionsRef.current.handleGoBack();
          }

          if (recognizedCmd) {
            setVoiceActiveTrigger(true);
            if (voiceTimeout.current) clearTimeout(voiceTimeout.current);
            voiceTimeout.current = setTimeout(() => setVoiceActiveTrigger(false), 1000);
          }
        };

        rec.onend = () => {
          // Delay restart slightly to allow browser audio context to cycle smoothly
          if (voiceOn && recognitionRef.current) {
            setTimeout(() => {
              if (voiceOn && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (err) {
                  console.log('Error restarting speech recognition:', err);
                }
              }
            }, 200);
          }
        };

        rec.onerror = (e: any) => {
          console.log('Speech recognition error event:', e.error);
          if (e.error === 'not-allowed') {
            setVoiceError('Microphone permission blocked. Please ensure you open the app in a new tab.');
            if (recognitionRef.current) {
              recognitionRef.current.onend = null;
            }
          } else if (e.error === 'service-not-allowed') {
            // Speech recognition service offline / disabled in browser
            if (offlineVoiceRef.current) {
              setVoiceError('Offline Assembly voice active 🎙️');
            } else {
              setVoiceError('Speech recognition service blocked.');
            }
          } else if (e.error === 'network') {
            if (offlineVoiceRef.current) {
              setVoiceError('Offline Assembly active 🎙️ (Standard API Offline)');
            } else {
              setVoiceError('Network offline.');
            }
          }
        };

        recognitionRef.current = rec;
        try {
          rec.start();
        } catch (err) {
          console.log('Error starting SpeechRecognition:', err);
        }
      } catch (err) {
        console.log('Error constructing SpeechRecognition:', err);
        if (offlineVoiceRef.current) {
          setVoiceError('Offline Assembly active 🎙️');
        }
      }
    } else {
      // If Web Speech is completely unsupported (e.g. some native Electron config / other environments)
      if (offlineVoiceRef.current) {
        setVoiceError('Offline Assembly active 🎙️');
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onstart = null;
        try {
          recognitionRef.current.stop();
        } catch (err) {}
        recognitionRef.current = null;
      }
      if (offlineVoiceRef.current) {
        offlineVoiceRef.current.stop();
        offlineVoiceRef.current = null;
      }
    };
  }, [voiceOn]);

  // Sync minimized state to Electron to trigger 80x80 container resizing
  useEffect(() => {
    if (isElectron) {
      try {
        (window as any).electronAPI.setMinimizedState(isMinimized);
      } catch (err) {}
    }
  }, [isElectron, isMinimized]);

  // Dynamic card auto-resizing IPC for Electron
  useEffect(() => {
    if (!isElectron || isMinimized || !isActivated) return;
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const resizeObserver = new ResizeObserver(() => {
      const rect = cardEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Send size + 56px (28px padding on each side to cleanly host the rounded card border and drop shadow glow without clipping)
        (window as any).electronAPI.resizeWindow(rect.width + 56, rect.height + 56);
      }
    });

    resizeObserver.observe(cardEl);
    return () => {
      resizeObserver.disconnect();
    };
  }, [isElectron, isMinimized, isActivated]);

  // Toggle ignoring click-through on transparent padding space outside the app card in Electron
  useEffect(() => {
    if (!isElectron || !isActivated) return;

    if (isMinimized) {
      // In minimized widget mode, ensure mouse interaction works perfectly over the 80x80 widget
      if (lastIgnoreRef.current !== false) {
        lastIgnoreRef.current = false;
        try {
          (window as any).electronAPI.setIgnoreMouseEvents(false);
        } catch (err) {}
      }
      return;
    }

    const handleWindowMouseMove = (e: MouseEvent) => {
      // If full screen overlays are open, ensure the entire window is interactive
      if (isAboutOpen || !!colorPickerTarget) {
        if (lastIgnoreRef.current !== false) {
          lastIgnoreRef.current = false;
          (window as any).electronAPI.setIgnoreMouseEvents(false);
        }
        return;
      }

      const cardEl = cardRef.current;
      if (!cardEl) return;

      const rect = cardEl.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;

      // Check if mouse is within the visual card element
      const isInside = (
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
      );

      if (isInside) {
        if (lastIgnoreRef.current !== false) {
          lastIgnoreRef.current = false;
          (window as any).electronAPI.setIgnoreMouseEvents(false);
        }
      } else {
        if (lastIgnoreRef.current !== true) {
          lastIgnoreRef.current = true;
          (window as any).electronAPI.setIgnoreMouseEvents(true, { forward: true });
        }
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      if (isElectron) {
        try {
          (window as any).electronAPI.setIgnoreMouseEvents(false);
        } catch (err) {}
      }
    };
  }, [isElectron, isMinimized, isActivated, isAboutOpen, colorPickerTarget]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      // ignore keys inside inputs or textareas
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.getAttribute('contenteditable') === 'true') {
        return;
      }
      if (e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        playTick(soundOn);
        handleAdvance();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        playTick(soundOn);
        handleGoBack();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [isDone, step, queue.length, soundOn]);

  // Nav Handlers
  function handleAdvance() {
    if (isDone) {
      setIsDone(false);
      setStep(0);
      playTick(soundOn);
      return;
    }
    if (!queue.length) return;
    if (step < queue.length - 1) {
      setStep((prev) => prev + 1);
      playTick(soundOn);
    } else {
      setIsDone(true);
      playChime(soundOn);
    }
  }

  function handleGoBack() {
    if (step === 0 && !isDone) return;
    if (isDone) {
      setIsDone(false);
      setStep(queue.length - 1);
    } else {
      setStep((prev) => prev - 1);
    }
    playTick(soundOn);
  }

  const handleTimerReset = () => {
    setTimerSeconds(0);
    setTimerRunning(true);
    playTick(soundOn);
  };

  /* Dragging handlers for main card */
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, .tog, a, .accent-swatch, .cat-color-dot, .timer-row, .timer-display, #timer-display')) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - posX,
      y: e.clientY - posY,
    };
    warmAudioContext();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = Math.max(0, Math.min(window.innerWidth - cardWidth, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
    setPosX(newX);
    setPosY(newY);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  /* Dragging for mini float icon */
  const handleMiniPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingMini(true);
    miniDidMove.current = false;
    miniDragOffset.current = {
      x: e.clientX - miniX,
      y: e.clientY - miniY,
    };
  };

  const handleMiniPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingMini) return;
    const dx = e.clientX - miniDragOffset.current.x;
    const dy = e.clientY - miniDragOffset.current.y;
    if (Math.abs(dx - miniX) > 4 || Math.abs(dy - miniY) > 4) {
      miniDidMove.current = true;
    }
    setMiniX(Math.max(0, Math.min(window.innerWidth - 64, dx)));
    setMiniY(Math.max(0, Math.min(window.innerHeight - 64, dy)));
  };

  const handleMiniPointerUp = () => {
    setIsDraggingMini(false);
    if (!miniDidMove.current) {
      setIsMinimized(false);
    }
  };

  /* Left-side Resizing */
  const handleResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = cardWidth;
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    const dx = resizeStartX.current - e.clientX; // drag left to increase width, right to decrease
    setCardWidth(Math.min(480, Math.max(230, resizeStartWidth.current + dx)));
  };

  const handleResizeUp = () => {
    setIsResizing(false);
  };

  const toggleTheme = () => {
    setIsLight((prev) => !prev);
  };

  const minimizeCard = () => {
    setIsMinimized(true);
  };

  const toggleEdit = () => {
    setIsEditOpen((prev) => !prev);
  };

  const closeApp = () => {
    playCancel(soundOn);
    if ((window as any).electronAPI) {
      (window as any).electronAPI.close();
    } else {
      setIsMinimized(true);
    }
  };

  const timerFormat = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const sec = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const timerTogglePause = () => {
    setTimerRunning((prev) => !prev);
  };

  const applyAccent = (idx: number) => {
    setAccentIdx(idx);
    setCustomAccent(null);
  };

  const applyAccentCustom = (hex: string) => {
    setAccentIdx(-1);
    setCustomAccent(hex);
  };

  const onBellSelect = (key: string) => {
    setSelectedBell(key);
    playPreviewBell(key);
  };

  const handleStartEditTimer = () => {
    const totalSeconds = timerTarget;
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    setEditHoursStr(String(h).padStart(2, '0'));
    setEditMinutesStr(String(m).padStart(2, '0'));
    setEditSecondsStr(String(s).padStart(2, '0'));
    setIsEditingTimer(true);
  };

  const handleSaveTimer = () => {
    const h = parseInt(editHoursStr, 10) || 0;
    const m = parseInt(editMinutesStr, 10) || 0;
    const s = parseInt(editSecondsStr, 10) || 0;
    const totalSeconds = (h * 3600) + (m * 60) + s;
    const finalSeconds = Math.max(1, totalSeconds);
    setTimerTarget(finalSeconds);
    setTimerSeconds(0);
    setIsEditingTimer(false);
    if (timerRunning) {
      const now = new Date();
      setTimerStartedAt(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  const playPreviewBell = (key: string) => {
    warmAudioContext();
    playBellOnce(key, true);
  };

  const resetApp = () => {
    setCategories(DEFAULT_CATEGORIES.map((c) => ({ ...c, tasks: [...c.tasks] })));
    setIsLight(false);
    setIdleAnim(true);
    setSoundOn(true);
    setVoiceOn(false);
    setAccentIdx(0);
    setCustomAccent(null);
    setSelectedBell('school_bell');
    setTimerTarget(300);
    setTimerSeconds(0);
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerVisible(true);
    setStep(0);
    setIsDone(false);
  };

  const openAbout = () => {
    setIsAboutOpen(true);
  };

  const activeItem = queue[isDone ? -1 : step];

  return (
    <div className={`relative w-screen h-screen overflow-hidden font-sans select-none bg-transparent ${isElectron ? 'flex items-center justify-center' : ''}`}>
      {!isActivated ? (
        <div className="license-gate-wrapper w-full h-full flex items-center justify-center bg-black/50 backdrop-blur-md">
          <LicenseGate onValidated={handleLicenseActivated} isLight={isLight} />
        </div>
      ) : (
        <>
          {/* Mini floating launcher icon when minimized */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="mini-icon-shell flex items-center justify-center"
            style={isElectron ? {
              left: 0,
              top: 0,
              width: '80px',
              height: '80px',
              position: 'absolute',
              WebkitAppRegion: 'drag',
            } : {
              left: miniX,
              top: miniY,
            }}
            onPointerDown={isElectron ? undefined : handleMiniPointerDown}
            onPointerMove={isElectron ? undefined : handleMiniPointerMove}
            onPointerUp={isElectron ? undefined : handleMiniPointerUp}
          >
            <div
              onClick={isElectron ? () => setIsMinimized(false) : undefined}
              className="cursor-pointer"
              style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
            >
              <OverdeskLogo size={54} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card interface */}
      <div
        id="card"
        ref={cardRef}
        className={`card-shell cursor-default flex flex-col ${isLight ? 'light_mode' : ''} ${isMinimized ? 'hidden' : ''} ${isElectron ? 'relative animate-fade-in' : 'absolute'}`}
        style={{
          left: isElectron ? undefined : `${posX}px`,
          top: isElectron ? undefined : `${posY}px`,
          width: `${cardWidth}px`,
        }}
        onPointerDown={isElectron ? undefined : handlePointerDown}
        onPointerMove={isElectron ? undefined : handlePointerMove}
        onPointerUp={isElectron ? undefined : handlePointerUp}
      >
        {/* Left Side Resize Handle */}
        <div
          id="resize-handle"
          className="resize-handle"
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
        />

        {/* Top Control Bar */}
        <div className="top-bar flex items-center justify-between mb-2">
          {/* Theme switcher */}
          <button
            className="theme-switch flex items-center w-11 h-6 rounded-full p-0.5 border border-[var(--divider)] relative transition-colors duration-200"
            onClick={toggleTheme}
            title="Toggle theme mode"
          >
            <div
              className="theme-knob w-4.5 h-4.5 bg-white rounded-full flex items-center justify-center transition-transform duration-200"
              style={{ transform: isLight ? 'translateX(18px)' : 'translateX(0)' }}
            >
              {isLight ? (
                <Moon size={10} className="text-slate-800 animate-fade-in" />
              ) : (
                <Sun size={10} className="text-slate-700 animate-fade-in" />
              )}
            </div>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action Tools */}
          <div className="flex items-center gap-1.5">
            <button
              className="minimize-btn flex items-center justify-center w-7 h-7 rounded-full bg-[var(--row-bg)] border border-[var(--divider)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--row-hover)] transition-all active:scale-90"
              onClick={minimizeCard}
              title="Minimize panel"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="10" y1="14" x2="3" y2="21" />
                <line x1="21" y1="3" x2="14" y2="10" />
              </svg>
            </button>

            <button
              id="edit-btn"
              className={`edit-btn flex items-center justify-center w-7 h-7 rounded-full transition-all active:scale-90 ${
                isEditOpen 
                  ? 'bg-violet-600 text-white' 
                  : 'bg-[var(--row-bg)] border border-[var(--divider)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--row-hover)]'
              }`}
              onClick={toggleEdit}
              title="Edit habits & steps"
            >
              <SlidersHorizontal size={13} />
            </button>

            <button
              className="cancel-btn flex items-center justify-center w-7 h-7 rounded-full bg-[var(--row-bg)] border border-[var(--divider)] text-[var(--text-dim)] hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
              onClick={closeApp}
              title="Close app"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="progress-wrap flex items-center gap-2 mb-2.5">
          <div className="progress-bar-track flex-1 h-2 rounded-full overflow-hidden bg-[var(--divider)]">
            <div
              id="progress-fill"
              className="progress-bar-fill-animated"
              style={{ width: `${queue.length ? Math.round(((isDone ? queue.length : step) / queue.length) * 100) : 0}%` }}
            />
          </div>
          <span className="progress-label text-[11px] font-bold text-[var(--text-dim)] min-w-8 text-right font-mono tracking-wider">
            {isDone ? queue.length : step}/{queue.length}
          </span>
        </div>

        {/* Custom Timer Sub-Row */}
        {timerVisible && (
          <div 
            id="timer-row" 
            className="timer-row flex items-center justify-between p-1 px-2 mb-2 rounded-xl bg-[var(--row-bg)] border border-[var(--divider)] transition-all"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="timer-left flex items-center gap-2">
              {isEditingTimer ? (
                <div className="flex items-center gap-1 font-mono text-xs font-semibold select-all bg-[var(--row-bg)] p-0.5 rounded-lg border border-[var(--divider)]">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoFocus
                    value={editHoursStr}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 2) {
                        setEditHoursStr(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTimer();
                      if (e.key === 'Escape') setIsEditingTimer(false);
                    }}
                    className="w-8 bg-transparent text-center text-[11px] font-bold text-[var(--text)] outline-none"
                    placeholder="HH"
                    title="Hours"
                  />
                  <span className="text-[var(--text-dim)]">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editMinutesStr}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 2) {
                        setEditMinutesStr(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTimer();
                      if (e.key === 'Escape') setIsEditingTimer(false);
                    }}
                    className="w-8 bg-transparent text-center text-[11px] font-bold text-[var(--text)] outline-none"
                    placeholder="MM"
                    title="Minutes"
                  />
                  <span className="text-[var(--text-dim)]">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editSecondsStr}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 2) {
                        setEditSecondsStr(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTimer();
                      if (e.key === 'Escape') setIsEditingTimer(false);
                    }}
                    className="w-8 bg-transparent text-center text-[11px] font-bold text-[var(--text)] outline-none"
                    placeholder="SS"
                    title="Seconds"
                  />
                  <button
                    onClick={handleSaveTimer}
                    className="p-1 text-emerald-500 hover:text-emerald-400 rounded transition-colors"
                    title="Save (Enter)"
                  >
                    <Check size={11} strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => setIsEditingTimer(false)}
                    className="p-1 text-rose-500 hover:text-rose-400 rounded transition-colors"
                    title="Cancel (Esc)"
                  >
                    <X size={11} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <span
                  id="timer-display"
                  className="timer-display font-mono text-sm font-semibold tracking-wider text-[var(--text)] hover:bg-[var(--row-hover)] cursor-pointer rounded-lg px-2.5 py-0.5 transition-all outline-none border border-transparent hover:border-[var(--divider)]"
                  onClick={handleStartEditTimer}
                  title="Click to edit timer duration"
                >
                  {timerFormat(Math.max(0, timerTarget - timerSeconds))}
                </span>
              )}
              <span id="timer-status" className={`timer-status-dot ${!timerRunning ? 'paused' : (timerTarget - timerSeconds) <= 5 ? 'warn' : ''}`}>
                ●
              </span>

              {voiceOn && (
                <div 
                  id="timer-mic-indicator"
                  className="flex items-center justify-center relative w-4 h-4"
                  title="Offline Assembly Voice input active (Next / Back)"
                >
                  <span className={`absolute inline-flex h-2.5 w-2.5 rounded-full opacity-65 animate-ping transition-colors duration-300 ${
                    voiceActiveTrigger ? 'bg-red-500' : 'bg-orange-500'
                  }`} />
                  <Mic 
                    size={11} 
                    className={`transition-colors duration-300 ${
                      voiceActiveTrigger ? 'text-red-500' : 'text-orange-500'
                    }`}
                    strokeWidth={2.5}
                  />
                </div>
              )}
            </div>
            <div className="timer-right flex items-center gap-1.5">
              <button
                className="timer-action-btn w-6.5 h-6.5 bg-[var(--row-bg)] border border-[var(--divider)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--row-hover)] rounded-full flex items-center justify-center transition-all active:scale-90"
                onClick={timerTogglePause}
                title={timerRunning ? 'Pause timer' : 'Resume timer'}
              >
                {timerRunning ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
              </button>
              <button
                className="timer-action-btn w-6.5 h-6.5 bg-[var(--row-bg)] border border-[var(--divider)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--row-hover)] rounded-full flex items-center justify-center transition-all active:scale-90"
                onClick={handleTimerReset}
                title="Reset timer"
              >
                <RotateCcw size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Principal task slides action row */}
        <div className="main-row flex items-center gap-2">
          <button
            id="back-btn"
            disabled={step === 0 && !isDone}
            onClick={() => { playTick(soundOn); handleGoBack(); }}
            className={`back-btn w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              step > 0 || isDone
                ? 'opacity-100 cursor-pointer pointer-events-auto bg-[var(--row-bg)] border border-[var(--divider)] text-[var(--text)] hover:bg-[var(--row-hover)] active:scale-90'
                : 'opacity-20 pointer-events-none text-[var(--text-dim)]'
            }`}
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>

          {/* Interactive Screen stage with Typewriter slider */}
          <div className="stage flex-1 min-w-0 h-11 relative overflow-hidden flex flex-col justify-center">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={isDone ? 'finished-stage' : activeItem ? activeItem.text : 'no-active-stage'}
                initial={{ x: 26, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -26, opacity: 0 }}
                transition={{ duration: 0.28, cubicBezier: [0.4, 0, 0.2, 1] }}
                className="slide absolute left-0 right-0 flex flex-col text-left truncate"
              >
                {isDone ? (
                  <span className="slide-label text-emerald-500 font-semibold tracking-wide flex items-center justify-center gap-1.5 h-full animate-pulse text-xs">
                    <Check size={14} strokeWidth={3} /> Routine completed!
                  </span>
                ) : activeItem ? (
                  <>
                    <span 
                      className="slide-cat-label text-[9px] font-bold uppercase tracking-wider h-[14px]" 
                      style={{ color: activeItem.color }}
                    >
                      {activeItem.cat}
                    </span>
                    <TypewriterText
                      text={activeItem.text}
                      enabled={idleAnim}
                      color={activeItem.color}
                    />
                  </>
                ) : (
                  <span className="slide-label text-[var(--text-dim)] font-medium tracking-wide text-xs">
                    No active steps
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <button
            id="next-btn"
            onClick={() => { playTick(soundOn); handleAdvance(); }}
            className={`next-btn w-11 h-11 rounded-full flex items-center justify-center text-white transition-all duration-200 active:scale-90 ${
              isDone ? 'complete bg-emerald-500 hover:bg-emerald-600' : 'bg-violet-600 hover:bg-violet-700'
            }`}
          >
            {isDone ? <Check size={16} strokeWidth={3} /> : <ChevronRight size={16} strokeWidth={2.5} />}
          </button>
        </div>

        {/* Dynamic Slidout Edit menu */}
        <EditPanel
          isOpen={isEditOpen}
          categories={categories}
          onUpdateCategories={(newCats) => {
            setCategories(newCats);
            // rebuild queue and sync
            const nextQueue = [];
            newCats.forEach((cat) => { if (cat.active) cat.tasks.forEach((t) => nextQueue.push({ text: t, cat: cat.label, color: cat.color })); });
            if (step >= nextQueue.length) {
              setStep(Math.max(0, nextQueue.length - 1));
            }
          }}
          soundOn={soundOn}
          onToggleSound={() => setSoundOn(!soundOn)}
          idleAnim={idleAnim}
          onToggleIdleAnim={() => setIdleAnim(!idleAnim)}
          voiceOn={voiceOn}
          onToggleVoice={() => setVoiceOn(!voiceOn)}
          voiceError={voiceError}
          isIframe={isIframe}
          voiceSupported={!!SpeechRecognition}
          timerVisible={timerVisible}
          onToggleTimerVisible={() => setTimerVisible(!timerVisible)}
          accentIdx={accentIdx}
          onSelectAccent={applyAccent}
          onSelectCustomAccent={applyAccentCustom}
          selectedBell={selectedBell}
          onBellSelect={onBellSelect}
          onPreviewBell={playPreviewBell}
          onResetApp={resetApp}
          onOpenAbout={openAbout}
          onOpenColorPicker={(cat, rect) => setColorPickerTarget({ cat, rect })}
        />
      </div>

      {/* Floating temporary popup to select custom Category focus colors */}
      <ColorPickerPopup
        isOpen={!!colorPickerTarget}
        activeColor={colorPickerTarget?.cat.color || ''}
        triggerRect={colorPickerTarget?.rect || null}
        isLight={isLight}
        onSelect={(newCol) => {
          if (!colorPickerTarget) return;
          const next = categories.map((c) => {
            if (c.id === colorPickerTarget.cat.id) {
              return { ...c, color: newCol };
            }
            return c;
          });
          setCategories(next);
        }}
        onClose={() => setColorPickerTarget(null)}
      />

      {/* Exquisite About info overlay modal */}
      <AboutOverlay
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        isLight={isLight}
        updaterMessage={updaterMessage}
        updaterReady={updaterReady}
        isElectron={isElectron}
        onRestartToUpdate={() => {
          if (isElectron && (window as any).electronAPI?.restartToUpdate) {
            (window as any).electronAPI.restartToUpdate();
          }
        }}
      />
        </>
      )}
    </div>
  );
}
