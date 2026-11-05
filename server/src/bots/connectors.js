import axios from 'axios';
import { config } from '../config.js';

const http = axios.create({ timeout: 8000 });

// ---- Telegram -------------------------------------------------------------
export const telegram = {
  api: (token, method) => `https://api.telegram.org/bot${token}/${method}`,

  async send(token, chatId, text) {
    await http.post(telegram.api(token, 'sendMessage'), { chat_id: chatId, text });
  },

  async getMe(token) {
    const { data } = await http.get(telegram.api(token, 'getMe'));
    return data.result;
  },

  // Telegram pushes every message the bot receives to our inbound endpoint.
  async setWebhook(token, botId, secret) {
    const url = `${config.publicApiUrl}/api/integrations/telegram/${botId}`;
    const { data } = await http.post(telegram.api(token, 'setWebhook'), { url, secret_token: secret });
    return { ...data, url };
  },
};

// ---- Discord / Slack incoming webhooks (outbound notifications) ------------
export async function postDiscord(webhookUrl, text) {
  await http.post(webhookUrl, { content: text.slice(0, 2000), username: 'Personal Assistant' });
}

export async function postSlack(webhookUrl, text) {
  await http.post(webhookUrl, { text });
}
