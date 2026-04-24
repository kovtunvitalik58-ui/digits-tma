/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'var(--tg-bg)',
        surface: 'var(--tg-surface)',
        'surface-strong': 'var(--tg-surface-strong)',
        border: 'var(--tg-border)',
        text: 'var(--tg-text)',
        hint: 'var(--tg-hint)',
        accent: 'var(--tg-accent)',
        'accent-strong': 'var(--tg-accent-strong)',
        violet: 'var(--tg-violet)',
        success: '#22c55e',
        warn: '#f59e0b',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.28), 0 1px 2px rgba(0,0,0,0.2)',
        pop: '0 18px 44px -12px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.35)',
        glow: '0 12px 36px -8px rgba(129, 140, 248, 0.55)',
      },
    },
  },
  plugins: [],
};
