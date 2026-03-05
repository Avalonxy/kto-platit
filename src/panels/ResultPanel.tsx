import { Panel, PanelHeader, Header, Group, Div, Button, Avatar } from '../ui';
import { Icon24ShareOutline } from '@vkontakte/icons';
import bridge from '@vkontakte/vk-bridge';
import type { Participant, Scenario } from '../types';

type ResultData = {
  scenario: Scenario;
  winner: Participant;
  participants: Participant[];
} | null;

type Props = {
  id: string;
  result: ResultData;
  onBack: () => void;
};

const CTA = '\n\n———\n\nКто следующий? Решайте споры без споров — мини-приложение «Кто платит?»: друзья из VK, один тап, честный жребий. Попробуй 👇';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildShareMessage(
  scenario: Scenario,
  winner: Participant,
  participants: Participant[],
): string {
  const names = participants.map((p) => p.name).join(', ');
  const id = scenario.id;

  if (id === 'coffee') {
    const variants = [
      `☕ Кофейная рулетка крутилась — и судьба указала на того, кто сегодня раскошелится за капучино!\n\nПоздравляем: ${winner.name} 🎉\n\nВ игре были: ${names}`,
      `☕ Кто платит за кофе? Жребий сказал: ${winner.name} — сегодня капучино на него!\n\nВ кругу: ${names}`,
      `☕ Рулетка раскрутилась — платёж за кофе падает на ${winner.name}. Остальным только радоваться 😄\n\nУчастники: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'film') {
    const variants = [
      `🎬 Кинорулетка вынесла вердикт: выбор фильма на вечер в надёжных руках!\n\nСегодня за контентом следит: ${winner.name}\n\nУчастники голосования: ${names}`,
      `🎬 Кто выбирает фильм? Судьба указала: ${winner.name} — вечерний плейлист в надёжных руках!\n\nВ команде: ${names}`,
      `🎬 Жребий решён: за вечерний контент отвечает ${winner.name}. Остальным — расслабиться и смотреть.\n\nУчастники: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'driver') {
    const variants = [
      `🚙 Ключи от руля вручены судьбой! Сегодня за рулём — ${winner.name}.\n\nОстальным — расслабиться и наслаждаться видом из окна.\n\nВ машине: ${names}`,
      `🚙 Кто за рулём? Жребий выпал на ${winner.name} — ключи его, остальные в пассажиры!\n\nВ поездке: ${names}`,
      `🚙 Рулетка решила: за руль садится ${winner.name}. Остальным — удобно устроиться и наслаждаться дорогой.\n\nВ машине: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'duty') {
    const variants = [
      `📌 Дежурный назначен честным жребием. Сегодня в ответе за порядок — ${winner.name}!\n\nСостав: ${names}`,
      `📌 Кто дежурит? Жребий указал: ${winner.name} — сегодня он у руля порядка!\n\nВ команде: ${names}`,
      `📌 Рулетка выпала: дежурный на сегодня — ${winner.name}. Остальным можно расслабиться 😄\n\nСостав: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'order') {
    const variants = [
      `🍽️ Голодные желудки доверили заказ одному человеку. Кто у руля меню? ${winner.name}!\n\nЖдали решения: ${names}`,
      `🍽️ Кто заказывает еду? Жребий сказал: ${winner.name} — меню в его руках!\n\nВ кругу: ${names}`,
      `🍽️ Судьба указала на шефа вечера: ${winner.name} выбирает, что едим. Остальным — только аппетит нагуливать 😄\n\nУчастники: ${names}`,
    ];
    return pick(variants) + CTA;
  }
  if (id === 'music') {
    const variants = [
      `🎧 Диджей на вечер выбран! Пульт и плейлист в руках у ${winner.name}.\n\nВ команде: ${names}`,
      `🎧 Кто ставит музыку? Рулетка указала: ${winner.name} — пульт его, уши наши!\n\nУчастники: ${names}`,
      `🎧 Жребий выпал: за саундтрек вечера отвечает ${winner.name}. Остальным — только слушать и кайфовать.\n\nВ команде: ${names}`,
    ];
    return pick(variants) + CTA;
  }

  // custom или неизвестный id — подбираем текст по ключевым словам в названии
  const title = scenario.title.toLowerCase();

  if (/\b(платит|оплач|кофе|капучино|счёт|раскошел|деньги|скинуться)\b/.test(title)) {
    return (
      `💰 Жеребьёвка по финансам: «${scenario.title}»\n\n` +
      `Судьба указала: сегодня платит ${winner.name}!\n\n` +
      `В кругу: ${names}` + CTA
    );
  }
  if (/\b(фильм|кино|сериал|контент|смотреть)\b/.test(title)) {
    return (
      `🎬 «${scenario.title}» — рулетка крутилась, выбор сделан!\n\n` +
      `За контентом сегодня следит: ${winner.name}\n\n` +
      `Участники: ${names}` + CTA
    );
  }
  if (/\b(рул|водитель|машин|за рулём|езд)\b/.test(title)) {
    return (
      `🚗 «${scenario.title}» — ключи вручены!\n\n` +
      `За рулём: ${winner.name}. Остальным — в пассажиры.\n\n` +
      `В поездке: ${names}` + CTA
    );
  }
  if (/\b(дежур|уборк|порядок|ответствен|дежурит)\b/.test(title)) {
    return (
      `📌 «${scenario.title}» — жребий выпал!\n\n` +
      `Сегодня в ответе: ${winner.name}\n\n` +
      `Состав: ${names}` + CTA
    );
  }
  if (/\b(еда|заказ|пицц|суши|меню|заказывает|доставк)\b/.test(title)) {
    return (
      `🍽️ «${scenario.title}» — голодные желудки сказали своё!\n\n` +
      `У руля меню: ${winner.name}\n\n` +
      `Ждали: ${names}` + CTA
    );
  }
  if (/\b(музык|плейлист|диджей|ставит музыку|саундтрек)\b/.test(title)) {
    return (
      `🎧 «${scenario.title}» — пульт вручён!\n\n` +
      `Плейлист ведёт: ${winner.name}\n\n` +
      `В команде: ${names}` + CTA
    );
  }
  if (/\b(идёт|идти|пойдёт|поход|выбираем кто)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — жребий брошен!\n\n` +
      `Идёт: ${winner.name}\n\n` +
      `Претенденты: ${names}` + CTA
    );
  }
  if (/\b(первый|начинает|начнёт|старт)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — рулетка решила!\n\n` +
      `Первым будет: ${winner.name}\n\n` +
      `Участники: ${names}` + CTA
    );
  }
  if (/\b(рассказ|историю|скажет|говорит)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — слово дано!\n\n` +
      `Рассказывает: ${winner.name}\n\n` +
      `Слушатели: ${names}` + CTA
    );
  }
  if (/\b(игра|игрок|ходит|ход)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — жребий выпал!\n\n` +
      `В игре побеждает: ${winner.name}\n\n` +
      `Играли: ${names}` + CTA
    );
  }
  if (/\b(позвонит|звонок|связь|напишет)\b/.test(title)) {
    return (
      `📱 «${scenario.title}» — судьба указала!\n\n` +
      `Этому человеку звонить/писать: ${winner.name}\n\n` +
      `В списке: ${names}` + CTA
    );
  }
  if (/\b(выбирает|выбор|решает)\b/.test(title)) {
    return (
      `${scenario.emoji} «${scenario.title}» — решение принято!\n\n` +
      `Выбирает: ${winner.name}\n\n` +
      `Участники: ${names}` + CTA
    );
  }

  // Любой другой случай — креативный универсальный шаблон
  return (
    `${scenario.emoji} Жеребьёвка: «${scenario.title}»\n\n` +
    `Победитель: ${winner.name} 🎉\n\n` +
    `Участники: ${names}` + CTA
  );
}

