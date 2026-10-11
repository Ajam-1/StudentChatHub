const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:you@example.com',
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

// Save a user's subscription (use your database, not memory)
app.post('/subscribe', async (req, res) => {
  const { userId, subscription } = req.body;
  await db.saveSubscription(userId, subscription);
  res.sendStatus(201);
});

// Call this when a message arrives for a user who is offline
async function pushToUser(userId, sender, text) {
  const subs = await db.getSubscriptions(userId);
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        sub,
        JSON.stringify({ title: sender, body: text, url: '/' })
      );
    } catch (err) {
      // Subscription expired or was revoked, so remove it
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.deleteSubscription(sub.endpoint);
      }
    }
  }
}
