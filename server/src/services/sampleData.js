import Lead, { LEAD_SOURCES } from '../models/Lead.js';
import Invoice from '../models/Invoice.js';
import Post, { PLATFORMS } from '../models/Post.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';

// Realistic-looking sample records so the team dashboards have something to show.
const DAY = 864e5;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const ago = (days) => new Date(Date.now() - days * DAY - rand(0, DAY));
// Skewed toward recent days, like a growing business.
const recent = (max) => Math.floor(max * Math.random() ** 1.7);

const NAMES = ['Aarav Shah', 'Priya Nair', 'Rahul Verma', 'Ananya Iyer', 'Vikram Rao', 'Sneha Pillai', 'Karthik Raj', 'Divya Menon', 'Arjun Das', 'Meera Kapoor', 'Rohan Gupta', 'Isha Reddy'];
const COMPANIES = ['Bloom Studio', 'Nimbus Labs', 'Spice Route Foods', 'Orbit Fitness', 'Kaveri Textiles', 'Pixel Forge', 'GreenLeaf Organics', 'UrbanNest Realty'];
const TITLES = ['5 tips to grow on Instagram', 'Behind the scenes: our studio', 'Client success story', 'How we plan a launch', 'Weekly product demo', 'Founder Q&A', 'Top tools we use', 'Before & after reel', 'Customer testimonial', 'Industry news roundup'];

export async function hasBusinessData(user) {
  const counts = await Promise.all([Lead, Invoice, Post, Project].map((M) => M.countDocuments({ user })));
  return counts.some(Boolean);
}

export async function createSampleData(user) {
  const stamp = (d) => ({ createdAt: d, updatedAt: d });
  const stages = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

  const leads = Array.from({ length: 260 }, () => {
    const created = ago(recent(360));
    const stage = pick([...stages, 'new', 'contacted', 'won']);
    const closed = new Date(Math.min(Date.now(), created.getTime() + rand(2, 25) * DAY));
    return {
      user,
      name: pick(NAMES),
      company: pick(COMPANIES),
      email: '',
      source: pick(LEAD_SOURCES),
      stage,
      value: rand(8, 120) * 1000,
      createdAt: created,
      updatedAt: ['won', 'lost'].includes(stage) ? closed : created,
    };
  });

  const invoices = [];
  for (let m = 0; m < 12; m++) {
    for (let k = 0; k < rand(8, 14); k++) {
      const issue = ago(m * 30 + rand(0, 28));
      const status = m === 0 ? pick(['paid', 'paid', 'paid', 'sent', 'draft']) : m === 1 ? pick(['paid', 'paid', 'paid', 'paid', 'sent', 'overdue']) : pick(['paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'overdue']);
      invoices.push({
        user,
        number: `INV-${String(1000 + invoices.length)}`,
        client: pick(COMPANIES),
        amount: rand(6, 40) * 1000,
        kind: 'income',
        category: 'services',
        status,
        issueDate: issue,
        dueDate: new Date(issue.getTime() + 15 * DAY),
        paidAt: status === 'paid' ? new Date(Math.min(Date.now(), issue.getTime() + rand(1, 10) * DAY)) : undefined,
        ...stamp(issue),
      });
    }
    for (const category of ['software', 'salaries', 'ads', 'office']) {
      const issue = ago(m * 30 + rand(0, 28));
      const base = { software: 4, salaries: 38, ads: 12, office: 6 }[category];
      invoices.push({ user, number: `EXP-${String(500 + invoices.length)}`, client: category, amount: rand(base, base * 1.5) * 1000, kind: 'expense', category, status: 'paid', issueDate: issue, paidAt: issue, ...stamp(issue) });
    }
  }

  const posts = Array.from({ length: 200 }, () => {
    const status = pick(['published', 'published', 'published', 'scheduled', 'draft', 'idea']);
    const published = ago(recent(360));
    const platform = pick(PLATFORMS);
    const views = status === 'published' ? rand(300, platform === 'youtube' ? 40000 : 15000) : 0;
    return {
      user,
      title: pick(TITLES),
      platform,
      status,
      publishedAt: status === 'published' ? published : undefined,
      scheduledAt: status === 'scheduled' ? new Date(Date.now() + rand(1, 20) * DAY) : undefined,
      views,
      likes: Math.round(views * (rand(2, 8) / 100)),
      comments: Math.round(views * (rand(2, 10) / 1000)),
      shares: Math.round(views * (rand(1, 6) / 1000)),
      ...stamp(published),
    };
  });

  await Promise.all([Lead.insertMany(leads, { timestamps: false }), Invoice.insertMany(invoices, { timestamps: false }), Post.insertMany(posts, { timestamps: false })]);

  const projectSpecs = [
    { name: 'Website redesign', client: 'Bloom Studio', status: 'active', budget: 250000, deadline: new Date(Date.now() + 20 * DAY), tasks: ['Wireframes', 'Visual design', 'Build homepage', 'CMS setup', 'QA & launch', 'Analytics setup'] },
    { name: 'Spring ad campaign', client: 'Orbit Fitness', status: 'active', budget: 120000, deadline: new Date(Date.now() + 9 * DAY), tasks: ['Creative brief', 'Shoot videos', 'Write ad copy', 'Launch Meta ads', 'Weekly report'] },
    { name: 'Mobile app MVP', client: 'Nimbus Labs', status: 'planning', budget: 600000, deadline: new Date(Date.now() + 75 * DAY), tasks: ['Scope workshop', 'User flows', 'Tech plan'] },
    { name: 'Brand guidelines', client: 'GreenLeaf Organics', status: 'done', budget: 80000, deadline: ago(10), tasks: ['Logo refresh', 'Color system', 'Typography', 'Guideline PDF'] },
  ];
  for (const spec of projectSpecs) {
    const project = await Project.create({ user, ...spec, tasks: undefined });
    const tasks = spec.tasks.map((title, i) => {
      const done = spec.status === 'done' || (spec.status === 'active' && i < spec.tasks.length / 2);
      const finished = ago(rand(0, 80));
      return {
        user,
        project: project._id,
        title,
        priority: pick(['low', 'medium', 'high']),
        status: done ? 'done' : pick(['todo', 'in_progress']),
        completedAt: done ? finished : undefined,
        dueDate: done ? undefined : new Date(Date.now() + rand(-5, 25) * DAY),
        ...stamp(done ? finished : ago(rand(0, 30))),
      };
    });
    await Task.insertMany(tasks, { timestamps: false });
  }
  return { leads: leads.length, invoices: invoices.length, posts: posts.length, projects: projectSpecs.length };
}
