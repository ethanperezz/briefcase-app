const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authMiddleware } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*, c.name as client_name, c.company as client_company,
      (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id AND m.status = 'completed') as completed_milestones,
      (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) as total_milestones
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `).all(req.userId);
  res.json(projects);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare(`
    SELECT p.*, c.name as client_name, c.company as client_company, c.portal_token
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ? AND p.user_id = ?
  `).get(req.params.id, req.userId);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order').all(req.params.id);
  const files = db.prepare('SELECT * FROM files WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id);
  const messages = db.prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC').all(req.params.id);
  const invoices = db.prepare('SELECT * FROM invoices WHERE project_id = ? ORDER BY created_at DESC').all(req.params.id);

  res.json({ ...project, milestones, files, messages, invoices });
});

router.post('/', (req, res) => {
  const { clientId, name, description, dueDate } = req.body;
  if (!clientId || !name) return res.status(400).json({ error: 'Client and project name are required' });

  const db = getDb();
  const client = db.prepare('SELECT id FROM clients WHERE id = ? AND user_id = ?').get(clientId, req.userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const id = uuidv4();
  db.prepare('INSERT INTO projects (id, client_id, user_id, name, description, due_date) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, clientId, req.userId, name, description || null, dueDate || null);

  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const { name, description, status, dueDate } = req.body;
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare('UPDATE projects SET name = ?, description = ?, status = ?, due_date = ? WHERE id = ?')
    .run(name || project.name, description ?? project.description, status || project.status, dueDate ?? project.due_date, req.params.id);

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Milestones
router.post('/:id/milestones', (req, res) => {
  const { title, description, dueDate } = req.body;
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM milestones WHERE project_id = ?').get(req.params.id);
  const id = uuidv4();

  db.prepare('INSERT INTO milestones (id, project_id, title, description, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.params.id, title, description || null, dueDate || null, (maxOrder?.max || 0) + 1);

  res.status(201).json(db.prepare('SELECT * FROM milestones WHERE id = ?').get(id));
});

router.put('/:id/milestones/:milestoneId', (req, res) => {
  const { title, description, status, dueDate } = req.body;
  const db = getDb();

  const milestone = db.prepare(`
    SELECT m.* FROM milestones m
    JOIN projects p ON p.id = m.project_id
    WHERE m.id = ? AND p.id = ? AND p.user_id = ?
  `).get(req.params.milestoneId, req.params.id, req.userId);

  if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

  db.prepare('UPDATE milestones SET title = ?, description = ?, status = ?, due_date = ? WHERE id = ?')
    .run(title || milestone.title, description ?? milestone.description, status || milestone.status, dueDate ?? milestone.due_date, req.params.milestoneId);

  res.json(db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.milestoneId));
});

// Messages
router.post('/:id/messages', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Message content is required' });

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.userId);
  const id = uuidv4();

  db.prepare('INSERT INTO messages (id, project_id, sender_type, sender_name, content) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.params.id, 'freelancer', user.full_name, content);

  res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));
});

// Invoices
router.post('/:id/invoices', (req, res) => {
  const { invoiceNumber, amount, currency, dueDate, description, lineItems } = req.body;
  if (!invoiceNumber || !amount) return res.status(400).json({ error: 'Invoice number and amount are required' });

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const id = uuidv4();
  db.prepare(`INSERT INTO invoices (id, project_id, user_id, invoice_number, amount, currency, due_date, description, line_items)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, req.params.id, req.userId, invoiceNumber, amount,
    currency || 'USD', dueDate || null, description || null, lineItems ? JSON.stringify(lineItems) : null);

  res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id));
});

router.put('/:projectId/invoices/:id', (req, res) => {
  const { status } = req.body;
  const db = getDb();
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
});

module.exports = router;
