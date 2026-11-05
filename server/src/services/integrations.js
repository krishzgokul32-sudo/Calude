import axios from 'axios';

// Every tool GK can connect to: what to ask the user for, and how to check it works.
// Each test makes one read-only call to the tool's own API and returns the account name.
const http = axios.create({ timeout: 10000 });
const graph = (path, token, params = {}) => http.get(`https://graph.facebook.com/${path}`, { params, headers: { Authorization: `Bearer ${token}` } });

async function googleAccessToken({ clientId, clientSecret, refreshToken }) {
  const { data } = await http.post(
    'https://oauth2.googleapis.com/token',
    new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
  );
  return data.access_token;
}

const GOOGLE_FIELDS = [
  { key: 'clientId', label: 'OAuth client ID', secret: false },
  { key: 'clientSecret', label: 'OAuth client secret', secret: true },
  { key: 'refreshToken', label: 'Refresh token', secret: true },
];
const GOOGLE_HELP = [
  'In Google Cloud Console, create a project and enable the API.',
  'Create an OAuth client (type: Web application) and add https://developers.google.com/oauthplayground as a redirect URI.',
  'In the OAuth Playground (gear icon → use your own credentials), authorize the scope below and exchange the code for a refresh token.',
];

export const PROVIDERS = {
  whatsapp: {
    name: 'WhatsApp Business',
    icon: '💬',
    description: 'Answer customers and follow up on leads over WhatsApp (Cloud API).',
    fields: [
      { key: 'phoneNumberId', label: 'Phone number ID', secret: false },
      { key: 'accessToken', label: 'Permanent access token', secret: true },
    ],
    help: ['Open developers.facebook.com → your app → WhatsApp → API Setup.', 'Copy the Phone number ID.', 'Create a permanent token: Business Settings → System users → Generate token with whatsapp_business_messaging.'],
    async test({ phoneNumberId, accessToken }) {
      const { data } = await graph(phoneNumberId, accessToken, { fields: 'display_phone_number,verified_name' });
      return `${data.verified_name || 'WhatsApp'} · ${data.display_phone_number || phoneNumberId}`;
    },
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    description: 'Read posts and insights, and reply to DMs for an Instagram business account.',
    fields: [
      { key: 'igUserId', label: 'Instagram business account ID', secret: false },
      { key: 'accessToken', label: 'Access token', secret: true },
    ],
    help: ['Connect your Instagram business account to a Facebook Page.', 'In Graph API Explorer, get a token with instagram_basic, instagram_manage_messages and pages_show_list.', 'Find the account ID with GET me/accounts?fields=instagram_business_account.'],
    async test({ igUserId, accessToken }) {
      const { data } = await graph(igUserId, accessToken, { fields: 'username' });
      return `@${data.username}`;
    },
  },
  metaAds: {
    name: 'Meta Ads',
    icon: '📣',
    description: 'Pull ad spend and campaign results into the Sales & Marketing dashboard.',
    fields: [
      { key: 'adAccountId', label: 'Ad account ID (act_…)', secret: false },
      { key: 'accessToken', label: 'Access token', secret: true },
    ],
    help: ['Open Business Settings → Ad accounts and copy the ID (add the act_ prefix).', 'Generate a system-user token with ads_read.'],
    async test({ adAccountId, accessToken }) {
      const id = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
      const { data } = await graph(id, accessToken, { fields: 'name,currency' });
      return `${data.name} (${data.currency})`;
    },
  },
  youtube: {
    name: 'YouTube',
    icon: '▶️',
    description: 'Track channel views and subscribers on the Content dashboard.',
    fields: [
      { key: 'channelId', label: 'Channel ID (UC…)', secret: false },
      { key: 'apiKey', label: 'YouTube Data API key', secret: true },
    ],
    help: ['In Google Cloud Console, enable "YouTube Data API v3".', 'Create an API key under Credentials.', 'Find your channel ID in YouTube Studio → Settings → Channel → Advanced.'],
    async test({ channelId, apiKey }) {
      const { data } = await http.get('https://www.googleapis.com/youtube/v3/channels', { params: { part: 'snippet,statistics', id: channelId, key: apiKey } });
      const ch = data.items?.[0];
      if (!ch) throw new Error('No channel found with that ID');
      return `${ch.snippet.title} · ${Number(ch.statistics.subscriberCount || 0).toLocaleString()} subscribers`;
    },
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    description: 'Post updates and track engagement from your LinkedIn account.',
    fields: [{ key: 'accessToken', label: 'Access token', secret: true }],
    help: ['Create an app at linkedin.com/developers and add "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn".', 'Use the OAuth token generator tool with the openid, profile and w_member_social scopes.'],
    async test({ accessToken }) {
      const { data } = await http.get('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
      return data.name || data.email || 'LinkedIn member';
    },
  },
  gmail: {
    name: 'Gmail',
    icon: '✉️',
    description: 'Read and send email, and log invoices that arrive by email.',
    fields: GOOGLE_FIELDS,
    help: [...GOOGLE_HELP, 'Scope: https://www.googleapis.com/auth/gmail.modify'],
    async test(c) {
      const token = await googleAccessToken(c);
      const { data } = await http.get('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${token}` } });
      return data.emailAddress;
    },
  },
  sheets: {
    name: 'Google Sheets',
    icon: '📊',
    description: 'Sync leads, invoices and reports with a Google Sheet.',
    fields: [...GOOGLE_FIELDS, { key: 'spreadsheetId', label: 'Spreadsheet ID (from the sheet URL)', secret: false }],
    help: [...GOOGLE_HELP, 'Scope: https://www.googleapis.com/auth/spreadsheets', 'The spreadsheet ID is the long code in the sheet URL between /d/ and /edit.'],
    async test(c) {
      const token = await googleAccessToken(c);
      const { data } = await http.get(`https://sheets.googleapis.com/v4/spreadsheets/${c.spreadsheetId}`, { params: { fields: 'properties.title' }, headers: { Authorization: `Bearer ${token}` } });
      return data.properties.title;
    },
  },
};

/** Turn an API failure into a sentence a person can act on. */
export function explainError(err) {
  const r = err.response;
  if (r) {
    const msg = r.data?.error?.message || r.data?.error_description || r.data?.message || (typeof r.data?.error === 'string' ? r.data.error : '');
    if (r.status === 401 || r.status === 403) return `The tool rejected these credentials (${r.status})${msg ? `: ${msg}` : ''}. Check the token and its permissions.`;
    if (r.status === 404) return `Not found (404)${msg ? `: ${msg}` : ''}. Check the ID.`;
    return `The tool returned an error (${r.status})${msg ? `: ${msg}` : ''}.`;
  }
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN'].includes(err.code)) return "Couldn't reach the tool's servers. Check this server's internet connection.";
  return err.message || 'Connection test failed.';
}

/** Provider list for the UI (no functions). */
export const providerCatalog = () =>
  Object.entries(PROVIDERS).map(([key, p]) => ({ key, name: p.name, icon: p.icon, description: p.description, help: p.help, fields: p.fields }));
