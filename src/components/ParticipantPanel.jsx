export function ParticipantPanel({
  participantName,
  onNameChange,
  canVote,
  showPushToggle,
  pushSubscribed,
  pushStatus,
  onTogglePush
}) {
  return (
    <section className="panel compact-panel">
      <label className="inline-field">
        Ваше ім'я
        <input
          type="text"
          placeholder="Наприклад: Андрій"
          value={participantName}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </label>
      {!canVote ? <p className="field-hint">Введіть ім'я, щоб залишити відповідь.</p> : null}
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
