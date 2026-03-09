let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.account_sid || !connectionSettings.settings.api_key || !connectionSettings.settings.api_key_secret)) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

export async function getTwilioClient() {
  const { accountSid, apiKey, apiKeySecret } = await getCredentials();

  if (accountSid.startsWith('AC')) {
    const twilio = (await import('twilio')).default;
    return twilio(apiKey, apiKeySecret, { accountSid });
  }

  return new TwilioRestClient(apiKey, apiKeySecret, accountSid);
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

export async function getTwilioAccountSid() {
  const { accountSid } = await getCredentials();
  return accountSid;
}

class TwilioRestClient {
  private authHeader: string;
  private accountSid: string;

  constructor(apiKey: string, apiKeySecret: string, accountSid: string) {
    this.authHeader = 'Basic ' + Buffer.from(apiKey + ':' + apiKeySecret).toString('base64');
    this.accountSid = accountSid;
  }

  get conversations() {
    return {
      v1: {
        conversations: (conversationSid: string) => ({
          messages: {
            create: async (params: { body: string }) => {
              const url = `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Messages`;
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Authorization': this.authHeader,
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ Body: params.body }).toString(),
              });
              if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`Twilio API error ${response.status}: ${error.message || response.statusText}`);
              }
              return response.json();
            },
          },
        }),
      },
    };
  }

  get messages() {
    return {
      create: async (params: { body: string; to: string; from: string }) => {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            Body: params.body,
            To: params.to,
            From: params.from,
          }).toString(),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(`Twilio API error ${response.status}: ${error.message || response.statusText}`);
        }
        return response.json();
      },
    };
  }
}
