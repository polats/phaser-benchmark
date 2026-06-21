import type { BenchPerfPayload } from '../../game/events';

type Props = {
  perf: BenchPerfPayload | null;
  done: { capacity: number } | null;
};

// Small always-on overlay showing the live FPS / object count from the active
// bench. When a bench finishes ramping, it shows the measured capacity.
export function PerfHud({ perf, done }: Props) {
  const fps = perf ? perf.fps.toFixed(0) : '—';
  const count = perf ? perf.count.toLocaleString() : '—';
  return (
    <div className="perf panel">
      {`fps    ${fps}\ncount  ${count}`}
      {done ? `\nCAP    ${done.capacity.toLocaleString()}` : ''}
    </div>
  );
}
