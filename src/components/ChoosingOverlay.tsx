import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { LOTTIE_THINKING, LOTTIE_CELEBRATION, CHOOSING_REVEAL_DURATION } from '../constants';
import type { Participant } from '../types';

type Phase = 'thinking' | 'reveal';

type Props = {
  visible: boolean;
  phase: Phase;
  winner: Participant | null;
  onRevealEnd: () => void;
};

export function ChoosingOverlay({ visible, phase, winner, onRevealEnd }: Props) {
  const [thinkingData, setThinkingData] = useState<object | null>(null);
  const [celebrationData, setCelebrationData] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(LOTTIE_THINKING)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setThinkingData(data); })
      .catch(() => {});
    fetch(LOTTIE_CELEBRATION)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setCelebrationData(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (phase !== 'reveal' || !winner) return;
    const t = setTimeout(onRevealEnd, CHOOSING_REVEAL_DURATION);
    return () => clearTimeout(t);
  }, [phase, winner, onRevealEnd]);

  if (!visible) return null;

  const isReveal = phase === 'reveal';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--vkui--color_background_content, #fff)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {isReveal ? (
        <>
          <div style={{ width: 200, height: 200, flexShrink: 0 }}>
            {celebrationData ? (
              <Lottie animationData={celebrationData} loop style={{ width: '100%', height: '100%' }} />
            ) : (
              <div style={{ fontSize: 80, textAlign: 'center' }}>🎉</div>
            )}
          </div>
          {winner && (
            <p
              style={{
                marginTop: 16,
                fontSize: 24,
                fontWeight: 600,
                textAlign: 'center',
                color: 'var(--vkui--color_text_primary, #000)',
              }}
            >
              {winner.name}
            </p>
          )}
        </>
      ) : (
        <>
          <div style={{ width: 180, height: 180, flexShrink: 0 }}>
            {thinkingData ? (
              <Lottie animationData={thinkingData} loop style={{ width: '100%', height: '100%' }} />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 48,
                }}
              >
                ⏳
              </div>
            )}
          </div>
          <p style={{ marginTop: 16, fontSize: 18, color: 'var(--vkui--color_text_secondary)' }}>
            Выбираем...
          </p>
        </>
      )}
    </div>
  );
}
