/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0a0a0c',
        surface: '#131316',
        elevated: '#1c1c20',
        border: '#2a2a2f',
        primary: '#7dd3c0',
        accentA: '#7dd3c0',
        accentB: '#e8a87c',
        muted: '#8b8b93',
        ink: '#f2f2f0',
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.35)',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseSoft: 'pulseSoft 2s ease-in-out infinite',
        fadeUp: 'fadeUp 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
