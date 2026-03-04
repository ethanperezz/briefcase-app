/* ============================================
   BRIEFCASE — Dashboard Application
   ============================================ */

const API = '/api';
let token = localStorage.getItem('briefcase_token');
let currentUser = null;
let currentProject = null;
let clientsCache = [];

// ---- Auth ----
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    token = data.token;
    localStorage.setItem('briefcase_token', token);
    currentUser = data.user;
    showDashboard();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function register() {
  const fullName = document.getElementById('regName').value;
  const businessName = document.getElementById('regBusiness').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, businessName, fullName })
    });
    token = data.token;
    localStorage.setItem('briefcase_token', token);
    currentUser = data.user;
    showDashboard();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('briefcase_token');
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginPage').style.display = 'block';
}

function showLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}

async function showDashboard() {
  if (!currentUser) {
    try {
      currentUser = await api('/auth/me');
    } catch {
      logout();
      return;
    }
  }

  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('app').style.display = 'grid';

  // Update sidebar
  const initials = currentUser.fullName.split(' ').map(n => n[0]).join('');
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userName').textContent = currentUser.fullName;
  document.getElementById('userEmail').textContent = currentUser.email;

  navigate('overview');
}

// ---- Navigation ----
function navigate(page, data) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));

  const navLink = document.querySelector(`[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');

  const el = document.getElementById(`page-${page}`);
  if (el) el.style.display = 'block';

  switch (page) {
    case 'overview': loadOverview(); break;
    case 'clients': loadClients(); break;
    case 'projects': loadProjects(); break;
    case 'project-detail': loadProjectDetail(data); break;
  }
}

document.querySelectorAll('.sidebar-nav a').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(a.dataset.page);
  });
});

// ---- Overview ----
async function loadOverview() {
  let clients, projects;
  try {
    [clients, projects] = await Promise.all([
      api('/clients'),
      api('/projects')
    ]);
  } catch { return; }
  clientsCache = clients;

  const active = projects.filter(p => p.status === 'active');

  document.getElementById('statsGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Clients</div>
      <div class="stat-value">${clients.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active Projects</div>
      <div class="stat-value">${active.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Projects</div>
      <div class="stat-value">${projects.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Completion Rate</div>
      <div class="stat-value">${projects.length ? Math.round(projects.filter(p => p.status === 'completed').length / projects.length * 100) : 0}%</div>
    </div>
  `;

  renderProjectList(active, 'activeProjectsList');
}

// ---- Clients ----
async function loadClients() {
  let clients;
  try {
    clients = await api('/clients');
  } catch { return; }
  clientsCache = clients;

  if (!clients.length) {
    document.getElementById('clientsList').innerHTML = `
      <div class="empty-state">
        <h3>No clients yet</h3>
        <p>Add your first client to get started.</p>
        <button class="btn btn-primary" onclick="openModal('addClient')">Add Client</button>
      </div>`;
    return;
  }

  document.getElementById('clientsList').innerHTML = clients.map(c => `
    <div class="list-item" onclick="showClientProjects('${c.id}')">
      <div class="item-main">
        <div class="item-icon" style="background:var(--primary-bg);color:var(--primary);">
          ${c.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
        </div>
        <div>
          <div class="item-title">${esc(c.name)}</div>
          <div class="item-subtitle">${esc(c.company || c.email || 'No company')}</div>
        </div>
      </div>
      <div class="item-meta">
        <span style="font-size:13px;color:var(--text-secondary);">${c.project_count} project${c.project_count !== 1 ? 's' : ''}</span>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();copyText('${location.origin}/portal/${c.portal_token}')">Copy Link</button>
      </div>
    </div>
  `).join('');
}

async function showClientProjects(clientId) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
  const navLink = document.querySelector('[data-page="projects"]');
  if (navLink) navLink.classList.add('active');
  document.getElementById('page-projects').style.display = 'block';

  try {
    const projects = await api('/projects');
    const filtered = projects.filter(p => p.client_id === clientId);
    const client = clientsCache.find(c => c.id === clientId);
    const label = client ? `${client.name}'s Projects` : 'Projects';
    document.querySelector('#page-projects .page-header h2').textContent = label;
    renderProjectList(filtered, 'projectsList');
  } catch { return; }
}

// ---- Projects ----
async function loadProjects() {
  try {
    const [projects, clients] = await Promise.all([
      api('/projects'),
      api('/clients')
    ]);
    clientsCache = clients;
    renderProjectList(projects, 'projectsList');
  } catch { return; }
}

