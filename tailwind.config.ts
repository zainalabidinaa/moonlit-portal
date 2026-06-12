import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090b',
        surface: '#111117',
        'surface-2': '#18181b',
        accent: '#8b5cf6',
        'accent-light': '#2e1065',
        border: '#3f3f46',
        text: '#f4f4f5',
        muted: '#a1a1aa',
      },
    },
  },
  plugins: [],
} satisfies Config;
