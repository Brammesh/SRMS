/**
 * database.js — SQLite connection, schema creation, and helpers
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../srms.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema Creation ───────────────────────────────────────────────────────────

db.exec(`
  -- Users table (admin, staff, student)
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL CHECK(role IN ('admin','staff','student')),
    student_id    INTEGER REFERENCES students(id) ON DELETE SET NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Students table
  CREATE TABLE IF NOT EXISTS students (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    roll_number     TEXT    UNIQUE NOT NULL,
    register_number TEXT    UNIQUE NOT NULL,
    name            TEXT    NOT NULL,
    email           TEXT,
    phone           TEXT,
    department      TEXT    NOT NULL,
    class           TEXT    NOT NULL,
    semester        INTEGER NOT NULL CHECK(semester BETWEEN 1 AND 8),
    batch           TEXT    NOT NULL,
    date_of_birth   TEXT,
    gender          TEXT    CHECK(gender IN ('Male','Female','Other')),
    address         TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Subjects table
  CREATE TABLE IF NOT EXISTS subjects (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_code  TEXT    UNIQUE NOT NULL,
    subject_name  TEXT    NOT NULL,
    department    TEXT    NOT NULL,
    semester      INTEGER NOT NULL CHECK(semester BETWEEN 1 AND 8),
    credits       INTEGER NOT NULL DEFAULT 3,
    max_marks     INTEGER NOT NULL DEFAULT 100,
    pass_marks    INTEGER NOT NULL DEFAULT 50,
    subject_type  TEXT    DEFAULT 'Theory' CHECK(subject_type IN ('Theory','Practical','Lab')),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Results table
  CREATE TABLE IF NOT EXISTS results (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    internal_marks  REAL    NOT NULL DEFAULT 0,
    external_marks  REAL    NOT NULL DEFAULT 0,
    total_marks     REAL    GENERATED ALWAYS AS (internal_marks + external_marks) STORED,
    grade           TEXT,
    grade_point     REAL,
    status          TEXT    NOT NULL DEFAULT 'FAIL' CHECK(status IN ('PASS','FAIL','ABSENT')),
    academic_year   TEXT    NOT NULL,
    exam_date       TEXT,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, subject_id, academic_year)
  );

  -- Staffs table
  CREATE TABLE IF NOT EXISTS staffs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id        TEXT    UNIQUE NOT NULL,
    name            TEXT    NOT NULL,
    email           TEXT    UNIQUE NOT NULL,
    phone           TEXT,
    department      TEXT    NOT NULL,
    designation     TEXT    NOT NULL,
    username        TEXT    UNIQUE NOT NULL,
    password_hash   TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Announcements / Activity Log
  CREATE TABLE IF NOT EXISTS activity_log (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    action                TEXT NOT NULL,
    entity_type           TEXT NOT NULL,
    entity_id             INTEGER,
    performed_by_username TEXT,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Grading Helper ────────────────────────────────────────────────────────────

/**
 * Compute grade, grade point, and pass/fail status from marks.
 * Uses a 10-point CGPA scale (Indian university standard).
 */
function computeGrade(totalMarks, maxMarks, passMarks) {
  const percentage = (totalMarks / maxMarks) * 100;
  let grade, gradePoint;

  if (totalMarks < passMarks) {
    grade = 'F';
    gradePoint = 0;
  } else if (percentage >= 91) {
    grade = 'O';
    gradePoint = 10;
  } else if (percentage >= 81) {
    grade = 'A+';
    gradePoint = 9;
  } else if (percentage >= 71) {
    grade = 'A';
    gradePoint = 8;
  } else if (percentage >= 61) {
    grade = 'B+';
    gradePoint = 7;
  } else if (percentage >= 51) {
    grade = 'B';
    gradePoint = 6;
  } else {
    grade = 'C';
    gradePoint = 5;
  }

  return {
    grade,
    gradePoint,
    status: totalMarks >= passMarks ? 'PASS' : 'FAIL',
    percentage: Math.round(percentage * 100) / 100,
  };
}

module.exports = { db, computeGrade };
