import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {};
  const title = payload.title ?? 'VidMitka: потрібна відповідь';
  const options = {
    body: payload.body ?? 'Відкрийте розклад і відмітьте, чи зможете служити.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: {
      url: payload.url ?? '/'
    },
    tag: payload.tag ?? 'vidmitka-reminder',
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const currentClient = clients.find((client) => client.url.includes(self.location.origin));

      if (currentClient) {
        currentClient.focus();
        return currentClient.navigate(url);
      }

      return self.clients.openWindow(url);
    })
  );
});
