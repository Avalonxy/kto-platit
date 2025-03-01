export type Participant = {
  id: string;
  name: string;
  photo?: string;
  isFromVk?: boolean;
};

export type Scenario = {
  id: string;
  title: string;
  emoji: string;
  description?: string;
};

export type HistoryItem = {
  id: string;
  scenarioTitle: string;
  scenarioEmoji: string;
  winner: Participant;
  participantNames: string[];
  date: string;
};
