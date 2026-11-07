import axios from 'axios';
import { config } from '../config.js';

const http = axios.create({ timeout: 8000 });

// ---- Telegram -------------------------------------------------------------
export const telegram = {
  api: (token, method) => `https://api.telegram.org/bot${token}/${method}`,

  // Telegram rejects messages over 4096 characters, so long replies are sent in parts.
  async send(token, chatId, text) {
    const parts = String(text || '').match(/[\s\S]{1,4000}/g) || [''];
    for (const part of parts) await http.post(telegram.api(token, 'sendMessage'), { chat_id: chatId, text: part });
  },

  async getUpdates(token, offset) {
    const { data } = await http.get(telegram.api(token, 'getUpdates'), { params: { timeout: 0, offset, allowed_updates: JSON.stringify(['message', 'edited_message']) } });
    return data;
  },

  async deleteWebhook(token) {
    await http.post(telegram.api(token, 'deleteWebhook'));
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
