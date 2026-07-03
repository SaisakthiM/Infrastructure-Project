import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error, clearError } = useAuthStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      // Error handled in store
    }
  }

  return (
    <div className="aurora-bg min-h-screen flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo Section */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-btn-gradient shadow-[0_0_40px_rgba(52,232,158,0.45)]"
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg className="w-9 h-9 text-aurora-900" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.086-5.053 5.409-5.053 9.009 0 3.182.824 6.329 2.372 9.019l-2.52 9.021 9.267-3.286c2.592 1.874 5.814 2.777 9.26 2.777h.005c8.242 0 14.288-6.352 14.288-14.29C21.722 7.9 15.675 1.6 7.365 1.6z"/>
            </svg>
          </motion.div>
          <h1 className="text-4xl font-extrabold mb-2 text-gradient">Whisper</h1>
          <p className="text-white/60">Welcome back. Your conversations await.</p>
        </motion.div>

        {/* Login Form */}
        <motion.div
          className="card p-8 space-y-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="input-field"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input-field"
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-400/30 text-red-300 px-4 py-3 rounded-xl text-sm"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-aurora-900/40 border-t-aurora-900 rounded-full animate-spin" />
                  Logging in...
                </span>
              ) : 'Login'}
            </motion.button>
          </form>

          <div className="divider"></div>

          <div className="text-center">
            <p className="text-white/60 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-aurora-mint font-semibold hover:text-aurora-teal transition-colors">
                Register here
              </Link>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
