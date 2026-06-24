/**
 * routes/dashboard.js — Summary statistics for admin/staff dashboard
 */

const express = require('express');
const { db } = require('../db/database');
const { authenticate, staffOrAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', authenticate, staffOrAdmin, (req, res) => {
  try {
    const totalStudents  = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
    const totalStaff     = db.prepare('SELECT COUNT(*) as count FROM staffs').get().count;
    const totalSubjects  = db.prepare('SELECT COUNT(*) as count FROM subjects').get().count;
    const totalResults   = db.prepare('SELECT COUNT(*) as count FROM results').get().count;

    const passCount      = db.prepare("SELECT COUNT(*) as count FROM results WHERE status = 'PASS'").get().count;
    const failCount      = db.prepare("SELECT COUNT(*) as count FROM results WHERE status = 'FAIL'").get().count;
    const absentCount    = db.prepare("SELECT COUNT(*) as count FROM results WHERE status = 'ABSENT'").get().count;

    const passRate       = totalResults > 0 ? Math.round((passCount / totalResults) * 10000) / 100 : 0;
    const failRate       = totalResults > 0 ? Math.round((failCount / totalResults) * 10000) / 100 : 0;

    // Department-wise student count
    const byDepartment = db.prepare(`
      SELECT department, COUNT(*) as count FROM students GROUP BY department ORDER BY count DESC
    `).all();

    // Top 5 performers by CGPA
    const topPerformers = db.prepare(`
      SELECT s.name, s.roll_number, s.department, s.semester,
             ROUND(SUM(r.grade_point * sub.credits) / SUM(sub.credits), 2) as cgpa
      FROM students s
      JOIN results r ON r.student_id = s.id
      JOIN subjects sub ON sub.id = r.subject_id
      WHERE r.status = 'PASS'
      GROUP BY s.id
      ORDER BY cgpa DESC
      LIMIT 5
    `).all();

    // Recent activity (real database logs)
    const recentActivity = db.prepare(`
      SELECT a.* FROM activity_log a
      ORDER BY a.created_at DESC LIMIT 8
    `).all();

    // Subject-wise average marks
    const subjectAverages = db.prepare(`
      SELECT s.subject_code, s.subject_name, ROUND(AVG(r.total_marks), 1) as avg_marks
      FROM results r
      JOIN subjects s ON s.id = r.subject_id
      GROUP BY r.subject_id
      ORDER BY avg_marks DESC
      LIMIT 8
    `).all();

    // Semester performance (average total marks by semester)
    const semesterPerformance = db.prepare(`
      SELECT s.semester, ROUND(AVG(r.total_marks), 1) as avg_marks
      FROM results r
      JOIN subjects s ON s.id = r.subject_id
      GROUP BY s.semester
      ORDER BY s.semester
    `).all();

    // Monthly Result Statistics (results added per month)
    const monthlyStatsRaw = db.prepare(`
      SELECT strftime('%m', updated_at) as month_num, COUNT(*) as count
      FROM results
      GROUP BY month_num
      ORDER BY month_num
    `).all();

    const monthNames = {
      '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
      '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };

    const monthlyStats = monthlyStatsRaw.map(m => ({
      month: monthNames[m.month_num] || m.month_num,
      count: m.count
    }));

    res.json({
      totalStudents,
      totalStaff,
      totalSubjects,
      totalResults,
      passCount,
      failCount,
      absentCount,
      passRate,
      failRate,
      byDepartment,
      topPerformers,
      recentActivity,
      subjectAverages,
      semesterPerformance,
      monthlyStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
