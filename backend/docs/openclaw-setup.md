# OpenClaw notifier — setup

OpenClaw is the multi-channel notifier that fans deal/document/agent/error
events out to Telegram and Twilio (SMS / WhatsApp / iMessage). It replaces
the legacy `clawdbotWebhook` stub.

The runtime lives at `backend/src/services/notifications/`:

- `openclawNotifier.ts` — singleton with `notifyDealCreated`, `notifyAnalysisComplete`, `notifyError`
- `channels/telegram.ts`, `channels/twilio.ts` — channel adapters
- `openclaw-actions.ts` — action dispatcher (`approve`, `dismiss`, `rerun`)

Inbound action triggers are wired through the existing
`backend/src/services/chat/messageRouter.ts` webhook handlers — Telegram
inline buttons (`callback_data` prefix `ocl:`) and Twilio text commands
(`approve <id>` / `dismiss` / `rerun <id>`).

## 1. Enable channels

Set `OPENCLAW_ENABLED_CHANNELS` in `.env` to a comma-separated list of channels
you want active. Leave it blank to auto-enable every channel that has all
required credentials.

```
OPENCLAW_ENABLED_CHANNELS=telegram,twilio
JEDIRE_PUBLIC_URL=https://app.jedire.com
```

## 2. Telegram setup

1. Open Telegram, message **@BotFather**, and run `/newbot`. Save the bot token.
2. Find your chat id by messaging your new bot, then visiting
   `https://api.telegram.org/bot<TOKEN>/getUpdates` — the `chat.id` field is
   what you want. (Or use `@get_id_bot`.)
3. Register the inbound webhook so Telegram delivers messages and button taps
   to JediRe:
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=$JEDIRE_PUBLIC_URL/webhooks/telegram"
   ```
4. Populate the env vars:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC...
   TELEGRAM_NOTIFY_CHAT_ID=987654321
   TELEGRAM_ALLOWED_CHAT_IDS=987654321
   ```
   `TELEGRAM_ALLOWED_CHAT_IDS` is optional — if blank, only
   `TELEGRAM_NOTIFY_CHAT_ID` is allowed to invoke actions.

## 3. Twilio setup

1. Get an account SID + auth token from <https://twilio.com/console>.
2. Provision (or re-use) a number, or enable a WhatsApp sender. For SMS use
   E.164 (`+14155550100`); for WhatsApp use `whatsapp:+14155550100`.
3. In the Twilio Console, set the **inbound message webhook** for the number
   (or for the Conversations service) to:
   ```
   $JEDIRE_PUBLIC_URL/webhooks/twilio
   ```
4. Populate the env vars:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_FROM_PHONE_NUMBER=+14155550100
   TWILIO_NOTIFY_TO_NUMBERS=+14155550101,+14155550102
   TWILIO_ALLOWED_NUMBERS=+14155550101
   ```
   If `TWILIO_ALLOWED_NUMBERS` is blank, the `TWILIO_NOTIFY_TO_NUMBERS` list is
   used as the allowlist.

## 4. Smoke test

After setting env vars, restart the JediRe workflow and trigger a deal to
confirm both channels fire:

```bash
# (in a Node REPL inside backend/)
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

You should see one message in Telegram (with an inline button) and one SMS in
each `TWILIO_NOTIFY_TO_NUMBERS` entry. Tapping the Telegram button or replying
"dismiss" to the SMS will edit / acknowledge the message.

## 5. Hardening — webhook authenticity (production)

Action dispatch trusts the sender id (Telegram chat id, Twilio phone number)
to enforce allowlists. Without webhook signature verification an attacker who
can POST to the public webhook URL could forge those fields and execute
actions. **Free-text chat is not signature-gated** (so local dev stays usable),
but production deployments should enable both checks below.

### Telegram secret token

```
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

Re-register the webhook with the same value:

```
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=$JEDIRE_PUBLIC_URL/webhooks/telegram&secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

When `TELEGRAM_WEBHOOK_SECRET` is set, the `ocl:` callback handler requires
the `X-Telegram-Bot-Api-Secret-Token` header to match before dispatching.

### Twilio request signature

Set `TWILIO_AUTH_TOKEN` (you already need this for outbound). With it set, the
Twilio handler validates `X-Twilio-Signature` against the request URL + body
before dispatching action commands. If your deployment runs behind a reverse
proxy that rewrites Host (so the signed URL doesn't match `req.get('host')`),
also set:

```
TWILIO_WEBHOOK_BASE_URL=https://api.jedire.com
```

## 6. v1 action vocabulary

| Verb       | Telegram button text | Twilio reply pattern    | Effect (v1)                   |
| ---------- | -------------------- | ----------------------- | ----------------------------- |
| `approve`  | "Approve"            | `approve <resourceId>`  | Logs approval (TODO: wire to underwriting commit). |
| `dismiss`  | "Dismiss"            | `dismiss [<resourceId>]`| Marks notification dismissed. |
| `rerun`    | "Re-run analysis"    | `rerun <resourceId>`    | Logs a rerun request (TODO: wire to agent dispatcher). |

Adding a new action is two steps: add a handler to
`openclaw-actions.ts:dispatchAction` and (optionally) include it in
`notification.actions` when calling the notifier.

## 7. About the legacy `/api/v1/clawdbot/*` REST routes

The 1419-line `backend/src/api/rest/clawdbot-webhooks.routes.ts` file is **not**
the bot — it's a separate JSON-RPC-style API used by an external assistant.
It still relies on `CLAWDBOT_WEBHOOK_SECRET` and `CLAWDBOT_AUTH_TOKEN`, which
remain in `.env.example` for that reason. Renaming or removing it is a
separate, opt-in task.
