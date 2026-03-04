const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authMiddleware } = require('../middleware');

const router = express.Router();
router.use(authMiddleware);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

router.post('/upload/:projectId', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.projectId, req.userId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const id = uuidv4();
  db.prepare('INSERT INTO files (id, project_id, user_id, original_name, stored_name, file_size, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.params.projectId, req.userId, req.file.originalname, req.file.filename, req.file.size, req.file.mimetype);

  res.status(201).json(db.prepare('SELECT * FROM files WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const file = db.prepare(`
    SELECT f.* FROM files f
    JOIN projects p ON p.id = f.project_id
    WHERE f.id = ? AND p.user_id = ?
  `).get(req.params.id, req.userId);

  if (!file) return res.status(404).json({ error: 'File not found' });

  const fs = require('fs');
  const filePath = path.join(__dirname, '..', '..', 'uploads', file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
