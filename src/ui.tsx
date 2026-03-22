/**
 * Re-export VKUI components with relaxed props to avoid TS2739
 * (conflict between VKUI 4 types and @types/react 18 DOM attributes).
 */
import type { FC, ReactNode, ChangeEvent, KeyboardEvent, CSSProperties } from 'react';
import * as VK from '@vkontakte/vkui';

type OptionalChildren = { children?: ReactNode };

export const AppRoot: FC<OptionalChildren> = VK.AppRoot as FC<OptionalChildren>;
export const SplitLayout: FC<
  OptionalChildren & { popout?: ReactNode; modal?: ReactNode; header?: ReactNode }
> = VK.SplitLayout as FC<any>;
export const SplitCol: FC<OptionalChildren> = VK.SplitCol as FC<OptionalChildren>;
export const View: FC<{ activePanel: string; children?: ReactNode }> = VK.View as FC<{ activePanel: string; children?: ReactNode }>;
export const Tabbar: FC<OptionalChildren> = VK.Tabbar as FC<OptionalChildren>;
export const TabbarItem: FC<{ selected?: boolean; onClick?: () => void; text?: string; children?: ReactNode }> = VK.TabbarItem as FC<{ selected?: boolean; onClick?: () => void; text?: string; children?: ReactNode }>;

export const Panel: FC<{ id: string; children?: ReactNode }> = VK.Panel as FC<{ id: string; children?: ReactNode }>;
export const PanelHeader: FC<{ children?: ReactNode; before?: ReactNode }> = VK.PanelHeader as FC<{ children?: ReactNode; before?: ReactNode }>;
export const Group: FC<{ header?: ReactNode; children?: ReactNode; description?: string }> = VK.Group as FC<{ header?: ReactNode; children?: ReactNode; description?: string }>;
export const Div: FC<{ children?: ReactNode; style?: CSSProperties }> = VK.Div as FC<{ children?: ReactNode; style?: CSSProperties }>;
export const Header: FC<{ mode?: string; children?: ReactNode; size?: string }> = VK.Header as FC<{ mode?: string; children?: ReactNode; size?: string }>;
export const SimpleCell: FC<{
  children?: ReactNode; key?: string; before?: ReactNode; after?: ReactNode; subtitle?: string;
  onClick?: () => void; selected?: boolean;
}> = VK.SimpleCell as FC<any>;
export const Button: FC<{
  children?: ReactNode; size?: 'l' | 'm' | 's'; stretched?: boolean; mode?: string;
  disabled?: boolean; loading?: boolean; onClick?: () => void; before?: ReactNode;
}> = VK.Button as FC<any>;
export const Avatar: FC<{ size?: number; src?: string; children?: ReactNode; style?: CSSProperties }> = VK.Avatar as FC<any>;
export const Input: FC<{
  placeholder?: string; value?: string;
  disabled?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  status?: string;
  bottom?: string;
  maxLength?: number;
}> = VK.Input as FC<any>;
export const IconButton: FC<{
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}> = VK.IconButton as FC<any>;
export const CellButton: FC<{ children?: ReactNode; onClick?: () => void; disabled?: boolean }> = VK.CellButton as FC<any>;
export const FixedLayout: FC<{ filled?: boolean; vertical?: string; children?: ReactNode }> = VK.FixedLayout as FC<any>;
export const Spacing: FC<{ size?: number }> = VK.Spacing as FC<any>;
export const ModalRoot: FC<{ activeModal?: string; onClose?: () => void; children?: ReactNode }> = VK.ModalRoot as FC<any>;
export const ModalPage: FC<{ id: string; onClose?: () => void; settlingHeight?: number; children?: ReactNode }> = VK.ModalPage as FC<any>;
export const ModalPageHeader: FC<{ children?: ReactNode }> = VK.ModalPageHeader as FC<OptionalChildren>;
export const Spinner: FC<{ size?: string }> = VK.Spinner as FC<any>;
export const Checkbox: FC<{ checked?: boolean; onChange?: () => void }> = VK.Checkbox as FC<any>;
/** Alert для popout у SplitLayout (подтверждения, не window.confirm во WebView). */
export const Alert: FC<{
  actions?: Array<{
    title: string;
    mode: 'cancel' | 'destructive' | 'default';
    autoclose?: boolean;
    action?: () => void;
  }>;
  header?: ReactNode;
  text?: ReactNode;
  onClose?: () => void;
  actionsLayout?: 'vertical' | 'horizontal';
  dismissLabel?: string;
}> = VK.Alert as FC<any>;

export const ConfigProvider: FC<OptionalChildren & { appearance?: 'light' | 'dark' }> =
  VK.ConfigProvider as FC<OptionalChildren & { appearance?: 'light' | 'dark' }>;
export const AdaptivityProvider: FC<OptionalChildren> = VK.AdaptivityProvider as FC<OptionalChildren>;
