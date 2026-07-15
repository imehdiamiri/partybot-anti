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
  Sliders, 
  Plus, 
  Trash2,
  Trophy,
  Palette
} from "lucide-react";

type Phase = "setup" | "ready" | "memorize" | "recreate" | "roundResult" | "results";

interface Player {
  id: string;
  name: string;
}

interface PlayerRoundResult {
  playerId: string;
  roundIndex: number;
  guess: { h: number; s: number; b: number };
  target: { h: number; s: number; b: number };
  score: number;
}

function hsvToHsl(h: number, s: number, v: number): string {
  const sDec = s / 100;
  const vDec = v / 100;
  
  let l = vDec * (1 - sDec / 2);
  let sHsl = 0;
  if (l > 0 && l < 1) {
    sHsl = (vDec - l) / Math.min(l, 1 - l);
  }
  
  const hInt = Math.round(h);
  const sInt = Math.round(sHsl * 100);
  const lInt = Math.round(l * 100);
  
  return `hsl(${hInt}, ${sInt}%, ${lInt}%)`;
}

function calculateScore(target: { h: number; s: number; b: number }, guess: { h: number; s: number; b: number }): number {
  if (target.h === guess.h && target.s === guess.s && target.b === guess.b) {
    return 10.00;
  }
  const h1 = target.h * (Math.PI / 180);
  const s1 = target.s / 100;
  const v1 = target.b / 100;

  const h2 = guess.h * (Math.PI / 180);
  const s2 = guess.s / 100;
  const v2 = guess.b / 100;

  // Convert to cylindrical coordinates:
  // x = S * V * cos(H), y = S * V * sin(H), z = V
  const x1 = s1 * v1 * Math.cos(h1);
  const y1 = s1 * v1 * Math.sin(h1);
  const z1 = v1;

  const x2 = s2 * v2 * Math.cos(h2);
  const y2 = s2 * v2 * Math.sin(h2);
  const z2 = v2;

  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const normDist = Math.min(1.0, dist / 2.0);
  const rawScore = 10 * (1 - normDist);
  return Math.max(0, Math.round(rawScore * 100) / 100);
}

