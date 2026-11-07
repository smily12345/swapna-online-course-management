// SWAPNA'S ONLINE COURSES LEARNING MANAGEMENT SYSTEM
// Simple Express + MySQL CRUD pattern, matching the reference project structure.

require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "development_only_change_this_secret";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let db;

async function connectDatabase() {
    db = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "Swa@Pna143",
        database: process.env.DB_NAME || "swapna_lms"
    });
    console.log("Connected to MySQL database: swapna_lms");
}

function handleError(res, error) {
    console.error(error);
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "This record already exists." });
    }
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json({ message: "Please select a valid related record." });
    }
    return res.status(500).json({ message: "Database error. Check the server console." });
}

function makeToken(user) {
    return jwt.sign({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role
    }, JWT_SECRET, { expiresIn: "7d" });
}

function authRequired(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Please log in first." });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: "Session expired. Please log in again." });
    }
}

function instructorOnly(req, res, next) {
    if (req.user.role !== "instructor") {
        return res.status(403).json({ message: "Only instructors can perform this action." });
    }
    next();
}

app.get("/api/health", (req, res) => {
    res.json({ message: "Swapna LMS API is running." });
});

// ---------------- AUTHENTICATION ----------------
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required." });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ message: "Password must contain at least 6 characters." });
        }
        const safeRole = role === "instructor" ? "instructor" : "student";
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            "INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)",
            [name.trim(), email.trim().toLowerCase(), hash, safeRole]
        );
        const user = { user_id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: safeRole };
        res.status(201).json({ message: "Account created successfully.", token: makeToken(user), user });
    } catch (error) { handleError(res, error); }
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Enter your email and password." });
        const [rows] = await db.execute(
            "SELECT user_id,name,email,password,role FROM users WHERE email=?",
            [email.trim().toLowerCase()]
        );
        if (!rows.length || !(await bcrypt.compare(password, rows[0].password))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }
        const { password: ignored, ...user } = rows[0];
        res.json({ message: "Login successful.", token: makeToken(user), user });
    } catch (error) { handleError(res, error); }
});

app.get("/api/me", authRequired, (req, res) => res.json(req.user));

// ---------------- DASHBOARD ----------------
app.get("/api/dashboard", authRequired, async (req, res) => {
    try {
        if (req.user.role === "instructor") {
            const [[courseCount]] = await db.execute(
                "SELECT COUNT(*) AS total FROM courses WHERE instructor_id=?", [req.user.user_id]
            );
            const [[studentCount]] = await db.execute(
                `SELECT COUNT(DISTINCT e.student_id) AS total FROM enrollments e
                 JOIN courses c ON c.course_id=e.course_id WHERE c.instructor_id=?`, [req.user.user_id]
            );
            const [[lessonCount]] = await db.execute(
                `SELECT COUNT(*) AS total FROM lessons l JOIN courses c ON c.course_id=l.course_id
                 WHERE c.instructor_id=?`, [req.user.user_id]
            );
            res.json({ role: "instructor", courses: courseCount.total, students: studentCount.total, lessons: lessonCount.total });
        } else {
            const [[enrollmentCount]] = await db.execute(
                "SELECT COUNT(*) AS total FROM enrollments WHERE student_id=?", [req.user.user_id]
            );
            const [[completedCount]] = await db.execute(
                "SELECT COUNT(*) AS total FROM lesson_progress WHERE student_id=? AND completed=1", [req.user.user_id]
            );
            const [[availableCount]] = await db.execute("SELECT COUNT(*) AS total FROM courses");
            res.json({ role: "student", enrollments: enrollmentCount.total, completed: completedCount.total, available: availableCount.total });
        }
    } catch (error) { handleError(res, error); }
});

