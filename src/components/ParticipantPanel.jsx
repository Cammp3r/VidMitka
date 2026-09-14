import { NameAuthForm } from './NameAuthForm';

export function ParticipantPanel({
  useAccounts,
  isNamedAccount,
  participantName,
  onNameChange,
  onRegister,
  onLogin,
  onLogout,
  roles,
  preferredRole,
  onPreferredRoleChange,
  canVote,
  showPushToggle,
  pushSubscribed,
  pushStatus,
  onTogglePush
}) {
  return (
    <section className="panel compact-panel">
      {useAccounts ? (
        isNamedAccount ? (
          <div className="panel-head">
            <span>
              Ви увійшли як <strong>{participantName}</strong>
            </span>
            <button type="button" className="secondary-button small-button" onClick={onLogout}>
              Вийти
            </button>
          </div>
        ) : (
          <NameAuthForm onRegister={onRegister} onLogin={onLogin} />
        )
      ) : (
        <label className="inline-field">
          Ваше ім'я
          <input
            type="text"
            placeholder="Наприклад: Андрій"
            value={participantName}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
      )}
      <label className="inline-field role-picker">
        Моя роль на служінні
        <select value={preferredRole} onChange={(event) => onPreferredRoleChange(event.target.value)} disabled={!canVote}>
          <option value="">Не обирати роль</option>
          {roles.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <span className="field-hint">Вибрана роль автоматично відмітить вас як «Можу бути» на найближчому служінні.</span>
      </label>
      {!canVote ? (
        <p className="field-hint">
          {useAccounts
            ? 'Увійдіть або зареєструйтесь, щоб залишити відповідь.'
            : "Введіть ім'я, щоб залишити відповідь."}
        </p>
      ) : null}
      {showPushToggle ? (
        <>
          <button
            type="button"
            className={pushSubscribed ? 'secondary-button push-toggle active' : 'secondary-button push-toggle'}
            onClick={onTogglePush}
          >
            {pushSubscribed ? 'Сповіщення увімкнено · вимкнути' : 'Увімкнути сповіщення'}
          </button>
          {pushStatus ? <p className="field-hint">{pushStatus}</p> : null}
        </>
      ) : null}
    </section>
  );
}
