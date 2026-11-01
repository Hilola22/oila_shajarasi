import { useState } from 'react';
import { api } from '../api.js';
import { ErrorNote } from './common.jsx';

export default function Account({ user, onClose, onDone }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.changePassword(current, next);
      setOk(true);
      setCurrent('');
      setNext('');
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="muted">
        {user.full_name} · {user.email} · {user.role === 'admin' ? 'Admin' : "A'zo"}
      </p>
      <label className="field">
        <span>Joriy parol</span>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </label>
      <label className="field">
        <span>Yangi parol (kamida 8 belgi)</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required autoComplete="new-password" />
      </label>
      <ErrorNote>{error}</ErrorNote>
      {ok && <p className="ok-note">Parol almashtirildi.</p>}
      <div className="actions end">
        <button type="button" className="btn" onClick={onClose}>
          Yopish
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Parolni almashtirish
        </button>
      </div>
    </form>
  );
}
