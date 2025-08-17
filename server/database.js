// server/database.js - Complete Enhanced Database Schema
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { require: true, rejectUnauthorized: false }
    : false,
  keepAlive: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  min: parseInt(process.env.DB_MIN_CONNECTIONS) || 5,
});

const createTables = async () => {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL, ensuring complete schema exists...');

    // CORE TABLES
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'staff',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
        type TEXT NOT NULL CHECK (type IN ('sale', 'expense')),
        category TEXT,
        status TEXT NOT NULL DEFAULT 'approved',
        transaction_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        receipt_image_url TEXT,
        notes TEXT
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL,
        user_email TEXT NOT NULL,
        action_type TEXT NOT NULL,
        details TEXT,
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // EMPLOYEES
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        pay_rate NUMERIC(8, 2) DEFAULT 0 CHECK (pay_rate >= 0),
        phone TEXT,
        address TEXT,
        hire_date DATE DEFAULT CURRENT_DATE,
        position TEXT DEFAULT 'Staff',
        department TEXT DEFAULT 'Restaurant',
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        start_time TIME NOT NULL,
        duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
        break_duration_minutes INTEGER DEFAULT 30,
        position_required TEXT,
        max_employees INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // REQUEST TABLES
    await client.query(`
      CREATE TABLE IF NOT EXISTS approval_requests (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
        user_uid TEXT NOT NULL,
        user_email TEXT NOT NULL,
        request_type TEXT NOT NULL DEFAULT 'delete',
        reason TEXT NOT NULL,
        transaction_data JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        admin_uid TEXT,
        admin_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS availability_requests (
        id SERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL,
        user_email TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT NOT NULL,
        request_type TEXT DEFAULT 'time_off',
        status TEXT NOT NULL DEFAULT 'pending',
        admin_uid TEXT,
        admin_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMPTZ
      );
    `);

    // TIME & SCHEDULING
await client.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
        id SERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL,
        user_email TEXT NOT NULL,
        clock_in_time TIMESTAMPTZ NOT NULL,
        clock_out_time TIMESTAMPTZ,
        break_start_time TIMESTAMPTZ,
        break_end_time TIMESTAMPTZ,
        total_hours NUMERIC(5, 2),
        overtime_hours NUMERIC(5, 2) DEFAULT 0,
        notes TEXT,
        location TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
`);

    // ROTA SHIFTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS rota_shifts (
        id SERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL,
        shift_template_id INTEGER REFERENCES shift_templates(id) ON DELETE CASCADE,
        shift_date DATE NOT NULL,
        custom_start_time TIME,
        custom_end_time TIME,
        notes TEXT,
        published BOOLEAN DEFAULT FALSE,
        published_at TIMESTAMPTZ,
        published_by TEXT,
        created_by TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // SYSTEM & OTHER TABLES
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        category TEXT DEFAULT 'general',
        is_public BOOLEAN DEFAULT FALSE,
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_uid TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        action_url TEXT,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // VERIFY EXISTING COLUMNS & DROP UNIQUE CONSTRAINT FOR MULTIPLE SHIFTS
    console.log('Verifying all required columns exist...');
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;`);
    await client.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;`);
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS total_hours NUMERIC(5,2);`);
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_in_time TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clock_out_time TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE rota_shifts ADD COLUMN IF NOT EXISTS custom_start_time TIME;`);
    await client.query(`ALTER TABLE rota_shifts ADD COLUMN IF NOT EXISTS custom_end_time TIME;`);
    await client.query(`ALTER TABLE rota_shifts ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE rota_shifts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE rota_shifts ADD COLUMN IF NOT EXISTS published_by TEXT;`);
    await client.query(`ALTER TABLE rota_shifts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';`);
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS user_email TEXT;`);
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS notes TEXT;`);
    await client.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS location TEXT;`);
    await client.query(`ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ip_address INET,ADD COLUMN IF NOT EXISTS user_agent TEXT;`);
    
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name='rota_shifts'
            AND constraint_type='UNIQUE'
            AND constraint_name='rota_shifts_user_uid_shift_date_key'
        ) THEN
          ALTER TABLE rota_shifts DROP CONSTRAINT rota_shifts_user_uid_shift_date_key;
        END IF;
      END$$;
    `);

    // CREATE INDEXES
    console.log('Creating indexes for optimal performance...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_uid, transaction_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rota_shifts_date ON rota_shifts(shift_date);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_uid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_uid, is_read);`);

    // DEFAULT SETTINGS
    await client.query(`
      INSERT INTO settings (key, value, description, category, is_public)
      VALUES
        ('business_name','MR BURGER','Business name','general',true),
        ('currency','GBP','Transaction currency','financial',true),
        ('timezone','Europe/London','Default timezone','general',true),
        ('max_daily_hours','12','Max hours per day','scheduling',false),
        ('break_duration','30','Default break duration','scheduling',false)
      ON CONFLICT(key) DO NOTHING;
    `);

    console.log('✅ Database schema created/updated successfully.');
  } catch (err) {
    console.error('❌ Error creating schema:', err.stack);
    throw err;
  } finally {
    client.release();
  }
};

const query = async (text, params) => {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 200) {
      console.warn(`⚠️ Slow query (${duration}ms): ${text.substring(0, 100).replace(/\s+/g, ' ')}...`);
    }
    return res;
  } catch (error) {
    console.error('❌ Database query error:', { error: error.message, query: text });
    throw error;
  } finally {
    client.release();
  }
};

const healthCheck = async () => {
  try {
    const result = await query('SELECT NOW() AS current_time, version() AS pg_version');
    return {
      status: 'healthy',
      timestamp: result.rows[0].current_time,
      version: result.rows[0].pg_version,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
};

const maintenance = {
  updateDailySummaries: async (date) => {
    try {
      console.log(`Running maintenance for ${date}`);
      return { success: true, date };
    } catch (error) {
      console.error('Maintenance error:', error);
      throw error;
    }
  }
};

module.exports = {
  pool,
  createTables,
  query,
  healthCheck,
  maintenance
};