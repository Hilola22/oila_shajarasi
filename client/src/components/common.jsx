import { useEffect } from 'react';
import { initials } from '../utils.js';

export function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <path d="M32 54V30" stroke="#f4e9d0" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 40l-10-8M32 36l10-8" stroke="#f4e9d0" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="32" cy="22" r="8" fill="#e3a21a" />
      <circle cx="19" cy="29" r="6" fill="#f4e9d0" />
      <circle cx="45" cy="25" r="6" fill="#f4e9d0" />
    </svg>
  );
}

export function Avatar({ member, size = 'md' }) {
  const cls = `avatar avatar-${size} ${member.gender === 'ayol' ? 'is-female' : 'is-male'}`;
  if (member.photo_url) {
    return <img className={cls} src={member.photo_url} alt="" loading="lazy" referrerPolicy="no-referrer" />;
  }
  return (
    <span className={cls} aria-hidden="true">
      {initials(member)}
    </span>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Yopish">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p className="error-note" role="alert">
      {children}
    </p>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
