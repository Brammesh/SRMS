# 🎓 Student Result Management System (SRMS)

A modern web-based Student Result Management System built using **Node.js, Express.js, SQLite, HTML, CSS, and JavaScript**. The system provides separate portals for **Administrators, Staff/Teachers, and Students** to efficiently manage and access academic records and examination results.

---

## 📌 Features

### 👨‍💼 Admin Portal

* Secure Admin Login
* Dashboard with statistics and analytics
* Manage Students (Add, Edit, Delete, Search)
* Manage Staff/Teachers
* Manage Subjects
* Manage Examination Results
* Generate Student Reports
* Password Reset Management
* Role-Based Access Control

### 👨‍🏫 Staff/Teacher Portal

* Secure Login
* View and Manage Assigned Student Records
* Enter and Update Marks
* View Student Performance
* Generate Reports

### 👨‍🎓 Student Portal

* View Semester Results
* Subject-wise Marks Display
* Grade and CGPA Calculation
* Result Summary Dashboard
* Download Result as PDF
* Mobile-Friendly Interface

---

## 🛠️ Technology Stack

| Technology | Purpose             |
| ---------- | ------------------- |
| Node.js    | Backend Runtime     |
| Express.js | REST API Framework  |
| SQLite     | Database            |
| JWT        | Authentication      |
| bcrypt     | Password Encryption |
| PDFKit     | PDF Generation      |
| HTML5      | Frontend Structure  |
| CSS3       | Styling             |
| JavaScript | Client-side Logic   |

---

## 📂 Project Structure

```text
SRMS/
├── backend/
│   ├── db/
│   ├── middleware/
│   ├── routes/
│   └── server.js
│
├── frontend/
│   ├── admin/
│   ├── student/
│   ├── css/
│   ├── js/
│   └── index.html
│
├── package.json
├── package-lock.json
└── README.md
```

---

## 🚀 Installation

### Clone Repository

```bash
git clone https://github.com/Brammesh/SRMS.git
cd SRMS
```

### Install Dependencies

```bash
npm install
```

### Start Application

```bash
npm start
```

Server will start on:

```text
http://localhost:3000
```

---

## 🔐 User Roles

### Admin

* Full System Access
* Manage Students
* Manage Staff
* Manage Subjects
* Manage Results
* Generate Reports

### Staff

* Manage Student Results
* View Student Information
* Generate Reports

### Student

* View Own Results
* Download PDF Marksheet
* View CGPA and Grades

---

## 📊 Result Features

* Internal Marks
* External Marks
* Total Marks Calculation
* Grade Calculation
* Pass / Fail Status
* Semester-wise Results
* CGPA Calculation
* Academic Year Tracking

---

## 📄 PDF Report Generation

The system supports professional PDF report generation including:

* Institution Name
* Student Information
* Subject-wise Marks Table
* Grade Information
* CGPA
* Pass/Fail Status
* Generated Date & Time
* Signature Placeholder

---

## 🔒 Security Features

* JWT Authentication
* Password Hashing using bcrypt
* Role-Based Authorization
* Protected API Routes
* Input Validation
* Secure Session Management

---

## 📱 Responsive Design

The application is fully responsive and optimized for:

* Desktop
* Laptop
* Tablet
* Mobile Devices

---

## 🎯 Future Enhancements

* Email Notifications
* Attendance Management
* Semester Promotion System
* Excel Export
* Multi-Institution Support
* Cloud Database Support
* Student Profile Management
* Audit Logs

---

## 👨‍💻 Author

**Brammesh R**

* GitHub: https://github.com/Brammesh

---

## 📜 License

This project is developed for educational and learning purposes.

© 2026 Brammesh R. All Rights Reserved.
