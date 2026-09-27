import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#08080a',
        bg2: '#0e0e11',
        surface: '#131316',
        'surface-2': '#1a1a1f',
        accent: '#ff7a3d',
        'accent-2': '#ff6a2b',
        'accent-light': '#2a170e',
        cyan: '#6fdc9a',
        magenta: '#b9c2ff',
        orange: '#ff8a35',
        border: '#1f1f25',
        'border-strong': '#2c2c33',
        text: '#f5f5f7',
        muted: '#a3a3ab',
        faint: '#6b6b74',
      },
      fontFamily: {
        display: ['Geist', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        body: ['Geist', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 12px 40px -10px rgba(255,122,61,.6)',
        'glow-lg': '0 30px 80px -40px rgba(255,122,61,.35)',
        window: '0 50px 120px -30px rgba(0,0,0,1), 0 0 0 1px rgba(255,255,255,.08)',
        card: '0 40px 100px -30px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.04)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(.2,.7,.2,1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
