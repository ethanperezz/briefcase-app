const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'briefcase.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initialize() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      business_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      brand_color TEXT DEFAULT '#6366f1',
      logo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT,
      company TEXT,
      portal_token TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','on_hold','cancelled')),
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed')),
      due_date TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL CHECK(sender_type IN ('freelancer','client')),
      sender_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue','cancelled')),
      due_date TEXT,
      description TEXT,
      line_items TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id);
    CREATE INDEX IF NOT EXISTS idx_clients_token ON clients(portal_token);
    CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
  `);

  return db;
}

function seed() {
  const db = getDb();
  const existingUser = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existingUser) return;

  const userId = uuidv4();
  const clientId = uuidv4();
  const projectId = uuidv4();
  const passwordHash = bcrypt.hashSync('demo123', 10);
  const portalToken = uuidv4();

  db.prepare(`INSERT INTO users (id, email, password_hash, business_name, full_name, brand_color)
    VALUES (?, ?, ?, ?, ?, ?)`).run(userId, 'demo@briefcase.dev', passwordHash, 'Sarah Chen Design', 'Sarah Chen', '#6366f1');

  db.prepare(`INSERT INTO clients (id, user_id, name, email, company, portal_token)
    VALUES (?, ?, ?, ?, ?, ?)`).run(clientId, userId, 'Alex Rivera', 'alex@techstartup.io', 'TechStartup Inc', portalToken);

  db.prepare(`INSERT INTO projects (id, client_id, user_id, name, description, status, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(projectId, clientId, userId, 'Brand Identity Redesign',
    'Complete brand identity overhaul including logo, color palette, typography, and brand guidelines document.',
    'active', '2026-04-15');

  const milestones = [
    { title: 'Discovery & Research', status: 'completed', order: 1 },
    { title: 'Mood Board & Concepts', status: 'completed', order: 2 },
    { title: 'Logo Design (3 Options)', status: 'in_progress', order: 3 },
    { title: 'Color Palette & Typography', status: 'pending', order: 4 },
    { title: 'Brand Guidelines Document', status: 'pending', order: 5 },
  ];

  const insertMilestone = db.prepare(`INSERT INTO milestones (id, project_id, title, status, sort_order)
    VALUES (?, ?, ?, ?, ?)`);

  for (const m of milestones) {
    insertMilestone.run(uuidv4(), projectId, m.title, m.status, m.order);
  }

  const insertMessage = db.prepare(`INSERT INTO messages (id, project_id, sender_type, sender_name, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`);

  insertMessage.run(uuidv4(), projectId, 'freelancer', 'Sarah Chen',
    'Hi Alex! I\'ve completed the discovery phase and put together some initial mood boards. Take a look and let me know your thoughts!',
    '2026-03-01 10:30:00');
  insertMessage.run(uuidv4(), projectId, 'client', 'Alex Rivera',
    'These look amazing, Sarah! I really love the direction of Board #2 — the bold, modern feel is exactly what we\'re going for.',
    '2026-03-01 14:15:00');
  insertMessage.run(uuidv4(), projectId, 'freelancer', 'Sarah Chen',
    'Great choice! I\'ll start developing logo concepts based on that direction. Should have 3 options ready by next week.',
    '2026-03-02 09:00:00');

  db.prepare(`INSERT INTO invoices (id, project_id, user_id, invoice_number, amount, status, due_date, description, line_items)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), projectId, userId, 'INV-001', 2500, 'paid', '2026-03-01',
    'Brand Identity Redesign - Phase 1 Deposit',
    JSON.stringify([
      { description: 'Discovery & Research', amount: 1000 },
      { description: 'Mood Board & Concept Development', amount: 1500 }
    ]));

  db.prepare(`INSERT INTO invoices (id, project_id, user_id, invoice_number, amount, status, due_date, description, line_items)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuidv4(), projectId, userId, 'INV-002', 3500, 'sent', '2026-04-01',
    'Brand Identity Redesign - Phase 2',
    JSON.stringify([
      { description: 'Logo Design & Revisions', amount: 2000 },
      { description: 'Color Palette & Typography', amount: 750 },
      { description: 'Brand Guidelines Document', amount: 750 }
    ]));

  console.log(`Seed data created. Portal link: /portal/${portalToken}`);
}

module.exports = { getDb, initialize, seed };
