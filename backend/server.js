// ─────────────────────────────────────────────────────────────────────────────
// backend/server.js  — FIXED (full replacement)
//
// Bug fix applied:
//   [H3] Added express.static middleware to serve the uploads/ directory.
//        Without this, every file the user downloads goes to /uploads/<path>
//        which Express never matched, returning 404 for all attachments.
//        The frontend links to /uploads/inquiry/<filename> — this must be
//        reachable from the browser through the same Express server.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const dotenv = require('dotenv');

// Environment variables must be loaded before importing services. WhatsApp
// reads its client id, Chrome path and persistent session directories while
// the module is initialised.
dotenv.config({ path: path.join(__dirname, '.env') });

const express = require('express');
const morgan  = require('morgan');
const cors    = require('cors');

const connectDB                        = require('./config/db');
const { initWhatsApp, reloadWhatsAppSettings } = require('./services/whatsappService');
const { initKickoffWorkflowScheduler } = require('./services/kickoffWorkflowScheduler');
const timesheetRoutes = require('./routes/timesheetRoutes');
const teamRoutes = require('./routes/teamRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const { seedDefaultDepartments } = require('./services/departmentSeedService');

// Connect to MongoDB before starting database-backed integrations.
// Master → Integration Settings is the source of truth for WhatsApp. Environment
// variables are used only until the first WhatsApp settings record is saved.
connectDB()
  .then(async () => {
    await seedDefaultDepartments();
    await reloadWhatsAppSettings();
    initWhatsApp();
    initKickoffWorkflowScheduler();
  })
  .catch((error) => {
    console.error('[server] Database/integration startup failed:', error.message);
  });

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Static file serving for uploads  [FIX H3] ────────────────────────────────
// Serves files under backend/uploads/ at the URL path /uploads.
// The frontend references attachment URLs as /uploads/inquiry/<filename>.
// Must be registered BEFORE the API routes so it is matched first.
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    // Do not list directory contents — serve individual files only
    index: false,
    // 1 day cache for uploaded files in production; no-cache in dev
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/inquiries',     require('./routes/inquiryRoutes'));
app.use('/api/projects',      require('./routes/projectRoutes'));
app.use('/api/kickoff-workflows', require('./routes/kickoffWorkflowRoutes'));
app.use('/api/customers',     require('./routes/customerRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/dashboard',     require('./routes/dashboardRoutes'));
app.use('/api/departments',   require('./routes/departmentRoutes'));
app.use('/api/users',         require('./routes/userRoutes'));
app.use('/api/integrations',  require('./routes/integrationRoutes'));
app.use('/api/timesheet', timesheetRoutes);
app.use('/api/teams', teamRoutes);
// app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets', require('./routes/ticketRoutes'));


// ─── Health Check ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status:  'OK',
    message: 'Electrical CRM API is running',
  });
});

// ─── Error Handling Middleware ─────────────────────────────────────────────────

app.use(require('./middleware/errorMiddleware'));

// ─── Server Start ──────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;