export function ResultPanel({ id, result, onBack }: Props) {
  if (!result) {
    return (
      <Panel id={id}>
        <PanelHeader>Результат</PanelHeader>
        <Div>Нет данных</Div>
        <Button size="l" stretched onClick={onBack}>
          Назад
        </Button>
      </Panel>
    );
  }

  const { scenario, winner, participants } = result;
  const shareMessage = buildShareMessage(scenario, winner, participants);

  const handleShare = () => {
    bridge.send('VKWebAppShowWallPostBox', {
      message: shareMessage,
      attachments: window.location.href,
    }).catch(() => {});
  };

  return (
    <Panel id={id}>
      <PanelHeader before={<Button onClick={onBack}>Назад</Button>}>
        Результат
      </PanelHeader>

      <Group header={<Header mode="secondary">{scenario.emoji} {scenario.title}</Header>}>
        <Div style={{ textAlign: 'center' }}>
          <Avatar size={96} style={{ margin: '0 auto 12px' }}>
            {winner.name[0]}
          </Avatar>
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <Header mode="primary">{winner.name}</Header>
          </div>
          <p style={{ color: 'var(--vkui--color_text_secondary)', marginTop: 4, textAlign: 'center' }}>
            Участники: {participants.map((p) => p.name).join(', ')}
          </p>
        </Div>
        <Div>
          <Button
            size="l"
            stretched
            before={<Icon24ShareOutline />}
            onClick={handleShare}
          >
            Поделиться в VK
          </Button>
        </Div>
        <Div>
          <Button size="l" stretched mode="secondary" onClick={onBack}>
            Ещё раз
          </Button>
        </Div>
      </Group>
    </Panel>
  );
}
