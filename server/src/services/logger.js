// Tiny structured logger: JSON lines in production (easy to ship to any log store),
// readable lines in development. Levels: debug < info < warn < error.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const min = LEVELS[process.env.LOG_LEVEL] || (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);
const json = process.env.NODE_ENV === 'production' || process.env.LOG_FORMAT === 'json';

function write(level, msg, fields = {}) {
  if (LEVELS[level] < min || process.env.NODE_ENV === 'test') return;
  const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  if (json) {
    out.write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }) + '\n');
  } else {
    const extra = Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
    out.write(`${new Date().toISOString().slice(11, 19)} ${level.toUpperCase().padEnd(5)} ${msg}${extra}\n`);
  }
}

export const log = {
  debug: (m, f) => write('debug', m, f),
  info: (m, f) => write('info', m, f),
  warn: (m, f) => write('warn', m, f),
  error: (m, f) => write('error', m, f),
};
