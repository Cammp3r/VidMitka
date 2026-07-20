import { useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from './lib/supabase';

const serviceRolesFallback = ['Камера', 'Звук', 'Медіа'];
const defaultResponseOptions = ['Можу бути', 'Не можу бути', 'Під питанням'];

const initialServices = [
  {
    id: 'fri-2026-07-24',
    date: '2026-07-24',
    time: '19:00',
    title: 'Вечірнє служіння',
    note: 'Підготовка команди, звук і трансляція',
    roles: ['Камера', 'Звук', 'Зустрічаючі'],
    isRecurring: true,
    recurringParentId: 'fri-evening'
  },
  {
    id: 'sun-2026-07-26',
    date: '2026-07-26',
    time: '11:00',
    title: 'Основне служіння',
    note: 'Трансляція та молитовна підтримка',
    roles: ['Камера', 'Презентація', 'Медіа'],
    isRecurring: true,
    recurringParentId: 'sun-main'
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

const toTimeInput = (time) => time.slice(0, 5);

const fromServiceRow = (row) => ({
  id: row.id,
  date: row.service_date,
  time: toTimeInput(row.service_time),
  title: row.title,
  note: row.note,
  roles: row.roles ?? [],
  isRecurring: row.is_recurring,
  recurringParentId: row.recurring_parent_id
});

const toServicePayload = (service) => ({
  ...(service.id ? { id: service.id } : {}),
  service_date: service.date,
  service_time: service.time,
  title: service.title,
  note: service.note,
  roles: service.roles,
  is_recurring: service.isRecurring,
  recurring_parent_id: service.recurringParentId,
  reminder_at: service.isRecurring ? null : new Date().toISOString(),
  reminder_sent_at: null
});

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
    recurringParentId: parentId
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
    count: Object.values(roleResponses).filter((entry) => getResponseValue(entry) === option).length
  }));

const getResponseValue = (entry) => {
  if (!entry) return '';
  return typeof entry === 'string' ? entry : entry.value;
};
const getResponseName = (key, entry) => {
  if (!entry) return key;
  return typeof entry === 'string' ? key : entry.displayName;
};

const getGroupedResponses = (roleResponses = {}, options) =>
  options.map((option) => ({
    option,
    names: Object.entries(roleResponses)
      .filter(([, entry]) => getResponseValue(entry) === option)
      .map(([key, entry]) => getResponseName(key, entry))
      .sort((first, second) => first.localeCompare(second, 'uk'))
  }));

