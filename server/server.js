import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (frontend build)
const FRONTEND_DIST = join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST));

// Turso Database (libSQL) - supports both local file and remote Turso
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data/responses.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize database
async function initDatabase() {
  // Create table if not exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,

      -- Geo data (from IP)
      country TEXT,
      country_code TEXT,
      city TEXT,
      timezone_from_ip TEXT,

      -- App / experiment metadata
      app_id TEXT,
      quiz_version TEXT,
      question_set_id TEXT,
      score_algo_version TEXT,

      -- Demographics
      age_group TEXT,
      gender TEXT,

      -- Quiz results
      question_ids TEXT,
      answers TEXT,
      question_times TEXT,
      answers_by_question_id TEXT,
      times_by_question_id TEXT,
      total_quiz_time INTEGER,

      -- Score results
      score REAL,
      tier TEXT,
      yes_count INTEGER,

      -- Session info
      session_duration INTEGER,
      selected_language TEXT,
      client_id TEXT,
      session_id TEXT,
      session_started_at TEXT,
      session_finished_at TEXT,
      completed INTEGER,

      -- Attribution
      landing_url TEXT,
      landing_path TEXT,
      document_referrer TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      utm_content TEXT,
      utm_term TEXT,

      -- Client data
      browser_language TEXT,
      languages TEXT,
      timezone TEXT,
      device_type TEXT,
      screen_width INTEGER,
      screen_height INTEGER,
      viewport_width INTEGER,
      viewport_height INTEGER,
      pixel_ratio REAL,
      platform TEXT,
      connection_type TEXT,

      -- Request metadata
      user_agent TEXT,
      referer TEXT
    )
  `);

  // Lightweight, additive migrations for existing DBs
  const columnsToAdd = {
    country_code: 'TEXT',
    app_id: 'TEXT',
    quiz_version: 'TEXT',
    question_set_id: 'TEXT',
    score_algo_version: 'TEXT',
    question_ids: 'TEXT',
    answers_by_question_id: 'TEXT',
    times_by_question_id: 'TEXT',
    client_id: 'TEXT',
    session_id: 'TEXT',
    session_started_at: 'TEXT',
    session_finished_at: 'TEXT',
    completed: 'INTEGER',
    landing_url: 'TEXT',
    landing_path: 'TEXT',
    document_referrer: 'TEXT',
    utm_source: 'TEXT',
    utm_medium: 'TEXT',
    utm_campaign: 'TEXT',
    utm_content: 'TEXT',
    utm_term: 'TEXT'
  };

  const tableInfo = await db.execute('PRAGMA table_info(responses)');
  const existingColumns = new Set(tableInfo.rows.map(row => row.name));

  for (const [name, type] of Object.entries(columnsToAdd)) {
    if (!existingColumns.has(name)) {
      try {
        await db.execute(`ALTER TABLE responses ADD COLUMN ${name} ${type}`);
      } catch {
        // Column might already exist
      }
    }
  }

  // Create indexes for common queries
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_timestamp ON responses(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_country ON responses(country)',
    'CREATE INDEX IF NOT EXISTS idx_country_code ON responses(country_code)',
    'CREATE INDEX IF NOT EXISTS idx_age_group ON responses(age_group)',
    'CREATE INDEX IF NOT EXISTS idx_gender ON responses(gender)',
    'CREATE INDEX IF NOT EXISTS idx_app_id ON responses(app_id)',
    'CREATE INDEX IF NOT EXISTS idx_question_set_id ON responses(question_set_id)',
    'CREATE INDEX IF NOT EXISTS idx_client_id ON responses(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_session_id ON responses(session_id)',
  ];

  for (const sql of indexes) {
    await db.execute(sql);
  }

  console.log('Database initialized');
}

// Helper: Get country from IP using free API
async function getGeoFromIP(ip) {
  try {
    // Skip for localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return {
        country: 'Local',
        countryCode: 'Local',
        city: 'Localhost',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
    }

    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,city,timezone`);
    const data = await response.json();
    return {
      country: data.country || 'Unknown',
      countryCode: data.countryCode || 'Unknown',
      city: data.city || 'Unknown',
      timezone: data.timezone || 'Unknown'
    };
  } catch {
    return { country: 'Unknown', countryCode: 'Unknown', city: 'Unknown', timezone: 'Unknown' };
  }
}

// Helper: Get real IP from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket.remoteAddress
    || '';
}

