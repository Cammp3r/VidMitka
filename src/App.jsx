import { useEffect, useMemo, useRef, useState } from 'react';

const serviceRolesFallback = ['Камера', 'Звук', 'Медіа'];
const defaultResponseOptions = ['Можу бути', 'Не можу бути', 'Під питанням'];
const dayMs = 24 * 60 * 60 * 1000;

const initialServices = [
  {
    id: 'fri-2026-07-24',
    date: '2026-07-24',
    time: '19:00',
    title: 'Вечірнє служіння',
    note: 'Підготовка команди, звук і трансляція',
    roles: ['Камера', 'Звук', 'Зустрічаючі'],
    isRecurring: true,
    recurringParentId: 'fri-evening',
    createdAt: Date.now(),
    notificationAt: Date.now() + dayMs
  },
  {
    id: 'sun-2026-07-26',
    date: '2026-07-26',
    time: '11:00',
    title: 'Основне служіння',
    note: 'Трансляція та молитовна підтримка',
    roles: ['Камера', 'Презентація', 'Медіа'],
    isRecurring: true,
    recurringParentId: 'sun-main',
    createdAt: Date.now(),
    notificationAt: Date.now() + dayMs
  }
];

const getTodayInputDate = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

const createEmptyForm = () => ({
  id: '',
  date: getTodayInputDate(),
  time: '18:30',
  title: '',
  note: '',
  rolesText: serviceRolesFallback.join('\n'),
  isRecurring: false
});

const formatDateInput = (date) => {
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const getServiceStart = (service) => new Date(`${service.date}T${service.time}`);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getNotificationAt = (isRecurring, createdAt = Date.now()) => createdAt + (isRecurring ? dayMs : 0);

const formatServiceDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(value);
};

const normalizeLines = (text, fallback) => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines : fallback;
};

const sortServices = (items) =>
  [...items].sort((first, second) => `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`));

const createNextRecurringService = (service, now) => {
  let nextStart = addDays(getServiceStart(service), 7);

  while (nextStart <= now) {
    nextStart = addDays(nextStart, 7);
  }

  const parentId = service.recurringParentId || service.id;
  const date = formatDateInput(nextStart);

  return {
    ...service,
    id: `${parentId}-${date}-${service.time}`,
    date,
    recurringParentId: parentId,
    createdAt: now.getTime(),
    notificationAt: getNotificationAt(true, now.getTime())
  };
};

const cleanupServices = (items, currentResponses, now = new Date()) => {
  const nextServices = [];
  const nextResponses = {};
  const usedIds = new Set();

  items.forEach((service) => {
    if (getServiceStart(service) <= now) {
      if (service.isRecurring) {
        const nextService = createNextRecurringService(service, now);

        if (!usedIds.has(nextService.id)) {
          nextServices.push(nextService);
          usedIds.add(nextService.id);
        }
      }

      return;
    }

    nextServices.push(service);
    usedIds.add(service.id);
    if (currentResponses[service.id]) {
      nextResponses[service.id] = currentResponses[service.id];
    }
  });

  return {
    services: sortServices(nextServices),
    responses: nextResponses
  };
};

const getResponseCounts = (roleResponses = {}, options) =>
  options.map((option) => ({
    option,
    count: Object.values(roleResponses).filter((value) => value === option).length
  }));

const getGroupedResponses = (roleResponses = {}, options) =>
  options.map((option) => ({
    option,
    names: Object.entries(roleResponses)
      .filter(([, value]) => value === option)
      .map(([name]) => name)
      .sort((first, second) => first.localeCompare(second, 'uk'))
  }));

