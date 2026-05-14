import { Colors } from '@/src/theme/Colors';
import { useState, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Platform, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { useSavedIdeasStore, SavedIdea } from '@/src/store/useSavedIdeasStore';
import { LinearGradient } from 'expo-linear-gradient';

import { IconSymbol } from '@/components/ui/icon-symbol';

// Platform-safe BlurView
let BlurViewComponent: any = null;
if (Platform.OS === 'ios') {
  try { BlurViewComponent = require('expo-blur').BlurView; } catch {}
}
const SurfaceBlur = ({ style, children, intensity = 25 }: any) => {
  if (Platform.OS === 'ios' && BlurViewComponent) {
    return <BlurViewComponent intensity={intensity} tint="dark" style={style}>{children}</BlurViewComponent>;
  }
  return <View style={[style, { backgroundColor: 'rgba(20,20,30,0.92)' }]}>{children}</View>;
};

export const GAME_VIBES = [
  { id: 'couple', title: 'Couple', icon: 'heart.fill', color: '#FF2D55' },
  { id: 'funny', title: 'Funny', icon: 'face.smiling.fill', color: Colors.yellow },
  { id: 'memory', title: 'Memory', icon: 'brain.head.profile', color: '#5AC8FA' },
  { id: 'action', title: 'Action', icon: 'figure.run', color: Colors.orange },
  { id: 'cards', title: 'Cards', icon: 'suit.club.fill', color: '#007AFF' },
  { id: 'trivia', title: 'Trivia', icon: 'questionmark.circle.fill', color: '#00C7BE' },
  { id: 'roleplay', title: 'Roleplay', icon: 'theatermasks.fill', color: '#AF52DE' },
  { id: 'challenge', title: 'Challenge', icon: 'flame.fill', color: Colors.red },
] as const;

/** Comprehensive local game library keyed by vibe. Each vibe has 6+ ideas so
 *  we can pick 2-3 unique ones per generation without repetition. */
const LOCAL_GAME_LIBRARY: Record<string, Array<{
  title: string;
  description: string;
  steps: string[];
  tags: string[];
}>> = {
  couple: [
    { title: 'Love Roulette', description: 'Spin and answer intimate questions about each other.', steps: ['One partner spins the wheel', 'Read the question out loud', 'Both answer honestly', 'Compare answers and score!'], tags: ['Romantic', '2 Players'] },
    { title: 'Memory Lane', description: 'Test how well you remember your relationship milestones.', steps: ['Write 5 relationship memories each', 'Take turns reading them', 'Partner guesses when it happened', 'Most correct answers wins'], tags: ['Couples', 'Memory'] },
    { title: 'Two Truths, One Wish', description: 'Share truths and a secret wish with your partner.', steps: ['Each person says 2 truths and 1 wish', 'Partner guesses which is the wish', 'Discuss wishes together', 'Bonus: try to make one wish come true'], tags: ['Deep', 'Intimate'] },
    { title: 'Song Dedication', description: 'Dedicate songs and explain why they remind you of your partner.', steps: ['Pick a song that reminds you of them', 'Play 30 seconds of it', 'Explain why you chose it', 'Rate each dedication'], tags: ['Music', 'Sweet'] },
    { title: 'Would You Rather: Love Edition', description: 'Tricky dilemmas that reveal what you value most.', steps: ['Draw a dilemma card', 'Both choose independently', 'Reveal answers simultaneously', 'Discuss your reasoning'], tags: ['Choices', 'Fun'] },
    { title: 'Finish My Sentence', description: 'Complete each other\'s sentences and see how in sync you are.', steps: ['One person starts a sentence', 'The other must finish it', 'Score points for matching answers', 'Most in-sync couple wins!'], tags: ['Sync', 'Quick'] },
  ],
  funny: [
    { title: 'Accent Olympics', description: 'Say everyday phrases in the most ridiculous accents possible.', steps: ['Draw a phrase card', 'Roll the accent dice', 'Perform with full commitment', 'Group votes on the best attempt'], tags: ['Acting', 'Hilarious'] },
    { title: 'Bad Advice Bureau', description: 'Give the worst possible advice and see who cracks first.', steps: ['One person shares a real problem', 'Everyone gives intentionally terrible advice', 'Vote for the worst (best) advice', 'Advisor with most votes wins the round'], tags: ['Creative', 'Loud'] },
    { title: 'Emoji Charades', description: 'Act out emoji combinations for your team to guess.', steps: ['Draw 3 random emoji', 'Create a scene combining all three', 'Team has 60 seconds to guess', 'Switch teams and repeat'], tags: ['Teams', 'Fast'] },
    { title: 'The Floor Is Lava: Story Edition', description: 'Create an absurd story but switch narrators mid-sentence.', steps: ['First player starts a story', 'Clap to pass to next player mid-sentence', 'They must continue seamlessly', 'Laughing or pausing = penalty point'], tags: ['Groups', 'Creative'] },
    { title: 'Sound Effects Battle', description: 'Replace words with sound effects in normal conversations.', steps: ['Pick a common word to ban', 'Replace it with a sound effect', 'Have a normal conversation', 'First person to forget loses'], tags: ['Silly', 'Quick'] },
    { title: 'Reverse Interview', description: 'Answer questions about yourself as if you were someone else in the group.', steps: ['Draw a name from the hat', 'Answer questions as that person', 'Group guesses who you\'re impersonating', 'Most convincing actor wins'], tags: ['Improv', 'Groups'] },
  ],
  memory: [
    { title: 'Chain Reaction', description: 'Build an ever-growing list and try not to forget a single item.', steps: ['First player says a word', 'Next player repeats it and adds one', 'Chain keeps growing each turn', 'Forget or hesitate and you\'re out!'], tags: ['Focus', 'Elimination'] },
    { title: 'Snapshot Memory', description: 'Study a scene for 10 seconds then answer questions about it.', steps: ['Set up a scene with random objects', 'Everyone studies it for 10 seconds', 'Cover the scene and ask questions', 'Most correct answers wins'], tags: ['Visual', 'Quick'] },
    { title: 'Melody Match', description: 'Hum songs and match them to the right titles.', steps: ['One player hums a well-known song', 'Others race to name the song', 'First correct answer gets a point', 'Player with most points wins'], tags: ['Music', 'Speed'] },
    { title: 'Timeline Scramble', description: 'Put historical or pop culture events in the right order.', steps: ['Draw 5 event cards', 'Arrange them in chronological order', 'Reveal the correct timeline', 'Closest arrangement scores highest'], tags: ['Trivia', 'Strategy'] },
    { title: 'Name That Face', description: 'Match names to faces after a brief introduction round.', steps: ['Show photos of random people with names', 'Study for 30 seconds', 'Shuffle and remove names', 'Match as many as possible'], tags: ['Visual', 'Challenge'] },
    { title: 'Story Recall', description: 'Listen to a short story then answer detailed questions.', steps: ['One person reads a short story', 'Others listen without taking notes', 'Answer 5 questions about the story', 'Most correct details wins'], tags: ['Focus', 'Listen'] },
  ],
  action: [
    { title: 'Speed Stack', description: 'Race to stack cups in patterns faster than your opponents.', steps: ['Set up cup pyramids', 'On go, race to stack and unstack', 'First to complete the pattern wins', 'Losers do a funny forfeit'], tags: ['Speed', 'Physical'] },
    { title: 'Balloon Keepy-Uppy', description: 'Keep the balloon in the air using only the body part called out.', steps: ['Inflate a balloon', 'Someone calls a body part', 'Only use that part to keep it up', 'Let it touch the ground and you\'re out'], tags: ['Active', 'Silly'] },
    { title: 'Musical Statues Plus', description: 'Freeze when the music stops, but in the pose called out.', steps: ['Play music and dance', 'When music stops, a pose is called', 'Everyone must freeze in that pose', 'Worst pose is eliminated each round'], tags: ['Dance', 'Elimination'] },
    { title: 'Rapid Fire Relay', description: 'Complete mini-challenges in a relay race against the clock.', steps: ['Set up 4 station challenges', 'Teams race through all stations', 'Each station has a 30-second task', 'Fastest team wins!'], tags: ['Teams', 'Race'] },
    { title: 'Paper Plane Championship', description: 'Design and fly paper planes for distance and accuracy.', steps: ['Everyone builds a paper plane', 'Round 1: Longest distance', 'Round 2: Hit the target', 'Combined score determines winner'], tags: ['Creative', 'Competition'] },
    { title: 'Ninja Clap', description: 'Try to clap someone\'s hands while they dodge — last one standing wins.', steps: ['Stand in a circle', 'Take turns trying to clap neighbors\' hands', 'Defenders can dodge with one movement', 'Lose both hands and you\'re out'], tags: ['Reflex', 'Physical'] },
  ],
  cards: [
    { title: 'Bluff Master', description: 'Play cards face-down and try to bluff your way to victory.', steps: ['Deal all cards evenly', 'Play 1-3 cards face down, claiming a value', 'Anyone can call bluff', 'Wrong caller takes the pile, correct caller gives it'], tags: ['Bluff', 'Strategy'] },
    { title: 'Card Tower Challenge', description: 'Build the tallest card tower in 2 minutes.', steps: ['Each player gets a deck', 'Set a 2-minute timer', 'Build the tallest tower possible', 'Tallest standing tower wins'], tags: ['Steady', 'Building'] },
    { title: 'War Stories', description: 'Classic card war but with storytelling twists.', steps: ['Flip cards simultaneously', 'Higher card wins BUT must tell a micro-story', 'If you can\'t tell a story, you lose the round', 'Most cards at the end wins'], tags: ['Creative', 'Cards'] },
    { title: 'Speed Snap', description: 'Race to slap matching cards before anyone else.', steps: ['Take turns flipping cards to center', 'When two cards match, race to slap the pile', 'Fastest slap takes all cards', 'Player with most cards wins'], tags: ['Reflex', 'Fast'] },
    { title: 'Prediction Poker', description: 'Predict how many rounds you\'ll win — no more, no less.', steps: ['Deal 5 cards each', 'Predict your exact number of wins', 'Play all 5 rounds', 'Exact predictions score double'], tags: ['Strategy', 'Prediction'] },
    { title: 'Card Bingo', description: 'Draw cards and match them to your bingo grid first.', steps: ['Each player creates a 3x3 grid', 'Dealer draws cards one by one', 'Mark matching cards on your grid', 'First to complete a line wins'], tags: ['Luck', 'Quick'] },
  ],
  trivia: [
    { title: 'Fact or Fiction', description: 'Guess which outrageous statements are actually true.', steps: ['Read a wild statement', 'Everyone votes: Fact or Fiction?', 'Reveal the answer', 'Track scores over 10 rounds'], tags: ['Knowledge', 'Surprising'] },
    { title: 'Category Blitz', description: 'Name items in a category before time runs out.', steps: ['Draw a category card', 'Start the 30-second timer', 'Name as many items as possible', 'Unique answers score points'], tags: ['Speed', 'Knowledge'] },
    { title: 'Year Guesser', description: 'Guess the year that famous events happened.', steps: ['Read an event description', 'Everyone writes their year guess', 'Closest to the actual year wins', 'Exact year = bonus points'], tags: ['History', 'Guessing'] },
    { title: 'Price Tag', description: 'Guess the price of unusual items from around the world.', steps: ['Show an unusual product', 'Everyone writes their price guess', 'Reveal the actual price', 'Closest without going over wins'], tags: ['Guessing', 'Fun'] },
    { title: 'Lyric Finish', description: 'Complete the missing lyrics to famous songs.', steps: ['Play a song and pause mid-lyric', 'Everyone writes the next line', 'Reveal the correct lyrics', 'Exact matches get full points'], tags: ['Music', 'Memory'] },
    { title: 'Two-Second Expert', description: 'Become an instant expert on random topics and bluff your way through.', steps: ['Draw a random topic card', 'Speak for 30 seconds as an expert', 'Others rate your believability', 'Most convincing expert wins'], tags: ['Bluff', 'Creative'] },
  ],
  roleplay: [
    { title: 'Courtroom Drama', description: 'Put everyday situations on trial with ridiculous accusations.', steps: ['Draw a silly accusation card', 'Assign judge, lawyer, and defendant', 'Present arguments for 2 minutes each', 'Jury (other players) delivers verdict'], tags: ['Drama', 'Groups'] },
    { title: 'Time Traveler\'s Dilemma', description: 'Roleplay historical figures dealing with modern problems.', steps: ['Draw a historical figure card', 'Draw a modern problem card', 'Stay in character for 3 minutes', 'Group votes on best performance'], tags: ['Creative', 'Acting'] },
    { title: 'Reality Show', description: 'Create and star in your own ridiculous reality show.', steps: ['Pick a reality show genre', 'Assign roles to each player', 'Improvise a 5-minute episode', 'Vote for the breakout star'], tags: ['Improv', 'Hilarious'] },
    { title: 'Alien Ambassador', description: 'One player is an alien trying to understand human customs.', steps: ['Choose the alien ambassador', 'Others explain everyday things as if to aliens', 'Alien asks absurd follow-up questions', 'Most creative explanation wins'], tags: ['Silly', 'Creative'] },
    { title: 'Job Interview Gone Wrong', description: 'Interview for the most absurd job positions imaginable.', steps: ['Draw a ridiculous job title', 'One person interviews, one applies', 'Stay completely serious', 'Audience votes who broke character first'], tags: ['Improv', 'Comedy'] },
    { title: 'Dubbed Movie', description: 'Act out a scene while someone else provides the dialogue.', steps: ['Choose a movie genre', 'Two people act silently', 'Two others provide live dubbing', 'Switch roles after each scene'], tags: ['Teams', 'Acting'] },
  ],
  challenge: [
    { title: 'Dare Ladder', description: 'Escalating dares where you can bail — but lose points.', steps: ['Start with a mild dare', 'Each round the dare escalates', 'Bail anytime but lose all round points', 'Complete all 5 levels for max points'], tags: ['Brave', 'Escalating'] },
    { title: 'Skill Showdown', description: 'Head-to-head micro-challenges that test random skills.', steps: ['Draw a skill challenge card', 'Two players compete head-to-head', 'Winner stays, loser is replaced', 'Last player standing is champion'], tags: ['1v1', 'Skills'] },
    { title: 'Taste Test Extreme', description: 'Blindfolded taste tests with surprising combinations.', steps: ['Blindfold the contestant', 'Present a mystery food combination', 'They must guess all ingredients', 'Most correct guesses wins the round'], tags: ['Food', 'Blind'] },
    { title: 'One-Minute Masterpiece', description: 'Create art, build structures, or perform in just 60 seconds.', steps: ['Draw a creative challenge card', 'Set the 60-second timer', 'Create your masterpiece', 'Group votes on the best creation'], tags: ['Speed', 'Creative'] },
    { title: 'Truth Bomb', description: 'Answer increasingly personal questions or take the forfeit.', steps: ['Draw a question card', 'Answer truthfully or take a forfeit', 'Forfeits get harder each round', 'Most honest player wins respect'], tags: ['Truth', 'Bold'] },
    { title: 'Impossible Tasks', description: 'Try to complete seemingly impossible challenges.', steps: ['Draw an impossible task card', 'You have 3 attempts to complete it', 'Success = 3 points, partial = 1 point', 'Most points after 5 rounds wins'], tags: ['Physical', 'Fun'] },
  ],
};

/** Pick n random unique items from an array. */
function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Build unique IDs for generated ideas. */
let _generationCounter = 0;
function nextId(): string {
  _generationCounter += 1;
  return `gen_${Date.now()}_${_generationCounter}`;
}

/** Generate 2-3 locally-sourced game ideas based on vibe, player count, and context. */
function generateLocalIdeas(vibeId: string, playerCount: number, context: string): any[] {
  // Collect matching vibe games + some cross-vibe variety
  const primary = LOCAL_GAME_LIBRARY[vibeId] || LOCAL_GAME_LIBRARY['funny'];
  const allVibes = Object.keys(LOCAL_GAME_LIBRARY).filter(k => k !== vibeId);
  const crossVibeKey = allVibes[Math.floor(Math.random() * allVibes.length)];
  const crossVibe = LOCAL_GAME_LIBRARY[crossVibeKey] || [];

  // Pick 2 from primary, 1 from cross-vibe for variety
  const primaryPicks = pickRandom(primary, 2);
  const crossPick = pickRandom(crossVibe, 1);
  const selected = [...primaryPicks, ...crossPick];

  // Adapt player count into steps/tags
  return selected.map(game => {
    const adaptedTags = [...game.tags];
    if (playerCount <= 2) adaptedTags.push('Duo');
    else if (playerCount <= 4) adaptedTags.push('Small Group');
    else if (playerCount <= 8) adaptedTags.push('Party');
    else adaptedTags.push('Big Group');

    return {
      id: nextId(),
      title: game.title,
      description: game.description,
      steps: game.steps,
      tags: adaptedTags.slice(0, 3),
    };
  });
}

interface Props {
  /** Optional initial vibe id (defaults to 'funny'). */
  initialVibeId?: string;
  /** Show the inline hero card at the top. Set false for tighter embeds. */
  showHero?: boolean;
  /** Override the hero copy. */
  heroTitle?: string;
  heroSubtitle?: string;
}

export function AIGeneratorPanel({
  initialVibeId,
  showHero = true,
  heroTitle = 'Invent your\nnext party game',
  heroSubtitle = "Pick a vibe, set your crew, and we'll cook up fresh games in seconds.",
}: Props) {
  const initial = GAME_VIBES.find(v => v.id === initialVibeId) ?? GAME_VIBES[1];
  const [vibe, setVibe] = useState<(typeof GAME_VIBES)[number]>(initial);
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const previouslyShown = useRef<Set<string>>(new Set());
  const { saveIdea, isIdeaSaved } = useSavedIdeasStore();

  const handleSaveIdea = useCallback((idea: any) => {
    saveIdea({ id: idea.id, title: idea.title, description: idea.description, steps: idea.steps, tags: idea.tags, savedAt: Date.now() });
  }, [saveIdea]);

  const minPlayers = 2;
  const maxPlayers = 20;

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setIdeas([]);

    const excludedTitles = Array.from(previouslyShown.current);
    const excludeClause = excludedTitles.length > 0
      ? `\n\nDo NOT use any of these titles (already shown): ${excludedTitles.join(', ')}.`
      : '';

    try {
      const { complete, stripCodeFences } = await import('@/src/services/LLMService');

      const contextInstruction = prompt.trim()
        ? `\n\nCRITICAL: The user specified this theme/context: "${prompt.trim()}". Every game you generate MUST be directly related to and built around this theme. Do NOT generate generic games.`
        : '';

      const systemPrompt = `You are a creative party game designer. Generate exactly 3 unique party game ideas as a JSON array. Each object must have: { "id": unique_string, "title": string, "description": one_sentence, "steps": string_array_3_to_5, "tags": string_array_2 }. Return ONLY valid JSON array, no markdown.${contextInstruction}${excludeClause}`;
      const userPrompt = `Create 3 NEW party games for ${playerCount} players with a "${vibe.title}" vibe.${prompt.trim() ? ` Themed around: ${prompt.trim()}` : ''}`;

      const raw = await complete(systemPrompt, userPrompt);
      const parsed = JSON.parse(stripCodeFences(raw));
      const results = Array.isArray(parsed) ? parsed : [parsed];
      const withIds = results.map((r: any) => ({ ...r, id: r.id || nextId() }));
      withIds.forEach((r: any) => previouslyShown.current.add(r.title));
      setIdeas(withIds);
    } catch (err: any) {
      console.warn('AI generation failed, using local fallback:', err?.message);
      const localIdeas = generateLocalIdeas(vibe.id, playerCount, prompt)
        .filter(g => !previouslyShown.current.has(g.title));
      localIdeas.forEach(g => previouslyShown.current.add(g.title));
      setIdeas(localIdeas.length > 0 ? localIdeas : generateLocalIdeas(vibe.id, playerCount, prompt));
    }

    setIsGenerating(false);
    setShowModal(true);
  };

  return (
    <View style={styles.root}>
      {showHero && (
        <View style={styles.heroCardWrapper}>
          <LinearGradient
            colors={['rgba(175, 82, 222, 0.55)', 'rgba(0, 122, 255, 0.35)', 'rgba(255, 45, 85, 0.25)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroCardContent}>
              <View style={styles.aiBadge}>
                <IconSymbol name="sparkles" size={10} color="rgba(255,255,255,0.9)" />
                <Text style={styles.aiBadgeText}>AI POWERED</Text>
              </View>
              <Text style={styles.heroTitle}>{heroTitle}</Text>
              <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
            </View>
            <View style={styles.heroIconWrapper}>
              <IconSymbol name="wand.and.stars" size={80} color="rgba(255,255,255,0.12)" style={{ transform: [{ rotate: '12deg' }] }} />
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Vibe Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.vibeHeader}>
          <Text style={styles.sectionTitle}>Choose a vibe</Text>
          <Text style={[styles.selectedVibeText, { color: vibe.color }]}>{vibe.title}</Text>
        </View>
        <View style={styles.vibeGrid}>
          {GAME_VIBES.map((v) => {
            const isSelected = vibe.id === v.id;
            return (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.vibeTile,
                  isSelected ? { borderColor: 'rgba(255,255,255,0.25)' } : { borderColor: `${v.color}38` },
                ]}
                onPress={() => setVibe(v)}
                activeOpacity={0.7}
              >
                {Platform.OS === 'ios' && BlurViewComponent ? (
                  <BlurViewComponent tint="dark" intensity={isSelected ? 40 : 20} style={StyleSheet.absoluteFill} />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: isSelected ? `${v.color}40` : 'rgba(20,20,30,0.92)' }]} />
                )}
                <LinearGradient
                  colors={isSelected ? [v.color, `${v.color}B3`] : ['transparent', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.vibeTileGradient}
                >
                  <IconSymbol name={v.icon as any} size={16} color={isSelected ? 'white' : v.color} />
                  <Text style={[styles.vibeTileText, { color: isSelected ? 'white' : 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
                    {v.title}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Players + Context */}
      <View style={styles.detailsContainer}>
        <SurfaceBlur intensity={30} style={[styles.surfaceCard, { overflow: 'hidden' }]}>
          <View style={styles.playersRow}>
            <IconSymbol name="person.2.fill" size={18} color={Colors.green} />
            <Text style={styles.playersLabel}>Players</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.stepperButton, playerCount <= minPlayers && styles.stepperDisabled]}
              onPress={() => setPlayerCount(Math.max(minPlayers, playerCount - 1))}
              disabled={playerCount <= minPlayers}
            >
              <IconSymbol name="minus" size={14} color={Colors.green} />
            </TouchableOpacity>
            <Text style={styles.playerCount}>{playerCount}</Text>
            <TouchableOpacity
              style={[styles.stepperButton, playerCount >= maxPlayers && styles.stepperDisabled]}
              onPress={() => setPlayerCount(Math.min(maxPlayers, playerCount + 1))}
              disabled={playerCount >= maxPlayers}
            >
              <IconSymbol name="plus" size={14} color={Colors.green} />
            </TouchableOpacity>
          </View>
        </SurfaceBlur>

        <SurfaceBlur intensity={30} style={[styles.surfaceCard, { overflow: 'hidden' }]}>
          <View style={styles.contextHeader}>
            <IconSymbol name="text.alignleft" size={12} color="rgba(255,255,255,0.9)" />
            <Text style={styles.contextLabel}>Context</Text>
          </View>
          <View style={styles.contextInputWrapper}>
            <TextInput
              style={styles.contextInput}
              placeholder="e.g. road trip, birthday, couples…"
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              numberOfLines={3}
              value={prompt}
              onChangeText={setPrompt}
            />
          </View>
        </SurfaceBlur>
      </View>

      {/* Generate Button */}
      <TouchableOpacity style={styles.generateButtonWrapper} onPress={handleGenerate} disabled={isGenerating}>
        <LinearGradient
          colors={isGenerating ? ['#6B3FA0', '#3D5A99'] : ['#AF52DE', Colors.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.generateButton}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <IconSymbol name="sparkles" size={18} color="white" />
          )}
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Creating Games…' : 'Generate Ideas'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Ideas Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol name="sparkles" size={18} color="#AF52DE" />
                <Text style={styles.modalTitle}>Generated Ideas</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowModal(false)}>
                <IconSymbol name="xmark" size={16} color="white" />
              </TouchableOpacity>
            </View>

            {/* Ideas List */}
            <View style={styles.modalIdeasList}>
              {ideas.map((idea) => {
                const saved = isIdeaSaved(idea.id);
                return (
                  <View key={idea.id} style={styles.modalIdeaCard}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(25,25,40,0.97)', borderRadius: 16 }]} />
                    <View style={{ padding: 14, gap: 10 }}>
                      <View style={styles.ideaHeaderRow}>
                        <View style={styles.ideaIcon}>
                          <IconSymbol name="sparkle" size={18} color={Colors.yellow} />
                        </View>
                        <View style={styles.ideaTexts}>
                          <Text style={styles.ideaTitle}>{idea.title}</Text>
                          <Text style={styles.ideaDescription}>{idea.description}</Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.saveBtn, saved && styles.saveBtnSaved]}
                          onPress={() => handleSaveIdea(idea)}
                          disabled={saved}
                        >
                          <IconSymbol name={saved ? 'checkmark' : 'bookmark'} size={14} color={saved ? Colors.green : '#AF52DE'} />
                        </TouchableOpacity>
                      </View>
                      {idea.steps.map((step: string, i: number) => (
                        <View key={i} style={styles.stepRow}>
                          <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>{i + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}
                      {idea.tags && idea.tags.length > 0 && (
                        <View style={styles.tagsRow}>
                          {idea.tags.map((tag: string) => (
                            <View key={tag} style={styles.tagBadge}>
                              <Text style={styles.tagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 0 },
  heroCardWrapper: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#AF52DE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  heroCard: { padding: 18, minHeight: 160 },
  heroCardContent: { position: 'relative', zIndex: 2, alignItems: 'flex-start', gap: 10 },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  aiBadgeText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: 'white', fontSize: 28, fontFamily: 'Viral-Black' },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18, marginTop: 4 },
  heroIconWrapper: { position: 'absolute', right: -20, top: 20, opacity: 0.8 },
  sectionContainer: { marginBottom: 20 },
  vibeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontFamily: 'Viral-Black', color: 'white', fontSize: 16 },
  selectedVibeText: { fontSize: 12, fontWeight: '600' },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeTile: { width: '23%', height: 64, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  vibeTileGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  vibeTileText: { fontSize: 11, fontWeight: 'bold' },
  detailsContainer: { gap: 14, marginBottom: 20 },
  surfaceCard: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  playersRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playersLabel: { color: Colors.green, fontSize: 15, fontWeight: '600' },
  stepperButton: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  stepperDisabled: { opacity: 0.3 },
  playerCount: { color: Colors.green, fontSize: 20, fontWeight: 'bold', minWidth: 28, textAlign: 'center' },
  contextHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  contextLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 'bold' },
  contextInputWrapper: {
    backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  contextInput: {
    color: 'white', fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
    minHeight: 80, textAlignVertical: 'top',
  },
  generateButtonWrapper: {
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#AF52DE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
    marginBottom: 20,
  },
  generateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 10 },
  generateButtonText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: Dimensions.get('window').height * 0.85,
    paddingBottom: 40,
    borderWidth: 1, borderColor: 'rgba(175,82,222,0.25)',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  modalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalIdeasList: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  modalIdeaCard: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  saveBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(175,82,222,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtnSaved: { backgroundColor: 'rgba(52,199,89,0.15)' },
  ideaHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ideaIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255, 204, 0, 0.14)',
    justifyContent: 'center', alignItems: 'center',
  },
  ideaTexts: { flex: 1, gap: 3 },
  ideaTitle: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  ideaDescription: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.14)',
    justifyContent: 'center', alignItems: 'center',
  },
  stepBadgeText: { color: Colors.blue, fontSize: 11, fontWeight: 'bold' },
  stepText: { flex: 1, color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tagBadge: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  tagText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
});
