import type { LeaderboardEntry } from '../../../shared/api';

type Props = {
  entries: LeaderboardEntry[];
  username: string | null;
  bestScore: number;
};

export function Leaderboard({ entries, username, bestScore }: Props) {
  return (
    <div className="leaderboard panel">
      <h3>Leaderboard</h3>
      {entries.length === 0 ? (
        <div style={{ opacity: 0.7 }}>No scores yet</div>
      ) : (
        <ol>
          {entries.map((e) => (
            <li key={e.username} style={e.username === username ? { fontWeight: 700 } : undefined}>
              {e.username} — {e.score.toLocaleString()}
            </li>
          ))}
        </ol>
      )}
      {username ? <div style={{ marginTop: 4, opacity: 0.8 }}>You: {bestScore.toLocaleString()}</div> : null}
    </div>
  );
}
