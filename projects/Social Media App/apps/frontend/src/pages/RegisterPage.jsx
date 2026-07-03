import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/common/Loaders';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]       = useState({ username: '', email: '', profile_name: '', password: '', password2: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrors({});
    if (form.password !== form.password2) {
      setErrors({ password2: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      const data = err.response?.data || {};
      setErrors(data);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'username',     label: 'Username',      type: 'text',     placeholder: 'john_doe'      },
    { key: 'profile_name', label: 'Display name',  type: 'text',     placeholder: 'John Doe'      },
    { key: 'email',        label: 'Email',         type: 'email',    placeholder: 'you@email.com'  },
    { key: 'password',     label: 'Password',      type: 'password', placeholder: '8+ characters'  },
    { key: 'password2',    label: 'Confirm password', type: 'password', placeholder: 'Repeat password' },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4 py-10">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-fuchsia-600/8 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
            nexus
          </h1>
          <p className="text-white/30 text-sm mt-2">Create your account</p>
        </div>

        <div className="bg-[#111] border border-white/8 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={submit} className="space-y-3.5">
            {fields.map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  placeholder={placeholder}
                  className={`
                    w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 outline-none transition-all
                    ${errors[key] ? 'border-red-500/50 bg-red-500/5' : 'border-white/8 focus:border-violet-500/50 focus:bg-white/8'}
                  `}
                />
                {errors[key] && (
                  <p className="text-xs text-red-400 mt-1">{Array.isArray(errors[key]) ? errors[key][0] : errors[key]}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Spinner size="sm" />}
              Create account
            </button>
          </form>
        </div>

        <div className="mt-4 bg-[#111] border border-white/8 rounded-2xl p-4 text-center">
          <p className="text-sm text-white/40">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