function renderProjectList(projects, containerId) {
  if (!projects.length) {
    document.getElementById(containerId).innerHTML = `
      <div class="empty-state">
        <h3>No projects yet</h3>
        <p>Create your first project to start tracking work.</p>
        <button class="btn btn-primary" onclick="openModal('addProject')">New Project</button>
      </div>`;
    return;
  }

  document.getElementById(containerId).innerHTML = projects.map(p => {
    const progress = p.total_milestones ? Math.round(p.completed_milestones / p.total_milestones * 100) : 0;
    return `
    <div class="list-item card-hover" onclick="navigate('project-detail','${p.id}')">
      <div class="item-main">
        <div class="item-icon" style="background:var(--primary-bg);color:var(--primary);">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        <div>
          <div class="item-title">${esc(p.name)}</div>
          <div class="item-subtitle">${esc(p.client_name)}${p.client_company ? ' — ' + esc(p.client_company) : ''}</div>
        </div>
      </div>
      <div class="item-meta">
        <div style="text-align:right;">
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <span style="font-size:11px;color:var(--text-muted);">${p.completed_milestones}/${p.total_milestones} milestones</span>
        </div>
        <span class="badge badge-${p.status}">${p.status.replace('_',' ')}</span>
        ${p.due_date ? `<span style="font-size:12px;color:var(--text-muted);">Due ${formatDate(p.due_date)}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ---- Project Detail ----
async function loadProjectDetail(projectId) {
  if (!projectId) return navigate('projects');

  let project;
  try {
    project = await api(`/projects/${projectId}`);
  } catch { return navigate('projects'); }
  if (!project) return navigate('projects');

  currentProject = project;

  document.getElementById('projectName').textContent = project.name;
  document.getElementById('projectClient').textContent = `${project.client_name}${project.client_company ? ' — ' + project.client_company : ''}`;
  document.getElementById('projectStatus').className = `badge badge-${project.status}`;
  document.getElementById('projectStatus').textContent = project.status.replace('_', ' ');

  // Portal link
  document.getElementById('portalLinkInput').value = `${location.origin}/portal/${project.portal_token}`;

  // Milestones
  renderMilestones(project.milestones);

  // Messages
  renderMessages(project.messages);

  // Files
  renderFiles(project.files);

  // Invoices
  renderInvoices(project.invoices);
}

function renderMilestones(milestones) {
  if (!milestones.length) {
    document.getElementById('milestonesList').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">No milestones yet. Add one to track progress.</div>';
    return;
  }

  document.getElementById('milestonesList').innerHTML = milestones.map(m => `
    <div class="milestone-item">
      <div class="check ${m.status}" onclick="toggleMilestone('${m.id}','${m.status}')">
        ${m.status === 'completed' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}
      </div>
      <span class="m-title ${m.status === 'completed' ? 'done' : ''}">${esc(m.title)}</span>
      <span class="badge badge-${m.status}" style="font-size:11px;">${m.status.replace('_',' ')}</span>
    </div>
  `).join('');
}

async function toggleMilestone(milestoneId, currentStatus) {
  const nextStatus = currentStatus === 'completed' ? 'pending' : currentStatus === 'pending' ? 'in_progress' : 'completed';
  await api(`/projects/${currentProject.id}/milestones/${milestoneId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: nextStatus })
  });
  loadProjectDetail(currentProject.id);
}

function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  if (!messages.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:14px;padding:20px;">No messages yet.</div>';
    return;
  }

  container.innerHTML = messages.map(m => {
    const isSent = m.sender_type === 'freelancer';
    const initials = m.sender_name.split(' ').map(n => n[0]).join('');
    return `
      <div class="message ${isSent ? 'sent' : 'received'}">
        <div class="msg-avatar">${initials}</div>
        <div>
          <div class="msg-bubble">${esc(m.content)}</div>
          <div class="msg-time">${formatDateTime(m.created_at)}</div>
        </div>
      </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;

  await api(`/projects/${currentProject.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });

  input.value = '';
  loadProjectDetail(currentProject.id);
}

document.getElementById('messageInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function renderFiles(files) {
  if (!files.length) {
    document.getElementById('filesList').innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:14px;padding:20px;">No files uploaded yet.</div>';
    return;
  }

  document.getElementById('filesList').innerHTML = files.map(f => `
    <div class="file-item">
      <div class="file-icon">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
      </div>
      <span class="file-name">${esc(f.original_name)}</span>
      <span class="file-size">${formatSize(f.file_size)}</span>
      <button class="btn btn-ghost btn-sm" onclick="deleteFile('${f.id}')">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>
  `).join('');
}

async function uploadFile() {
  const fileInput = document.getElementById('fileUpload');
  if (!fileInput.files.length) return;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  await fetch(`${API}/files/upload/${currentProject.id}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });

  fileInput.value = '';
  toast('File uploaded!', 'success');
  loadProjectDetail(currentProject.id);
}

async function deleteFile(fileId) {
  await api(`/files/${fileId}`, { method: 'DELETE' });
  toast('File deleted');
  loadProjectDetail(currentProject.id);
}

function renderInvoices(invoices) {
  if (!invoices.length) {
    document.getElementById('invoicesList').innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:14px;padding:20px;">No invoices yet.</div>';
    return;
  }

  document.getElementById('invoicesList').innerHTML = invoices.map(inv => `
    <div class="invoice-item">
      <div class="inv-info">
        <div>
          <div class="inv-number">${esc(inv.invoice_number)}</div>
          <div class="inv-desc">${esc(inv.description || '')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="badge badge-${inv.status}">${inv.status}</span>
        <div class="inv-amount">$${Number(inv.amount).toLocaleString()}</div>
        ${inv.status === 'sent' ? `<button class="btn btn-sm btn-secondary" onclick="markInvoicePaid('${inv.id}')">Mark Paid</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function markInvoicePaid(invoiceId) {
  await api(`/projects/${currentProject.id}/invoices/${invoiceId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'paid' })
  });
  toast('Invoice marked as paid!', 'success');
  loadProjectDetail(currentProject.id);
}

// ---- Modals ----
function openModal(type) {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');

  if (type === 'addClient') {
    content.innerHTML = `
      <h3>Add New Client</h3>
      <div class="form-group"><label>Name *</label><input type="text" class="form-input" id="modalClientName"></div>
      <div class="form-group"><label>Email</label><input type="email" class="form-input" id="modalClientEmail"></div>
      <div class="form-group"><label>Company</label><input type="text" class="form-input" id="modalClientCompany"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createClient()">Add Client</button>
      </div>`;
  }

  if (type === 'addProject') {
    const clientOptions = clientsCache.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    content.innerHTML = `
      <h3>New Project</h3>
      <div class="form-group"><label>Client *</label><select class="form-input" id="modalProjectClient">${clientOptions || '<option value="">No clients — add one first</option>'}</select></div>
      <div class="form-group"><label>Project Name *</label><input type="text" class="form-input" id="modalProjectName"></div>
      <div class="form-group"><label>Description</label><textarea class="form-input" id="modalProjectDesc"></textarea></div>
      <div class="form-group"><label>Due Date</label><input type="date" class="form-input" id="modalProjectDue"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createProject()">Create Project</button>
      </div>`;
  }

  if (type === 'addMilestone') {
    content.innerHTML = `
      <h3>Add Milestone</h3>
      <div class="form-group"><label>Title *</label><input type="text" class="form-input" id="modalMilestoneTitle"></div>
      <div class="form-group"><label>Description</label><textarea class="form-input" id="modalMilestoneDesc"></textarea></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createMilestone()">Add Milestone</button>
      </div>`;
  }

  if (type === 'addInvoice') {
    content.innerHTML = `
      <h3>Create Invoice</h3>
      <div class="form-group"><label>Invoice Number *</label><input type="text" class="form-input" id="modalInvNumber" placeholder="INV-003"></div>
      <div class="form-group"><label>Amount (USD) *</label><input type="number" class="form-input" id="modalInvAmount" step="0.01"></div>
      <div class="form-group"><label>Description</label><input type="text" class="form-input" id="modalInvDesc"></div>
      <div class="form-group"><label>Due Date</label><input type="date" class="form-input" id="modalInvDue"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createInvoice()">Create Invoice</button>
      </div>`;
  }

  overlay.classList.add('active');
}

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('modalOverlay').classList.remove('active');
}

async function createClient() {
  const name = document.getElementById('modalClientName').value.trim();
  if (!name) return toast('Client name is required', 'error');

  await api('/clients', {
    method: 'POST',
    body: JSON.stringify({
      name,
      email: document.getElementById('modalClientEmail').value.trim(),
      company: document.getElementById('modalClientCompany').value.trim()
    })
  });
  closeModal();
  toast('Client added!', 'success');
  loadClients();
}

async function createProject() {
  const clientId = document.getElementById('modalProjectClient').value;
  const name = document.getElementById('modalProjectName').value.trim();
  if (!clientId || !name) return toast('Client and name are required', 'error');

  await api('/projects', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      name,
      description: document.getElementById('modalProjectDesc').value.trim(),
      dueDate: document.getElementById('modalProjectDue').value
    })
  });
  closeModal();
  toast('Project created!', 'success');
  loadProjects();
}

async function createMilestone() {
  const title = document.getElementById('modalMilestoneTitle').value.trim();
  if (!title) return toast('Title is required', 'error');

  await api(`/projects/${currentProject.id}/milestones`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: document.getElementById('modalMilestoneDesc').value.trim()
    })
  });
  closeModal();
  toast('Milestone added!', 'success');
  loadProjectDetail(currentProject.id);
}

async function createInvoice() {
  const invoiceNumber = document.getElementById('modalInvNumber').value.trim();
  const amount = parseFloat(document.getElementById('modalInvAmount').value);
  if (!invoiceNumber || !amount) return toast('Number and amount are required', 'error');

  await api(`/projects/${currentProject.id}/invoices`, {
    method: 'POST',
    body: JSON.stringify({
      invoiceNumber,
      amount,
      description: document.getElementById('modalInvDesc').value.trim(),
      dueDate: document.getElementById('modalInvDue').value
    })
  });
  closeModal();
  toast('Invoice created!', 'success');
  loadProjectDetail(currentProject.id);
}

// ---- Utilities ----
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function copyPortalLink() {
  const input = document.getElementById('portalLinkInput');
  copyText(input.value);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Link copied!', 'success'));
}

function toast(message, type = '') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ---- Init ----
if (token) {
  showDashboard();
} else {
  document.getElementById('loginPage').style.display = 'block';
}
