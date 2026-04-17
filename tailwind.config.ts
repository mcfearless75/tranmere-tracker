import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        tranmere: {
          blue: '#003087',
          gold: '#D4AF37',
          white: '#FFFFFF',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
