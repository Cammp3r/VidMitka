import { notificationOffsetOptions } from '../lib/constants';

export function AdminServiceForm({
  form,
  setForm,
  isEditing,
  onSubmit,
  onCancelEdit,
  open,
  onToggle,
  responseOptionsText,
  onResponseOptionsTextChange,
  onSaveResponseOptions,
  notificationOffset,
  onNotificationOffsetChange
}) {
  return (
    <details
      className="admin-settings"
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
    >
      <summary>{isEditing ? 'Редагування служіння' : 'Налаштування служінь'}</summary>

      <form className="admin-form" onSubmit={onSubmit}>
        <label>
          Дата
          <input
            type="date"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </label>
        <label>
          Час
          <input
            type="time"
            value={form.time}
            onChange={(event) => setForm({ ...form, time: event.target.value })}
          />
        </label>
        <label>
          Назва
          <input
            type="text"
            placeholder="Наприклад: молодіжне служіння"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>
        <label>
          Опис
          <textarea
            rows="3"
            placeholder="Коротко про служіння"
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
        <label>
          Служіння команди
          <textarea
            rows="4"
            placeholder="Кожна роль з нового рядка"
            value={form.rolesText}
            onChange={(event) => setForm({ ...form, rolesText: event.target.value })}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.isRecurring}
            onChange={(event) => setForm({ ...form, isRecurring: event.target.checked })}
          />
          Регулярне служіння щотижня
        </label>

        <button className="submit-button" type="submit">
          {isEditing ? 'Зберегти зміни' : 'Додати в розклад'}
        </button>
        {isEditing ? (
          <button className="secondary-button" type="button" onClick={onCancelEdit}>
            Скасувати редагування
          </button>
        ) : null}
      </form>

      <div className="admin-form options-panel">
        <label>
          Варіанти відповідей
          <textarea
            rows="4"
            placeholder="Кожен варіант з нового рядка"
            value={responseOptionsText}
            onChange={(event) => onResponseOptionsTextChange(event.target.value)}
          />
        </label>
        <button className="secondary-button" type="button" onClick={onSaveResponseOptions}>
          Зберегти варіанти відповідей
        </button>
      </div>

      <div className="admin-form options-panel">
        <label>
          Час сповіщення перед служінням (для всіх)
          <select
            value={notificationOffset}
            onChange={(event) => onNotificationOffsetChange(event.target.value)}
          >
            {notificationOffsetOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
}
