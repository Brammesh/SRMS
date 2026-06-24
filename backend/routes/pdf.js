/**
 * routes/pdf.js — Professional PDF marksheet generator
 */

const express = require('express');
const PDFDocument = require('pdfkit');
const { db } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper to draw a graduation cap vector logo
function drawGraduationCapLogo(doc, x, y) {
  doc.save();
  doc.translate(x, y);

  // Shield background
  doc.fillColor('#e6edf8');
  doc.path('M 25 0 L 50 15 L 50 45 C 50 55, 25 65, 25 65 C 25 65, 0 55, 0 45 L 0 15 Z').fill();

  // Cap Diamond
  doc.fillColor('#1e3a5f');
  doc.path('M 25 15 L 42 22 L 25 29 L 8 22 Z').fill();

  // Cap Base
  doc.path('M 17 25.5 L 17 33 C 17 35, 33 35, 33 33 L 33 25.5').fill();

  // Tassel
  doc.strokeColor('#4F8EF7').lineWidth(1.5);
  doc.path('M 31 22 L 36 27 L 36 34').stroke();
  doc.fillColor('#4F8EF7');
  doc.circle(36, 35, 2.2).fill();

  doc.restore();
}

// Helper to draw profile silhouette
function drawProfileSilhouette(doc, x, y, w, h) {
  doc.save();
  doc.translate(x, y);

  // Background frame
  doc.fillColor('#f1f5f9').rect(0, 0, w, h).fill();
  doc.strokeColor('#cbd5e1').lineWidth(1).rect(0, 0, w, h).stroke();

  // Head
  doc.fillColor('#94a3b8');
  doc.circle(w / 2, h / 3, w / 5).fill();

  // Shoulders
  doc.path(`M ${w * 0.15} ${h * 0.9} C ${w * 0.15} ${h * 0.6}, ${w * 0.85} ${h * 0.6}, ${w * 0.85} ${h * 0.9} Z`).fill();

  // Label text
  doc.fillColor('#64748b').fontSize(6).font('Helvetica-Bold')
     .text('STUDENT PHOTO', 0, h - 12, { width: w, align: 'center' });

  doc.restore();
}

