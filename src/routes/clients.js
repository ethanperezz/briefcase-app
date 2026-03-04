const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authMiddleware } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*, COUNT(DISTINCT p.id) as project_count
    FROM clients c
    LEFT JOIN projects p ON p.client_id = c.id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(req.userId);
  res.json(clients);
});

router.post('/', (req, res) => {
  const { name, email, company } = req.body;
  if (!name) return res.status(400).json({ error: 'Client name is required' });

  const db = getDb();
  const id = uuidv4();
  const portalToken = uuidv4();

  db.prepare('INSERT INTO clients (id, user_id, name, email, company, portal_token) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, name, email || null, company || null, portalToken);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.status(201).json(client);
});

router.put('/:id', (req, res) => {
  const { name, email, company } = req.body;
  const db = getDb();

  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  db.prepare('UPDATE clients SET name = ?, email = ?, company = ? WHERE id = ?')
    .run(name || client.name, email ?? client.email, company ?? client.company, req.params.id);

  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
