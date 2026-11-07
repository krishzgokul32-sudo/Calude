import { LayoutDashboard, MessageSquareText, ListTodo, StickyNote, Bell, Bot, Settings, BarChart3, Megaphone, Wallet, Clapperboard, FolderKanban, Plug, Server, Map as MapIcon } from 'lucide-react';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chat', label: 'Assistant', icon: MessageSquareText },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/bots', label: 'Bot Hub', icon: Bot },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/connections', label: 'Connections', icon: Plug },
  { to: '/mcp', label: 'MCP server', icon: Server },
  { group: 'Teams' },
  { to: '/admin', label: 'Overview', icon: BarChart3 },
  { to: '/admin/sales', label: 'Sales & Marketing', icon: Megaphone },
  { to: '/admin/finance', label: 'Finance', icon: Wallet },
  { to: '/admin/content', label: 'Content', icon: Clapperboard },
  { to: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { group: '' },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const NAV_LINKS = NAV.filter((n) => n.to);
// Bottom bar on phones.
export const MOBILE_NAV = ['/', '/chat', '/admin', '/tasks', '/bots', '/settings'].map((to) => NAV_LINKS.find((n) => n.to === to));
