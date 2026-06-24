/**
 * seed.js — Populate the database with sample data for testing.
 * Run: npm run seed
 */

const bcrypt = require('bcryptjs');
const { db, computeGrade } = require('./database');

console.log('🌱 Seeding database...');

// ─── Clear existing data ────────────────────────────────────────────────────────
db.exec(`
  DELETE FROM results;
  DELETE FROM subjects;
  DELETE FROM users;
  DELETE FROM students;
  DELETE FROM staffs;
  DELETE FROM activity_log;
  DELETE FROM sqlite_sequence;
`);

// ─── Users & Staffs ────────────────────────────────────────────────────────────
const hashSync = (p) => bcrypt.hashSync(p, 10);

const insertUser = db.prepare(`
  INSERT INTO users (username, password_hash, role, student_id)
  VALUES (?, ?, ?, ?)
`);

const insertStaff = db.prepare(`
  INSERT INTO staffs (staff_id, name, email, phone, department, designation, username, password_hash, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Admin in users table
insertUser.run('admin', hashSync('admin123'), 'admin', null);

// Staff in staffs table
insertStaff.run('STF001', 'Dr. Ramesh Kumar', 'ramesh.kumar@srms.edu', '9876543230', 'CSE', 'Assistant Professor', 'staff01', hashSync('staff123'), 'Active');
insertStaff.run('STF002', 'Dr. Sarah Joseph', 'sarah.joseph@srms.edu', '9876543231', 'ECE', 'Associate Professor', 'staff02', hashSync('staff123'), 'Active');

// ─── Students ──────────────────────────────────────────────────────────────────
const insertStudent = db.prepare(`
  INSERT INTO students (roll_number, register_number, name, email, phone, department, class, semester, batch, date_of_birth, gender)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const students = [
  // CSE - Semester 4
  ['CS21001', 'REG2021001', 'Arjun Sharma', 'arjun.sharma@student.edu', '9876543210', 'CSE', 'CS-A', 4, '2021-2025', '2003-05-15', 'Male'],
  ['CS21002', 'REG2021002', 'Priya Nair', 'priya.nair@student.edu', '9876543211', 'CSE', 'CS-A', 4, '2021-2025', '2003-08-22', 'Female'],
  ['CS21003', 'REG2021003', 'Rahul Verma', 'rahul.verma@student.edu', '9876543212', 'CSE', 'CS-A', 4, '2021-2025', '2003-01-10', 'Male'],
  ['CS21004', 'REG2021004', 'Anjali Mehta', 'anjali.mehta@student.edu', '9876543213', 'CSE', 'CS-B', 4, '2021-2025', '2002-11-30', 'Female'],
  ['CS21005', 'REG2021005', 'Vikram Singh', 'vikram.singh@student.edu', '9876543214', 'CSE', 'CS-B', 4, '2021-2025', '2003-03-18', 'Male'],
  // ECE - Semester 4
  ['EC21001', 'REG2021006', 'Sneha Pillai', 'sneha.pillai@student.edu', '9876543215', 'ECE', 'EC-A', 4, '2021-2025', '2003-07-07', 'Female'],
  ['EC21002', 'REG2021007', 'Karthik Rajan', 'karthik.rajan@student.edu', '9876543216', 'ECE', 'EC-A', 4, '2021-2025', '2002-12-25', 'Male'],
  ['EC21003', 'REG2021008', 'Deepa Krishnan', 'deepa.krishnan@student.edu', '9876543217', 'ECE', 'EC-A', 4, '2021-2025', '2003-09-14', 'Female'],
  // MECH - Semester 2
  ['ME22001', 'REG2022001', 'Arun Kumar', 'arun.kumar@student.edu', '9876543218', 'MECH', 'ME-A', 2, '2022-2026', '2004-02-28', 'Male'],
  ['ME22002', 'REG2022002', 'Pooja Reddy', 'pooja.reddy@student.edu', '9876543219', 'MECH', 'ME-A', 2, '2022-2026', '2004-06-11', 'Female'],
  // CIVIL - Semester 6
  ['CV20001', 'REG2020001', 'Suresh Babu', 'suresh.babu@student.edu', '9876543220', 'CIVIL', 'CV-A', 6, '2020-2024', '2002-04-05', 'Male'],
  ['CV20002', 'REG2020002', 'Lakshmi Devi', 'lakshmi.devi@student.edu', '9876543221', 'CIVIL', 'CV-A', 6, '2020-2024', '2001-10-19', 'Female'],
  // CSE - Semester 6
  ['CS20001', 'REG2020005', 'Mohammed Ali', 'mohammed.ali@student.edu', '9876543222', 'CSE', 'CS-A', 6, '2020-2024', '2002-08-03', 'Male'],
  ['CS20002', 'REG2020003', 'Riya Gupta', 'riya.gupta@student.edu', '9876543223', 'CSE', 'CS-A', 6, '2020-2024', '2002-03-21', 'Female'],
  ['CS20003', 'REG2020004', 'Nikhil Patel', 'nikhil.patel@student.edu', '9876543224', 'CSE', 'CS-B', 6, '2020-2024', '2001-12-08', 'Male'],
];

const studentIds = [];
for (const s of students) {
  const result = insertStudent.run(...s);
  studentIds.push(result.lastInsertRowid);
}

// ─── Subjects ──────────────────────────────────────────────────────────────────
const insertSubject = db.prepare(`
  INSERT INTO subjects (subject_code, subject_name, department, semester, credits, max_marks, pass_marks, subject_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const subjects = [
  // CSE Semester 4
  ['CS401', 'Data Structures & Algorithms', 'CSE', 4, 4, 100, 40, 'Theory'],
  ['CS402', 'Database Management Systems', 'CSE', 4, 4, 100, 40, 'Theory'],
  ['CS403', 'Operating Systems', 'CSE', 4, 3, 100, 40, 'Theory'],
  ['CS404', 'Computer Networks', 'CSE', 4, 3, 100, 40, 'Theory'],
  ['CS405', 'Software Engineering', 'CSE', 4, 3, 100, 40, 'Theory'],
  ['CS406L', 'DBMS Laboratory', 'CSE', 4, 2, 50, 20, 'Lab'],
  // CSE Semester 6
  ['CS601', 'Machine Learning', 'CSE', 6, 4, 100, 40, 'Theory'],
  ['CS602', 'Web Technologies', 'CSE', 6, 4, 100, 40, 'Theory'],
  ['CS603', 'Cloud Computing', 'CSE', 6, 3, 100, 40, 'Theory'],
  ['CS604', 'Information Security', 'CSE', 6, 3, 100, 40, 'Theory'],
  ['CS605', 'Artificial Intelligence', 'CSE', 6, 4, 100, 40, 'Theory'],
  ['CS606L', 'ML Laboratory', 'CSE', 6, 2, 50, 20, 'Lab'],
  // ECE Semester 4
  ['EC401', 'Signals & Systems', 'ECE', 4, 4, 100, 40, 'Theory'],
  ['EC402', 'Digital Electronics', 'ECE', 4, 4, 100, 40, 'Theory'],
  ['EC403', 'Analog Circuits', 'ECE', 4, 3, 100, 40, 'Theory'],
  ['EC404', 'Electromagnetic Fields', 'ECE', 4, 3, 100, 40, 'Theory'],
  ['EC405', 'VLSI Design', 'ECE', 4, 3, 100, 40, 'Theory'],
  ['EC406L', 'Digital Electronics Lab', 'ECE', 4, 2, 50, 20, 'Lab'],
  // MECH Semester 2
  ['ME201', 'Engineering Mathematics', 'MECH', 2, 4, 100, 40, 'Theory'],
  ['ME202', 'Engineering Mechanics', 'MECH', 2, 4, 100, 40, 'Theory'],
  ['ME203', 'Materials Science', 'MECH', 2, 3, 100, 40, 'Theory'],
  ['ME204', 'Thermodynamics', 'MECH', 2, 3, 100, 40, 'Theory'],
  ['ME205L', 'Workshop Lab', 'MECH', 2, 2, 50, 20, 'Lab'],
  // CIVIL Semester 6
  ['CV601', 'Structural Analysis', 'CIVIL', 6, 4, 100, 40, 'Theory'],
  ['CV602', 'Concrete Technology', 'CIVIL', 6, 4, 100, 40, 'Theory'],
  ['CV603', 'Environmental Engineering', 'CIVIL', 6, 3, 100, 40, 'Theory'],
  ['CV604', 'Transportation Engineering', 'CIVIL', 6, 3, 100, 40, 'Theory'],
  ['CV605L', 'Surveying Lab', 'CIVIL', 6, 2, 50, 20, 'Lab'],
];

const subjectIds = {};
for (const s of subjects) {
  const result = insertSubject.run(...s);
  subjectIds[s[0]] = { id: result.lastInsertRowid, maxMarks: s[5], passMarks: s[6] };
}

// ─── Results ───────────────────────────────────────────────────────────────────
const insertResult = db.prepare(`
  INSERT INTO results (student_id, subject_id, internal_marks, external_marks, grade, grade_point, status, academic_year, exam_date)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function addResult(studentId, subjectCode, internal, external, academicYear) {
  const sub = subjectIds[subjectCode];
  if (!sub) return;
  const total = internal + external;
  const { grade, gradePoint, status } = computeGrade(total, sub.maxMarks, sub.passMarks);
  insertResult.run(studentId, sub.id, internal, external, grade, gradePoint, status, academicYear, '2024-11-15');
}

// CSE Students (Semester 4)
const csSem4Subjects = ['CS401', 'CS402', 'CS403', 'CS404', 'CS405', 'CS406L'];
const csSem4Results = [
  // Arjun Sharma - high performer
  [[38,55],[35,60],[28,52],[30,58],[32,56],[18,25]],
  // Priya Nair - average
  [[30,45],[28,40],[25,42],[27,43],[26,44],[15,20]],
  // Rahul Verma - below average (some fails)
  [[20,25],[18,22],[15,20],[22,28],[19,21],[8,12]],
  // Anjali Mehta - good
  [[35,58],[33,55],[30,50],[32,54],[31,52],[17,23]],
  // Vikram Singh - very good
  [[37,60],[36,62],[32,55],[34,57],[33,58],[19,26]],
];
for (let i = 0; i < 5; i++) {
  for (let j = 0; j < csSem4Subjects.length; j++) {
    addResult(studentIds[i], csSem4Subjects[j], csSem4Results[i][j][0], csSem4Results[i][j][1], '2024-25');
  }
}

// ECE Students (Semester 4)
const eceSem4Subjects = ['EC401', 'EC402', 'EC403', 'EC404', 'EC405', 'EC406L'];
const eceSem4Results = [
  [[36,57],[34,58],[30,52],[31,54],[33,56],[18,24]],
  [[28,42],[27,40],[24,38],[26,41],[25,39],[14,19]],
  [[38,60],[36,62],[32,56],[34,58],[35,59],[19,27]],
];
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < eceSem4Subjects.length; j++) {
    addResult(studentIds[5 + i], eceSem4Subjects[j], eceSem4Results[i][j][0], eceSem4Results[i][j][1], '2024-25');
  }
}

