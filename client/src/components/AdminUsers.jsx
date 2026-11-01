import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorNote } from './common.jsx';

const ROLE_LABEL = { admin: 'Admin', member: "A'zo (faqat ko'rish)" };

export default function AdminUsers({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'member' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { users: list } = await api.users();
      setUsers(list);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createUser(form);
      setForm({ full_name: '', email: '', password: '', role: 'member' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(user, role) {
    setError('');
    try {
      await api.updateUser(user.id, { role });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(user) {
    if (!window.confirm(`${user.full_name} hisobini o'chirasizmi?`)) return;
    setError('');
    try {
      await api.deleteUser(user.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="admin-layout">
      <div className="card pad">
        <h3>Foydalanuvchilar</h3>
        <ErrorNote>{error}</ErrorNote>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ism-familiya</th>
                <th>Email</th>
                <th>Rol</th>
                <th aria-label="Amallar" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.full_name} {u.id === currentUser.id && <span className="chip">Siz</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      aria-label={`${u.full_name} roli`}
                    >
                      {Object.entries(ROLE_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="right">
                    {u.id !== currentUser.id && (
                      <button type="button" className="btn btn-ghost-danger" onClick={() => remove(u)}>
                        O'chirish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <form className="card pad form" onSubmit={create}>
        <h3>Yangi foydalanuvchi</h3>
        <p className="muted">
          «Admin» oila a'zolarini qo'shadi va tahrirlaydi. «A'zo» daraxtni faqat ko'ra oladi.
        </p>
        <label className="field">
          <span>Ism-familiya</span>
          <input value={form.full_name} onChange={set('full_name')} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} required />
        </label>
        <label className="field">
          <span>Parol (kamida 8 belgi)</span>
          <input type="password" value={form.password} onChange={set('password')} minLength={8} required autoComplete="new-password" />
        </label>
        <label className="field">
          <span>Rol</span>
          <select value={form.role} onChange={set('role')}>
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Qo\'shilmoqda…' : "Foydalanuvchi qo'shish"}
        </button>
      </form>
    </section>
  );
}