// GET /api/pdf/marksheet/:studentId
router.get('/marksheet/:studentId', authenticate, (req, res) => {
  const studentId = Number(req.params.studentId);

  // Role verification: Students can only view their own
  if (req.user.role === 'student' && req.user.studentId !== studentId) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!student) return res.status(404).json({ error: 'Student not found.' });

  const { academic_year } = req.query;
  let query = `
    SELECT r.*, s.subject_code, s.subject_name, s.credits, s.max_marks, s.pass_marks, s.subject_type
    FROM results r
    JOIN subjects s ON s.id = r.subject_id
    WHERE r.student_id = ?
  `;
  const params = [studentId];
  if (academic_year) {
    query += ' AND r.academic_year = ?';
    params.push(academic_year);
  }
  query += ' ORDER BY s.semester, s.subject_code';

  const results = db.prepare(query).all(...params);
  if (results.length === 0) {
    return res.status(404).json({ error: 'No academic results found for this student.' });
  }

  // Statistics calculation
  const passing = results.filter(r => r.status === 'PASS');
  const totalCredits = results.reduce((s, r) => s + r.credits, 0);
  const earnedCredits = passing.reduce((s, r) => s + r.credits, 0);
  const weightedGP = passing.reduce((s, r) => s + (r.grade_point * r.credits), 0);
  const cgpa = earnedCredits > 0 ? (weightedGP / earnedCredits).toFixed(2) : '0.00';
  const hasFail = results.some(r => r.status === 'FAIL');

  const totalObtained = results.reduce((s, r) => s + r.total_marks, 0);
  const totalMax = results.reduce((s, r) => s + r.max_marks, 0);
  const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : '0.00';

  // PDF Document creation
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="marksheet_${student.roll_number}.pdf"`);
  doc.pipe(res);

  // Palette definitions
  const PRIMARY   = '#1e3a5f';
  const ACCENT    = '#4F8EF7';
  const DARKGRAY  = '#334155';
  const LIGHTGRAY = '#f8fafc';
  const BORDER    = '#cbd5e1';

  // 1. Institution Header Banner
  drawGraduationCapLogo(doc, 45, 30);

  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(16)
     .text('SRMS UNIVERSITY OF TECHNOLOGY', 105, 30);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(ACCENT)
     .text('DEPARTMENT OF ACADEMIC AFFAIRS', 105, 48);
  doc.fontSize(8).font('Helvetica').fillColor('#64748b')
     .text('Official Academic Record & Mark Statement  |  Affiliated & Registered', 105, 60);

  doc.strokeColor(ACCENT).lineWidth(2).moveTo(40, 85).lineTo(doc.page.width - 40, 85).stroke();

  // 2. Student Details Box
  let y = 100;
  doc.fillColor(LIGHTGRAY).rect(40, y, doc.page.width - 80, 110).fill();
  doc.strokeColor(BORDER).lineWidth(1).rect(40, y, doc.page.width - 80, 110).stroke();

  // Photo
  drawProfileSilhouette(doc, 485, y + 15, 60, 75);

  // Info details
  doc.fillColor(PRIMARY).fontSize(10).font('Helvetica-Bold').text('STUDENT INFORMATION & ACADEMIC STANDING', 55, y + 12);
  doc.fontSize(8.5).font('Helvetica').fillColor(DARKGRAY);

  const col1 = 55, col2 = 270;
  doc.text(`Student Name :  ${student.name.toUpperCase()}`, col1, y + 32);
  doc.text(`Roll Number  :  ${student.roll_number}`, col1, y + 48);
  doc.text(`Register No  :  ${student.register_number}`, col1, y + 64);
  doc.text(`Date of Birth:  ${student.date_of_birth || 'N/A'}`, col1, y + 80);

  doc.text(`Department   :  ${student.department}`, col2, y + 32);
  doc.text(`Semester     :  Semester ${student.semester}`, col2, y + 48);
  doc.text(`Class/Section:  ${student.class}`, col2, y + 64);
  doc.text(`Academic Year:  ${academic_year || 'All Years'}`, col2, y + 80);

  // 3. Results Table Header
  y += 125;
  doc.fillColor(PRIMARY).fontSize(10).font('Helvetica-Bold').text('STATEMENT OF EXAMINATION PERFORMANCE', 40, y);
  y += 15;

  const colWidths = [50, 190, 50, 50, 50, 40, 35, 50];
  const colX = [40];
  for (let i = 1; i < colWidths.length; i++) colX.push(colX[i - 1] + colWidths[i - 1]);

  // Render Table Header Row
  doc.rect(40, y, doc.page.width - 80, 20).fill(PRIMARY);
  doc.fillColor('white').fontSize(8.5).font('Helvetica-Bold');
  const headers = ['CODE', 'SUBJECT TITLE', 'INT.', 'EXT.', 'TOTAL', 'GRADE', 'GP', 'STATUS'];
  headers.forEach((h, i) => {
    doc.text(h, colX[i], y + 6, { width: colWidths[i], align: i === 1 ? 'left' : 'center' });
  });
  y += 20;

  // Results Loop
  results.forEach((r, idx) => {
    // Determine subject name line height to support word wrapping and avoid overflow
    const subjHeight = doc.heightOfString(r.subject_name, { width: colWidths[1] - 8 }) + 10;
    const rowHeight = Math.max(20, subjHeight);

    // Page Break handling
    if (y + rowHeight > doc.page.height - 110) {
      doc.addPage();
      y = 50;

      // Repeat Table Header
      doc.rect(40, y, doc.page.width - 80, 20).fill(PRIMARY);
      doc.fillColor('white').fontSize(8.5).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, colX[i], y + 6, { width: colWidths[i], align: i === 1 ? 'left' : 'center' });
      });
      y += 20;
    }

    const rowBg = idx % 2 === 0 ? 'white' : '#f8fafc';
    if (rowBg !== 'white') {
      doc.fillColor(rowBg).rect(40, y, doc.page.width - 80, rowHeight).fill();
    }

    // Border line
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(40, y + rowHeight).lineTo(doc.page.width - 40, y + rowHeight).stroke();

    doc.fillColor(DARKGRAY).fontSize(8).font('Helvetica');
    // Code
    doc.text(r.subject_code, colX[0], y + 6, { width: colWidths[0], align: 'center' });
    // Subject Name (wrapped)
    doc.text(r.subject_name, colX[1] + 4, y + 6, { width: colWidths[1] - 8, align: 'left' });
    // Int
    doc.text(String(r.internal_marks), colX[2], y + 6, { width: colWidths[2], align: 'center' });
    // Ext
    doc.text(String(r.external_marks), colX[3], y + 6, { width: colWidths[3], align: 'center' });
    // Total
    doc.text(String(r.total_marks), colX[4], y + 6, { width: colWidths[4], align: 'center' });
    // Grade
    doc.text(r.grade, colX[5], y + 6, { width: colWidths[5], align: 'center' });
    // GP
    doc.text(String(r.grade_point), colX[6], y + 6, { width: colWidths[6], align: 'center' });
    // Status
    const statusColor = r.status === 'PASS' ? '#10b981' : '#ef4444';
    doc.fillColor(statusColor).font('Helvetica-Bold').text(r.status, colX[7], y + 6, { width: colWidths[7], align: 'center' });

    y += rowHeight;
  });

  // Table Outer Frame
  doc.strokeColor(PRIMARY).lineWidth(1).rect(40, y - 20 - results.reduce((sum, r, idx) => {
    const h = Math.max(20, doc.heightOfString(r.subject_name, { width: colWidths[1] - 8 }) + 10);
    return sum + h;
  }, 0), doc.page.width - 80, results.reduce((sum, r) => sum + Math.max(20, doc.heightOfString(r.subject_name, { width: colWidths[1] - 8 }) + 10), 0) + 20).stroke();

  // Page Break boundary check for summary
  if (y + 110 > doc.page.height - 110) {
    doc.addPage();
    y = 50;
  }

  // 4. Performance Summary Box
  y += 20;
  doc.fillColor(LIGHTGRAY).rect(40, y, doc.page.width - 80, 50).fill();
  doc.strokeColor(BORDER).lineWidth(1).rect(40, y, doc.page.width - 80, 50).stroke();

  doc.fillColor(PRIMARY).fontSize(9.5).font('Helvetica-Bold');
  doc.text(`TOTAL CREDIT POINTS EARNED :  ${earnedCredits} / ${totalCredits}`, 55, y + 12);
  doc.text(`CUMULATIVE GRADE POINT AVERAGE (CGPA) :  ${cgpa}`, 55, y + 28);

  const overallStatus = hasFail ? 'FAIL' : 'PASS';
  const overallColor = hasFail ? '#ef4444' : '#10b981';

  doc.text('RESULT STATUS :', 320, y + 20);
  doc.fillColor(overallColor).fontSize(14).text(overallStatus, 420, y + 17);

  // 5. Authorized Signatures / Seal Area
  y += 70;
  doc.strokeColor(BORDER).lineWidth(0.5).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
  y += 15;

  doc.fillColor('#64748b').fontSize(8.5).font('Helvetica');
  doc.text(`Generated Date: ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`, col1, y + 10);
  doc.text('Verification Token: ' + Math.random().toString(36).substring(2, 10).toUpperCase(), col1, y + 24);

  // Signature line
  doc.strokeColor(DARKGRAY).lineWidth(0.75).moveTo(doc.page.width - 180, y + 25).lineTo(doc.page.width - 50, y + 25).stroke();
  doc.fillColor(DARKGRAY).fontSize(8.5).font('Helvetica-Bold')
     .text('CONTROLLER OF EXAMINATIONS', doc.page.width - 180, y + 32, { width: 130, align: 'center' });

  // 6. Footer on all pages
  let pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
       .text('This is an official computer-generated academic document issued by SRMS. Document authenticity can be verified online.', 40, doc.page.height - 40, { align: 'center', width: doc.page.width - 80 });
  }

  doc.end();
});

module.exports = router;
