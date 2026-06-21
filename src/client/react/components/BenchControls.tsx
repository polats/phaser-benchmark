import { useEffect, useState } from 'react';
import { EventBus } from '../../game/EventBus';
import { GameEvents, type ShaderChangedPayload } from '../../game/events';
import { FILTER_NAMES } from '../../game/benches/FiltersBench';
import { TEXT_MODE_NAMES } from '../../game/benches/TextBench';
import { SHADER_OPTIONS } from '../../game/demos/ShaderDemo';

type Props = {
  activeKey: string | null;
};

// Per-scene control panel rendered over the canvas. Only the FiltersBench,
// TextBench, and ShaderDemo expose tunable options today; everything else
// renders nothing.
export function BenchControls({ activeKey }: Props) {
  if (activeKey === 'FiltersBench') return <FilterControls />;
  if (activeKey === 'TextBench') return <TextControls />;
  if (activeKey === 'ShaderDemo') return <ShaderControls />;
  return null;
}

// Pick the text rendering mode the TextBench ramps. Changing it restarts the
// measurement (see TextBench.onMode).
function TextControls() {
  const [active, setActive] = useState(0);

  const select = (index: number) => {
    setActive(index);
    EventBus.emit(GameEvents.TextMode, { index });
  };

  return (
    <div className="bench-controls panel">
      <span className="bench-controls__title">Text mode</span>
      <div className="bench-controls__items">
        {TEXT_MODE_NAMES.map((name, i) => (
          <button
            key={name}
            className={i === active ? 'on' : undefined}
            onClick={() => select(i)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// Toggle which filter types the FiltersBench stacks while ramping. Changing the
// set restarts the measurement (see FiltersBench.onConfig).
function FilterControls() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(FILTER_NAMES));

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      EventBus.emit(GameEvents.FiltersConfig, { filters: [...next] });
      return next;
    });
  };

  return (
    <div className="bench-controls panel">
      <span className="bench-controls__title">Filters to stack</span>
      <div className="bench-controls__items">
        {FILTER_NAMES.map((name) => (
          <button
            key={name}
            className={selected.has(name) ? 'on' : undefined}
            onClick={() => toggle(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

// Pick exactly one shader for the ShaderDemo. Stays in sync with tap-to-cycle on
// the canvas via the ShaderChanged event.
function ShaderControls() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onChanged = (p: ShaderChangedPayload) => setActive(p.index);
    EventBus.on(GameEvents.ShaderChanged, onChanged);
    return () => {
      EventBus.off(GameEvents.ShaderChanged, onChanged);
    };
  }, []);

  const select = (index: number) => {
    setActive(index);
    EventBus.emit(GameEvents.ShaderSelect, { index });
  };

  return (
    <div className="bench-controls panel">
      <span className="bench-controls__title">Shader</span>
      <div className="bench-controls__items">
        {SHADER_OPTIONS.map((opt, i) => (
          <button
            key={opt.name}
            className={i === active ? 'on' : undefined}
            title={opt.heavy ? 'Heavy — fillrate stress' : undefined}
            onClick={() => select(i)}
          >
            {opt.name}
            {opt.heavy ? ' ⚡' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
