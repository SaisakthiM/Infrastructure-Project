import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/common/Loaders';
import { toast } from 'react-toastify';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (!form.username || !form.password) {
      setErrors({ general: 'Please fill in all fields' });
      return;
    }
    setLoading(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (data?.non_field_errors) setErrors({ general: data.non_field_errors[0] });
      else setErrors({ general: 'Invalid username or password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
            nexus
          </h1>
          <p className="text-white/30 text-sm mt-2">Connect with your world</p>
        </div>

        {/* Form */}
        <div className="bg-[#111] border border-white/8 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={submit} className="space-y-4">
            {errors.general && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-center"
              >
                {errors.general}
              </motion.p>
            )}

            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Username</label>
              <input
                value={form.username}
                onChange={set('username')}
                autoComplete="username"
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
                placeholder="your_username"
              />
            </div>

            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete="current-password"
                className="w-full bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Spinner size="sm" />}
              Log in
            </button>
          </form>
        </div>

        {/* Register link */}
        <div className="mt-4 bg-[#111] border border-white/8 rounded-2xl p-4 text-center">
          <p className="text-sm text-white/40">
            Don't have an account?{' '}
            <Link to="/register" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

