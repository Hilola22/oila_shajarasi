import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { fullName } from '../utils.js';
import { ErrorNote } from './common.jsx';

const EMPTY = {
  first_name: '',
  last_name: '',
  middle_name: '',
  gender: '',
  birth_date: '',
  death_date: '',
  birth_place: '',
  phone: '',
  occupation: '',
  bio: '',
  photo_url: '',
  father_id: '',
  mother_id: '',
  spouse_id: '',
};

function toForm(member, presets) {
  const base = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) {
    const v = member ? member[key] : presets?.[key];
    base[key] = v === null || v === undefined ? '' : String(v);
  }
  return base;
}

export default function MemberForm({ member, presets, members, onSaved, onCancel }) {
  const [form, setForm] = useState(() => toForm(member, presets));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const editingId = member?.id;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const others = useMemo(() => members.filter((m) => m.id !== editingId), [members, editingId]);
  const fathers = others.filter((m) => m.gender === 'erkak');
  const mothers = others.filter((m) => m.gender === 'ayol');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.gender) {
      setError('Jinsni tanlang');
      return;
    }
    setBusy(true);
    const payload = {};
    for (const [k, v] of Object.entries(form)) payload[k] = v === '' ? null : v;
    for (const k of ['father_id', 'mother_id', 'spouse_id']) {
      payload[k] = payload[k] === null ? null : Number(payload[k]);
    }
    try {
      const { member: saved } = editingId
        ? await api.updateMember(editingId, payload)
        : await api.createMember(payload);
      await onSaved(saved, Boolean(editingId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const options = (list) =>
    list.map((m) => (
      <option key={m.id} value={m.id}>
        {fullName(m)}
        {m.birth_date ? ` (${m.birth_date.slice(0, 4)})` : ''}
      </option>
    ));

  return (
    <form className="form" onSubmit={submit}>
      <div className="grid-2">
        <label className="field">
          <span>Ism *</span>
          <input value={form.first_name} onChange={set('first_name')} required maxLength={60} autoFocus />
        </label>
        <label className="field">
          <span>Familiya</span>
          <input value={form.last_name} onChange={set('last_name')} maxLength={60} />
        </label>
        <label className="field">
          <span>Otasining ismi</span>
          <input value={form.middle_name} onChange={set('middle_name')} maxLength={60} />
        </label>
        <fieldset className="field radio-group">
          <legend>Jinsi *</legend>
          <label>
            <input type="radio" name="gender" value="erkak" checked={form.gender === 'erkak'} onChange={set('gender')} />
            Erkak
          </label>
          <label>
            <input type="radio" name="gender" value="ayol" checked={form.gender === 'ayol'} onChange={set('gender')} />
            Ayol
          </label>
        </fieldset>
        <label className="field">
          <span>Tug'ilgan sana</span>
          <input type="date" value={form.birth_date} onChange={set('birth_date')} min="1000-01-01" />
        </label>
        <label className="field">
          <span>Vafot sanasi</span>
          <input type="date" value={form.death_date} onChange={set('death_date')} min={form.birth_date || '1000-01-01'} />
        </label>
        <label className="field">
          <span>Tug'ilgan joy</span>
          <input value={form.birth_place} onChange={set('birth_place')} maxLength={120} />
        </label>
        <label className="field">
          <span>Kasbi</span>
          <input value={form.occupation} onChange={set('occupation')} maxLength={120} />
        </label>
        <label className="field">
          <span>Telefon</span>
          <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+998 90 123 45 67" maxLength={30} />
        </label>
        <label className="field">
          <span>Rasm havolasi (ixtiyoriy)</span>
          <input type="url" value={form.photo_url} onChange={set('photo_url')} placeholder="https://…" maxLength={500} />
        </label>
      </div>

      <h4 className="form-section">Oilaviy bog'lanishlar</h4>
      <div className="grid-3">
        <label className="field">
          <span>Otasi</span>
          <select value={form.father_id} onChange={set('father_id')}>
            <option value="">— tanlanmagan —</option>
            {options(fathers)}
          </select>
        </label>
        <label className="field">
          <span>Onasi</span>
          <select value={form.mother_id} onChange={set('mother_id')}>
            <option value="">— tanlanmagan —</option>
            {options(mothers)}
          </select>
        </label>
        <label className="field">
          <span>Turmush o'rtog'i</span>
          <select value={form.spouse_id} onChange={set('spouse_id')}>
            <option value="">— yo'q —</option>
            {options(others)}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Qisqacha ma'lumot</span>
        <textarea value={form.bio} onChange={set('bio')} rows={3} maxLength={2000} />
      </label>

      <ErrorNote>{error}</ErrorNote>
      <div className="actions end">
        <button type="button" className="btn" onClick={onCancel}>
          Bekor qilish
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saqlanmoqda…' : editingId ? 'Saqlash' : "Qo'shish"}
        </button>
      </div>
    </form>
  );
}
