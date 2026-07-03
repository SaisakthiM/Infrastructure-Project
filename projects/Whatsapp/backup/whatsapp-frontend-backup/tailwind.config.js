/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#25D366',
          dark: '#111B21',
          darker: '#0A0E11',
          light: '#F0F2F5',
          lighter: '#FFFFFF',
          gray: '#54656F',
          border: '#E5E7EB',
          bg: '#ECE5DD'
        },
        aurora: {
          900: '#0a0e10',
          800: '#0f1417',
          700: '#161c20',
          600: '#1f2730',
          glass: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.08)',
          mint: '#25D366',
          teal: '#1faa85',
          violet: '#2a9d8f',
          pink: '#1faa85',
          amber: '#25D366'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Helvetica Neue', 'sans-serif']
      },
      backgroundImage: {
        'aurora-gradient': 'radial-gradient(circle at 20% 20%, rgba(37,211,102,0.10), transparent 40%), radial-gradient(circle at 80% 0%, rgba(31,170,133,0.10), transparent 45%), radial-gradient(circle at 50% 100%, rgba(37,211,102,0.06), transparent 50%), linear-gradient(160deg, #0a0e10 0%, #0f1417 50%, #161c20 100%)',
        'btn-gradient': 'linear-gradient(135deg, #25D366 0%, #1faa85 100%)',
        'btn-gradient-hover': 'linear-gradient(135deg, #1faa85 0%, #25D366 100%)',
        'sent-gradient': 'linear-gradient(135deg, #25D366 0%, #1faa85 100%)',
        'shimmer': 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 100%)'
      },
      keyframes: {
        slideIn: {
          from: { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' }
        },
        floatSlow: {
          '0%, 100%': { transform: 'translate(0px, 0px)' },
          '50%': { transform: 'translate(20px, -30px)' }
        },
        floatSlower: {
          '0%, 100%': { transform: 'translate(0px, 0px)' },
          '50%': { transform: 'translate(-30px, 25px)' }
        },
        pulseGlow: {
          '0%, 100%': { opacity: 0.6, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.15)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        }
      },
      animation: {
        'slide-in': 'slideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'float-slow': 'floatSlow 14s ease-in-out infinite',
        'float-slower': 'floatSlower 18s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2.2s linear infinite',
        'gradient-shift': 'gradientShift 8s ease infinite'
      }
    }
  },
  plugins: []
}
