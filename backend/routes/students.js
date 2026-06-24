/**
 * routes/students.js — CRUD for students
 */

const express = require('express');
const { db } = require('../db/database');
const { authenticate, staffOrAdmin, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/students — List all students (with optional filters)
router.get('/', authenticate, staffOrAdmin, (req, res) => {
  const { department, semester, search, class: cls } = req.query;

  let query = 'SELECT * FROM students WHERE 1=1';
  const params = [];

  if (department) { query += ' AND department = ?'; params.push(department); }
  if (semester)   { query += ' AND semester = ?';   params.push(Number(semester)); }
  if (cls)        { query += ' AND class = ?';      params.push(cls); }
  if (search) {
    query += ' AND (name LIKE ? OR roll_number LIKE ? OR register_number LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ' ORDER BY department, semester, name';
  const students = db.prepare(query).all(...params);
  res.json(students);
});

// GET /api/students/:id — Get single student
router.get('/:id', authenticate, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found.' });

  // Students can only view their own profile
  if (req.user.role === 'student' && req.user.studentId !== student.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  res.json(student);
});

// POST /api/students — Create student
router.post('/', authenticate, staffOrAdmin, (req, res) => {
  const {
    roll_number, register_number, name, email, phone,
    department, class: cls, semester, batch, date_of_birth, gender, address
  } = req.body;

  if (!roll_number || !register_number || !name || !department || !cls || !semester || !batch) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO students
        (roll_number, register_number, name, email, phone, department, class, semester, batch, date_of_birth, gender, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      roll_number, register_number, name, email || null, phone || null,
      department, cls, Number(semester), batch,
      date_of_birth || null, gender || null, address || null
    );

    // Log activity
    db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES (?,?,?,?)`)
      .run('CREATE', 'student', result.lastInsertRowid, req.user.username);

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(student);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Roll number or register number already exists.' });
    }
    throw err;
  }
});

// PUT /api/students/:id — Update student
router.put('/:id', authenticate, staffOrAdmin, (req, res) => {
  const {
    roll_number, register_number, name, email, phone,
    department, class: cls, semester, batch, date_of_birth, gender, address
  } = req.body;

  const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found.' });

  try {
    db.prepare(`
      UPDATE students SET
        roll_number = ?, register_number = ?, name = ?, email = ?, phone = ?,
        department = ?, class = ?, semester = ?, batch = ?, date_of_birth = ?,
        gender = ?, address = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      roll_number, register_number, name, email || null, phone || null,
      department, cls, Number(semester), batch,
      date_of_birth || null, gender || null, address || null,
      req.params.id
    );

    db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES (?,?,?,?)`)
      .run('UPDATE', 'student', req.params.id, req.user.username);

    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
    res.json(student);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Roll number or register number already exists.' });
    }
    throw err;
  }
});

// DELETE /api/students/:id — Delete student (admin only)
router.delete('/:id', authenticate, adminOnly, (req, res) => {
  const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found.' });

  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES (?,?,?,?)`)
    .run('DELETE', 'student', req.params.id, req.user.username);

  res.json({ message: 'Student deleted successfully.' });
});

// GET /api/students/meta/filters — Get unique filter values
router.get('/meta/filters', authenticate, staffOrAdmin, (req, res) => {
  const departments = db.prepare('SELECT DISTINCT department FROM students ORDER BY department').all().map(r => r.department);
  const classes = db.prepare('SELECT DISTINCT class FROM students ORDER BY class').all().map(r => r.class);
  const batches = db.prepare('SELECT DISTINCT batch FROM students ORDER BY batch DESC').all().map(r => r.batch);
  res.json({ departments, classes, batches });
});

module.exports = router;
