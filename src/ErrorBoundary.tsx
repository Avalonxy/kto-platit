import { Component, type ErrorInfo, type ReactNode } from 'react';
import bridge from '@vkontakte/vk-bridge';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * При ошибке в дереве (в т.ч. в клиенте VK на Android) сразу скрываем экран загрузки VK,
 * иначе возможна бесконечная загрузка.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    try {
      (bridge.send as (method: string) => Promise<unknown>)('VKWebAppReady').catch(() => {});
    } catch {
      // bridge недоступен
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          <p style={{ margin: 0, fontSize: 16, color: '#333' }}>
            Что-то пошло не так. Закройте приложение и откройте снова.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
