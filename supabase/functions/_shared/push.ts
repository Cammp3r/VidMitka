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
  const adminPassword = Deno.env.get('ADMIN_PASSWORD') ?? '';
  const requestAdminPassword = request.headers.get('x-admin-password') ?? '';
  const hasServiceRoleKey = serviceRoleKey && (apiKey === serviceRoleKey || bearer === serviceRoleKey);
  const hasAdminPassword = adminPassword && requestAdminPassword === adminPassword;

  return Boolean(hasServiceRoleKey || hasAdminPassword);
};

const sendPushRows = async (
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: Record<string, string>
) => {
  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
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
    .map((result, index) => ({ result, subscription: subscriptions[index] }))
    .filter(({ result }) => result.status === 'rejected' && [404, 410].includes(result.reason?.statusCode))
    .map(({ subscription }) => subscription.id)
    .filter(Boolean);

  if (expiredIds.length) {
    await adminClient.from('push_subscriptions').delete().in('id', expiredIds);
  }

  return {
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length
  };
};

export const sendPushToUsers = async (userIds: string[], payload: Record<string, string>) => {
  if (!userIds.length) return { sent: 0, failed: 0 };

  const { data, error } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (error) throw error;

  return sendPushRows(data ?? [], payload);
};

export const sendPushToAll = async (payload: Record<string, string>) => {
  const { data, error } = await adminClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth');

  if (error) throw error;

  return sendPushRows(data ?? [], payload);
};
