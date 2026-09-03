import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window;

export const usePushSubscription = (userId) => {
  const [status, setStatus] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!isPushSupported() || !userId || !supabase) {
      setSubscribed(false);
      return undefined;
    }

    let active = true;

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!subscription) {
          if (active) setSubscribed(false);
          return;
        }

        const { data, error } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('endpoint', subscription.endpoint)
          .maybeSingle();

        if (active) setSubscribed(!error && Boolean(data));
      })
      .catch(() => {
        if (active) setSubscribed(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const enable = async () => {
    if (!supabase || !userId) {
      setStatus('Зачекайте кілька секунд і спробуйте ще раз.');
      return;
    }

    if (!isPushSupported() || !('Notification' in window)) {
      setStatus('Цей браузер не підтримує сповіщення.');
      return;
    }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setStatus('Сповіщення ще не налаштовані.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus('Сповіщення не дозволені в браузері.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

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

      if (error) throw error;

      setSubscribed(true);
      setStatus('Сповіщення увімкнено.');
    } catch {
      setStatus('Не вдалося увімкнути сповіщення. Спробуйте пізніше.');
    }
  };

  const disable = async () => {
    if (!isPushSupported()) {
      setSubscribed(false);
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      if (supabase) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    }

    setSubscribed(false);
    setStatus('Сповіщення вимкнено.');
  };

  return { status, subscribed, enable, disable };
};