// MECH Students (Semester 2)
const mechSem2Subjects = ['ME201', 'ME202', 'ME203', 'ME204', 'ME205L'];
const mechSem2Results = [
  [[32,50],[30,48],[28,44],[29,46],[15,21]],
  [[35,55],[33,52],[31,49],[32,51],[17,23]],
];
for (let i = 0; i < 2; i++) {
  for (let j = 0; j < mechSem2Subjects.length; j++) {
    addResult(studentIds[8 + i], mechSem2Subjects[j], mechSem2Results[i][j][0], mechSem2Results[i][j][1], '2024-25');
  }
}

// CIVIL Students (Semester 6)
const civilSem6Subjects = ['CV601', 'CV602', 'CV603', 'CV604', 'CV605L'];
const civilSem6Results = [
  [[34,53],[32,51],[29,47],[30,49],[16,22]],
  [[37,59],[35,57],[32,53],[34,55],[18,25]],
];
for (let i = 0; i < 2; i++) {
  for (let j = 0; j < civilSem6Subjects.length; j++) {
    addResult(studentIds[10 + i], civilSem6Subjects[j], civilSem6Results[i][j][0], civilSem6Results[i][j][1], '2024-25');
  }
}

// CSE Students Sem 6
const csSem6Subjects = ['CS601', 'CS602', 'CS603', 'CS604', 'CS605', 'CS606L'];
const csSem6Results = [
  [[38,60],[36,58],[33,55],[35,57],[37,59],[19,26]],
  [[30,47],[28,44],[26,41],[27,43],[29,46],[15,21]],
  [[35,56],[33,54],[30,50],[32,52],[34,55],[17,24]],
];
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < csSem6Subjects.length; j++) {
    addResult(studentIds[12 + i], csSem6Subjects[j], csSem6Results[i][j][0], csSem6Results[i][j][1], '2024-25');
  }
}

// ─── Student user accounts ─────────────────────────────────────────────────────
// Create user accounts for first 5 CSE students (both username and register number)
const studentUserData = [
  ['arjun.sharma', 'student123', studentIds[0]],
  ['REG2021001', 'student123', studentIds[0]],
  ['priya.nair', 'student123', studentIds[1]],
  ['REG2021002', 'student123', studentIds[1]],
  ['rahul.verma', 'student123', studentIds[2]],
  ['REG2021003', 'student123', studentIds[2]],
  ['anjali.mehta', 'student123', studentIds[3]],
  ['REG2021004', 'student123', studentIds[3]],
  ['vikram.singh', 'student123', studentIds[4]],
  ['REG2021005', 'student123', studentIds[4]],
];
for (const [uname, pass, sid] of studentUserData) {
  insertUser.run(uname, hashSync(pass), 'student', sid);
}

console.log('✅ Database seeded successfully!');
console.log('');
console.log('📋 Sample Login Credentials:');
console.log('  Admin:   admin / admin123');
console.log('  Staff:   staff01 / staff123');
console.log('  Student: REG2021001 / student123 (or arjun.sharma / student123)');
console.log('  Student lookup: Roll# CS21001 or Register# REG2021001');
