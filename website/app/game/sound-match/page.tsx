"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  RotateCcw, 
  ChevronRight, 
  Sparkles, 
  Check, 
  Award, 
  Play, 
  Volume2, 
  Plus, 
  Trash2,
  Trophy,
  Activity,
  VolumeX
} from "lucide-react";

type Phase = "setup" | "ready" | "memorize" | "recreate" | "roundResult" | "results";

interface Player {
  id: string;
  name: string;
}

interface PlayerRoundResult {
  playerId: string;
  roundIndex: number;
  guessFrequency: number;
  targetFrequency: number;
  score: number;
}

const FREQ_MIN = 220;
const FREQ_MAX = 880;

function calculateAuditoryScore(target: number, guess: number): number {
  const targetRounded = Math.round(target);
  const guessRounded = Math.round(guess);
  if (targetRounded === guessRounded) {
    return 10.00;
  }

  // Compute difference in octaves: diff = abs(log2(target / guess))
  const diff = Math.abs(Math.log2(targetRounded / guessRounded));
  
  // Define maximum tolerable difference as 1.2 octaves (about a 10th interval)
  const maxDiff = 1.2;
  const normDiff = Math.min(1.0, diff / maxDiff);
  
  // Power factor of 1.2 to give slightly better rewards for closer matches
  const rawScore = 10 * Math.pow(1 - normDiff, 1.2);
  return Math.max(0, Math.round(rawScore * 100) / 100);
}

