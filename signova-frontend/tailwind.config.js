/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        signova: {
          ink: '#0f172a',
          muted: '#64748b',
          blue: '#1d4ed8',
          cyan: '#06b6d4',
          mist: '#f5fbff',
        },
      },
      boxShadow: {
        soft: '0 18px 48px rgba(29, 78, 216, 0.10)',
        glass: '0 20px 60px rgba(15, 23, 42, 0.10)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
