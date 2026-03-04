const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { portalMiddleware } = require('../middleware');

const router = express.Router();

// Get portal data (all projects for this client)
router.get('/:token', portalMiddleware, (req, res) => {
  const db = getDb();
  const client = req.client;
  const user = db.prepare('SELECT business_name, full_name, brand_color, email FROM users WHERE id = ?').get(client.user_id);

  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id AND m.status = 'completed') as completed_milestones,
      (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) as total_milestones
    FROM projects p
    WHERE p.client_id = ?
    ORDER BY p.created_at DESC
  `).all(client.id);

  res.json({
    client: { name: client.name, company: client.company },
    freelancer: { businessName: user.business_name, fullName: user.full_name, brandColor: user.brand_color, email: user.email },
    projects
  });
});

// Get specific project details in portal
router.get('/:token/projects/:projectId', portalMiddleware, (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND client_id = ?').get(req.params.projectId, req.client.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY sort_order').all(project.id);
  const files = db.prepare('SELECT id, original_name, file_size, mime_type, created_at FROM files WHERE project_id = ? ORDER BY created_at DESC').all(project.id);
  const messages = db.prepare('SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC').all(project.id);
  const invoices = db.prepare('SELECT * FROM invoices WHERE project_id = ? AND status != ? ORDER BY created_at DESC').all(project.id, 'draft');

  const user = db.prepare('SELECT business_name, full_name, brand_color FROM users WHERE id = ?').get(project.user_id);

  res.json({
    ...project,
    milestones,
    files,
    messages,
    invoices,
    freelancer: { businessName: user.business_name, fullName: user.full_name, brandColor: user.brand_color }
  });
});

// Client sends a message
router.post('/:token/projects/:projectId/messages', portalMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Message content is required' });

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND client_id = ?').get(req.params.projectId, req.client.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const id = uuidv4();
  db.prepare('INSERT INTO messages (id, project_id, sender_type, sender_name, content) VALUES (?, ?, ?, ?, ?)')
    .run(id, project.id, 'client', req.client.name, content);

  res.status(201).json(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));
});

// Download file from portal
router.get('/:token/files/:fileId', portalMiddleware, (req, res) => {
  const db = getDb();
  const file = db.prepare(`
    SELECT f.* FROM files f
    JOIN projects p ON p.id = f.project_id
    WHERE f.id = ? AND p.client_id = ?
  `).get(req.params.fileId, req.client.id);

  if (!file) return res.status(404).json({ error: 'File not found' });

  const path = require('path');
  const filePath = path.join(__dirname, '..', '..', 'uploads', file.stored_name);
  res.download(filePath, file.original_name);
});

module.exports = router;
