/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ServerPilot design tokens
        sp: {
          bg:       '#0b0f1a',   // page background
          surface:  '#111827',   // card / panel
          border:   '#1f2937',   // borders
          hover:    '#1e2a3a',   // hover state
          accent:   '#3b82f6',   // primary blue
          success:  '#22c55e',
          warning:  '#f59e0b',
          danger:   '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
