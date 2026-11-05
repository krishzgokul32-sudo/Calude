import { motion } from 'framer-motion';

/**
 * The assistant's animated "face". States: idle | thinking | listening | speaking.
 */
export default function AssistantOrb({ size = 120, state = 'idle', onClick }) {
  const pulse = {
    idle: { scale: [1, 1.04, 1], transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' } },
    thinking: { scale: [1, 0.92, 1.06, 1], rotate: [0, 180, 360], transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } },
    listening: { scale: [1, 1.12, 1], transition: { duration: 0.8, repeat: Infinity } },
    speaking: { scale: [1, 1.08, 0.98, 1.1, 1], transition: { duration: 0.9, repeat: Infinity } },
  }[state];

  const ringCount = state === 'idle' ? 2 : 3;

  return (
    <div className="orb-wrap" style={{ width: size * 1.8, height: size * 1.8, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      {Array.from({ length: ringCount }).map((_, i) => (
        <motion.div
          key={`${state}-${i}`}
          className="orb-ring"
          style={{ width: size, height: size }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: state === 'idle' ? 3.5 : 1.6, repeat: Infinity, delay: i * (state === 'idle' ? 1.75 : 0.5), ease: 'easeOut' }}
        />
      ))}
      <motion.div className="orb" style={{ width: size, height: size }} animate={pulse} whileHover={{ scale: 1.06 }}>
        <motion.div
          style={{ position: 'absolute', inset: '18%', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,.65), transparent 60%)' }}
          animate={{ x: [0, size * 0.06, -size * 0.04, 0], y: [0, -size * 0.04, size * 0.05, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}
