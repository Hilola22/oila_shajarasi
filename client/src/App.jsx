import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import { fullName } from './utils.js';
import { Logo, Modal } from './components/common.jsx';
import Login from './components/Login.jsx';
import Tree from './components/Tree.jsx';
import MemberList from './components/MemberList.jsx';
import MemberDetails from './components/MemberDetails.jsx';
import MemberForm from './components/MemberForm.jsx';
import BirthdayCalendar from './components/BirthdayCalendar.jsx';
import AdminUsers from './components/AdminUsers.jsx';
import Account from './components/Account.jsx';

const TABS = [
  { id: 'tree', label: 'Daraxt' },
  { id: 'list', label: "A'zolar" },
  { id: 'calendar', label: "Tug'ilgan kunlar" },
  { id: 'admin', label: 'Foydalanuvchilar', adminOnly: true },
];

export default function App() {
  const [meta, setMeta] = useState(null);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState('tree');
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(null); // { member?, presets? }
  const [accountOpen, setAccountOpen] = useState(false);
  const [calendarPick, setCalendarPick] = useState([]);
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState('');

  const isAdmin = user?.role === 'admin';

  const toastTimer = useRef(0);
  const showToast = useCallback((text) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3500);
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const { members: list } = await api.members();
      setMembers(list);
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setMembers([]);
    setDetailId(null);
    setForm(null);
    setAccountOpen(false);
    setTab('tree');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await api.meta();
        if (!cancelled) setMeta(m);
      } catch {
        /* meta ixtiyoriy */
      }
      if (getToken()) {
        try {
          const { user: me } = await api.me();
          if (cancelled) return;
          setUser(me);
          await loadMembers();
        } catch {
          setToken(null);
        }
      }
      if (!cancelled) setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMembers]);

  async function handleLoggedIn(me) {
    setUser(me);
    await loadMembers();
  }

  const detailMember = members.find((m) => m.id === detailId) || null;

  function openForm(next) {
    setDetailId(null);
    setForm(next);
  }

  function addChild(parent) {
    const preset =
      parent.gender === 'erkak'
        ? { father_id: parent.id, mother_id: parent.spouse_id }
        : { mother_id: parent.id, father_id: parent.spouse_id };
    openForm({ presets: preset });
  }

  function addSpouse(person) {
    openForm({ presets: { spouse_id: person.id, gender: person.gender === 'erkak' ? 'ayol' : 'erkak' } });
  }

  async function handleSaved(saved, wasEdit) {
    await loadMembers();
    setForm(null);
    setDetailId(saved.id);
    showToast(wasEdit ? `${fullName(saved)} yangilandi` : `${fullName(saved)} qo'shildi`);
  }

  async function handleDelete(member) {
    await api.deleteMember(member.id);
    await loadMembers();
    setDetailId(null);
    showToast(`${fullName(member)} o'chirildi`);
  }

  function openCalendarFor(member) {
    setCalendarPick([member.id]);
    setDetailId(null);
    setTab('calendar');
  }

  if (booting) {
    return (
      <div className="boot">
        <Logo size={56} />
      </div>
    );
  }

  if (!user) return <Login meta={meta} onLoggedIn={handleLoggedIn} />;

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo size={38} />
          <div>
            <strong>{meta?.app_name || 'Nasl Daraxti'}</strong>
            <span>Oila shajarasi</span>
          </div>
        </div>
        <nav className="tabs" aria-label="Bo'limlar">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'is-active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="userbox">
          <button type="button" className="user-chip" onClick={() => setAccountOpen(true)} title="Hisob sozlamalari">
            <span>{user.full_name}</span>
            <span className={`chip ${isAdmin ? 'chip-gold' : ''}`}>{isAdmin ? 'Admin' : "A'zo"}</span>
          </button>
          <button type="button" className="btn btn-small" onClick={logout}>
            Chiqish
          </button>
        </div>
      </header>

      <main className="content">
        {loadError && (
          <p className="error-note" role="alert">
            {loadError}
          </p>
        )}

        {tab === 'tree' && (
          <Tree members={members} onSelect={setDetailId} canEdit={isAdmin} onAdd={() => openForm({})} />
        )}
        {tab === 'list' && (
          <MemberList members={members} onSelect={setDetailId} canEdit={isAdmin} onAdd={() => openForm({})} />
        )}
        {tab === 'calendar' && <BirthdayCalendar members={members} preselected={calendarPick} />}
        {tab === 'admin' && isAdmin && <AdminUsers currentUser={user} />}
      </main>

      <footer className="footer">
        Loyiha egasi: <strong>{meta?.owner_name}</strong> · {meta?.app_name || 'Nasl Daraxti'}
      </footer>

      {isAdmin && tab === 'tree' && members.length > 0 && (
        <button type="button" className="fab" onClick={() => openForm({})} aria-label="A'zo qo'shish">
          +
        </button>
      )}

      {detailMember && (
        <Modal title="Oila a'zosi" onClose={() => setDetailId(null)}>
          <MemberDetails
            member={detailMember}
            members={members}
            canEdit={isAdmin}
            onSelect={setDetailId}
            onEdit={(m) => openForm({ member: m })}
            onAddChild={addChild}
            onAddSpouse={addSpouse}
            onDelete={handleDelete}
            onCalendar={openCalendarFor}
          />
        </Modal>
      )}

      {form && isAdmin && (
        <Modal
          title={form.member ? "A'zoni tahrirlash" : "Yangi oila a'zosi"}
          onClose={() => setForm(null)}
          wide
        >
          <MemberForm
            member={form.member}
            presets={form.presets}
            members={members}
            onSaved={handleSaved}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}

      {accountOpen && (
        <Modal title="Hisob sozlamalari" onClose={() => setAccountOpen(false)}>
          <Account user={user} onClose={() => setAccountOpen(false)} />
        </Modal>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
