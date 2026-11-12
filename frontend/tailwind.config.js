/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0F123B',
        sidebar: '#060B26',
        card: '#0B1233',
        secondary: '#1A1F37',
        accent: '#0075FF',
        cyan: '#21D4FD',
        success: '#01B574',
        warning: '#FFD60A',
        danger: '#FF453A',
        // Aliases para manter compatibilidade com os componentes existentes.
        app: '#0F123B',
        surface: '#1A1F37',
        ink: '#F5F9FF',
        muted: '#A0AEC0',
        line: '#2A3F59',
        text: {
          primary: '#F5F9FF',
          secondary: '#A0AEC0',
        },
        border: 'rgba(178, 205, 237, 0.16)',
        ml: '#FFE600',
        accentSoft: 'rgba(0, 117, 255, 0.16)',
        cyanSoft: 'rgba(100, 210, 255, 0.16)',
        successSoft: 'rgba(1, 181, 116, 0.16)',
        warningSoft: 'rgba(255, 214, 10, 0.15)',
        dangerSoft: 'rgba(255, 69, 58, 0.16)',
        primarySoft: 'rgba(0, 117, 255, 0.16)',
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
