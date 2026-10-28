/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#050A14',
        sidebar: '#08111F',
        card: '#0D1B2F',
        secondary: '#14263F',
        accent: '#4C9DFF',
        cyan: '#64D2FF',
        success: '#30D158',
        warning: '#FFD60A',
        danger: '#FF453A',
        // Aliases para manter compatibilidade com os componentes existentes.
        app: '#050A14',
        surface: '#14263F',
        ink: '#F5F9FF',
        muted: '#A7B9CE',
        line: '#2A3F59',
        text: {
          primary: '#F5F9FF',
          secondary: '#A7B9CE',
        },
        border: 'rgba(178, 205, 237, 0.16)',
        ml: '#FFE600',
        accentSoft: 'rgba(76, 157, 255, 0.16)',
        cyanSoft: 'rgba(100, 210, 255, 0.16)',
        successSoft: 'rgba(48, 209, 88, 0.16)',
        warningSoft: 'rgba(255, 214, 10, 0.15)',
        dangerSoft: 'rgba(255, 69, 58, 0.16)',
        primarySoft: 'rgba(76, 157, 255, 0.16)',
        secondarySoft: 'rgba(100, 210, 255, 0.16)',
      },
      borderColor: {
        DEFAULT: 'rgba(178, 205, 237, 0.16)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Inter',
          'sans-serif',
        ],
        heading: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Inter',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.4rem',
        '3xl': '1.9rem',
      },
      boxShadow: {
        glass:
          '0 30px 80px -36px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
      },
    },
  },
  plugins: [],
};