export default function SoundMatchGame() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<Player[]>([{ id: "1", name: "Player 1" }]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  
  const [roundIdx, setRoundIdx] = useState(0);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [guesses, setGuesses] = useState<PlayerRoundResult[]>([]);
  
  // Audio state
  const [targetFrequencies, setTargetFrequencies] = useState<number[]>([]);
  const [currentGuessFreq, setCurrentGuessFreq] = useState(440);
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [isPlayingGuess, setIsPlayingGuess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Web Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Setup helpers
  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;
    setPlayers(prev => [...prev, { id: Date.now().toString(), name: newPlayerName.trim() }]);
    setNewPlayerName("");
  };

  const handleRemovePlayer = (id: string) => {
    if (players.length <= 1) return;
    setPlayers(prev => prev.filter(p => p.id !== id));
  };

  const handleStartGame = () => {
    // Generate frequencies from pentatonic scale for pleasant harmony
    const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00];
    const freqs = Array.from({ length: maxRounds }, () => scale[Math.floor(Math.random() * scale.length)]);
    
    setTargetFrequencies(freqs);
    setGuesses([]);
    setRoundIdx(0);
    setPlayerIdx(0);
    setPhase("ready");
  };

  // Web Audio Context initialization
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  // Play custom frequency tone
  const playTone = (freq: number, duration: number, callback?: () => void) => {
    initAudio();
    const ctx = audioCtxRef.current!;
    
    // Stop any existing sound first
    stopSound();

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    // Smooth envelope (fade-in & fade-out)
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime + duration - 0.1);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    
    oscRef.current = osc;
    gainRef.current = gainNode;

    const timeout = setTimeout(() => {
      stopSound();
      if (callback) callback();
    }, duration * 1000);

    return () => clearTimeout(timeout);
  };

  // Real-time sound dragging
  const startLiveTone = (freq: number) => {
    initAudio();
    const ctx = audioCtxRef.current!;
    stopSound();

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    // Low volume during drag
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    
    osc.start(ctx.currentTime);
    
    oscRef.current = osc;
    gainRef.current = gainNode;
  };

  const updateLiveTone = (freq: number) => {
    if (oscRef.current && audioCtxRef.current) {
      oscRef.current.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
    }
  };

  const stopSound = () => {
    try {
      if (oscRef.current) {
        oscRef.current.stop();
        oscRef.current.disconnect();
        oscRef.current = null;
      }
      if (gainRef.current) {
        gainRef.current.disconnect();
        gainRef.current = null;
      }
    } catch (e) {
      // Ignore errors if oscillator already stopped
    }
  };

  const handlePlayTarget = () => {
    initAudio();
    setIsPlayingTarget(true);
    playTone(targetFrequencies[roundIdx], 2.5, () => {
      setIsPlayingTarget(false);
    });
  };

  const handleStartMemorize = () => {
    setPhase("memorize");
    initAudio();
    
    // Auto-play the target sound once memorization starts
    setTimeout(() => {
      setIsPlayingTarget(true);
      playTone(targetFrequencies[roundIdx], 3.0, () => {
        setIsPlayingTarget(false);
      });
    }, 500);
  };

  const handleSliderStart = () => {
    setIsDragging(true);
    startLiveTone(currentGuessFreq);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentGuessFreq(val);
    if (isDragging) {
      updateLiveTone(val);
    }
  };

  const handleSliderEnd = () => {
    setIsDragging(false);
    stopSound();
  };

  const handleSubmitGuess = () => {
    stopSound();
    const activeTarget = targetFrequencies[roundIdx];
    const score = calculateAuditoryScore(activeTarget, currentGuessFreq);
    
    const newResult: PlayerRoundResult = {
      playerId: players[playerIdx].id,
      roundIndex: roundIdx,
      guessFrequency: currentGuessFreq,
      targetFrequency: activeTarget,
      score
    };

    setGuesses(prev => [...prev, newResult]);
    setPhase("roundResult");
  };

  const handleContinue = () => {
    stopSound();
    const isLastPlayer = playerIdx + 1 >= players.length;
    if (isLastPlayer) {
      const isLastRound = roundIdx + 1 >= maxRounds;
      if (isLastRound) {
        setPhase("results");
      } else {
        setPlayerIdx(0);
        setRoundIdx(prev => prev + 1);
        setPhase("ready");
      }
    } else {
      setPlayerIdx(prev => prev + 1);
      setPhase("ready");
    }
  };

  const lastResult = guesses[guesses.length - 1];

  const feedback = useMemo(() => {
    if (!lastResult) return null;
    const s = lastResult.score;
    if (s === 10) return { text: "✨ PERFECT 10! ✨", color: "text-yellow-400 border-yellow-400/50 bg-yellow-400/5" };
    if (s >= 9.0) return { text: "🔥 EXCELLENT 🔥", color: "text-emerald-400 border-emerald-400/50 bg-emerald-400/5" };
    if (s >= 7.0) return { text: "👍 GOOD JOB 👍", color: "text-blue-400 border-blue-400/50 bg-blue-400/5" };
    if (s < 5.0) return { text: "😢 TRY AGAIN 😢", color: "text-rose-400 border-rose-400/50 bg-rose-400/5" };
    return { text: "OKAY", color: "text-amber-400 border-amber-400/50 bg-amber-400/5" };
  }, [lastResult]);

  const scoreboard = useMemo(() => {
    return players.map(p => {
      const pGuesses = guesses.filter(g => g.playerId === p.id);
      const totalScore = pGuesses.reduce((sum, g) => sum + g.score, 0);
      return {
        id: p.id,
        name: p.name,
        total: totalScore,
        avg: totalScore / Math.max(1, pGuesses.length)
      };
    }).sort((a, b) => b.total - a.total);
  }, [guesses, players]);

  // Clean on unmount
  useEffect(() => {
    return () => {
      stopSound();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#08080C] text-gray-100 font-sans flex flex-col justify-between selection:bg-pink-500/30 selection:text-pink-200">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-pink-950/10 via-transparent to-transparent pointer-events-none" />

      {/* Nav Header */}
      <header className="border-b border-white/5 bg-[#0D0D14]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Lobby
          </Link>
          <div className="text-center">
            <h1 className="text-base font-bold text-white flex items-center gap-1.5 justify-center">
              <Volume2 className="w-4 h-4 text-pink-400" />
              Sound Match
            </h1>
          </div>
          <div className="w-14" /> {/* Spacer */}
        </div>
      </header>

      {/* Game Content Box */}
      <div className="flex-1 w-full max-w-xl mx-auto px-6 py-8 flex flex-col justify-center">
        
        {/* PHASE 1: SETUP */}
        {phase === "setup" && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
            <h2 className="text-2xl font-black text-white mb-2">Game Setup</h2>
            <p className="text-xs text-gray-400 mb-6">Enter players and select how many rounds to match.</p>

            {/* Players list */}
            <div className="space-y-3 mb-6">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block">Players ({players.length})</label>
              
              <div className="flex gap-2 mb-3">
                <input 
                  type="text" 
                  placeholder="Enter name..."
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
                  className="flex-1 bg-[#161622] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 transition-colors"
                />
                <button 
                  onClick={handleAddPlayer}
                  className="bg-pink-600 hover:bg-pink-500 text-white rounded-xl px-4 py-2.5 flex items-center justify-center transition-colors shadow-lg shadow-pink-600/10"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {players.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-[#161622] border border-white/5 rounded-xl px-4 py-2 text-sm text-gray-200">
                    <span className="font-semibold">{p.name}</span>
                    <button 
                      onClick={() => handleRemovePlayer(p.id)}
                      disabled={players.length <= 1}
                      className="text-gray-500 hover:text-rose-400 disabled:opacity-30 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Rounds Selector */}
            <div className="mb-8">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">Number of Rounds</label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 8].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMaxRounds(r)}
                    className={`py-2 rounded-xl border text-sm font-bold transition-all ${
                      maxRounds === r 
                        ? "bg-pink-600 border-pink-500 text-white shadow-lg shadow-pink-600/10" 
                        : "bg-[#161622] border-white/5 text-gray-400 hover:text-white"
                    }`}
                  >
                    {r} Rounds
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={handleStartGame}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-pink-500/15 hover:-translate-y-0.5 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Game
            </button>
          </div>
        )}

        {/* PHASE 2: READY */}
        {phase === "ready" && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
            <span className="text-xs font-bold text-pink-400 bg-pink-950/40 px-3.5 py-1.5 rounded-full border border-pink-800/30 uppercase inline-block mb-4">
              Round {roundIdx + 1} of {maxRounds}
            </span>
            <h2 className="text-3xl font-black text-white mb-2">
              Pass to <span className="text-pink-400">{players[playerIdx].name}</span>
            </h2>
            <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
              Make sure only {players[playerIdx].name} is looking at the screen, then start the memorization audio.
            </p>

            <button 
              onClick={handleStartMemorize}
              className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-pink-600/10 transition-colors"
            >
              Start Turn
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PHASE 3: MEMORIZE */}
        {phase === "memorize" && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden flex flex-col items-center">
            <h2 className="text-xl font-bold text-white mb-1">Listen to target tone</h2>
            <p className="text-xs text-gray-400 mb-8">Memorize its pitch and recreate it later.</p>

            {/* Custom equalizer bar visualizer */}
            <div className="h-28 flex items-end justify-center gap-1.5 mb-8 w-full max-w-xs px-6">
              {Array.from({ length: 15 }).map((_, i) => (
                <div 
                  key={i} 
                  style={{
                    height: `${isPlayingTarget ? 20 + Math.sin(i * 0.5) * 60 + Math.random() * 20 : 8}%`
                  }}
                  className={`w-1.5 rounded-full bg-pink-500 transition-all duration-150 ${isPlayingTarget ? "" : "opacity-30"}`}
                />
              ))}
            </div>

            <div className="flex gap-4 w-full">
              <button 
                onClick={handlePlayTarget}
                disabled={isPlayingTarget}
                className="flex-1 bg-pink-600 hover:bg-pink-500 disabled:bg-[#161622] disabled:text-gray-500 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors border border-pink-500/10"
              >
                <Volume2 className="w-4 h-4" />
                {isPlayingTarget ? "Playing..." : "Play Again"}
              </button>

              <button 
                onClick={() => {
                  stopSound();
                  setPhase("recreate");
                  setCurrentGuessFreq(440);
                }}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-colors border border-white/5"
              >
                Go to Match
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* PHASE 4: RECREATE (DRAGGABLE VERTICAL SLIDER) */}
        {phase === "recreate" && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Sound Match</span>
                <h2 className="text-lg font-black text-white">{players[playerIdx].name}'s Turn</h2>
              </div>
              <span className="text-xs font-bold text-pink-400 bg-pink-950/40 border border-pink-900/40 px-3 py-1 rounded-xl">
                Round {roundIdx + 1}
              </span>
            </div>

            <p className="text-xs text-gray-400 mb-6 text-center">
              Drag the slider to adjust the pitch. Hold to hear your tone.
            </p>

            <div className="grid grid-cols-12 gap-6 items-center mb-8">
              
              {/* Left visualizer */}
              <div className="col-span-3 flex flex-col items-center gap-1.5 h-64 justify-center">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Pitch</span>
                <div className="text-lg font-black text-pink-400 font-mono">{Math.round(currentGuessFreq)}<span className="text-[10px] font-medium text-gray-500">Hz</span></div>
                
                {/* Visualizer bars */}
                <div className="flex gap-1 items-end h-20 w-full justify-center">
                  {[1, 2, 3].map((idx) => (
                    <div 
                      key={idx}
                      style={{
                        height: `${isDragging ? 20 + Math.random() * 80 : 10}%`
                      }}
                      className="w-1.5 bg-pink-500/80 rounded-full transition-all duration-100"
                    />
                  ))}
                </div>
              </div>

              {/* Central vertical slider */}
              <div className="col-span-9 flex flex-col items-center justify-center">
                <div className="h-64 w-full flex items-center justify-center relative">
                  {/* Vertical Track background */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-[#161622] rounded-full transform -translate-x-1/2 border border-white/5" />
                  
                  {/* Range input mapped vertically using absolute bounds */}
                  <input 
                    type="range"
                    min={FREQ_MIN}
                    max={FREQ_MAX}
                    value={currentGuessFreq}
                    onChange={handleSliderChange}
                    onMouseDown={handleSliderStart}
                    onMouseUp={handleSliderEnd}
                    onTouchStart={handleSliderStart}
                    onTouchEnd={handleSliderEnd}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-20"
                    style={{ writingMode: "bt-lr" as any }}
                  />
                  <div 
                    style={{ 
                      bottom: `${((currentGuessFreq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * 90 + 5}%` 
                    }}
                    className={`absolute left-1/2 w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 border border-white/20 shadow-xl shadow-pink-600/30 flex items-center justify-center pointer-events-none transform -translate-x-1/2 transition-transform duration-100 ${
                      isDragging ? "scale-110 ring-4 ring-pink-500/20" : ""
                    }`}
                  >
                    <Activity className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => {
                  initAudio();
                  playTone(currentGuessFreq, 1.5);
                }}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3.5 px-4 rounded-xl border border-white/5 flex items-center justify-center gap-2 transition-colors"
              >
                <Volume2 className="w-4 h-4" />
                Listen (Guess)
              </button>

              <button 
                onClick={handleSubmitGuess}
                className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/15 transition-all"
              >
                Submit Match
              </button>
            </div>
          </div>
        )}

        {/* PHASE 5: ROUND RESULT */}
        {phase === "roundResult" && lastResult && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative text-center">
            <h2 className="text-xl font-bold text-white mb-1">{players[playerIdx].name}'s Result</h2>
            <p className="text-xs text-gray-500 mb-6">Round {roundIdx + 1}</p>

            {/* Score circle */}
            <div className="relative w-36 h-36 rounded-full border-4 border-pink-500/20 flex flex-col items-center justify-center mx-auto mb-6">
              <span className="text-3xl font-black text-white">{lastResult.score.toFixed(2)}</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">out of 10</span>
              <div className="absolute inset-0 rounded-full border border-pink-500/40 animate-ping opacity-10 pointer-events-none" />
            </div>

            {/* Feedback Badge */}
            {feedback && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-4 py-1.5 rounded-full border uppercase tracking-wider mb-8 ${feedback.color}`}>
                <Award className="w-3.5 h-3.5" />
                {feedback.text}
              </span>
            )}

            {/* Tones comparison card */}
            <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 mb-8">
              <div className="grid grid-cols-2 gap-4">
                
                {/* Target play button */}
                <div className="flex flex-col items-center gap-2">
                  <button 
                    onClick={() => playTone(lastResult.targetFrequency, 2.0)}
                    className="w-14 h-14 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-colors group"
                  >
                    <Volume2 className="w-5 h-5 text-gray-400 group-hover:text-white" />
                  </button>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Target ({Math.round(lastResult.targetFrequency)} Hz)</span>
                </div>

                {/* Guess play button */}
                <div className="flex flex-col items-center gap-2 border-l border-white/5">
                  <button 
                    onClick={() => playTone(lastResult.guessFrequency, 2.0)}
                    className="w-14 h-14 rounded-full bg-pink-600 hover:bg-pink-500 flex items-center justify-center shadow-lg shadow-pink-600/10 transition-colors"
                  >
                    <Volume2 className="w-5 h-5 text-white" />
                  </button>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Guess ({Math.round(lastResult.guessFrequency)} Hz)</span>
                </div>

              </div>
            </div>

            <button 
              onClick={handleContinue}
              className="w-full bg-pink-600 hover:bg-pink-500 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-pink-600/10 transition-colors"
            >
              {playerIdx + 1 < players.length 
                ? "Pass to Next Player" 
                : roundIdx + 1 < maxRounds ? "Next Round" : "View Final Standings"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PHASE 6: FINAL RESULTS */}
        {phase === "results" && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
            <div className="text-center mb-8">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2 animate-bounce" />
              <h2 className="text-2xl font-black text-white">Final Leaderboard</h2>
              <p className="text-xs text-gray-400">Play again or return to the main catalog.</p>
            </div>

            {/* Scoreboard table */}
            <div className="space-y-3 mb-8">
              {scoreboard.map((entry, index) => (
                <div 
                  key={entry.id}
                  className={`flex items-center justify-between border rounded-2xl px-5 py-4 transition-all ${
                    index === 0 
                      ? "bg-gradient-to-r from-pink-950/20 to-rose-950/20 border-pink-500/20 shadow-md shadow-pink-500/5" 
                      : "bg-[#161622] border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      index === 0 ? "bg-yellow-500 text-black" : 
                      index === 1 ? "bg-slate-300 text-black" : 
                      index === 2 ? "bg-amber-600 text-white" : "bg-[#28283a] text-gray-400"
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <span className="font-bold text-white block">{entry.name}</span>
                      <span className="text-[10px] text-gray-500 font-medium">Avg Score: {entry.avg.toFixed(2)} pts</span>
                    </div>
                  </div>
                  <span className="text-base font-black text-white">{entry.total.toFixed(2)} pts</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => {
                  setPhase("setup");
                }}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl border border-white/5 flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Setup Screen
              </button>
              <button 
                onClick={() => {
                  handleStartGame();
                }}
                className="bg-pink-600 hover:bg-pink-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-pink-600/10"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-600">
        <p>© PlayVirals - Sound Match Web Edition</p>
      </footer>
    </main>
  );
}