export default function ColorMatchGame() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [players, setPlayers] = useState<Player[]>([{ id: "1", name: "Player 1" }]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  
  const [roundIdx, setRoundIdx] = useState(0);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [guesses, setGuesses] = useState<PlayerRoundResult[]>([]);
  
  // Game state
  const [targetColors, setTargetColors] = useState<{ h: number; s: number; b: number }[]>([]);
  const [currentGuess, setCurrentGuess] = useState({ h: 180, s: 50, b: 50 });
  const [memorizeTimeLeft, setMemorizeTimeLeft] = useState(4);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
    // Generate colors
    const colors = Array.from({ length: maxRounds }, () => ({
      h: Math.floor(Math.random() * 360),
      s: Math.floor(65 + Math.random() * 35), // 65-100% Saturation
      b: Math.floor(55 + Math.random() * 35), // 55-90% Brightness
    }));
    setTargetColors(colors);
    setGuesses([]);
    setRoundIdx(0);
    setPlayerIdx(0);
    setPhase("ready");
  };

  // Turn management
  const handleStartMemorize = () => {
    setPhase("memorize");
    setMemorizeTimeLeft(4);
    
    if (timerRef.current) clearInterval(timerRef.current);
    
    let left = 4;
    timerRef.current = setInterval(() => {
      left -= 1;
      setMemorizeTimeLeft(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase("recreate");
        setCurrentGuess({ h: 180, s: 50, b: 50 });
      }
    }, 1000);
  };

  const handleSubmitGuess = () => {
    const activeTarget = targetColors[roundIdx];
    const score = calculateScore(activeTarget, currentGuess);
    
    const newResult: PlayerRoundResult = {
      playerId: players[playerIdx].id,
      roundIndex: roundIdx,
      guess: currentGuess,
      target: activeTarget,
      score
    };

    setGuesses(prev => [...prev, newResult]);
    setPhase("roundResult");
  };

  const handleContinue = () => {
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

  // Computations
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

  // Clean timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#08080C] text-gray-100 font-sans flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-emerald-950/10 via-transparent to-transparent pointer-events-none" />

      {/* Nav Header */}
      <header className="border-b border-white/5 bg-[#0D0D14]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-semibold">
            <ArrowLeft className="w-4 h-4" />
            Lobby
          </Link>
          <div className="text-center">
            <h1 className="text-base font-bold text-white flex items-center gap-1.5 justify-center">
              <Palette className="w-4 h-4 text-emerald-400" />
              Color Match
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
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
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
                  className="flex-1 bg-[#161622] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button 
                  onClick={handleAddPlayer}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2.5 flex items-center justify-center transition-colors shadow-lg shadow-emerald-600/10"
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
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/10" 
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
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 hover:-translate-y-0.5 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Game
            </button>
          </div>
        )}

        {/* PHASE 2: READY (PASS PHONE) */}
        {phase === "ready" && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 px-3.5 py-1.5 rounded-full border border-emerald-800/30 uppercase inline-block mb-4">
              Round {roundIdx + 1} of {maxRounds}
            </span>
            <h2 className="text-3xl font-black text-white mb-2">
              Pass to <span className="text-emerald-400">{players[playerIdx].name}</span>
            </h2>
            <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
              Make sure only {players[playerIdx].name} is looking at the screen, then start the memorization countdown.
            </p>

            <button 
              onClick={handleStartMemorize}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 transition-colors"
            >
              Start Turn
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PHASE 3: MEMORIZE */}
        {phase === "memorize" && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden flex flex-col items-center">
            <h2 className="text-xl font-bold text-white mb-2">Memorize this Color</h2>
            <p className="text-xs text-gray-400 mb-6">Closing in {memorizeTimeLeft}s...</p>

            {/* Giant Swatch */}
            <div 
              style={{ backgroundColor: hsvToHsl(targetColors[roundIdx].h, targetColors[roundIdx].s, targetColors[roundIdx].b) }}
              className="w-48 h-48 rounded-3xl shadow-2xl shadow-black/60 mb-8 animate-pulse border border-white/10"
            />

            {/* Progress track */}
            <div className="w-full h-2 bg-[#161622] rounded-full overflow-hidden border border-white/5">
              <div 
                style={{ 
                  width: `${(memorizeTimeLeft / 4) * 100}%`,
                  backgroundColor: hsvToHsl(targetColors[roundIdx].h, targetColors[roundIdx].s, targetColors[roundIdx].b) 
                }}
                className="h-full rounded-full transition-all duration-1000 ease-linear"
              />
            </div>
          </div>
        )}

        {/* PHASE 4: RECREATE (SLIDERS) */}
        {phase === "recreate" && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">Color Match</span>
                <h2 className="text-lg font-black text-white">{players[playerIdx].name}'s Guess</h2>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-3 py-1 rounded-xl">
                Round {roundIdx + 1}
              </span>
            </div>

            {/* Large comparison swatch */}
            <div className="flex flex-col items-center mb-8">
              <div 
                style={{ backgroundColor: hsvToHsl(currentGuess.h, currentGuess.s, currentGuess.b) }}
                className="w-full h-32 rounded-2xl shadow-xl border border-white/10 transition-colors duration-150"
              />
              <span className="text-xs font-semibold text-gray-400 mt-2">Your Guess Swatch</span>
            </div>

            {/* Sliders */}
            <div className="space-y-6 mb-8">
              
              {/* Hue */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-400">Hue</span>
                  <span className="text-white">{Math.round(currentGuess.h)}°</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="360"
                  value={currentGuess.h}
                  onChange={(e) => setCurrentGuess(prev => ({ ...prev, h: parseInt(e.target.value) }))}
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"
                  }}
                />
              </div>

              {/* Saturation */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-400">Saturation</span>
                  <span className="text-white">{Math.round(currentGuess.s)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100"
                  value={currentGuess.s}
                  onChange={(e) => setCurrentGuess(prev => ({ ...prev, s: parseInt(e.target.value) }))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #ffffff, ${hsvToHsl(currentGuess.h, 100, currentGuess.b)})`
                  }}
                />
              </div>

              {/* Brightness */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-400">Brightness</span>
                  <span className="text-white">{Math.round(currentGuess.b)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100"
                  value={currentGuess.b}
                  onChange={(e) => setCurrentGuess(prev => ({ ...prev, b: parseInt(e.target.value) }))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #000000, ${hsvToHsl(currentGuess.h, currentGuess.s, 100)})`
                  }}
                />
              </div>

            </div>

            <button 
              onClick={handleSubmitGuess}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/15 transition-all"
            >
              Submit Match
            </button>
          </div>
        )}

        {/* PHASE 5: ROUND RESULT */}
        {phase === "roundResult" && lastResult && (
          <div className="bg-[#0D0D14] border border-white/5 rounded-3xl p-6 md:p-8 shadow-2xl relative text-center">
            <h2 className="text-xl font-bold text-white mb-1">{players[playerIdx].name}'s Result</h2>
            <p className="text-xs text-gray-500 mb-6">Round {roundIdx + 1}</p>

            {/* Score circle */}
            <div className="relative w-36 h-36 rounded-full border-4 border-emerald-500/20 flex flex-col items-center justify-center mx-auto mb-6">
              <span className="text-3xl font-black text-white">{lastResult.score.toFixed(2)}</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">out of 10</span>
              
              {/* Abs/relative pulse glow based on score */}
              <div className="absolute inset-0 rounded-full border border-emerald-500/40 animate-ping opacity-10 pointer-events-none" />
            </div>

            {/* Feedback Badge */}
            {feedback && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-4 py-1.5 rounded-full border uppercase tracking-wider mb-8 ${feedback.color}`}>
                <Award className="w-3.5 h-3.5" />
                {feedback.text}
              </span>
            )}

            {/* Overlapping swatch display */}
            <div className="bg-[#161622] border border-white/5 rounded-2xl p-5 mb-8">
              <div className="flex justify-center items-center gap-4 mb-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div 
                    style={{ backgroundColor: hsvToHsl(lastResult.target.h, lastResult.target.s, lastResult.target.b) }}
                    className="w-20 h-20 rounded-xl shadow-lg border border-white/10"
                  />
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Target</span>
                </div>
                <div className="text-gray-600 font-bold">VS</div>
                <div className="flex flex-col items-center gap-1.5">
                  <div 
                    style={{ backgroundColor: hsvToHsl(lastResult.guess.h, lastResult.guess.s, lastResult.guess.b) }}
                    className="w-20 h-20 rounded-xl shadow-lg border border-white/10"
                  />
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Your Guess</span>
                </div>
              </div>

              {/* Exact numbers info */}
              <div className="grid grid-cols-2 gap-4 text-[10px] text-gray-500 font-mono text-left pt-3 border-t border-white/5">
                <div>
                  <p>H: {Math.round(lastResult.target.h)}°</p>
                  <p>S: {Math.round(lastResult.target.s)}%</p>
                  <p>B: {Math.round(lastResult.target.b)}%</p>
                </div>
                <div className="border-l border-white/5 pl-4">
                  <p>H: {Math.round(lastResult.guess.h)}°</p>
                  <p>S: {Math.round(lastResult.guess.s)}%</p>
                  <p>B: {Math.round(lastResult.guess.b)}%</p>
                </div>
              </div>
            </div>

            <button 
              onClick={handleContinue}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 transition-colors"
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
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
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
                      ? "bg-gradient-to-r from-emerald-950/20 to-teal-950/20 border-emerald-500/20 shadow-md shadow-emerald-500/5" 
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
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/10"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-600">
        <p>© PlayVirals - Color Match Web Edition</p>
      </footer>
    </main>
  );
}