const buildResponseMap = (rows) => {
  const map = {};

  rows.forEach((row) => {
    map[row.service_id] ??= {};
    map[row.service_id][row.role] ??= {};
    map[row.service_id][row.role][row.user_id] = {
      displayName: row.display_name,
      value: row.value,
      userId: row.user_id
    };
  });

  return map;
};

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
  const [userId, setUserId] = useState('');
  const [remoteStatus, setRemoteStatus] = useState(isSupabaseConfigured ? 'Підключення до Supabase...' : '');
  const [pushStatus, setPushStatus] = useState('');
  const responsesRef = useRef(responses);
  const participantNameRef = useRef('');

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  const loadRemoteData = async () => {
    if (!supabase) return;

    const [
      servicesResult,
      optionsResult,
      responsesResult
    ] = await Promise.all([
      supabase.from('services').select('*').order('service_date').order('service_time'),
      supabase.from('response_options').select('*').order('position'),
      supabase.from('responses').select('*')
    ]);

    if (servicesResult.error || optionsResult.error || responsesResult.error) {
      throw servicesResult.error ?? optionsResult.error ?? responsesResult.error;
    }

    const nextServices = servicesResult.data.map(fromServiceRow);
    const nextOptions = optionsResult.data.map((option) => option.label);

    setServices(nextServices);
    setSelectedServiceId((currentSelectedId) => {
      if (nextServices.some((service) => service.id === currentSelectedId)) return currentSelectedId;
      return nextServices[0]?.id ?? '';
    });
    setResponseOptions(nextOptions.length ? nextOptions : defaultResponseOptions);
    setResponseOptionsText((nextOptions.length ? nextOptions : defaultResponseOptions).join('\n'));
    setResponses(buildResponseMap(responsesResult.data));
  };

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;

    const bootSupabase = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let session = sessionData.session;

        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          session = data.session;
        }

        if (!active || !session?.user) return;

        setUserId(session.user.id);
        setRemoteStatus('Supabase підключено');
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (profile?.display_name) {
          setParticipantName(profile.display_name);
          participantNameRef.current = profile.display_name;
        }
        await loadRemoteData();
      } catch (error) {
        setRemoteStatus(`Помилка Supabase: ${error.message}`);
      }
    };

    bootSupabase();

    const channel = supabase
      .channel('vidmitka-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => loadRemoteData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'response_options' }, () => loadRemoteData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, () => loadRemoteData())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (supabase) return undefined;

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

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? services[0],
    [selectedServiceId, services]
  );

  const serviceResponses = selectedService ? responses[selectedService.id] ?? {} : {};
  const isEditing = Boolean(form.id);
  const normalizedParticipantName = participantName.trim();
  const canVote = Boolean(normalizedParticipantName && (!supabase || userId));

  const upsertProfile = async (displayName) => {
    if (!supabase || !userId || !displayName) return;

    await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        display_name: displayName,
        updated_at: new Date().toISOString()
      });
  };

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
      upsertProfile(nextName);
    }
  };

  const handleVote = async (role, value) => {
    if (!selectedService || !canVote) return;

    if (supabase) {
      const { error } = await supabase
        .from('responses')
        .upsert({
          service_id: selectedService.id,
          role,
          user_id: userId,
          display_name: normalizedParticipantName,
          value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'service_id,role,user_id'
        });

      if (error) {
        setRemoteStatus(`Помилка збереження відповіді: ${error.message}`);
        return;
      }
    }

    setResponses((current) => ({
      ...current,
      [selectedService.id]: {
        ...(current[selectedService.id] ?? {}),
        [role]: {
          ...((current[selectedService.id] ?? {})[role] ?? {}),
          [supabase ? userId : normalizedParticipantName]: supabase
            ? { displayName: normalizedParticipantName, value, userId }
            : value
        }
      }
    }));
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  };

  const handleEnablePush = async () => {
    if (!supabase || !userId) {
      setPushStatus('Спочатку потрібно підключити Supabase.');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushStatus('Цей браузер не підтримує push-сповіщення.');
      return;
    }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setPushStatus('Додайте VITE_VAPID_PUBLIC_KEY у .env.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setPushStatus('Сповіщення не дозволені в браузері.');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
    const json = subscription.toJSON();

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'endpoint'
      });

    setPushStatus(error ? `Помилка push: ${error.message}` : 'Push-сповіщення увімкнено.');
  };

  const handleSaveService = async (event) => {
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
      recurringParentId: form.recurringParentId || form.id || crypto.randomUUID()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('services')
        .upsert(toServicePayload(service))
        .select()
        .single();

      if (error) {
        setRemoteStatus(`Помилка збереження служіння: ${error.message}`);
        return;
      }

      const savedService = fromServiceRow(data);
      setSelectedServiceId(savedService.id);
      setForm(createEmptyForm());
      await loadRemoteData();
      return;
    }

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
      recurringParentId: service.recurringParentId
    });
  };

  const handleDeleteService = async (serviceId) => {
    if (supabase) {
      const { error } = await supabase.from('services').delete().eq('id', serviceId);

      if (error) {
        setRemoteStatus(`Помилка видалення служіння: ${error.message}`);
        return;
      }

      if (form.id === serviceId) {
        setForm(createEmptyForm());
      }
      await loadRemoteData();
      return;
    }

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

  const handleSaveResponseOptions = async () => {
    const nextOptions = normalizeLines(responseOptionsText, defaultResponseOptions);

    if (supabase) {
      const { error: deleteError } = await supabase
        .from('response_options')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        setRemoteStatus(`Помилка оновлення варіантів: ${deleteError.message}`);
        return;
      }

      const { error: insertError } = await supabase
        .from('response_options')
        .insert(nextOptions.map((label, index) => ({ label, position: index + 1 })));

      if (insertError) {
        setRemoteStatus(`Помилка оновлення варіантів: ${insertError.message}`);
        return;
      }
    }

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
              .map(([name, entry]) => {
                const nextValue = renamedOptions.get(getResponseValue(entry)) ?? getResponseValue(entry);
                return [
                  name,
                  typeof entry === 'string'
                    ? nextValue
                    : { ...entry, value: nextValue }
                ];
              })
              .filter(([, entry]) => allowedOptions.has(getResponseValue(entry)))
          );
        });
      });

      return nextResponses;
    });
  };

  const handleAdminResponseChange = async (serviceId, role, name, value, targetUserId = name) => {
    if (supabase) {
      if (value) {
        const { error } = await supabase
          .from('responses')
          .upsert({
            service_id: serviceId,
            role,
            user_id: targetUserId,
            display_name: name,
            value,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'service_id,role,user_id'
          });

        if (error) {
          setRemoteStatus(`Помилка редагування відповіді: ${error.message}`);
          return;
        }
      } else {
        const { error } = await supabase
          .from('responses')
          .delete()
          .eq('service_id', serviceId)
          .eq('role', role)
          .eq('user_id', targetUserId);

        if (error) {
          setRemoteStatus(`Помилка видалення відповіді: ${error.message}`);
          return;
        }
      }

      await loadRemoteData();
      return;
    }

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

  const handleAddAdminResponse = async (serviceId, role) => {
    const key = `${serviceId}-${role}`;
    const draft = adminDrafts[key] ?? { name: '', value: responseOptions[0] ?? '' };
    const name = draft.name.trim();

    if (!name || !draft.value) return;

    if (supabase) {
      setRemoteStatus('Додавання відповіді вручну для Supabase потребує реального user_id користувача.');
      return;
    }

    await handleAdminResponseChange(serviceId, role, name, draft.value);
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
            {remoteStatus ? <p className="field-hint">{remoteStatus}</p> : null}
            {supabase ? (
              <>
                <button type="button" className="secondary-button" onClick={handleEnablePush}>
                  Увімкнути push-сповіщення
                </button>
                {pushStatus ? <p className="field-hint">{pushStatus}</p> : null}
              </>
            ) : null}
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
                  const currentVote = getResponseValue(roleResponses[supabase ? userId : normalizedParticipantName]);
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
                          {Object.entries(roleResponses).map(([key, entry]) => (
                            <label key={key}>
                              {getResponseName(key, entry)}
                              <select
                                value={getResponseValue(entry)}
                                onChange={(event) => handleAdminResponseChange(
                                  service.id,
                                  role,
                                  getResponseName(key, entry),
                                  event.target.value,
                                  key
                                )}
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
