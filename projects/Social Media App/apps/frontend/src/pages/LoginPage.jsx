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
    /* no page fill: city.css paints the paper ground and the district maquette shows through */
    <div className="min-h-screen flex items-center justify-center px-4 py-10 pt-[calc(var(--hud-h)_+_2.5rem)]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24 }}
        className="w-full max-w-sm"
      >
        {/* District identity: plate + wordmark in condensed display, one accent rule (no glow, no gradient) */}
        <div className="text-center mb-8">
          <span className="plate lg mb-4">
            <span className="code">D-06</span>
            <span className="name">Social</span>
          </span>
          <h1 className="display mt-4">nexus</h1>
          <hr className="rule-accent mx-auto" />
          <p className="muted text-cap">Connect with your world — one register for the whole city</p>
        </div>

        <form onSubmit={submit} className="glass mb-4">
          <div className="bd space-y-4">
            {errors.general && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bad text-center text-cap font-medium"
                role="alert"
              >
                {errors.general}
              </motion.p>
            )}

            <label className="field">Username
              <input
                value={form.username}
                onChange={set('username')}
                autoComplete="username"
                placeholder="your_username"
              />
            </label>

            <label className="field">Password
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>

            <button type="submit" className="btn primary block" disabled={loading}>
              {loading && <Spinner size="sm" />}
              Log in
            </button>
          </div>
        </form>

        <div className="glass">
          <div className="bd text-center">
            <p className="muted text-meta">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-city-accent">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