// ---------------- COURSES ----------------
app.get("/api/courses", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT c.*, u.name AS instructor_name,
             (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.course_id) AS lesson_count
             FROM courses c JOIN users u ON u.user_id=c.instructor_id
             ORDER BY c.course_id DESC`
        );
        res.json(rows);
    } catch (error) { handleError(res, error); }
});

app.get("/api/courses/:id", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT c.*,u.name AS instructor_name FROM courses c
             JOIN users u ON u.user_id=c.instructor_id WHERE c.course_id=?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ message: "Course not found." });
        const [lessons] = await db.execute(
            "SELECT lesson_id,title,content,video_url,lesson_order FROM lessons WHERE course_id=? ORDER BY lesson_order",
            [req.params.id]
        );
        res.json({ ...rows[0], lessons });
    } catch (error) { handleError(res, error); }
});

app.post("/api/courses", authRequired, instructorOnly, async (req, res) => {
    try {
        const { title, category, description, level, image_url } = req.body;
        if (!title || !category || !description) return res.status(400).json({ message: "Title, category and description are required." });
        const [result] = await db.execute(
            "INSERT INTO courses (title,category,description,level,instructor_id,image_url) VALUES (?,?,?,?,?,?)",
            [title.trim(), category.trim(), description.trim(), level || "Beginner", req.user.user_id, image_url || ""]
        );
        res.status(201).json({ message: "Course created successfully.", course_id: result.insertId });
    } catch (error) { handleError(res, error); }
});

app.put("/api/courses/:id", authRequired, instructorOnly, async (req, res) => {
    try {
        const { title, category, description, level, image_url } = req.body;
        const [result] = await db.execute(
            `UPDATE courses SET title=?,category=?,description=?,level=?,image_url=?
             WHERE course_id=? AND instructor_id=?`,
            [title, category, description, level, image_url || "", req.params.id, req.user.user_id]
        );
        if (!result.affectedRows) return res.status(404).json({ message: "Course not found or not yours." });
        res.json({ message: "Course updated successfully." });
    } catch (error) { handleError(res, error); }
});

app.delete("/api/courses/:id", authRequired, instructorOnly, async (req, res) => {
    try {
        const [result] = await db.execute(
            "DELETE FROM courses WHERE course_id=? AND instructor_id=?",
            [req.params.id, req.user.user_id]
        );
        if (!result.affectedRows) return res.status(404).json({ message: "Course not found or not yours." });
        res.json({ message: "Course deleted successfully." });
    } catch (error) { handleError(res, error); }
});

// ---------------- LESSONS ----------------
app.get("/api/courses/:id/lessons", async (req, res) => {
    try {
        const [rows] = await db.execute(
            "SELECT lesson_id,title,content,video_url,lesson_order FROM lessons WHERE course_id=? ORDER BY lesson_order",
            [req.params.id]
        );
        res.json(rows);
    } catch (error) { handleError(res, error); }
});

app.post("/api/courses/:id/lessons", authRequired, instructorOnly, async (req, res) => {
    try {
        const { title, content, video_url, lesson_order } = req.body;
        const [owned] = await db.execute(
            "SELECT course_id FROM courses WHERE course_id=? AND instructor_id=?",
            [req.params.id, req.user.user_id]
        );
        if (!owned.length) return res.status(404).json({ message: "Course not found or not yours." });
        if (!title || !content) return res.status(400).json({ message: "Lesson title and content are required." });
        const [result] = await db.execute(
            "INSERT INTO lessons (course_id,title,content,video_url,lesson_order) VALUES (?,?,?,?,?)",
            [req.params.id, title.trim(), content.trim(), video_url || "", Number(lesson_order) || 1]
        );
        res.status(201).json({ message: "Lesson added successfully.", lesson_id: result.insertId });
    } catch (error) { handleError(res, error); }
});

app.delete("/api/lessons/:id", authRequired, instructorOnly, async (req, res) => {
    try {
        const [result] = await db.execute(
            `DELETE l FROM lessons l JOIN courses c ON c.course_id=l.course_id
             WHERE l.lesson_id=? AND c.instructor_id=?`,
            [req.params.id, req.user.user_id]
        );
        if (!result.affectedRows) return res.status(404).json({ message: "Lesson not found or not yours." });
        res.json({ message: "Lesson deleted successfully." });
    } catch (error) { handleError(res, error); }
});

// ---------------- ENROLLMENTS & PROGRESS ----------------
app.post("/api/enrollments", authRequired, async (req, res) => {
    try {
        if (req.user.role !== "student") return res.status(403).json({ message: "Only students can enroll." });
        const { course_id } = req.body;
        if (!course_id) return res.status(400).json({ message: "Select a course." });
        const [result] = await db.execute(
            "INSERT INTO enrollments (student_id,course_id) VALUES (?,?)",
            [req.user.user_id, Number(course_id)]
        );
        res.status(201).json({ message: "Enrolled successfully.", enrollment_id: result.insertId });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "You are already enrolled in this course." });
        handleError(res, error);
    }
});

app.get("/api/my-learning", authRequired, async (req, res) => {
    try {
        if (req.user.role !== "student") return res.status(403).json({ message: "Student account required." });
        const [rows] = await db.execute(
            `SELECT c.course_id,c.title,c.category,c.level,c.image_url,u.name AS instructor_name,
             COUNT(DISTINCT l.lesson_id) AS total_lessons,
             COUNT(DISTINCT CASE WHEN p.completed=1 THEN l.lesson_id END) AS completed_lessons
             FROM enrollments e JOIN courses c ON c.course_id=e.course_id
             JOIN users u ON u.user_id=c.instructor_id
             LEFT JOIN lessons l ON l.course_id=c.course_id
             LEFT JOIN lesson_progress p ON p.lesson_id=l.lesson_id AND p.student_id=e.student_id
             WHERE e.student_id=? GROUP BY c.course_id ORDER BY e.enrolled_at DESC`,
            [req.user.user_id]
        );
        res.json(rows);
    } catch (error) { handleError(res, error); }
});

app.post("/api/progress", authRequired, async (req, res) => {
    try {
        if (req.user.role !== "student") return res.status(403).json({ message: "Student account required." });
        const { lesson_id, completed } = req.body;
        const [allowed] = await db.execute(
            `SELECT l.lesson_id FROM lessons l JOIN enrollments e ON e.course_id=l.course_id
             WHERE l.lesson_id=? AND e.student_id=?`,
            [lesson_id, req.user.user_id]
        );
        if (!allowed.length) return res.status(403).json({ message: "Enroll in this course before updating progress." });
        await db.execute(
            `INSERT INTO lesson_progress (student_id,lesson_id,completed,completed_at)
             VALUES (?,?,?,IF(?,NOW(),NULL))
             ON DUPLICATE KEY UPDATE completed=VALUES(completed),completed_at=IF(VALUES(completed)=1,NOW(),NULL)`,
            [req.user.user_id, lesson_id, completed ? 1 : 0, completed ? 1 : 0]
        );
        res.json({ message: "Learning progress updated." });
    } catch (error) { handleError(res, error); }
});

app.get("/api/my-courses", authRequired, instructorOnly, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT c.*,(SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.course_id) AS lesson_count,
             (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.course_id) AS student_count
             FROM courses c WHERE c.instructor_id=? ORDER BY c.course_id DESC`,
            [req.user.user_id]
        );
        res.json(rows);
    } catch (error) { handleError(res, error); }
});

// Start after the database connection succeeds.
connectDatabase()
    .then(() => app.listen(PORT, () => console.log(`Swapna LMS running at http://localhost:${PORT}`)))
    .catch(error => {
        console.error("Database connection failed:", error.message);
        console.error("Check MySQL is running and .env credentials are correct. Run schema.sql in MySQL Workbench first.");
        process.exit(1);
    });
