// The single source of truth for GK's MCP tools: tiers, categories and tool → category.
// The endpoint, the gate and the Settings → MCP page all read this file.

export const TIERS = {
  read: { label: 'Reads only', description: 'Looks at your data. Changes nothing.' },
  build: { label: 'Creates & edits', description: 'Adds or changes records in GK.' },
  send: { label: 'Sends to people', description: 'Can post to Telegram, Discord, Slack or your bots.' },
  destructive: { label: 'Cannot be undone', description: 'Deletes records permanently.' },
};

// Order here = order on the Settings page. Only read categories start ON.
export const CATEGORIES = [
  { key: 'overview_read', label: 'Overview', description: 'Workspace info and business summary', tier: 'read', defaultOn: true },
  { key: 'tasks_read', label: 'Tasks — read', description: 'See your tasks', tier: 'read', defaultOn: true },
  { key: 'tasks_edit', label: 'Tasks — edit', description: 'Create and update tasks', tier: 'build', defaultOn: false },
  { key: 'notes_read', label: 'Notes — read', description: 'Search your notes', tier: 'read', defaultOn: true },
  { key: 'notes_edit', label: 'Notes — edit', description: 'Save new notes', tier: 'build', defaultOn: false },
  { key: 'reminders_read', label: 'Reminders — read', description: 'See upcoming reminders', tier: 'read', defaultOn: true },
  { key: 'reminders_edit', label: 'Reminders — edit', description: 'Schedule reminders', tier: 'build', defaultOn: false },
  { key: 'business_read', label: 'Business — read', description: 'Leads, invoices, posts and projects', tier: 'read', defaultOn: true },
  { key: 'business_edit', label: 'Business — edit', description: 'Add and update leads, invoices and posts', tier: 'build', defaultOn: false },
  { key: 'bots_read', label: 'Bots — read', description: 'See your connected bots', tier: 'read', defaultOn: true },
  { key: 'send', label: 'Send through bots', description: 'Message your bots, including Telegram, Discord and Slack', tier: 'send', defaultOn: false },
  { key: 'delete', label: 'Delete', description: 'Delete tasks, notes and leads', tier: 'destructive', defaultOn: false },
];

export const TOOLS = {
  get_workspace_info: 'overview_read',
  get_business_summary: 'overview_read',
  list_tasks: 'tasks_read',
  create_task: 'tasks_edit',
  update_task: 'tasks_edit',
  search_notes: 'notes_read',
  create_note: 'notes_edit',
  list_reminders: 'reminders_read',
  set_reminder: 'reminders_edit',
  list_leads: 'business_read',
  list_invoices: 'business_read',
  list_posts: 'business_read',
  list_projects: 'business_read',
  create_lead: 'business_edit',
  update_lead: 'business_edit',
  create_invoice: 'business_edit',
  update_invoice: 'business_edit',
  create_post: 'business_edit',
  list_bots: 'bots_read',
  call_bot: 'send',
  delete_task: 'delete',
  delete_note: 'delete',
  delete_lead: 'delete',
};

/** Effective on/off per category: saved value, else the category default. */
export function resolveCategories(saved = {}) {
  return Object.fromEntries(CATEGORIES.map((c) => [c.key, typeof saved[c.key] === 'boolean' ? saved[c.key] : c.defaultOn]));
}

/** Default-deny: a tool must be in the catalog AND its category switched on. */
export function isToolAllowed(name, enabled) {
  const cat = TOOLS[name];
  return Boolean(cat && enabled[cat] === true);
}

/** Categories with their tools and state, for the Settings page. */
export function catalogForUi(enabled) {
  return CATEGORIES.map((c) => ({
    ...c,
    tierLabel: TIERS[c.tier].label,
    enabled: enabled[c.key] === true,
    tools: Object.entries(TOOLS).filter(([, cat]) => cat === c.key).map(([name]) => name),
  }));
}
