import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const getSecretKey = () => {
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacyKey) return legacyKey;

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (!secretKeys) return '';

  const parsed = JSON.parse(secretKeys);
  return Object.values(parsed)[0] as string;
};

const serviceRoleKey = getSecretKey();
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

export const adminClient = createClient(supabaseUrl, serviceRoleKey);

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

export const isAuthorizedRequest = (request: Request) => {
  const apiKey = request.headers.get('apikey') ?? '';
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';

  return Boolean(serviceRoleKey && (apiKey === serviceRoleKey || bearer === serviceRoleKey));
};

export const sendPushToAll = async (payload: Record<string, string>) => {
  const { data, error } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth');

  if (error) throw error;

  const results = await Promise.allSettled(
    (data ?? []).map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        },
        JSON.stringify(payload)
      )
    )
  );

  const expiredIds = results
    .map((result, index) => ({ result, subscription: data?.[index] }))
    .filter(({ result }) => result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode))
    .map(({ subscription }) => subscription?.id)
    .filter(Boolean);

  if (expiredIds.length) {
    await adminClient.from('push_subscriptions').delete().in('id', expiredIds);
  }

  return {
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length
  };
};
