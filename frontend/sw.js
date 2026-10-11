self.addEventListener("push", event => {
    const data = event.data ? event.data.json() : { title: "Peerva", body: "New message" };

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
            // Skip the notification if the user is already looking at the site
            const siteIsOpen = windowClients.some(c => c.visibilityState === "visible");
            if (siteIsOpen) return;

            return self.registration.showNotification(data.title, {
                body: data.body,
                icon: "/icon.png",
                data: { url: data.url || "/" }
            });
        })
    );
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const url = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
            for (const c of windowClients) {
                if ("focus" in c) return c.focus();
            }
            return clients.openWindow(url);
        })
    );
});
