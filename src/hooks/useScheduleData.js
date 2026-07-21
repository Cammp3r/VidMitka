import { useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  defaultNotificationOffset,
  defaultResponseOptions,
  initialServices
} from '../lib/constants';
import { formatServiceDate, groupServicesByWeek, sortServices } from '../lib/dateUtils';
import {
  buildAssignmentMap,
  cleanupServices,
  fromServiceRow,
  normalizeLines,
  toServicePayload
} from '../lib/serviceUtils';
import { buildResponseMap, getResponseValue } from '../lib/responseUtils';

const GROUPING_REFRESH_MS = 5 * 60 * 1000;
const NOTIFICATION_SETTINGS_ID = 1;

// Owns all server/demo data for the app: services, responses, profiles, response options,
// the notification offset, and the current participant's identity — plus every action that
// mutates them. Components only ever read from this hook's return value or call its actions.
export const useScheduleData = () => {
  const [responses, setResponses] = useState({});
  const [services, setServices] = useState(() => cleanupServices(initialServices, {}).services);
  const [selectedServiceId, setSelectedServiceId] = useState(
    () => cleanupServices(initialServices, {}).services[0]?.id ?? ''
  );
  const [participantName, setParticipantName] = useState('');
  const [responseOptions, setResponseOptions] = useState(defaultResponseOptions);
  const [responseOptionsText, setResponseOptionsText] = useState(defaultResponseOptions.join('\n'));
  const [profiles, setProfiles] = useState([]);
  const [notificationOffset, setNotificationOffset] = useState(defaultNotificationOffset);
  const [userId, setUserId] = useState('');
  const [remoteStatus, setRemoteStatus] = useState(isSupabaseConfigured ? 'Підключення даних...' : '');
  const [now, setNow] = useState(() => new Date());

  const responsesRef = useRef(responses);
  const participantNameRef = useRef('');
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD ?? '';

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  // Keeps "Цей тиждень" / "Наступний тиждень" labels accurate even if no data change
  // happens to trigger a re-render around a week boundary.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), GROUPING_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const loadRemoteData = async () => {
    if (!supabase) return;

    const [
      servicesResult,
      optionsResult,
      responsesResult,
      profilesResult,
      assignmentsResult,
      appSettingsResult
    ] = await Promise.all([
      supabase.from('services').select('*').order('service_date').order('service_time'),
      supabase.from('response_options').select('*').order('position'),
      supabase.from('responses').select('*'),
      supabase.from('profiles').select('*').order('display_name'),
      supabase.from('service_assignments').select('*'),
      supabase.from('app_settings').select('notification_offset_minutes').eq('id', NOTIFICATION_SETTINGS_ID).maybeSingle()
    ]);

    const firstError = [servicesResult, optionsResult, responsesResult, profilesResult, assignmentsResult, appSettingsResult]
      .map((result) => result.error)
      .find(Boolean);
    if (firstError) throw firstError;

    const assignmentMap = buildAssignmentMap(assignmentsResult.data);
    const nextServices = servicesResult.data.map((row) => ({
      ...fromServiceRow(row),
      assignments: assignmentMap[row.id] ?? {}
    }));
    const nextOptions = optionsResult.data.map((option) => option.label);

    setServices(nextServices);
    setProfiles(profilesResult.data ?? []);
    setSelectedServiceId((currentSelectedId) => {
      if (nextServices.some((service) => service.id === currentSelectedId)) return currentSelectedId;
      return nextServices[0]?.id ?? '';
    });
    setResponseOptions(nextOptions.length ? nextOptions : defaultResponseOptions);
    setResponseOptionsText((nextOptions.length ? nextOptions : defaultResponseOptions).join('\n'));
    setResponses(buildResponseMap(responsesResult.data));
    if (appSettingsResult.data?.notification_offset_minutes) {
      setNotificationOffset(appSettingsResult.data.notification_offset_minutes);
    }
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
        setRemoteStatus('Дані підключені');
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
        setRemoteStatus(`Не вдалося підключити дані: ${error.message}`);
      }
    };

    bootSupabase();

    const channel = supabase
      .channel('vidmitka-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => loadRemoteData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'response_options' }, () => loadRemoteData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'responses' }, () => loadRemoteData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadRemoteData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_assignments' }, () => loadRemoteData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => loadRemoteData())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
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

  const serviceWeekGroups = useMemo(() => groupServicesByWeek(services, now), [services, now]);

  const normalizedParticipantName = participantName.trim();
  const canVote = Boolean(normalizedParticipantName && (!supabase || userId));
  const voterKey = supabase ? userId : normalizedParticipantName;

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

  const changeParticipantName = (value) => {
    const nextName = value.trim();
    const previousName = participantNameRef.current;

    setParticipantName(value);

    if (nextName) {
      renameParticipantInResponses(previousName, nextName);
      participantNameRef.current = nextName;
      upsertProfile(nextName);
    }
  };

  const changeNotificationOffset = async (value) => {
    const nextOffset = Number(value);
    setNotificationOffset(nextOffset);

    if (!supabase) return;

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        id: NOTIFICATION_SETTINGS_ID,
        notification_offset_minutes: nextOffset,
        updated_at: new Date().toISOString()
      });

    setRemoteStatus(error ? 'Не вдалося зберегти час сповіщення.' : 'Час сповіщення збережено.');
  };

  const vote = async (role, value) => {
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
          [voterKey]: supabase ? { displayName: normalizedParticipantName, value, userId } : value
        }
      }
    }));
  };

  const saveService = async (service) => {
    if (supabase) {
      const { data, error } = await supabase
        .from('services')
        .upsert(toServicePayload(service))
        .select()
        .single();

      if (error) {
        setRemoteStatus(`Не вдалося зберегти служіння: ${error.message}`);
        return { ok: false };
      }

      const savedService = fromServiceRow(data);
      setSelectedServiceId(savedService.id);
      await loadRemoteData();
      return { ok: true };
    }

    setServices((current) => {
      const next = service.id && current.some((item) => item.id === service.id)
        ? current.map((item) => (item.id === service.id ? service : item))
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
    return { ok: true };
  };

  const deleteService = async (serviceId) => {
    if (supabase) {
      const { error } = await supabase.from('services').delete().eq('id', serviceId);

      if (error) {
        setRemoteStatus(`Не вдалося видалити служіння: ${error.message}`);
        return { ok: false };
      }

      await loadRemoteData();
      return { ok: true };
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
    return { ok: true };
  };

  const saveResponseOptions = async () => {
    const nextOptions = normalizeLines(responseOptionsText, defaultResponseOptions);

    if (supabase) {
      const { error: deleteError } = await supabase
        .from('response_options')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        setRemoteStatus(`Не вдалося оновити варіанти: ${deleteError.message}`);
        return;
      }

      const { error: insertError } = await supabase
        .from('response_options')
        .insert(nextOptions.map((label, index) => ({ label, position: index + 1 })));

      if (insertError) {
        setRemoteStatus(`Не вдалося оновити варіанти: ${insertError.message}`);
        return;
      }
    }

    const renamedOptions = new Map(
      responseOptions.map((option, index) => [option, nextOptions[index]]).filter(([, value]) => value)
    );
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

  const adminResponseChange = async (serviceId, role, name, value, targetUserId = name) => {
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
          setRemoteStatus(`Не вдалося змінити відповідь: ${error.message}`);
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
          setRemoteStatus(`Не вдалося видалити відповідь: ${error.message}`);
          return;
        }
      }

      await loadRemoteData();
      return;
    }

    setResponses((current) => {
      const roleResponses = (current[serviceId] ?? {})[role] ?? {};
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

  const addAdminResponse = async (serviceId, role, name, value) => {
    if (!name || !value) return;

    if (supabase) {
      setRemoteStatus('Ручне додавання відповіді доступне тільки в локальному режимі.');
      return;
    }

    await adminResponseChange(serviceId, role, name, value);
  };

  const notifyAssignedUser = async (service, role, profile) => {
    if (!supabase || !adminPassword) return;

    await supabase.functions.invoke('send-push', {
      body: {
        userIds: [profile.user_id],
        title: 'VidMitka: вас призначено на служіння',
        body: `${service.title} ${formatServiceDate(service.date)} о ${service.time}. Роль: ${role}.`,
        url: '/',
        tag: `assignment-${service.id}-${role}`
      },
      headers: {
        'x-admin-password': adminPassword
      }
    });
  };

  const assignUser = async (service, role, profileId) => {
    if (!supabase) {
      setRemoteStatus('Призначення акаунтів доступне після підключення Supabase.');
      return;
    }

    if (!profileId) {
      const { error } = await supabase
        .from('service_assignments')
        .delete()
        .eq('service_id', service.id)
        .eq('role', role);

      if (error) {
        setRemoteStatus(`Не вдалося прибрати призначення: ${error.message}`);
        return;
      }

      await loadRemoteData();
      return;
    }

    const profile = profiles.find((item) => item.user_id === profileId);
    if (!profile) return;

    const { error } = await supabase
      .from('service_assignments')
      .upsert({
        service_id: service.id,
        role,
        user_id: profile.user_id,
        display_name: profile.display_name,
        assigned_at: new Date().toISOString(),
        reminder_sent_at: null
      }, {
        onConflict: 'service_id,role'
      });

    if (error) {
      setRemoteStatus(`Не вдалося призначити акаунт: ${error.message}`);
      return;
    }

    await notifyAssignedUser(service, role, profile);
    setRemoteStatus(`Призначено: ${profile.display_name}`);
    await loadRemoteData();
  };

  return {
    services,
    serviceWeekGroups,
    selectedServiceId,
    selectServiceId: setSelectedServiceId,
    selectedService,
    responses,
    profiles,
    responseOptions,
    responseOptionsText,
    setResponseOptionsText,
    notificationOffset,
    changeNotificationOffset,
    participantName,
    changeParticipantName,
    normalizedParticipantName,
    voterKey,
    userId,
    canVote,
    remoteStatus,
    vote,
    saveService,
    deleteService,
    saveResponseOptions,
    adminResponseChange,
    addAdminResponse,
    assignUser
  };
};
