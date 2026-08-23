/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06080c',
          900: '#0a0e14',
          850: '#0e1319',
          800: '#121820',
          750: '#171e28',
          700: '#1c2430',
          650: '#222c3a',
          600: '#2a3545',
          500: '#3a4758',
        },
        neon: {
          DEFAULT: '#00e5ff',
          50: '#e0fcff',
          100: '#b8f5ff',
          200: '#81edff',
          300: '#3de5ff',
          400: '#00d4f0',
          500: '#00e5ff',
          600: '#00b8cc',
          700: '#008a99',
          800: '#005c66',
          900: '#002e33',
        },
        accent: {
          DEFAULT: '#00e5ff',
          50: '#e0fcff',
          100: '#b8f5ff',
          200: '#81edff',
          400: '#3de5ff',
          500: '#00e5ff',
          600: '#00b8cc',
          700: '#008a99',
        },
        terminal: {
          green: '#00ff88',
          amber: '#ffb800',
          red: '#ff3b3b',
          bg: '#06080c',
          fg: '#c8d6e5',
        },
        muted: {
          DEFAULT: '#6b7a8d',
          foreground: '#4a5568',
        },
        /* StyleSeed semantic text tokens */
        'text-primary': '#c8d6e5',
        'text-secondary': '#8a9bb0',
        'text-tertiary': '#5a6a7d',
        'text-disabled': '#3a4758',
        /* StyleSeed semantic surface tokens */
        'surface-page': '#06080c',
        'surface-card': '#0e1319',
        'surface-subtle': '#121820',
        'surface-muted': '#1c2430',
        /* StyleSeed semantic UI tokens */
        brand: '#00e5ff',
        destructive: '#ff3b3b',
        success: '#00ff88',
        warning: '#ffb800',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Geist Sans', '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        /* StyleSeed shadow system — max 8% opacity (Rule #12) */
        card: '0 1px 3px rgba(0, 229, 255, 0.03)',
        'card-hover': '0 2px 6px rgba(0, 229, 255, 0.06)',
        elevated: '0 4px 16px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        modal: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        glow: '0 0 0 1px rgba(0, 229, 255, 0.3), 0 0 16px rgba(0, 229, 255, 0.12)',
        'glow-sm': '0 0 0 1px rgba(0, 229, 255, 0.2), 0 0 8px rgba(0, 229, 255, 0.08)',
        'glow-lg': '0 0 0 1px rgba(0, 229, 255, 0.4), 0 0 24px rgba(0, 229, 255, 0.16)',
        'neon-green': '0 0 0 1px rgba(0, 255, 136, 0.3), 0 0 10px rgba(0, 255, 136, 0.12)',
        'neon-amber': '0 0 0 1px rgba(255, 184, 0, 0.3), 0 0 10px rgba(255, 184, 0, 0.12)',
        'neon-red': '0 0 0 1px rgba(255, 59, 59, 0.3), 0 0 10px rgba(255, 59, 59, 0.12)',
        'inner-glow': 'inset 0 1px 0 rgba(0, 229, 255, 0.06), inset 0 0 16px rgba(0, 229, 255, 0.02)',
      },
      borderRadius: {
        /* StyleSeed consistent radius personality */
        card: '16px',
        DEFAULT: '10px',
      },
      animation: {
        'fade-in': 'fadeIn var(--duration-normal, 200ms) var(--ease-default)',
        'slide-up': 'slideUp var(--duration-normal, 200ms) var(--ease-default)',
        'slide-in-left': 'slideInLeft 200ms ease-out',
        'pop-in': 'popIn var(--duration-slow, 350ms) var(--ease-spring)',
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInLeft: { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        popIn: { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        pulseNeon: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0,229,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.02) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-pattern': '24px 24px',
      },
    },
  },
  plugins: [],
};
