import { run } from './database';

const migrations = [
  // Employees table
  `CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    azure_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    department TEXT,
    role TEXT,
    manager_id INTEGER,
    is_manager INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
  )`,

  // Teams integration config
  `CREATE TABLE IF NOT EXISTS teams_integration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_sync DATETIME,
    config JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // Graph API tokens
  `CREATE TABLE IF NOT EXISTS graph_api_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // Collaborations (interaction data from Teams)
  `CREATE TABLE IF NOT EXISTS collaborations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    peer_id INTEGER NOT NULL,
    interaction_type TEXT NOT NULL,
    interaction_count INTEGER DEFAULT 1,
    total_minutes INTEGER DEFAULT 0,
    last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (peer_id) REFERENCES employees(id),
    UNIQUE(employee_id, peer_id, interaction_type)
  )`,

  // Peer rankings
  `CREATE TABLE IF NOT EXISTS peer_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    peer_id INTEGER NOT NULL,
    collaboration_score REAL NOT NULL,
    rank_position INTEGER NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (peer_id) REFERENCES employees(id),
    UNIQUE(employee_id, peer_id)
  )`,

  // Feedback cycles
  `CREATE TABLE IF NOT EXISTS feedback_cycles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'peer',
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    status TEXT DEFAULT 'active',
    config JSON,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES employees(id)
  )`,

  // Feedback requests
  `CREATE TABLE IF NOT EXISTS feedback_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    cycle_id TEXT NOT NULL,
    request_type TEXT DEFAULT 'peer',
    status TEXT DEFAULT 'pending',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME NOT NULL,
    completed_at DATETIME,
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at DATETIME,
    FOREIGN KEY (requester_id) REFERENCES employees(id),
    FOREIGN KEY (provider_id) REFERENCES employees(id),
    FOREIGN KEY (cycle_id) REFERENCES feedback_cycles(id)
  )`,

  // Feedback responses
  `CREATE TABLE IF NOT EXISTS feedback_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    requester_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    strengths TEXT,
    areas_for_improvement TEXT,
    specific_examples TEXT,
    actionable_suggestions TEXT,
    additional_context TEXT,
    overall_rating INTEGER,
    collaboration_rating INTEGER,
    communication_rating INTEGER,
    technical_rating INTEGER,
    is_anonymous INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES feedback_requests(id),
    FOREIGN KEY (requester_id) REFERENCES employees(id),
    FOREIGN KEY (provider_id) REFERENCES employees(id)
  )`,

  // Feedback analysis
  `CREATE TABLE IF NOT EXISTS feedback_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id INTEGER NOT NULL,
    sentiment_score REAL,
    sentiment_label TEXT,
    themes JSON,
    keywords JSON,
    is_constructive INTEGER DEFAULT 0,
    quality_score REAL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (response_id) REFERENCES feedback_responses(id)
  )`,

  // Actions (follow-ups from feedback)
  `CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    response_id INTEGER,
    employee_id INTEGER NOT NULL,
    assigned_by INTEGER NOT NULL,
    action_type TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    due_date DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (response_id) REFERENCES feedback_responses(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (assigned_by) REFERENCES employees(id)
  )`,

  // Notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id INTEGER,
    related_type TEXT,
    is_read INTEGER DEFAULT 0,
    sent_via TEXT,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`,

  // Sync jobs (for scheduled data collection)
  `CREATE TABLE IF NOT EXISTS sync_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    records_processed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // Pulse surveys
  `CREATE TABLE IF NOT EXISTS pulse_surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    scale_min INTEGER DEFAULT 1,
    scale_max INTEGER DEFAULT 5,
    status TEXT DEFAULT 'active',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES employees(id)
  )`,

  // Pulse responses
  `CREATE TABLE IF NOT EXISTS pulse_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES pulse_surveys(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`,

  // Chat sessions for chatbot feedback collection
  `CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    request_id INTEGER NOT NULL,
    state TEXT NOT NULL,
    context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (request_id) REFERENCES feedback_requests(id)
  )`,

  // Create indexes
  `CREATE INDEX IF NOT EXISTS idx_collaborations_employee ON collaborations(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_collaborations_peer ON collaborations(peer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_peer_rankings_employee ON peer_rankings(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_requests_provider ON feedback_requests(provider_id)`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_requests_requester ON feedback_requests(requester_id)`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_requests_cycle ON feedback_requests(cycle_id)`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_responses_requester ON feedback_responses(requester_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_employee ON notifications(employee_id)`,
  `CREATE INDEX IF NOT EXISTS idx_actions_employee ON actions(employee_id)`,
];

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  try {
    for (const migration of migrations) {
      await run(migration);
    }
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default runMigrations;

