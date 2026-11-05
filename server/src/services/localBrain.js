import { parseWhen } from './timeParser.js';

// Rule-based brain used when no ANTHROPIC_API_KEY is configured.
// It understands the core personal-assistant commands and routes to actions.
const fmtDate = (d) => new Date(d).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });

const HELP = `Here's what I can do:
- **Tasks** — "add task buy milk", "show my tasks", "complete buy milk"
- **Notes** — "note: meeting ideas — ship v2 on Friday", "search notes v2"
- **Reminders** — "remind me to call mom in 20 minutes", "remind me to stretch tomorrow at 9am"
- **Bots** — mention any bot with \`@handle\`, e.g. "@weather in Tokyo", "@calc 12*7", or say "list bots"
- **Analysis** — "analyze: I love this new feature but the login is slow"

_Tip: add your Claude API key in **Settings** to unlock full conversational AI._`;

export function detectIntent(text) {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (/^(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(lower)) return { intent: 'greet' };
  if (/\b(help|what can you do|commands)\b/.test(lower)) return { intent: 'help' };

  let m;
  if ((m = t.match(/^remind me (?:to |about )?(.+)$/i))) {
    const when = parseWhen(m[1]);
    const what = when ? m[1].replace(when.match, '').replace(/\s{2,}/g, ' ').trim() : m[1];
    return { intent: 'set_reminder', text: what.replace(/^to\s+/i, ''), when: when?.match || null };
  }
  if (/\b(my |list |show |upcoming )+reminders?\b/i.test(t)) return { intent: 'list_reminders' };

  if ((m = t.match(/^(?:add|create|new)\s+(?:a\s+)?(?:task|todo)[:\s]+(.+)$/i)) || (m = t.match(/^todo[:\s]+(.+)$/i))) {
    const priority = /\b(urgent|important|asap|high priority)\b/i.test(m[1]) ? 'high' : 'medium';
    return { intent: 'create_task', title: m[1].replace(/\b(urgent|asap|high priority)\b/gi, '').trim(), priority };
  }
  if ((m = t.match(/^(?:complete|finish|done|mark)\s+(?:task\s+)?(.+?)(?:\s+as done)?$/i))) return { intent: 'complete_task', title: m[1] };
  if (/\b(my |list |show |open )+(tasks|todos?|to-dos?)\b/i.test(t) || /^tasks\??$/i.test(t)) return { intent: 'list_tasks' };

  if ((m = t.match(/^(?:note|save note|remember)[:\s]+(.+)$/i))) {
    const [title, ...rest] = m[1].split(/\s+[—-]\s+|:\s+/);
    return { intent: 'create_note', title: title.slice(0, 80), content: rest.join(' — ') || m[1] };
  }
  if ((m = t.match(/^(?:search|find) notes?\s+(?:for\s+)?(.+)$/i))) return { intent: 'search_notes', query: m[1] };

  if (/\b(list|show|my) bots\b/i.test(t)) return { intent: 'list_bots' };
  if ((m = t.match(/^(?:analy[sz]e|sentiment)[:\s]+(.+)$/i))) return { intent: 'analyze_text', text: m[1] };
  if (/\b(time|date|day) (is it|today)\b/i.test(lower)) return { intent: 'time' };

  return { intent: 'unknown' };
}

export async function localReply(user, text, actions) {
  const intent = detectIntent(text);
  const name = user.name?.split(' ')[0] || 'there';
  const act = (tool, input) => ({ tool, input, ok: true });

  switch (intent.intent) {
    case 'greet':
      return { text: `Hey ${name}! 👋 I'm ${user.assistantName}. How can I help today? Say **help** to see what I can do.`, actions: [] };
    case 'help':
      return { text: HELP, actions: [] };
    case 'time':
      return { text: `🕒 It's ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}.`, actions: [] };
    case 'create_task': {
      const task = await actions.create_task(intent);
      return { text: `✅ Added task **${task.title}**${task.priority === 'high' ? ' (high priority 🔥)' : ''}.`, actions: [act('create_task', intent)] };
    }
    case 'list_tasks': {
      const tasks = await actions.list_tasks();
      if (!tasks.length) return { text: '🎉 You have no open tasks. Enjoy the free time!', actions: [] };
      return { text: `📋 You have ${tasks.length} open task(s):\n` + tasks.map((t) => `- ${t.priority === 'high' ? '🔥 ' : ''}${t.title}`).join('\n'), actions: [] };
    }
    case 'complete_task': {
      const task = await actions.complete_task(intent);
      return { text: `🏁 Marked **${task.title}** as done. Nice work!`, actions: [act('complete_task', intent)] };
    }
    case 'create_note': {
      const note = await actions.create_note(intent);
      return { text: `📝 Saved note **${note.title}**.`, actions: [act('create_note', intent)] };
    }
    case 'search_notes': {
      const notes = await actions.search_notes(intent);
      if (!notes.length) return { text: `No notes found for "${intent.query}".`, actions: [] };
      return { text: `🔎 Found ${notes.length} note(s):\n` + notes.map((n) => `- **${n.title}** — ${n.content.slice(0, 80)}`).join('\n'), actions: [] };
    }
    case 'set_reminder': {
      if (!intent.when) return { text: `When should I remind you to "${intent.text}"? e.g. "remind me to ${intent.text} in 15 minutes"`, actions: [] };
      const r = await actions.set_reminder(intent);
      return { text: `⏰ I'll remind you to **${r.text}** on ${fmtDate(r.remindAt)}.`, actions: [act('set_reminder', intent)] };
    }
    case 'list_reminders': {
      const rs = await actions.list_reminders();
      if (!rs.length) return { text: 'No upcoming reminders.', actions: [] };
      return { text: '⏰ Upcoming reminders:\n' + rs.map((r) => `- ${r.text} — ${fmtDate(r.remindAt)}`).join('\n'), actions: [] };
    }
    case 'list_bots': {
      const bots = await actions.list_bots();
      if (!bots.length) return { text: 'No bots connected yet. Open the **Bot Hub** to create one.', actions: [] };
      return { text: '🤖 Your bots:\n' + bots.map((b) => `- \`@${b.handle}\` — ${b.name} (${b.type})${b.enabled ? '' : ' _disabled_'}`).join('\n'), actions: [] };
    }
    case 'analyze_text': {
      try {
        const a = await actions.analyze_text(intent);
        return {
          text: `🧠 **Sentiment:** ${a.sentiment.label} (${a.sentiment.score})\n**Keywords:** ${a.keywords.join(', ') || '—'}\n**Intent:** ${a.intent.intent}`,
          actions: [act('analyze_text', intent)],
        };
      } catch (e) {
        return { text: e.message, actions: [] };
      }
    }
    default:
      return {
        text: `I'm not sure how to handle that yet, ${name}. Try **help**, or mention a bot like \`@wiki ${text.slice(0, 30)}\`.`,
        actions: [],
      };
  }
}
