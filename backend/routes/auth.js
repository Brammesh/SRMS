/**
 * routes/auth.js — Login, logout, profile settings and security management
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const hashSync = (p) => bcrypt.hashSync(p, 10);

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // 1. Try checking the users table (Admin and Student accounts)
  let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  // If not found in users table, try matching register number or roll number for a student
  if (!user) {
    user = db.prepare(`
      SELECT u.* FROM users u
      JOIN students s ON s.id = u.student_id
      WHERE s.register_number = ? OR s.roll_number = ?
    `).get(username, username);
  }

  // 2. Try checking staffs table
  let isStaff = false;
  let staff = null;
  if (!user) {
    staff = db.prepare('SELECT * FROM staffs WHERE username = ? OR email = ? OR staff_id = ?').get(username, username, username);
    if (staff) {
      if (staff.status !== 'Active') {
        return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
      }
      isStaff = true;
    }
  }

  if (!user && !staff) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const hash = isStaff ? staff.password_hash : user.password_hash;
  const isValid = bcrypt.compareSync(password, hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Sign JWT
  const payload = {
    id: isStaff ? staff.id : user.id,
    username: isStaff ? staff.username : user.username,
    role: isStaff ? 'staff' : user.role,
    studentId: isStaff ? null : user.student_id,
    staffId: isStaff ? staff.id : null
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

  res.json({
    token,
    user: {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      studentId: payload.studentId,
      staffId: payload.staffId,
      name: isStaff ? staff.name : (payload.role === 'admin' ? 'Administrator' : 'Student')
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  try {
    if (req.user.role === 'staff') {
      const staff = db.prepare('SELECT id, staff_id, name, email, phone, department, designation, username, status, created_at FROM staffs WHERE id = ?').get(req.user.id);
      if (!staff) return res.status(404).json({ error: 'Staff member not found.' });
      return res.json({ id: staff.id, username: staff.username, role: 'staff', name: staff.name, email: staff.email, department: staff.department });
    } else {
      const user = db.prepare('SELECT id, username, role, student_id, created_at FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      let extraDetails = {};
      if (user.role === 'student' && user.student_id) {
        const student = db.prepare('SELECT name, email, department FROM students WHERE id = ?').get(user.student_id);
        if (student) extraDetails = student;
      }

      return res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        studentId: user.student_id,
        name: user.role === 'admin' ? 'Administrator' : (extraDetails.name || 'Student'),
        email: extraDetails.email || '',
        department: extraDetails.department || ''
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/student-lookup — Anonymous result lookup
router.post('/student-lookup', (req, res) => {
  const { identifier, date_of_birth } = req.body;

  if (!identifier || !date_of_birth) {
    return res.status(400).json({ error: 'Roll/Register number and Date of Birth are required.' });
  }

  const student = db.prepare(`
    SELECT * FROM students 
    WHERE (roll_number = ? OR register_number = ?) AND date_of_birth = ?
  `).get(identifier, identifier, date_of_birth);

  if (!student) {
    return res.status(404).json({ error: 'Student record not found.' });
  }

  const token = jwt.sign(
    { id: null, username: student.roll_number, role: 'student', studentId: student.id },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.json({
    token,
    student: {
      id: student.id,
      name: student.name,
      roll_number: student.roll_number,
      department: student.department,
      semester: student.semester,
    }
  });
});

// PUT /api/auth/update-profile — Update own username/email
router.put('/update-profile', authenticate, (req, res) => {
  const { username, email } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  try {
    if (req.user.role === 'staff') {
      // Update staffs table
      if (!email) return res.status(400).json({ error: 'Email is required.' });
      
      const conflict = db.prepare('SELECT id FROM staffs WHERE (username = ? OR email = ?) AND id != ?').get(username, email, req.user.id);
      if (conflict) {
        return res.status(400).json({ error: 'Username or email already in use.' });
      }

      db.prepare('UPDATE staffs SET username = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(username, email, req.user.id);
    } else {
      // Update users table (admin/student)
      const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
      if (conflict) {
        return res.status(400).json({ error: 'Username already in use.' });
      }

      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id);

      // If student, update email in students table as well
      if (req.user.role === 'student' && req.user.studentId && email) {
        db.prepare('UPDATE students SET email = ? WHERE id = ?').run(email, req.user.studentId);
      }
    }

    res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/change-password — Update own password
router.put('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  try {
    let passwordHash = '';
    
    if (req.user.role === 'staff') {
      const staff = db.prepare('SELECT password_hash FROM staffs WHERE id = ?').get(req.user.id);
      if (!staff) return res.status(404).json({ error: 'Account not found.' });
      passwordHash = staff.password_hash;
    } else {
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
      if (!user) return res.status(404).json({ error: 'Account not found.' });
      passwordHash = user.password_hash;
    }

    const isValid = bcrypt.compareSync(currentPassword, passwordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = hashSync(newPassword);

    if (req.user.role === 'staff') {
      db.prepare('UPDATE staffs SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);
    } else {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
    }

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
