import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { LOTTIE_THINKING, LOTTIE_CELEBRATION, CHOOSING_REVEAL_DURATION } from '../constants';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
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
    fetchWithTimeout(LOTTIE_THINKING, { timeout: 5000 })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setThinkingData(data); })
      .catch((err) => {
        console.error('Failed to load thinking animation:', err);
      });
    fetchWithTimeout(LOTTIE_CELEBRATION, { timeout: 5000 })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setCelebrationData(data); })
      .catch((err) => {
        console.error('Failed to load celebration animation:', err);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (phase !== 'reveal' || !winner) return;
    const t = setTimeout(onRevealEnd, CHOOSING_REVEAL_DURATION);
    return () => clearTimeout(t);
  }, [phase, winner, onRevealEnd]);

  if (!visible) return null;

  const isReveal = phase === 'reveal';

  const revealSize = 'min(200px, 55vw)';
  const thinkSize = 'min(180px, 50vw)';
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
        paddingTop: 'max(24px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(24px, env(safe-area-inset-right, 0px))',
        boxSizing: 'border-box',
      }}
    >
      {isReveal ? (
        <>
          <div style={{ width: revealSize, height: revealSize, flexShrink: 0 }}>
            {celebrationData ? (
              <Lottie animationData={celebrationData} loop style={{ width: '100%', height: '100%' }} />
            ) : (
              <div style={{ fontSize: 'min(80px, 20vw)', textAlign: 'center' }}>🎉</div>
            )}
          </div>
          {winner && (
            <p
              style={{
                marginTop: 16,
                fontSize: 'clamp(18px, 5vw, 24px)',
                fontWeight: 600,
                textAlign: 'center',
                color: 'var(--vkui--color_text_primary, #000)',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                paddingLeft: 16,
                paddingRight: 16,
              }}
            >
              {winner.name}
            </p>
          )}
        </>
      ) : (
        <>
          <div style={{ width: thinkSize, height: thinkSize, flexShrink: 0 }}>
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
          <p style={{ marginTop: 16, fontSize: 'clamp(16px, 4vw, 18px)', color: 'var(--vkui--color_text_secondary)' }}>
            Выбираем...
          </p>
        </>
      )}
    </div>
  );
}
