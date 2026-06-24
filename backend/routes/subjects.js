/**
 * routes/subjects.js — CRUD for subjects
 */

const express = require('express');
const { db } = require('../db/database');
const { authenticate, staffOrAdmin, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/subjects — List all subjects
router.get('/', authenticate, (req, res) => {
  const { department, semester } = req.query;

  let query = 'SELECT * FROM subjects WHERE 1=1';
  const params = [];

  if (department) { query += ' AND department = ?'; params.push(department); }
  if (semester)   { query += ' AND semester = ?';   params.push(Number(semester)); }

  query += ' ORDER BY department, semester, subject_code';
  const subjects = db.prepare(query).all(...params);
  res.json(subjects);
});

// GET /api/subjects/:id
router.get('/:id', authenticate, (req, res) => {
  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
  if (!subject) return res.status(404).json({ error: 'Subject not found.' });
  res.json(subject);
});

// POST /api/subjects — Create subject (admin/staff only)
router.post('/', authenticate, staffOrAdmin, (req, res) => {
  const { subject_code, subject_name, department, semester, credits, max_marks, pass_marks, subject_type } = req.body;

  if (!subject_code || !subject_name || !department || !semester) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO subjects (subject_code, subject_name, department, semester, credits, max_marks, pass_marks, subject_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subject_code, subject_name, department, Number(semester),
      credits || 3, max_marks || 100, pass_marks || 40, subject_type || 'Theory'
    );

    db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES (?,?,?,?)`)
      .run('CREATE', 'subject', result.lastInsertRowid, req.user.username);

    const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(subject);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Subject code already exists.' });
    }
    throw err;
  }
});

// PUT /api/subjects/:id
router.put('/:id', authenticate, staffOrAdmin, (req, res) => {
  const { subject_code, subject_name, department, semester, credits, max_marks, pass_marks, subject_type } = req.body;

  const existing = db.prepare('SELECT id FROM subjects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subject not found.' });

  try {
    db.prepare(`
      UPDATE subjects SET
        subject_code = ?, subject_name = ?, department = ?, semester = ?,
        credits = ?, max_marks = ?, pass_marks = ?, subject_type = ?
      WHERE id = ?
    `).run(
      subject_code, subject_name, department, Number(semester),
      credits, max_marks, pass_marks, subject_type,
      req.params.id
    );

    db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES (?,?,?,?)`)
      .run('UPDATE', 'subject', req.params.id, req.user.username);

    const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
    res.json(subject);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Subject code already exists.' });
    }
    throw err;
  }
});

// DELETE /api/subjects/:id (admin only)
router.delete('/:id', authenticate, adminOnly, (req, res) => {
  const existing = db.prepare('SELECT id FROM subjects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Subject not found.' });

  db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
  db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES (?,?,?,?)`)
    .run('DELETE', 'subject', req.params.id, req.user.username);
  res.json({ message: 'Subject deleted.' });
});

module.exports = router;
