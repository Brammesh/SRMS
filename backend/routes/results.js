/**
 * routes/results.js — Enter, update, and retrieve exam results
 */

const express = require('express');
const { db, computeGrade } = require('../db/database');
const { authenticate, adminOnly, staffOrAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/results/student/:studentId ─────────────────────────────────────
// Get all results for a student (students can only get their own)
router.get('/student/:studentId', authenticate, (req, res) => {
  const studentId = Number(req.params.studentId);

  if (req.user.role === 'student' && req.user.studentId !== studentId) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const { academic_year } = req.query;
  let query = `
    SELECT r.*, s.subject_code, s.subject_name, s.credits, s.max_marks, s.pass_marks, s.subject_type,
           st.name as student_name, st.roll_number, st.register_number, st.department, st.semester, st.class, st.batch
    FROM results r
    JOIN subjects s ON s.id = r.subject_id
    JOIN students st ON st.id = r.student_id
    WHERE r.student_id = ?
  `;
  const params = [studentId];

  if (academic_year) { query += ' AND r.academic_year = ?'; params.push(academic_year); }
  query += ' ORDER BY s.semester, s.subject_code';

  const results = db.prepare(query).all(...params);

  // Calculate CGPA
  let cgpa = null;
  if (results.length > 0) {
    const passing = results.filter(r => r.status === 'PASS');
    const totalCredits = passing.reduce((s, r) => s + r.credits, 0);
    const weightedGP = passing.reduce((s, r) => s + (r.grade_point * r.credits), 0);
    cgpa = totalCredits > 0 ? Math.round((weightedGP / totalCredits) * 100) / 100 : 0;
  }

  res.json({ results, cgpa });
});

// ─── GET /api/results/class ───────────────────────────────────────────────────
// Get results for a whole class/department/semester
router.get('/class', authenticate, staffOrAdmin, (req, res) => {
  const { department, semester, academic_year, class: cls } = req.query;

  if (!department || !semester || !academic_year) {
    return res.status(400).json({ error: 'department, semester, and academic_year are required.' });
  }

  let studentQuery = 'SELECT * FROM students WHERE department = ? AND semester = ?';
  const studentParams = [department, Number(semester)];
  if (cls) { studentQuery += ' AND class = ?'; studentParams.push(cls); }
  studentQuery += ' ORDER BY name';

  const students = db.prepare(studentQuery).all(...studentParams);

  const results = students.map(student => {
    const studentResults = db.prepare(`
      SELECT r.*, s.subject_code, s.subject_name, s.credits, s.max_marks, s.pass_marks, s.subject_type
      FROM results r
      JOIN subjects s ON s.id = r.subject_id
      WHERE r.student_id = ? AND r.academic_year = ?
      ORDER BY s.subject_code
    `).all(student.id, academic_year);

    const passing = studentResults.filter(r => r.status === 'PASS');
    const totalCredits = passing.reduce((s, r) => s + r.credits, 0);
    const weightedGP = passing.reduce((s, r) => s + (r.grade_point * r.credits), 0);
    const cgpa = totalCredits > 0 ? Math.round((weightedGP / totalCredits) * 100) / 100 : 0;
    const hasFail = studentResults.some(r => r.status === 'FAIL');

    return { ...student, results: studentResults, cgpa, overall_status: hasFail ? 'FAIL' : 'PASS' };
  });

  res.json(results);
});

// ─── POST /api/results — Upsert a result ─────────────────────────────────────
router.post('/', authenticate, staffOrAdmin, (req, res) => {
  const { student_id, subject_id, internal_marks, external_marks, academic_year, exam_date, status: manualStatus } = req.body;

  if (!student_id || !subject_id || internal_marks === undefined || external_marks === undefined || !academic_year) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subject_id);
  if (!subject) return res.status(404).json({ error: 'Subject not found.' });

  const total = Number(internal_marks) + Number(external_marks);
  const { grade, gradePoint, status } = computeGrade(total, subject.max_marks, subject.pass_marks);
  const finalStatus = manualStatus === 'ABSENT' ? 'ABSENT' : status;

  const existing = db.prepare(
    'SELECT id FROM results WHERE student_id = ? AND subject_id = ? AND academic_year = ?'
  ).get(student_id, subject_id, academic_year);

  if (existing) {
    db.prepare(`
      UPDATE results SET
        internal_marks = ?, external_marks = ?, grade = ?, grade_point = ?,
        status = ?, exam_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      Number(internal_marks), Number(external_marks), grade, gradePoint,
      finalStatus, exam_date || null, existing.id
    );
  } else {
    db.prepare(`
      INSERT INTO results (student_id, subject_id, internal_marks, external_marks, grade, grade_point, status, academic_year, exam_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      student_id, subject_id, Number(internal_marks), Number(external_marks),
      grade, gradePoint, finalStatus, academic_year, exam_date || null
    );
  }

  db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES (?,?,?,?)`)
    .run(existing ? 'UPDATE' : 'CREATE', 'result', student_id, req.user.username);

  const result = db.prepare(`
    SELECT r.*, s.subject_code, s.subject_name FROM results r
    JOIN subjects s ON s.id = r.subject_id
    WHERE r.student_id = ? AND r.subject_id = ? AND r.academic_year = ?
  `).get(student_id, subject_id, academic_year);

  res.json(result);
});

// ─── POST /api/results/bulk — Bulk upsert results ────────────────────────────
router.post('/bulk', authenticate, staffOrAdmin, (req, res) => {
  const { entries } = req.body; // array of { student_id, subject_id, internal_marks, external_marks, academic_year }

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required.' });
  }

  const upsert = db.transaction((entries) => {
    const results = [];
    for (const entry of entries) {
      const { student_id, subject_id, internal_marks, external_marks, academic_year, exam_date } = entry;
      const subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(subject_id);
      if (!subject) continue;

      const total = Number(internal_marks) + Number(external_marks);
      const { grade, gradePoint, status } = computeGrade(total, subject.max_marks, subject.pass_marks);

      const existing = db.prepare(
        'SELECT id FROM results WHERE student_id = ? AND subject_id = ? AND academic_year = ?'
      ).get(student_id, subject_id, academic_year);

      if (existing) {
        db.prepare(`
          UPDATE results SET internal_marks = ?, external_marks = ?, grade = ?, grade_point = ?,
            status = ?, exam_date = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(Number(internal_marks), Number(external_marks), grade, gradePoint, status, exam_date || null, existing.id);
      } else {
        db.prepare(`
          INSERT INTO results (student_id, subject_id, internal_marks, external_marks, grade, grade_point, status, academic_year, exam_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(student_id, subject_id, Number(internal_marks), Number(external_marks), grade, gradePoint, status, academic_year, exam_date || null);
      }
      results.push({ student_id, subject_id, status: 'saved' });
    }
    return results;
  });

  const saved = upsert(entries);
  try {
    db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES ('BULK_SAVE', 'result', ?, ?)`)
      .run(entries[0] ? entries[0].student_id : null, req.user.username);
  } catch (e) {
    console.error(e);
  }
  res.json({ saved: saved.length, results: saved });
});

// ─── DELETE /api/results/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticate, adminOnly, (req, res) => {
  const existing = db.prepare('SELECT id FROM results WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Result not found.' });

  db.prepare('DELETE FROM results WHERE id = ?').run(req.params.id);
  db.prepare(`INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username) VALUES ('DELETE', 'result', ?, ?)`)
    .run(req.params.id, req.user.username);
  res.json({ message: 'Result deleted.' });
});

// ─── GET /api/results/academic-years ─────────────────────────────────────────
router.get('/academic-years', authenticate, (req, res) => {
  const years = db.prepare('SELECT DISTINCT academic_year FROM results ORDER BY academic_year DESC').all().map(r => r.academic_year);
  res.json(years);
});

module.exports = router;
