# OpenClaw Multi-Channel Notifier — Setup Reference

Source: Replit AI build (2026-04-27)

## Platform URL
```
https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev
```

## Webhook Endpoints
| Channel | URL |
|---------|-----|
| Telegram | `https://<platform-url>/webhooks/telegram` |
| Twilio | `https://<platform-url>/webhooks/twilio` |

## Env Vars (Replit Secrets)

### Telegram
```
TELEGRAM_BOT_TOKEN=          # From @BotFather
TELEGRAM_NOTIFY_CHAT_ID=     # Where notifications go (5468062863 for this chat)
TELEGRAM_ALLOWED_CHAT_IDS=   # Comma-separated, who can press buttons
TELEGRAM_WEBHOOK_SECRET=     # openssl rand -hex 32 (production)
```

### Twilio
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_PHONE_NUMBER=
TWILIO_NOTIFY_TO_NUMBERS=
TWILIO_ALLOWED_NUMBERS=
```

### Channel Control
```
OPENCLAW_ENABLED_CHANNELS=telegram,twilio
JEDIRE_PUBLIC_URL=https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev
```

### Bot Auth
```
ROCKEMAN_API_KEY=            # Set to 61233fbae02da90d1d5a159ad062a614ae6b31bcafb32b3d56987d5075640dc1
```

## Register Telegram Webhook
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://381d5707-51e5-4d3d-b340-02537a082e98-00-2gk8jsdbkwoy5.worf.replit.dev/webhooks/telegram"
```

## Action Vocabulary
| Verb | What it does |
|------|-------------|
| approve | Audit — records approval |
| dismiss | Audit — records dismissal |
| ack | Acknowledge threshold breach |
| rerun | Re-run deal analysis pipeline |
| rerun_agent | Future: single-agent re-run |

## Smoke Test
```js
import('./src/services/notifications/openclawNotifier').then(async (m) => {
  const r = await m.openclawNotifier.notify({
    kind: 'deal_created',
    title: 'Smoke test',
    body: 'OpenClaw is wired up.',
    actions: [{ label: 'Acknowledge', actionId: 'dismiss' }],
  });
  console.log(r);
});
```

## Quick-Start Checklist
1. Create bot with @BotFather → get TELEGRAM_BOT_TOKEN
2. Set TELEGRAM_NOTIFY_CHAT_ID = 5468062863 (this chat)
3. Register webhook with curl command above
4. Set ROCKEMAN_API_KEY in Secrets
5. Restart backend
6. Run smoke test

Updated: 2026-04-27
