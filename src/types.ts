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
  /** Id сценария (coffee, film, …) для отрисовки иконки; опционально для старых записей */
  scenarioId?: string;
  winner: Participant;
  participantNames: string[];
  date: string;
  /** Id результата на сервере — для ссылки #result-<serverId> (шеринг, открытие из истории). */
  serverId?: string;
};
