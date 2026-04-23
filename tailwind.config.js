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
        text: 'var(--tg-text)',
        hint: 'var(--tg-hint)',
        accent: 'var(--tg-accent)',
        success: '#22c55e',
        warn: '#f59e0b',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        pop: '0 8px 24px rgba(0,0,0,0.18)',
      },
    },
  },
  plugins: [],
};
