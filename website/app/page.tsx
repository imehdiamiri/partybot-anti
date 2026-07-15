"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Sparkles, 
  Smartphone, 
  Tv, 
  Layers, 
  ShieldAlert, 
  Download, 
  Users, 
  Play, 
  Lock, 
  Volume2, 
  Palette,
  X
} from "lucide-react";

interface GameInfo {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  isPremium: boolean;
  playableOnWeb: boolean;
  playUrl?: string;
  accent: string;
  heroImage: string;
}

const GAMES: GameInfo[] = [
  // Web Playable Games First
  {
    id: "sound_match",
    name: "Sound Match",
    description: "Listen to a target tone, then recreate its pitch from memory using a frequency slider.",
    minPlayers: 1,
    maxPlayers: 30,
    isPremium: false,
    playableOnWeb: true,
    playUrl: "/game/sound-match",
    accent: "from-pink-500 to-rose-500",
    heroImage: "/images/heroes/sound-match.png"
  },
  {
    id: "color_match",
    name: "Color Match",
    description: "We show you a color. You recreate it from memory. Challenge friends to beat your score.",
    minPlayers: 1,
    maxPlayers: 30,
    isPremium: false,
    playableOnWeb: true,
    playUrl: "/game/color-match",
    accent: "from-emerald-500 to-teal-500",
    heroImage: "/images/heroes/color-match.png"
  },
  // Free Mobile Games
  {
    id: "guess_the_seconds",
    name: "Guess the Seconds",
    description: "Choose a target time, hide it, count in your head, then stop as close as you can.",
    minPlayers: 2,
    maxPlayers: 30,
    isPremium: false,
    playableOnWeb: false,
    accent: "from-cyan-500 to-blue-500",
    heroImage: "/images/heroes/guess-the-seconds.png"
  },
  {
    id: "reverse_singing",
    name: "Reverse Singing",
    description: "Pass the phone. Record anything. Hear it reversed. Mimic it. Compare the chaos.",
    minPlayers: 2,
    maxPlayers: 2,
    isPremium: false,
    playableOnWeb: false,
    accent: "from-pink-500 to-purple-500",
    heroImage: "/images/heroes/reverse-singing.png"
  },
  {
    id: "imposter",
    name: "Imposter",
    description: "One player is the Imposter — find them before it's too late, or bluff your way to victory.",
    minPlayers: 4,
    maxPlayers: 30,
    isPremium: false,
    playableOnWeb: false,
    accent: "from-red-500 to-rose-600",
    heroImage: "/images/heroes/imposter.png"
  },
  {
    id: "memory_grid",
    name: "Memory Grid",
    description: "Flip tiles, find matching pairs, and race the clock — or your friends.",
    minPlayers: 1,
    maxPlayers: 30,
    isPremium: false,
    playableOnWeb: false,
    accent: "from-blue-500 to-indigo-500",
    heroImage: "/images/heroes/memory-grid.png"
  },
  {
    id: "reaction_time",
    name: "Reaction Time",
    description: "Wait for green, then tap as fast as you can. Lowest reaction time wins.",
    minPlayers: 1,
    maxPlayers: 30,
    isPremium: false,
    playableOnWeb: false,
    accent: "from-green-500 to-emerald-500",
    heroImage: "/images/heroes/reaction-time.png"
  },
  {
    id: "eye_sight",
    name: "Eye Sight",
    description: "Numbers flash for a split second — memorize them and type them back. Each round gets harder.",
    minPlayers: 1,
    maxPlayers: 30,
    isPremium: false,
    playableOnWeb: false,
    accent: "from-cyan-500 to-teal-500",
    heroImage: "/images/heroes/eye-sight.png"
  },
  {
    id: "drum_challenge",
    name: "Drum Challenge",
    description: "A music clip plays — tap the drum at the EXACT moment the beat drops. Closest to 0 ms wins.",
    minPlayers: 1,
    maxPlayers: 30,
    isPremium: false,
    playableOnWeb: false,
    accent: "from-fuchsia-500 to-pink-500",
    heroImage: "/images/heroes/drum-challenge.png"
  },
  // Premium Mobile Games
  {
    id: "ten_tangle",
    name: "Ten Tangle",
    description: "Get a secret number 1–10, act it out for a scenario, and fool the guesser.",
    minPlayers: 3,
    maxPlayers: 11,
    isPremium: true,
    playableOnWeb: false,
    accent: "from-purple-500 to-indigo-600",
    heroImage: "/images/heroes/ten-tangle.png"
  },
  {
    id: "memory_path",
    name: "Memory Path",
    description: "Find the hidden path from start to end — one wrong step and you restart.",
    minPlayers: 2,
    maxPlayers: 30,
    isPremium: true,
    playableOnWeb: false,
    accent: "from-orange-500 to-amber-500",
    heroImage: "/images/heroes/memory-path.png"
  },
  {
    id: "pass_guess",
    name: "Pass & Guess",
    description: "Pass one phone, write private answers, then guess who wrote each one before the final reveal.",
    minPlayers: 3,
    maxPlayers: 30,
    isPremium: true,
    playableOnWeb: false,
    accent: "from-yellow-500 to-amber-600",
    heroImage: "/images/heroes/pass-guess.png"
  },
  {
    id: "tap_in_order",
    name: "Tap in Order",
    description: "Race against the clock to tap numbered tiles in order. Same board for every player.",
    minPlayers: 1,
    maxPlayers: 30,
    isPremium: true,
    playableOnWeb: false,
    accent: "from-teal-500 to-cyan-500",
    heroImage: "/images/heroes/tap-in-order.png"
  },
  {
    id: "color_trap",
    name: "Color Trap",
    description: "Tap every color except the forbidden one. Three strikes and you're out.",
    minPlayers: 1,
    maxPlayers: 30,
    isPremium: true,
    playableOnWeb: false,
    accent: "from-rose-500 to-red-600",
    heroImage: "/images/heroes/color-trap.png"
  },
  {
    id: "draw_rush",
    name: "Draw & Rush",
    description: "One player draws a secret concept while everyone else rushes to guess what it is.",
    minPlayers: 2,
    maxPlayers: 12,
    isPremium: true,
    playableOnWeb: false,
    accent: "from-blue-500 to-indigo-500",
    heroImage: "/images/heroes/draw-rush.png"
  },
  {
    id: "spin_bottle",
    name: "Truth & Dare",
    description: "Spin the bottle, get picked, and pick Truth or Dare. Classic party energy.",
    minPlayers: 3,
    maxPlayers: 12,
    isPremium: true,
    playableOnWeb: false,
    accent: "from-violet-500 to-purple-600",
    heroImage: "/images/heroes/spin-bottle.png"
  }
];

