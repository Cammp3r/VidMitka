import { supabase } from './supabase';

// Login has no separate password field: the account "secret" is knowing the person's
// full name, which is an accepted trade-off for a small trusted team. Under the hood we
// still need a real Supabase Auth session (so RLS/auth.uid() and cross-device access work),
// so email/password are deterministically derived from the normalized name via SHA-256 —
// the same name always resolves to the same Supabase account.
const EMAIL_DOMAIN = 'vidmitka.local';

const normalizeNamePart = (value) => value.trim().replace(/\s+/g, ' ');

const bytesToHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const hashName = async (fullName) => {
  const data = new TextEncoder().encode(fullName.toLowerCase().normalize('NFKC'));
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return bytesToHex(digest);
};

const deriveCredentials = async (firstName, lastName) => {
  const fullName = `${firstName} ${lastName}`;
  const hash = await hashName(fullName);

  return {
    fullName,
    email: `u${hash.slice(0, 32)}@${EMAIL_DOMAIN}`,
    password: `${hash}-vidmitka`
  };
};

const isUniqueViolation = (error) => error?.code === '23505';

export const findProfileByName = async (firstName, lastName) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .ilike('first_name', firstName)
    .ilike('last_name', lastName)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const registerByName = async (rawFirstName, rawLastName) => {
  if (!supabase) return { ok: false, error: 'Supabase не налаштовано.' };

  const firstName = normalizeNamePart(rawFirstName ?? '');
  const lastName = normalizeNamePart(rawLastName ?? '');
  if (!firstName || !lastName) return { ok: false, error: "Вкажіть ім'я та прізвище." };

  try {
    const existing = await findProfileByName(firstName, lastName);
    if (existing) return { ok: false, error: 'Користувач з таким іменем вже зареєстрований.' };
  } catch (error) {
    return { ok: false, error: error.message };
  }

  const { email, password, fullName } = await deriveCredentials(firstName, lastName);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };

  if (!data.session) {
    return {
      ok: false,
      error: 'Реєстрація не завершена: потрібне підтвердження email. Зверніться до адміністратора застосунку.'
    };
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      user_id: data.session.user.id,
      display_name: fullName,
      first_name: firstName,
      last_name: lastName,
      updated_at: new Date().toISOString()
    });

  if (profileError) {
    if (isUniqueViolation(profileError)) {
      return { ok: false, error: 'Користувач з таким іменем вже зареєстрований.' };
    }
    return { ok: false, error: profileError.message };
  }

  return { ok: true, userId: data.session.user.id, displayName: fullName };
};

export const loginByName = async (rawFirstName, rawLastName) => {
  if (!supabase) return { ok: false, error: 'Supabase не налаштовано.' };

  const firstName = normalizeNamePart(rawFirstName ?? '');
  const lastName = normalizeNamePart(rawLastName ?? '');
  if (!firstName || !lastName) return { ok: false, error: "Вкажіть ім'я та прізвище." };

  const { email, password, fullName } = await deriveCredentials(firstName, lastName);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: 'Такого користувача не знайдено. Перевірте ім’я та прізвище.' };

  return { ok: true, userId: data.session.user.id, displayName: fullName };
};
