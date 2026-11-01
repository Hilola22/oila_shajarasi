import { useState } from 'react';
import { api, setToken } from '../api.js';
import { ErrorNote, Logo } from './common.jsx';

export default function Login({ meta, onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-art" aria-hidden="true">
        <div className="login-art-inner">
          <Logo size={64} />
          <h1>{meta?.app_name || 'Nasl Daraxti'}</h1>
          <p>
            Ajdodlaringiz, bobolaringiz va avlodlaringizni bitta daraxtda saqlang — kelajak avlod ham
            ildizini bilsin.
          </p>
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form card" onSubmit={submit}>
          <h2>Xush kelibsiz</h2>
          <p className="muted">Oila daraxtiga kirish uchun hisobingiz bilan tizimga kiring.</p>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>Parol</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <ErrorNote>{error}</ErrorNote>
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Kirilmoqda…' : 'Kirish'}
          </button>
        </form>
        <p className="owner-credit">Loyiha egasi: {meta?.owner_name}</p>
      </section>
    </main>
  );
}