export default function GameCatalog() {
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);

  return (
    <main className="min-h-screen bg-[#08080C] text-gray-100 font-sans selection:bg-purple-500/30 selection:text-purple-200">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-purple-900/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-[10%] left-[10%] w-[300px] h-[300px] bg-blue-500/5 rounded-full filter blur-[80px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[350px] h-[350px] bg-purple-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-white/5 bg-[#0D0D14]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                PlayVirals
              </h1>
              <p className="text-[10px] text-purple-400 font-medium uppercase tracking-wider">Party Games</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/imehdiamiri/partybot-anti"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-white/5"
            >
              GitHub
            </a>
            <button 
              onClick={() => setSelectedGame(GAMES[2])} // Just trigger modal for a non-web game
              className="text-xs font-semibold bg-white/5 hover:bg-white/10 text-white py-2 px-4 rounded-xl border border-white/10 flex items-center gap-2 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Get App
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-12 text-center relative">
        <span className="text-xs font-semibold tracking-widest text-purple-400 bg-purple-950/40 px-4 py-1.5 rounded-full border border-purple-800/30 uppercase inline-block mb-4">
          Ultimate Social Games
        </span>
        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
          Bring Your Friends. <br/>
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
            Let the Chaos Begin.
          </span>
        </h2>
        <p className="max-w-2xl mx-auto text-base md:text-lg text-gray-400 leading-relaxed mb-8">
          The ultimate party games for groups. Play directly on your web browser for free or download the official app to access all games and connect multiple phones!
        </p>

        {/* Feature quick badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-gray-400">
          <div className="flex items-center gap-1.5 bg-white/5 px-3.5 py-2 rounded-xl border border-white/5">
            <Smartphone className="w-3.5 h-3.5 text-blue-400" />
            1 Phone Pass & Play
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 px-3.5 py-2 rounded-xl border border-white/5">
            <Tv className="w-3.5 h-3.5 text-emerald-400" />
            Cross-device Sync
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 px-3.5 py-2 rounded-xl border border-white/5">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            AI-powered Prompts
          </div>
        </div>
      </section>

      {/* Game Catalog Grid */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h3 className="text-lg font-bold text-gray-300 mb-8 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-purple-500 rounded-full" />
          Game Library ({GAMES.length} games)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {GAMES.map((game) => (
            <div 
              key={game.id} 
              className={`group bg-[#0D0D14] border border-white/5 hover:border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 flex flex-col relative`}
            >
              {/* Game Badge */}
              <div className="absolute top-3 left-3 z-10 flex gap-2">
                {game.playableOnWeb && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg backdrop-blur-md">
                    Playable on Web
                  </span>
                )}
                {game.isPremium && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    Premium
                  </span>
                )}
              </div>

              {/* Game image container */}
              <div className="h-44 bg-gray-900 relative overflow-hidden">
                <Image 
                  src={game.heroImage} 
                  alt={game.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority={game.playableOnWeb}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D14] via-transparent to-transparent" />
              </div>

              {/* Game Info */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors flex items-center gap-2">
                    {game.name}
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">
                    {game.description}
                  </p>
                </div>

                <div>
                  {/* Info stats */}
                  <div className="flex items-center gap-4 text-[11px] text-gray-500 mb-4 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      {game.minPlayers === game.maxPlayers ? `${game.minPlayers} players` : `${game.minPlayers}–${game.maxPlayers} players`}
                    </div>
                  </div>

                  {/* Play CTA */}
                  {game.playableOnWeb ? (
                    <Link 
                      href={game.playUrl!}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/10 hover:shadow-purple-600/20 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Play on Web
                    </Link>
                  ) : (
                    <button 
                      onClick={() => setSelectedGame(game)}
                      className="w-full bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold py-2.5 px-4 rounded-xl border border-white/5 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      App Only
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* App only Modal */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-[#0D0D14] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative">
            <button 
              onClick={() => setSelectedGame(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Game Card Hero */}
            <div className="h-48 relative bg-gray-900">
              <Image 
                src={selectedGame.heroImage} 
                alt={selectedGame.name}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D14] via-transparent to-transparent" />
            </div>

            <div className="p-6 text-center">
              <h4 className="text-xl font-bold text-white mb-2">{selectedGame.name}</h4>
              <p className="text-xs text-purple-400 font-semibold mb-4">
                Available on iOS & Android
              </p>
              <p className="text-xs text-gray-400 leading-relaxed mb-6">
                {selectedGame.description}
                <br/><br/>
                This game requires multiplayer synchronization, microphone input, or advanced hardware features only available in the official PlayVirals app.
              </p>

              {/* Play Store buttons */}
              <div className="grid grid-cols-2 gap-4">
                <a 
                  href="#"
                  onClick={(e) => { e.preventDefault(); alert("App Store link: Coming soon!"); }}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  App Store
                </a>
                <a 
                  href="#"
                  onClick={(e) => { e.preventDefault(); alert("Google Play link: Coming soon!"); }}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/15 transition-all"
                >
                  Google Play
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-xs text-gray-500 mt-20">
        <p className="mb-4">© {new Date().getFullYear()} PlayVirals. All rights reserved.</p>
        <div className="flex justify-center gap-6">
          <Link href="/privacy" className="hover:text-gray-300">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-300">Terms of Service</Link>
        </div>
      </footer>
    </main>
  );
}
