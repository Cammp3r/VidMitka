export function AdminLoginPanel({ passwordInput, onPasswordChange, onSubmit, error }) {
  return (
    <section className="panel admin-login-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Адмін-панель</span>
          <h2>Вхід для адміністратора</h2>
        </div>
      </div>
      <form className="admin-form" onSubmit={onSubmit}>
        <label>
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            value={passwordInput}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </label>
        {error ? <p className="field-hint error-text">{error}</p> : null}
        <button className="submit-button" type="submit">Увійти</button>
      </form>
    </section>
  );
}
