// Fill in after registering the bot via @BotFather and linking the Mini App.
// - BOT_USERNAME: what comes after t.me/ (no @, no URL)
// - APP_NAME: the "short name" you set when running /newapp in BotFather
//
// These can be overridden by env vars at build time (VITE_BOT_USERNAME, VITE_APP_NAME).
// A deploy without them still works — share just falls back to a naked text message.

export const BOT_USERNAME: string =
  import.meta.env.VITE_BOT_USERNAME || 'digits_bot'; // placeholder
export const APP_NAME: string =
  import.meta.env.VITE_APP_NAME || 'play'; // placeholder

export function hasBotConfig(): boolean {
  return BOT_USERNAME !== 'digits_bot' && !!BOT_USERNAME && !!APP_NAME;
}
