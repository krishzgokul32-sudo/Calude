import { LayoutDashboard, MessageSquareText, ListTodo, StickyNote, Bell, Bot, Settings } from 'lucide-react';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/chat', label: 'Assistant', icon: MessageSquareText },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/bots', label: 'Bot Hub', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
];
