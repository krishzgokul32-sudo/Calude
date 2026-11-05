import { Router } from 'express';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { handleMessage } from '../services/assistant.js';

const router = Router();

router.get('/conversations', async (req, res) => {
  res.json(await Conversation.find({ user: req.user._id }).sort({ lastMessageAt: -1 }).limit(100));
});

router.get('/conversations/:id/messages', async (req, res) => {
  const convo = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  res.json(await Message.find({ conversation: convo._id }).sort({ createdAt: 1 }).limit(500));
});

router.delete('/conversations/:id', async (req, res) => {
  const convo = await Conversation.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!convo) return res.status(404).json({ error: 'Conversation not found' });
  await Message.deleteMany({ conversation: convo._id });
  res.json({ ok: true });
});

router.post('/message', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Message text is required' });
  if (text.length > 8000) return res.status(400).json({ error: 'Message is too long' });
  const { conversation, userMessage, reply } = await handleMessage(req.user, text, { conversationId: req.body.conversationId });
  res.json({ conversation, messages: [userMessage, reply] });
});

export default router;
