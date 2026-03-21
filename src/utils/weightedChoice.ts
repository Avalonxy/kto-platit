import type { Participant } from '../types';
import { getHistory } from './history';

/** Доля шанса у того, кто уже выигрывал (70% понижение = шанс 0.3 от базового) */
const PRIOR_WINNER_WEIGHT = 0.3;

/**
 * Считает, сколько раз каждый participant выигрывал в истории (по id).
 */
async function getWinCountsByParticipantId(): Promise<Map<string, number>> {
  const history = await getHistory();
  const counts = new Map<string, number>();
  for (const item of history) {
    const id = item.winner?.id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Выбирает одного участника с учётом весов: кто уже выигрывал — получает PRIOR_WINNER_WEIGHT (30% шанса).
 * Честный случайный выбор для клиента (Math.random + веса по истории), бэкенд не требуется.
 */
export async function chooseWeightedRandom(participants: Participant[]): Promise<Participant> {
  if (participants.length === 0) throw new Error('participants is empty');
  const winCounts = await getWinCountsByParticipantId();

  const weights = participants.map((p) => {
    const wins = winCounts.get(p.id) ?? 0;
    return wins > 0 ? PRIOR_WINNER_WEIGHT : 1;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;

  for (let i = 0; i < participants.length; i++) {
    r -= weights[i];
    if (r <= 0) return participants[i];
  }

  return participants[participants.length - 1];
}
