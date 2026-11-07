import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, Brain, Mic, Map as MapIcon, PlugZap, Shield, Workflow, LineChart, Swords } from 'lucide-react';
import DarkWarrior from '../components/DarkWarrior';
import ParticleSphere from '../components/ParticleSphere';
import NeuralBrain from '../components/NeuralBrain';
import BotArmy from '../components/BotArmy';

const ARSENAL = [
  { icon: Brain, title: 'Agentic brain', text: 'GK plans, picks the right tools and finishes the job: tasks, notes, reminders, invoices.' },
  { icon: Bot, title: 'An army of bots', text: 'Build your own bots with skills and a persona, then call any of them by @name from chat.' },
  { icon: PlugZap, title: 'Every connector', text: 'Telegram, WhatsApp, Gmail, Slack, Google Maps and more, each with its own key and test.' },
  { icon: Workflow, title: 'MCP server', text: 'Expose GK to Claude Desktop and other AI clients with per-user keys and gated tools.' },
  { icon: Mic, title: 'Voice command', text: 'Speak to GK and hear it answer back. Hands free, at your desk or on the move.' },
  { icon: MapIcon, title: 'Map intelligence', text: 'See clients by city, search places and jump straight into Google Maps.' },
  { icon: LineChart, title: 'War-room dashboards', text: 'Sales, finance, content and project views with live analytics.' },
  { icon: Shield, title: 'Built for battle', text: 'Rate limits, retries, circuit breakers and encrypted keys, ready for 10,000 users.' },
];

const STEPS = [
  ['Summon', 'Create your account and name your assistant.'],
  ['Arm', 'Connect your tools and forge bots for each job.'],
  ['Command', 'Tell GK what you want. It plans, acts and reports back.'],
];

const TITLE = ['GK', 'AGENTIC', 'AI'];
const up = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0 } };

/** Uses your own picture if client/public/hero-warrior.jpg exists, otherwise GK's drawn warrior. */
function HeroArt() {
  const [photo, setPhoto] = useState(true);
  if (photo) return <img className="land-photo" src="/hero-warrior.jpg" alt="GK warrior" onError={() => setPhoto(false)} />;
  return <DarkWarrior className="land-figure" />;
}

export default function Landing() {
  return (
    <div className="landing">
      <div className="land-embers" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.9) % 9}s`, animationDuration: `${8 + (i % 5) * 2}s` }} />
        ))}
      </div>

      <header className="land-nav">
        <Link to="/welcome" className="land-brand"><span className="land-sigil">GK</span>Agentic AI</Link>
        <nav>
          <a href="#army">Army</a>
          <a href="#arsenal">Arsenal</a>
          <a href="#memory">Memory</a>
          <a href="#how">How it works</a>
          <Link to="/login" className="btn btn-ghost">Sign in</Link>
        </nav>
      </header>

      <section className="land-hero">
        <motion.div className="land-copy" initial="hidden" animate="show" transition={{ staggerChildren: 0.12 }}>
          <motion.span className="land-kicker" variants={up}><Swords size={14} /> Your personal agent, armed and ready</motion.span>
          <h1 className="land-title">
            {TITLE.map((w, i) => (
              <motion.span key={w} variants={up} transition={{ type: 'spring', damping: 14 }} className={i === 0 ? 'gradient-text' : ''}>{w}</motion.span>
            ))}
          </h1>
          <motion.p variants={up} className="land-lead">
            A dark guardian for your work and life. GK thinks, plans and acts across your tools, your bots and your data, so you only give the order.
          </motion.p>
          <motion.div variants={up} className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <Link to="/login?mode=register" className="btn btn-primary land-cta">Enlist now <ArrowRight size={17} /></Link>
            <Link to="/login" className="btn btn-ghost land-cta">I already have an account</Link>
          </motion.div>
          <motion.div variants={up} className="land-stats">
            <div><b className="mono-num">20+</b><span>connectors</span></div>
            <div><b className="mono-num">10k</b><span>users ready</span></div>
            <div><b className="mono-num">24/7</b><span>on guard</span></div>
          </motion.div>
        </motion.div>

        <motion.div className="land-warrior" initial={{ opacity: 0, scale: 0.92, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}>
          <div className="land-halo" />
          <div className="land-sphere"><ParticleSphere size={560} density={0.9} /></div>
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
            <HeroArt />
          </motion.div>
          <div className="land-ground" />
          <motion.div className="float-card land-tag tilt-l" style={{ left: '-4%', top: '18%' }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}>
            <span className="accent-dot">✦</span> 3 tasks done while you slept
          </motion.div>
          <motion.div className="float-card land-tag tilt-r" style={{ right: '-4%', top: '82%' }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.3 }}>
            <span className="accent-dot">@</span> @sales bot drafted 4 follow-ups
          </motion.div>
        </motion.div>
      </section>

      <section id="army" className="land-section land-battle">
        <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} variants={up}>Assemble your <span className="gradient-text">bot army</span></motion.h2>
        <p className="land-sub" style={{ marginBottom: 0 }}>Every bot you build stands with GK against the daily chaos.</p>
        <motion.div className="army-frame" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8 }}>
          <BotArmy />
        </motion.div>
      </section>

      <section id="arsenal" className="land-section">
        <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} variants={up}>The <span className="gradient-text">Arsenal</span></motion.h2>
        <p className="land-sub">Everything GK carries into battle for you.</p>
        <div className="land-grid">
          {ARSENAL.map(({ icon: Icon, title, text }, i) => (
            <motion.article key={title} className="glass land-card" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay: (i % 4) * 0.08 }} whileHover={{ y: -6 }}>
              <span className="land-icon"><Icon size={20} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="memory" className="land-section">
        <div className="land-memory">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <span className="land-kicker"><Brain size={14} /> Memory layer</span>
            <h2 style={{ marginTop: 16 }}>Context windows are expanding. <span className="gradient-text">Memory is the new platform.</span></h2>
            <p className="land-sub">AI models went from reading 4K tokens to millions. GK adds memory that does not reset when the chat ends.</p>
            <ul>
              <li>Your notes, tasks and reminders</li>
              <li>Every conversation and decision</li>
              <li>Each bot&apos;s skills and history</li>
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.9 }}>
            <NeuralBrain />
          </motion.div>
        </div>
      </section>

      <section id="how" className="land-section">
        <h2>Three moves to <span className="gradient-text">command</span></h2>
        <div className="land-steps">
          {STEPS.map(([t, d], i) => (
            <motion.div key={t} className="land-step" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
              <span className="land-step-n mono-num">0{i + 1}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="land-final glass">
        <DarkWarrior className="land-final-fig" />
        <div>
          <h2>Your guardian is waiting.</h2>
          <p className="land-sub" style={{ margin: '8px 0 20px' }}>Free to start. Bring your own AI key, keep full control.</p>
          <Link to="/login?mode=register" className="btn btn-primary land-cta">Summon GK <ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer className="land-foot">
        <span className="land-brand"><span className="land-sigil">GK</span>Agentic AI</span>
        <span className="muted small">React · Node.js · MongoDB · Python</span>
      </footer>
    </div>
  );
}
