/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Dynamic colors used in components
    { pattern: /bg-(emerald|amber|blue|purple|orange|indigo|green|gray|red)-(50|100|300|400|500)/ },
    { pattern: /text-(emerald|amber|blue|purple|orange|indigo|green|gray|red)-(400|500|600|700)/ },
    { pattern: /border-(emerald|amber|blue|purple|orange|indigo|green|gray|red)-(100|200|300)/ },
    { pattern: /hover:bg-(emerald|amber|blue|purple|orange|indigo|green|gray|red)-(50|100)/ },
    { pattern: /hover:border-(emerald|amber|blue|purple|orange|indigo|green|gray|red)-(300)/ },
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        health: {
          green: '#10b981',
          yellow: '#f59e0b',
          orange: '#f97316',
          red: '#ef4444',
        }
      },
    },
  },
  plugins: [],
}
