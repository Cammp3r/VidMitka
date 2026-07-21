import { useState } from 'react';

export function NameAuthForm({ onRegister, onLogin }) {
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setPending(true);

    const action = mode === 'register' ? onRegister : onLogin;
    const result = await action(firstName, lastName);

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFirstName('');
    setLastName('');
  };

  return (
    <div className="name-auth">
      <div className="mode-switcher">
        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => switchMode('login')}
        >
          Вхід
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => switchMode('register')}
        >
          Реєстрація
        </button>
      </div>

      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Ім'я
          <input
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label>
          Прізвище
          <input
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>
        {error ? <p className="field-hint error-text">{error}</p> : null}
        <button className="submit-button" type="submit" disabled={pending}>
          {pending ? 'Зачекайте...' : mode === 'register' ? 'Зареєструватися' : 'Увійти'}
        </button>
      </form>
    </div>
  );
}