function App() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mode, setMode] = useState('user');
  const [responses, setResponses] = useState({});
  const [services, setServices] = useState(() => cleanupServices(initialServices, {}).services);
  const [selectedServiceId, setSelectedServiceId] = useState(() => cleanupServices(initialServices, {}).services[0]?.id ?? '');
  const [form, setForm] = useState(createEmptyForm);
  const [participantName, setParticipantName] = useState('');
  const [responseOptions, setResponseOptions] = useState(defaultResponseOptions);
  const [responseOptionsText, setResponseOptionsText] = useState(defaultResponseOptions.join('\n'));
  const [adminDrafts, setAdminDrafts] = useState({});
  const [expandedResults, setExpandedResults] = useState({});
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  });
  const [notifiedServiceIds, setNotifiedServiceIds] = useState(() => new Set(initialServices.map((service) => service.id)));
  const responsesRef = useRef(responses);
  const participantNameRef = useRef('');

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const runCleanup = () => {
      setServices((currentServices) => {
        const cleaned = cleanupServices(currentServices, responsesRef.current);
        setResponses(cleaned.responses);
        setSelectedServiceId((currentSelectedId) => {
          if (cleaned.services.some((service) => service.id === currentSelectedId)) return currentSelectedId;
          return cleaned.services[0]?.id ?? '';
        });
        return cleaned.services;
      });
    };

    runCleanup();
    const timer = window.setInterval(runCleanup, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (notificationPermission !== 'granted') return undefined;

    const checkNotifications = () => {
      const now = Date.now();
      const dueServices = services.filter((service) => (
        service.notificationAt &&
        service.notificationAt <= now &&
        !notifiedServiceIds.has(service.id)
      ));

      if (!dueServices.length) return;

      dueServices.forEach((service) => showServiceNotification(service));
      setNotifiedServiceIds((current) => {
        const next = new Set(current);
        dueServices.forEach((service) => next.add(service.id));
        return next;
      });
    };

    checkNotifications();
    const timer = window.setInterval(checkNotifications, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [notificationPermission, notifiedServiceIds, services]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? services[0],
    [selectedServiceId, services]
  );

  const serviceResponses = selectedService ? responses[selectedService.id] ?? {} : {};
  const isEditing = Boolean(form.id);
  const normalizedParticipantName = participantName.trim();
  const canVote = Boolean(normalizedParticipantName);

  const renameParticipantInResponses = (previousName, nextName) => {
    if (!previousName || !nextName || previousName === nextName) return;

    setResponses((current) => {
      const nextResponses = {};

      Object.entries(current).forEach(([serviceId, roleResponses]) => {
        nextResponses[serviceId] = {};

        Object.entries(roleResponses).forEach(([role, userResponses]) => {
          if (!Object.prototype.hasOwnProperty.call(userResponses, previousName)) {
            nextResponses[serviceId][role] = userResponses;
            return;
          }

          const nextUserResponses = { ...userResponses };
          nextUserResponses[nextName] = nextUserResponses[previousName];
          delete nextUserResponses[previousName];
          nextResponses[serviceId][role] = nextUserResponses;
        });
      });

      return nextResponses;
    });
  };

  const handleParticipantNameChange = (value) => {
    const nextName = value.trim();
    const previousName = participantNameRef.current;

    setParticipantName(value);

    if (nextName) {
      renameParticipantInResponses(previousName, nextName);
      participantNameRef.current = nextName;
    }
  };

  const handleVote = (role, value) => {
    if (!selectedService || !canVote) return;

    setResponses((current) => ({
      ...current,
      [selectedService.id]: {
        ...(current[selectedService.id] ?? {}),
        [role]: {
          ...((current[selectedService.id] ?? {})[role] ?? {}),
          [normalizedParticipantName]: value
        }
      }
    }));
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const showServiceNotification = async (service) => {
    const title = 'Час відповісти за служіння';
    const body = `${service.title}: ${formatServiceDate(service.date)} о ${service.time}. Оберіть, будь ласка, свій варіант.`;
    const options = {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: `service-${service.id}`,
      renotify: true
    };

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification(title, options);
      return;
    }

    new Notification(title, options);
  };

  const handleSaveService = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    const service = {
      id: form.id || crypto.randomUUID(),
      date: form.date,
      time: form.time,
      title: form.title.trim(),
      note: form.note.trim() || 'Без опису',
      roles: normalizeLines(form.rolesText, serviceRolesFallback),
      isRecurring: form.isRecurring,
      recurringParentId: form.recurringParentId || form.id || crypto.randomUUID(),
      createdAt: form.createdAt || Date.now(),
      notificationAt: form.notificationAt || getNotificationAt(form.isRecurring)
    };

    setServices((current) => {
      const next = form.id
        ? current.map((item) => (item.id === form.id ? service : item))
        : [...current, service];

      return sortServices(next);
    });
    setResponses((current) => {
      const currentResponses = current[service.id] ?? {};
      const allowedRoles = new Set(service.roles);

      return {
        ...current,
        [service.id]: Object.fromEntries(
          Object.entries(currentResponses).filter(([role]) => allowedRoles.has(role))
        )
      };
    });
    setSelectedServiceId(service.id);
    setForm(createEmptyForm());
  };

  const handleEditService = (service) => {
    setForm({
      id: service.id,
      date: service.date,
      time: service.time,
      title: service.title,
      note: service.note,
      rolesText: service.roles.join('\n'),
      isRecurring: service.isRecurring,
      recurringParentId: service.recurringParentId,
      createdAt: service.createdAt,
      notificationAt: service.notificationAt
    });
  };

  const handleDeleteService = (serviceId) => {
    setServices((current) => {
      const next = current.filter((service) => service.id !== serviceId);
      setSelectedServiceId((currentSelectedId) => {
        if (currentSelectedId !== serviceId) return currentSelectedId;
        return next[0]?.id ?? '';
      });

      return next;
    });
    setResponses((current) => {
      const next = { ...current };
      delete next[serviceId];
      return next;
    });
    if (form.id === serviceId) {
      setForm(createEmptyForm());
    }
  };

  const handleSaveResponseOptions = () => {
    const nextOptions = normalizeLines(responseOptionsText, defaultResponseOptions);
    const renamedOptions = new Map(responseOptions.map((option, index) => [option, nextOptions[index]]).filter(([, value]) => value));
    setResponseOptions(nextOptions);
    setResponseOptionsText(nextOptions.join('\n'));
    setResponses((current) => {
      const allowedOptions = new Set(nextOptions);
      const nextResponses = {};

      Object.entries(current).forEach(([serviceId, roleResponses]) => {
        nextResponses[serviceId] = {};
        Object.entries(roleResponses).forEach(([role, userResponses]) => {
          nextResponses[serviceId][role] = Object.fromEntries(
            Object.entries(userResponses)
              .map(([name, value]) => [name, renamedOptions.get(value) ?? value])
              .filter(([, value]) => allowedOptions.has(value))
          );
        });
      });

      return nextResponses;
    });
  };

  const handleAdminResponseChange = (serviceId, role, name, value) => {
    setResponses((current) => {
      const roleResponses = ((current[serviceId] ?? {})[role] ?? {});
      const nextRoleResponses = { ...roleResponses };

      if (value) {
        nextRoleResponses[name] = value;
      } else {
        delete nextRoleResponses[name];
      }

      return {
        ...current,
        [serviceId]: {
          ...(current[serviceId] ?? {}),
          [role]: nextRoleResponses
        }
      };
    });
  };

  const handleAddAdminResponse = (serviceId, role) => {
    const key = `${serviceId}-${role}`;
    const draft = adminDrafts[key] ?? { name: '', value: responseOptions[0] ?? '' };
    const name = draft.name.trim();

    if (!name || !draft.value) return;

    handleAdminResponseChange(serviceId, role, name, draft.value);
    setAdminDrafts((current) => ({
      ...current,
      [key]: { name: '', value: responseOptions[0] ?? '' }
    }));
  };

  const toggleResults = (serviceId, role) => {
    const key = `${serviceId}-${role}`;
    setExpandedResults((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  if (isDesktop) {
    return (
      <main className="desktop-blocker">
        <div className="desktop-card">
          <span className="badge">Лише для телефонів</span>
          <h1>Відкрий застосунок на смартфоні</h1>
          <p>
            Цей інтерфейс розрахований на мобільний екран і встановлення на головний екран як PWA.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <span className="eyebrow">VidMitka PWA</span>
          <h1>Розклад служінь і відповіді команди в одному застосунку</h1>
        </div>
      </section>

      <section className="mode-switcher" aria-label="Режим застосунку">
        <button className={mode === 'user' ? 'active' : ''} onClick={() => setMode('user')}>Служитель</button>
        <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>Адмін</button>
      </section>

      {mode === 'user' ? (
        <>
          <section className="panel compact-panel">
            <label className="inline-field">
              Ваше ім'я
              <input
                type="text"
                placeholder="Наприклад: Андрій"
                value={participantName}
                onChange={(event) => handleParticipantNameChange(event.target.value)}
              />
            </label>
            {!canVote ? <p className="field-hint">Введіть ім'я, щоб залишити відповідь.</p> : null}
          </section>

          <section className="panel compact-panel notification-panel">
            <div>
              <strong>Сповіщення</strong>
              <p className="field-hint">
                {notificationPermission === 'granted'
                  ? 'Увімкнено. Нагадування прийдуть за правилами розкладу.'
                  : 'Увімкніть, щоб отримувати нагадування проголосувати.'}
              </p>
            </div>
            {notificationPermission === 'granted' ? null : (
              <button
                type="button"
                className="secondary-button"
                disabled={notificationPermission === 'unsupported' || notificationPermission === 'denied'}
                onClick={requestNotifications}
              >
                {notificationPermission === 'denied' ? 'Заблоковано в браузері' : 'Увімкнути сповіщення'}
              </button>
            )}
          </section>

          <section className="service-list">
            {services.map((service) => (
              <button
                key={service.id}
                className={`service-card ${service.id === selectedService?.id ? 'selected' : ''}`}
                onClick={() => setSelectedServiceId(service.id)}
              >
                <span>{formatServiceDate(service.date)}</span>
                <strong>{service.time}</strong>
                <p>{service.title}</p>
                {service.isRecurring ? <small>Регулярне</small> : null}
              </button>
            ))}
          </section>

          {selectedService ? (
            <section className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">{formatServiceDate(selectedService.date)}</span>
                  <h2>{selectedService.title}</h2>
                </div>
                <div className="time-pill">{selectedService.time}</div>
              </div>
              <p className="muted">{selectedService.note}</p>

              <div className="roles-grid">
                {selectedService.roles.map((role) => {
                  const roleResponses = serviceResponses[role] ?? {};
                  const currentVote = roleResponses[normalizedParticipantName];
                  const counts = getResponseCounts(roleResponses, responseOptions);
                  const resultsKey = `${selectedService.id}-${role}`;
                  const hasVotes = Object.keys(roleResponses).length > 0;

                  return (
                    <article key={role} className="role-card">
                      <div className="role-title-row">
                        <h3>{role}</h3>
                        {currentVote ? <span className="vote-chip">{currentVote}</span> : null}
                      </div>
                      <div className="vote-row">
                        {counts.map(({ option, count }) => (
                          <button
                            key={option}
                            className={currentVote === option ? 'vote-button active' : 'vote-button'}
                            disabled={!canVote}
                            onClick={() => handleVote(role, option)}
                          >
                            <span>{option}</span>
                            <strong>{count}</strong>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={!hasVotes}
                        onClick={() => toggleResults(selectedService.id, role)}
                      >
                        {expandedResults[resultsKey] ? 'Сховати імена' : 'Показати імена'}
                      </button>
                      {expandedResults[resultsKey] ? (
                        <div className="results-list">
                          {getGroupedResponses(roleResponses, responseOptions).map(({ option, names }) => (
                            <div key={option} className="result-group">
                              <strong>{option}</strong>
                              {names.length ? (
                                <ul>
                                  {names.map((name) => (
                                    <li key={name}>{name}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p>Немає відповідей</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="panel">
              <h2>Розклад порожній</h2>
              <p className="muted">Адмін може додати перше служіння в розділі керування.</p>
            </section>
          )}
        </>
      ) : (
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Адмін-панель</span>
              <h2>{isEditing ? 'Редагувати служіння' : 'Створити служіння'}</h2>
            </div>
          </div>

          <form className="admin-form" onSubmit={handleSaveService}>
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
              <button className="secondary-button" type="button" onClick={() => setForm(createEmptyForm())}>
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
                onChange={(event) => setResponseOptionsText(event.target.value)}
              />
            </label>
            <button className="secondary-button" type="button" onClick={handleSaveResponseOptions}>
              Зберегти варіанти відповідей
            </button>
          </div>

          <div className="mini-list">
            {services.map((service) => (
              <article key={service.id} className="mini-card">
                <div className="mini-card-content">
                  <div>
                    <strong>{service.title}</strong>
                    <p>{formatServiceDate(service.date)} · {service.time}</p>
                    <p>{service.roles.length} ролей · {service.isRecurring ? 'регулярне' : 'разове'}</p>
                  </div>
                  <div className="admin-actions">
                    <button type="button" className="secondary-button" onClick={() => handleEditService(service)}>
                      Редагувати
                    </button>
                    <button type="button" className="danger-button" onClick={() => handleDeleteService(service.id)}>
                      Видалити
                    </button>
                  </div>
                  <div className="response-editor">
                    {service.roles.map((role) => {
                      const roleResponses = (responses[service.id] ?? {})[role] ?? {};
                      const key = `${service.id}-${role}`;
                      const draft = adminDrafts[key] ?? { name: '', value: responseOptions[0] ?? '' };
                      const resultsKey = `admin-${service.id}-${role}`;

                      return (
                        <div key={role} className="admin-role-responses">
                          <strong>{role}</strong>
                          <div className="count-row">
                            {getResponseCounts(roleResponses, responseOptions).map(({ option, count }) => (
                              <span key={option}>{option}: {count}</span>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => toggleResults(`admin-${service.id}`, role)}
                          >
                            {expandedResults[resultsKey] ? 'Сховати список' : 'Відкрити список голосів'}
                          </button>
                          {expandedResults[resultsKey] ? (
                            <div className="results-list">
                              {getGroupedResponses(roleResponses, responseOptions).map(({ option, names }) => (
                                <div key={option} className="result-group">
                                  <strong>{option}</strong>
                                  {names.length ? (
                                    <ul>
                                      {names.map((name) => (
                                        <li key={name}>{name}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p>Немає відповідей</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {Object.entries(roleResponses).map(([name, value]) => (
                            <label key={name}>
                              {name}
                              <select
                                value={value}
                                onChange={(event) => handleAdminResponseChange(service.id, role, name, event.target.value)}
                              >
                                <option value="">Видалити відповідь</option>
                                {responseOptions.map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            </label>
                          ))}
                          <div className="add-response-row">
                            <input
                              type="text"
                              placeholder="Ім'я"
                              value={draft.name}
                              onChange={(event) => setAdminDrafts((current) => ({
                                ...current,
                                [key]: { ...draft, name: event.target.value }
                              }))}
                            />
                            <select
                              value={draft.value}
                              onChange={(event) => setAdminDrafts((current) => ({
                                ...current,
                                [key]: { ...draft, value: event.target.value }
                              }))}
                            >
                              {responseOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                            <button type="button" className="secondary-button" onClick={() => handleAddAdminResponse(service.id, role)}>
                              Додати
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
