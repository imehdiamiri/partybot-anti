/** One outcome snapshot for both standings and the round result UI. */
export function getImposterOutcome(votes: Record<string, string>, imposterId: string) {
  const voteCounts: Record<string, number> = {};
  Object.values(votes).forEach(id => { voteCounts[id] = (voteCounts[id] || 0) + 1; });
  const maxVotes = Math.max(0, ...Object.values(voteCounts));
  const leaders = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
  const tied = leaders.length > 1;
  const imposterCaught = leaders.length === 1 && leaders[0] === imposterId;
  const points: Record<string, number> = {};
  if (imposterCaught) {
    Object.entries(votes).forEach(([voter, suspect]) => {
      if (suspect === imposterId && voter !== imposterId) points[voter] = 100;
    });
  } else if (imposterId) {
    points[imposterId] = 150;
  }
  return { voteCounts, tied, imposterCaught, points };
}
