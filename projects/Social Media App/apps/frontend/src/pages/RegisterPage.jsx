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
    /* no page fill: city.css paints the paper ground and the district maquette shows through */
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.24 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="plate lg mb-4">
            <span className="code">D-06</span>
            <span className="name">Social</span>
          </span>
          <h1 className="display mt-4">nexus</h1>
          <hr className="rule-accent mx-auto" />
          <p className="muted text-cap">Create your account</p>
        </div>

        <form onSubmit={submit} className="glass mb-4">
          <div className="bd space-y-3.5">
            {fields.map(({ key, label, type, placeholder }) => (
              <label className="field" key={key}>
                {label}
                <input
                  type={type}
                  value={form[key]}
                  onChange={set(key)}
                  placeholder={placeholder}
                  aria-invalid={Boolean(errors[key]) || undefined}
                />
                {errors[key] && (
                  <ul className="errorlist">
                    <li>{Array.isArray(errors[key]) ? errors[key][0] : errors[key]}</li>
                  </ul>
                )}
              </label>
            ))}

            <button type="submit" className="btn primary block" disabled={loading}>
              {loading && <Spinner size="sm" />}
              Create account
            </button>
          </div>
        </form>

        <div className="glass">
          <div className="bd text-center">
            <p className="muted text-meta">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-city-accent">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
