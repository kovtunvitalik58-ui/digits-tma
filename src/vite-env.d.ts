/// <reference types="vite/client" />

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
}

interface TelegramInitDataUnsafe {
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: { id: number; type: string; title?: string; username?: string };
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date?: number;
  hash?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramInitDataUnsafe;
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    setItem: (key: string, value: string, cb?: (err: string | null, ok: boolean) => void) => void;
    getItem: (key: string, cb: (err: string | null, value: string) => void) => void;
    getItems: (keys: string[], cb: (err: string | null, values: Record<string, string>) => void) => void;
    removeItem: (key: string, cb?: (err: string | null, ok: boolean) => void) => void;
    getKeys: (cb: (err: string | null, keys: string[]) => void) => void;
  };
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    setText: (t: string) => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  switchInlineQuery?: (query: string, chatTypes?: Array<'users' | 'bots' | 'groups' | 'channels'>) => void;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
}
