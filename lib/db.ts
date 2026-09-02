import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "grand-holdings.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    seedIfEmpty(db);
    refreshDemoProperties(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS facilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'basic')),
      facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
      access_all INTEGER NOT NULL DEFAULT 0 CHECK(access_all IN (0, 1)),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_facilities (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, facility_id)
    );

    CREATE TABLE IF NOT EXISTS checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checklist_facilities (
      checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      PRIMARY KEY (checklist_id, facility_id)
    );

    CREATE TABLE IF NOT EXISTS checklist_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      due_date TEXT NOT NULL,
      submitted_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
      UNIQUE(checklist_id, facility_id, due_date)
    );

    CREATE TABLE IF NOT EXISTS checklist_completion_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      completion_id INTEGER NOT NULL REFERENCES checklist_completions(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
      completed INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      UNIQUE(completion_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      expected_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      progress INTEGER NOT NULL DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'closed')),
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      note TEXT NOT NULL DEFAULT '',
      progress INTEGER NOT NULL CHECK(progress >= 0 AND progress <= 100),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      update_id INTEGER REFERENCES task_updates(id) ON DELETE SET NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS form_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_slug TEXT NOT NULL,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'prepared' CHECK(status IN ('draft', 'prepared', 'completed')),
      prepared_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      prepared_at TEXT,
      completed_at TEXT,
      guest_name TEXT NOT NULL DEFAULT '',
      guest_surname TEXT NOT NULL DEFAULT '',
      id_number TEXT NOT NULL DEFAULT '',
      form_data TEXT NOT NULL,
      pdf_path TEXT,
      content_hash TEXT NOT NULL,
      search_text TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_form_submissions_slug ON form_submissions(form_slug);
    CREATE INDEX IF NOT EXISTS idx_form_submissions_facility ON form_submissions(facility_id);
    CREATE INDEX IF NOT EXISTS idx_form_submissions_guest_name ON form_submissions(guest_name);
    CREATE INDEX IF NOT EXISTS idx_form_submissions_guest_surname ON form_submissions(guest_surname);
    CREATE INDEX IF NOT EXISTS idx_form_submissions_id_number ON form_submissions(id_number);
    CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);

    CREATE TABLE IF NOT EXISTS form_submission_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'identity_document',
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_form_submission_attachments_submission
      ON form_submission_attachments(submission_id);
  `);
  migrateUserSchema(database);
  migrateFormSubmissionSchema(database);
}

function migrateUserSchema(database: Database.Database) {
  const columns = database
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  if (!columns.some((column) => column.name === "access_all")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN access_all INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!columns.some((column) => column.name === "active")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1"
    );
  }

  const table = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get() as { sql: string } | undefined;
  if (table?.sql && !table.sql.includes("'manager'")) {
    const legacyColumns = database
      .prepare("PRAGMA table_info(users)")
      .all() as { name: string }[];
    const legacyHasActive = legacyColumns.some((column) => column.name === "active");
    const activeSelect = legacyHasActive
      ? "COALESCE(active, 1)"
      : "1";

    database.pragma("foreign_keys = OFF");
    database.pragma("legacy_alter_table = ON");
    database.exec(`
      ALTER TABLE users RENAME TO users_legacy;
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'basic')),
        facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
        access_all INTEGER NOT NULL DEFAULT 0 CHECK(access_all IN (0, 1)),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users (id, email, password_hash, name, role, facility_id, access_all, active, created_at)
        SELECT id, email, password_hash, name, role, facility_id, access_all, ${activeSelect}, created_at
        FROM users_legacy;
      DROP TABLE users_legacy;
    `);
    database.pragma("legacy_alter_table = OFF");
    database.pragma("foreign_keys = ON");
  }

  const columnsAfter = database
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  if (!columnsAfter.some((column) => column.name === "active")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1"
    );
  }

  database.exec(`
    INSERT OR IGNORE INTO user_facilities (user_id, facility_id)
      SELECT id, facility_id FROM users
      WHERE facility_id IS NOT NULL;
    UPDATE users SET access_all = 1 WHERE role = 'admin';
    UPDATE users SET active = 1 WHERE active IS NULL OR active NOT IN (0, 1);
  `);

  // One-time repair: users table rebuilds omitted active, leaving accounts invisible.
  const repaired = database
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'user_active_repair_v1'"
    )
    .get();
  if (!repaired) {
    database.exec(`
      CREATE TABLE user_active_repair_v1 (id INTEGER PRIMARY KEY);
      UPDATE users SET active = 1 WHERE active = 0;
    `);
  }
}

function formSubmissionColumnNames(database: Database.Database): Set<string> {
  const columns = database
    .prepare("PRAGMA table_info(form_submissions)")
    .all() as { name: string }[];
  return new Set(columns.map((column) => column.name));
}

function migrateFormSubmissionSchema(database: Database.Database) {
  const columns = formSubmissionColumnNames(database);

  if (!columns.has("status")) {
    database.exec(
      "ALTER TABLE form_submissions ADD COLUMN status TEXT NOT NULL DEFAULT 'prepared'"
    );
    columns.add("status");
  }
  if (!columns.has("prepared_by")) {
    database.exec(
      "ALTER TABLE form_submissions ADD COLUMN prepared_by INTEGER REFERENCES users(id) ON DELETE SET NULL"
    );
    columns.add("prepared_by");
  }
  if (!columns.has("prepared_at")) {
    database.exec("ALTER TABLE form_submissions ADD COLUMN prepared_at TEXT");
    columns.add("prepared_at");
  }
  if (!columns.has("completed_at")) {
    database.exec("ALTER TABLE form_submissions ADD COLUMN completed_at TEXT");
    columns.add("completed_at");
  }

  database.exec(`
    UPDATE form_submissions
    SET status = 'completed',
        completed_at = COALESCE(completed_at, submitted_at),
        prepared_by = COALESCE(prepared_by, submitted_by),
        prepared_at = COALESCE(prepared_at, submitted_at)
    WHERE pdf_path IS NOT NULL AND status != 'completed';

    UPDATE form_submissions
    SET prepared_by = COALESCE(prepared_by, submitted_by),
        prepared_at = COALESCE(prepared_at, submitted_at)
    WHERE status IN ('draft', 'prepared');
  `);

  database.exec(
    "CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status)"
  );
}

function seedIfEmpty(database: Database.Database) {
  const userCount = database
    .prepare("SELECT COUNT(*) as count FROM users")
    .get() as { count: number };

  if (userCount.count > 0) return;

  const insertFacility = database.prepare(`
    INSERT INTO facilities (name, address, contact_name, contact_phone, contact_email)
    VALUES (@name, @address, @contact_name, @contact_phone, @contact_email)
  `);

  const facilities = [
    {
      name: "Grand Game Lodge",
      address: "Sabi Sand Reserve, Mpumalanga",
      contact_name: "Sarah Mitchell",
      contact_phone: "+27 13 555 0101",
      contact_email: "lodge@grandholdings.co.za",
    },
    {
      name: "Grand Hotel Winelands",
      address: "R44 Wine Route, Stellenbosch",
      contact_name: "James Nkosi",
      contact_phone: "+27 21 555 0202",
      contact_email: "winelands@grandholdings.co.za",
    },
    {
      name: "Grand Hotel Robertson",
      address: "Valley Road, Robertson, Western Cape",
      contact_name: "Priya Pillay",
      contact_phone: "+27 23 555 0303",
      contact_email: "robertson@grandholdings.co.za",
    },
  ];

  const facilityIds: number[] = [];
  for (const f of facilities) {
    const result = insertFacility.run(f);
    facilityIds.push(Number(result.lastInsertRowid));
  }

  const passwordHash = bcrypt.hashSync("admin123", 10);
  database
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, facility_id, access_all) VALUES (?, ?, ?, 'admin', NULL, 1)`
    )
    .run("admin@grandholdings.co.za", passwordHash, "System Administrator");

  database
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, facility_id, access_all) VALUES (?, ?, ?, 'manager', ?, 0)`
    )
    .run(
      "manager.cpt@grandholdings.co.za",
      bcrypt.hashSync("manager123", 10),
      "Lodge Manager",
      facilityIds[0]
    );

  database
    .prepare(
      `INSERT INTO user_facilities (user_id, facility_id)
       SELECT id, ? FROM users WHERE email = 'manager.cpt@grandholdings.co.za'`
    )
    .run(facilityIds[0]);

  const checklistResult = database
    .prepare(
      `INSERT INTO checklists (name, frequency) VALUES ('Daily Checks', 'daily')`
    )
    .run();
  const checklistId = Number(checklistResult.lastInsertRowid);

  const items = [
    "Check Wi-Fi is operational",
    "Check telephone systems work",
    "Check gas levels",
    "Check fridge temperature levels",
  ];

  const insertItem = database.prepare(
    `INSERT INTO checklist_items (checklist_id, description, sort_order) VALUES (?, ?, ?)`
  );
  items.forEach((desc, i) => insertItem.run(checklistId, desc, i));

  const assignFacility = database.prepare(
    `INSERT INTO checklist_facilities (checklist_id, facility_id) VALUES (?, ?)`
  );
  for (const fid of facilityIds) {
    assignFacility.run(checklistId, fid);
  }
}

function refreshDemoProperties(database: Database.Database) {
  const updates = [
    {
      from: "Grand Hotel Cape Town",
      name: "Grand Game Lodge",
      address: "Sabi Sand Reserve, Mpumalanga",
      contact_email: "lodge@grandholdings.co.za",
      contact_phone: "+27 13 555 0101",
    },
    {
      from: "Grand Hotel Johannesburg",
      name: "Grand Hotel Winelands",
      address: "R44 Wine Route, Stellenbosch",
      contact_email: "winelands@grandholdings.co.za",
      contact_phone: "+27 21 555 0202",
    },
    {
      from: "Grand Hotel Durban",
      name: "Grand Hotel Robertson",
      address: "Valley Road, Robertson, Western Cape",
      contact_email: "robertson@grandholdings.co.za",
      contact_phone: "+27 23 555 0303",
    },
  ];

  const stmt = database.prepare(
    `UPDATE facilities SET name = ?, address = ?, contact_email = ?, contact_phone = ? WHERE name = ?`
  );
  for (const row of updates) {
    stmt.run(row.name, row.address, row.contact_email, row.contact_phone, row.from);
  }

  database
    .prepare(`UPDATE users SET name = ? WHERE email = ?`)
    .run("Lodge Manager", "manager.cpt@grandholdings.co.za");
  database
    .prepare(
      `UPDATE users SET role = 'manager', access_all = 0
       WHERE email = 'manager.cpt@grandholdings.co.za'`
    )
    .run();
  database
    .prepare(
      `INSERT OR IGNORE INTO user_facilities (user_id, facility_id)
       SELECT id, facility_id FROM users
       WHERE email = 'manager.cpt@grandholdings.co.za' AND facility_id IS NOT NULL`
    )
    .run();
}
