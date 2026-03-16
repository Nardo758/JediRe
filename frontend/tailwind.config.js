/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        terminal: {
          bg:     '#0A0E17',
          panel:  '#0F1319',
          header: '#1A1F2E',
          hover:  '#1E2538',
          active: '#252D40',
        },
        't-amber':  '#F5A623',
        't-green':  '#00D26A',
        't-red':    '#FF4757',
        't-cyan':   '#00BCD4',
        't-purple': '#A78BFA',
      },
      fontFamily: {
        mono:    ["'JetBrains Mono'", "'Fira Code'", "'SF Mono'", 'monospace'],
        display: ["'IBM Plex Mono'", 'monospace'],
        label:   ["'IBM Plex Sans'", 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