// API: Submit quiz response
app.post('/api/submit', async (req, res) => {
  try {
    const clientIP = getClientIP(req);
    const geo = await getGeoFromIP(clientIP);
    const body = req.body;

    await db.execute({
      sql: `
        INSERT INTO responses (
          timestamp, country, country_code, city, timezone_from_ip,
          app_id, quiz_version, question_set_id, score_algo_version,
          age_group, gender,
          question_ids, answers, question_times, answers_by_question_id, times_by_question_id, total_quiz_time,
          score, tier, yes_count,
          session_duration, selected_language, client_id, session_id,
          session_started_at, session_finished_at, completed,
          landing_url, landing_path, document_referrer,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term,
          browser_language, languages, timezone, device_type,
          screen_width, screen_height, viewport_width, viewport_height,
          pixel_ratio, platform, connection_type,
          user_agent, referer
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?
        )
      `,
      args: [
        new Date().toISOString(),
        geo.country,
        geo.countryCode,
        geo.city,
        geo.timezone,
        body.appId || null,
        body.quizVersion || null,
        body.questionSetId || null,
        body.scoreAlgoVersion || null,
        body.ageGroup || null,
        body.gender || null,
        JSON.stringify(body.questionIds || []),
        JSON.stringify(body.answers || []),
        JSON.stringify(body.questionTimes || []),
        JSON.stringify(body.answersByQuestionId || {}),
        JSON.stringify(body.timesByQuestionId || {}),
        body.totalQuizTime || null,
        body.score || null,
        body.tier || null,
        body.yesCount || null,
        body.sessionDuration || null,
        body.selectedLanguage || null,
        body.clientId || null,
        body.sessionId || null,
        body.sessionStartedAt || null,
        body.sessionFinishedAt || null,
        typeof body.completed === 'boolean' ? (body.completed ? 1 : 0) : null,
        body.landingUrl || null,
        body.landingPath || null,
        body.documentReferrer || null,
        body.utmSource || null,
        body.utmMedium || null,
        body.utmCampaign || null,
        body.utmContent || null,
        body.utmTerm || null,
        body.browserLanguage || null,
        body.languages || null,
        body.timezone || null,
        body.deviceType || null,
        body.screenWidth || null,
        body.screenHeight || null,
        body.viewportWidth || null,
        body.viewportHeight || null,
        body.pixelRatio || null,
        body.platform || null,
        body.connectionType || null,
        req.headers['user-agent'] || 'Unknown',
        req.headers['referer'] || 'Direct'
      ]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ success: false, error: 'Failed to save data' });
  }
});

// API: Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const total = await db.execute('SELECT COUNT(*) as count FROM responses');
    const recent = await db.execute('SELECT * FROM responses ORDER BY id DESC LIMIT 100');

    res.json({
      totalResponses: total.rows[0].count,
      responses: recent.rows
    });
  } catch (error) {
    console.error('Error reading stats:', error);
    res.status(500).json({ error: 'Failed to read stats' });
  }
});

// API: Get aggregated stats
app.get('/api/stats/summary', async (req, res) => {
  try {
    const total = await db.execute('SELECT COUNT(*) as count FROM responses');

    const byCountry = await db.execute(`
      SELECT country, COUNT(*) as count
      FROM responses
      GROUP BY country
      ORDER BY count DESC
      LIMIT 20
    `);

    const byAgeGroup = await db.execute(`
      SELECT age_group, COUNT(*) as count
      FROM responses
      WHERE age_group IS NOT NULL
      GROUP BY age_group
      ORDER BY age_group
    `);

    const byGender = await db.execute(`
      SELECT gender, COUNT(*) as count
      FROM responses
      WHERE gender IS NOT NULL
      GROUP BY gender
    `);

    const byDevice = await db.execute(`
      SELECT device_type, COUNT(*) as count
      FROM responses
      GROUP BY device_type
    `);

    const byLanguage = await db.execute(`
      SELECT selected_language, COUNT(*) as count
      FROM responses
      WHERE selected_language IS NOT NULL
      GROUP BY selected_language
      ORDER BY count DESC
    `);

    res.json({
      totalResponses: total.rows[0].count,
      byCountry: byCountry.rows,
      byAgeGroup: byAgeGroup.rows,
      byGender: byGender.rows,
      byDevice: byDevice.rows,
      byLanguage: byLanguage.rows
    });
  } catch (error) {
    console.error('Error reading summary:', error);
    res.status(500).json({ error: 'Failed to read summary' });
  }
});

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(FRONTEND_DIST, 'index.html'));
});

// Start server after database initialization
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
