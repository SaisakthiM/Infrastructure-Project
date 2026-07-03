export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        compiler: {
          primary: '#0D47A1',
          accent: '#2196F3',
          success: '#4CAF50',
          error: '#F44336',
          warning: '#FF9800',
          dark: '#0F1419',
          darkBg: '#1A1E27',
          cardBg: '#252D38',
          inputBg: '#2A3340',
          border: '#3A4450',
          text: '#E8E8E8',
          textSecondary: '#9BA3AF',
          code: '#1E1E1E'
        }
      },
      fontFamily: {
        mono: ['Fira Code', 'Monaco', 'Courier New', 'monospace']
      }
    }
  },
  plugins: []
}
