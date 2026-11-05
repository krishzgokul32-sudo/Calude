import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Moon, Sun, Command } from 'lucide-react';
import { NAV } from '../lib/nav';
import { useAuth } from '../context/AuthContext';
import AssistantOrb from './AssistantOrb';
import CommandPalette from './CommandPalette';


export default function Layout() {
  const { user, logout, updateUser } = useAuth();
  const location = useLocation();
  const [palette, setPalette] = useState(false);
  const theme = user?.preferences?.theme || 'dark';

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell">
      <motion.aside className="sidebar" initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 26 }}>
        <div className="brand">
          <AssistantOrb size={22} />
          <h2 className="gradient-text" style={{ marginLeft: -14 }}>{user?.assistantName || 'GK'}</h2>
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.div layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 450, damping: 34 }} />}
                <Icon size={19} />
                {label}
              </>
            )}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          <button className="btn btn-ghost" onClick={() => setPalette(true)} style={{ justifyContent: 'space-between' }}>
            <span className="row"><Command size={16} /> Quick actions</span>
            <span className="kbd">Ctrl K</span>
          </button>
          <div className="user-chip">
            <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
            <motion.button
              className="icon-btn"
              whileTap={{ rotate: 180, scale: 0.8 }}
              onClick={() => updateUser({ preferences: { theme: theme === 'dark' ? 'light' : 'dark' } })}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </motion.button>
            <button className="icon-btn" onClick={logout} aria-label="Log out">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </motion.aside>

      <main className="main">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="mobile-nav">
        {NAV.slice(0, 6).map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} aria-label={label}>
            <Icon size={21} />
          </NavLink>
        ))}
      </nav>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
