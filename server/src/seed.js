import { connectDB, disconnectDB } from './db.js';
import { seedDemo, DEMO } from './services/demoSeed.js';

await connectDB();
const created = await seedDemo();
console.log(created ? `🌱 Seeded demo user: ${DEMO.email} / ${DEMO.password}` : 'Demo user already exists');
await disconnectDB();
