/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          card: 'var(--color-card)',
          cardHover: 'var(--color-card-hover)',
          border: 'var(--color-border)',
          text: 'var(--color-text)',
          muted: 'var(--color-muted)',
          subtle: 'var(--color-subtle)',
          accent: 'var(--color-accent)',
          accentHover: 'var(--color-accent-hover)',
          accentMuted: 'var(--color-accent-muted)',
          highlight: 'var(--color-highlight)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 0 20px -3px var(--color-accent-glow)',
        'glow-card': '0 8px 30px -10px var(--color-card-shadow)',
      }
    },
  },
  plugins: [],
}
