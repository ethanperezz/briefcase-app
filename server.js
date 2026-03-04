require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initialize, seed } = require('./src/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initialize();
seed();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// NOTE: /uploads is NOT served statically — files are only accessible via authenticated routes

// API Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/clients', require('./src/routes/clients'));
app.use('/api/projects', require('./src/routes/projects'));
app.use('/api/files', require('./src/routes/files'));
app.use('/api/portal', require('./src/routes/portal'));

// Serve portal page for portal links
app.get('/portal/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal', 'index.html'));
});

app.get('/portal/:token/project/:projectId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal', 'project.html'));
});

// SPA fallback for dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n  ✦ Briefcase is running at http://localhost:${PORT}`);
  console.log(`  ✦ Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`  ✦ Demo login: demo@briefcase.dev / demo123\n`);
});
