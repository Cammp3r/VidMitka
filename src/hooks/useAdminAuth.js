import { useState } from 'react';
import { adminStorageKey } from '../lib/constants';

// Note: VITE_* env vars are baked into the public bundle at build time, so this password
// gate only hides the /admin UI from casual visitors — it is not a real access control
// (anyone can read it out of the shipped JS). See project notes for the right long-term fix
// (real Supabase auth + role-restricted RLS policies instead of a shared client-side password).
export const useAdminAuth = () => {
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD ?? '';
  const [isUnlocked, setIsUnlocked] = useState(() => window.localStorage.getItem(adminStorageKey) === 'unlocked');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');

  const login = (event) => {
    event.preventDefault();

    if (!adminPassword) {
      setError('Пароль адміністратора ще не налаштований.');
      return;
    }

    if (passwordInput === adminPassword) {
      window.localStorage.setItem(adminStorageKey, 'unlocked');
      setIsUnlocked(true);
      setPasswordInput('');
      setError('');
      return;
    }

    setError('Невірний пароль.');
  };

  const logout = () => {
    window.localStorage.removeItem(adminStorageKey);
    setIsUnlocked(false);
  };

  return { adminPassword, isUnlocked, passwordInput, setPasswordInput, error, login, logout };
};
