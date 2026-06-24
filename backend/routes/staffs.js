/**
 * routes/staffs.js — Staff CRUD API (Admin Only)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authenticate, adminOnly } = require('../middleware/auth');

const router = express.Router();

const hashSync = (p) => bcrypt.hashSync(p, 10);

// Log activity helper
function logActivity(action, entityId, performedBy) {
  try {
    db.prepare(`
      INSERT INTO activity_log (action, entity_type, entity_id, performed_by_username)
      VALUES (?, 'staff', ?, ?)
    `).run(action, entityId, performedBy);
  } catch (err) {
    console.error('Activity log error:', err);
  }
}

// GET /api/staffs — List staff members
router.get('/', authenticate, adminOnly, (req, res) => {
  const { department, search } = req.query;

  let query = 'SELECT id, staff_id, name, email, phone, department, designation, username, status, created_at FROM staffs WHERE 1=1';
  const params = [];

  if (department) {
    query += ' AND department = ?';
    params.push(department);
  }

  if (search) {
    query += ' AND (name LIKE ? OR staff_id LIKE ? OR username LIKE ? OR email LIKE ?)';
    const searchWildcard = `%${search}%`;
    params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const list = db.prepare(query).all(...params);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staffs/:id — Single staff member
router.get('/:id', authenticate, adminOnly, (req, res) => {
  try {
    const staff = db.prepare('SELECT id, staff_id, name, email, phone, department, designation, username, status, created_at FROM staffs WHERE id = ?').get(req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staffs — Add staff member
router.post('/', authenticate, adminOnly, (req, res) => {
  const { staff_id, name, email, phone, department, designation, username, password } = req.body;

  if (!staff_id || !name || !email || !department || !designation || !username || !password) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    // Check uniqueness
    const exists = db.prepare('SELECT id FROM staffs WHERE staff_id = ? OR username = ? OR email = ?').get(staff_id, username, email);
    if (exists) {
      return res.status(400).json({ error: 'Staff ID, username, or email already exists.' });
    }

    const passwordHash = hashSync(password);
    const result = db.prepare(`
      INSERT INTO staffs (staff_id, name, email, phone, department, designation, username, password_hash, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `).run(staff_id, name, email, phone || null, department, designation, username, passwordHash);

    logActivity('CREATE', result.lastInsertRowid, req.user.username);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Staff member added successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/staffs/:id — Edit staff details
router.put('/:id', authenticate, adminOnly, (req, res) => {
  const { name, email, phone, department, designation, username } = req.body;
  const id = req.params.id;

  if (!name || !email || !department || !designation || !username) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const staff = db.prepare('SELECT id FROM staffs WHERE id = ?').get(id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

    // Check unique constraints for others
    const conflict = db.prepare('SELECT id FROM staffs WHERE (username = ? OR email = ?) AND id != ?').get(username, email, id);
    if (conflict) {
      return res.status(400).json({ error: 'Username or email already in use.' });
    }

    db.prepare(`
      UPDATE staffs 
      SET name = ?, email = ?, phone = ?, department = ?, designation = ?, username = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, email, phone || null, department, designation, username, id);

    logActivity('UPDATE', id, req.user.username);

    res.json({ message: 'Staff member updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/staffs/:id/status — Toggle Active/Inactive status
router.put('/:id/status', authenticate, adminOnly, (req, res) => {
  const { status } = req.body;
  const id = req.params.id;

  if (!status || !['Active', 'Inactive'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  try {
    const staff = db.prepare('SELECT id FROM staffs WHERE id = ?').get(id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

    db.prepare('UPDATE staffs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    logActivity(`STATUS_CHANGE (${status})`, id, req.user.username);

    res.json({ message: `Staff status updated to ${status}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/staffs/:id/reset-password — Reset password
router.put('/:id/reset-password', authenticate, adminOnly, (req, res) => {
  const { password } = req.body;
  const id = req.params.id;

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  try {
    const staff = db.prepare('SELECT id FROM staffs WHERE id = ?').get(id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

    const passwordHash = hashSync(password);
    db.prepare('UPDATE staffs SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, id);
    logActivity('PASSWORD_RESET', id, req.user.username);

    res.json({ message: 'Staff password reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/staffs/:id — Delete staff member
router.delete('/:id', authenticate, adminOnly, (req, res) => {
  const id = req.params.id;

  try {
    const staff = db.prepare('SELECT id, name FROM staffs WHERE id = ?').get(id);
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

    db.prepare('DELETE FROM staffs WHERE id = ?').run(id);
    logActivity('DELETE', id, req.user.username);

    res.json({ message: `Staff member "${staff.name}" deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
