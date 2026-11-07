const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function seedDatabase() {
    const db = await mysql.createConnection({
        host: "localhost",
        user: "root",
        password: "Swa@Pna143", // Enter your MySQL password if you have one
        database: "swapna_lms"
    });

    try {
        const users = [
            {
                name: "Arun Kumar",
                email: "arun@example.com",
                password: "Arun@123",
                role: "instructor"
            },
            {
                name: "Priya Sharma",
                email: "priya@example.com",
                password: "Priya@123",
                role: "instructor"
            },
            {
                name: "Rahul Reddy",
                email: "rahul@example.com",
                password: "Rahul@123",
                role: "student"
            },
            {
                name: "Sneha Patel",
                email: "sneha@example.com",
                password: "Sneha@123",
                role: "student"
            },
            {
                name: "Kiran Kumar",
                email: "kiran@example.com",
                password: "Kiran@123",
                role: "student"
            }
        ];

        // Insert users without duplicating existing email addresses
        for (const user of users) {
            const [existing] = await db.execute(
                "SELECT id FROM users WHERE email = ?",
                [user.email]
            );

            if (existing.length === 0) {
                const hashedPassword = await bcrypt.hash(user.password, 10);

                await db.execute(
                    `INSERT INTO users (name, email, password, role)
                     VALUES (?, ?, ?, ?)`,
                    [
                        user.name,
                        user.email,
                        hashedPassword,
                        user.role
                    ]
                );

                console.log("Added:", user.email);
            } else {
                console.log("Already exists:", user.email);
            }
        }

        // Find instructor IDs
        const [arun] = await db.execute(
            "SELECT id FROM users WHERE email = ?",
            ["arun@example.com"]
        );

        const [priya] = await db.execute(
            "SELECT id FROM users WHERE email = ?",
            ["priya@example.com"]
        );

        // Add sample courses if they do not already exist
        const courses = [
            {
                title: "Full Stack Web Development",
                description: "Learn HTML, CSS, JavaScript, Node.js and MySQL.",
                instructor_id: arun[0].id,
                category: "Web Development",
                level: "Beginner"
            },
            {
                title: "Python Programming",
                description: "Learn Python fundamentals and programming concepts.",
                instructor_id: priya[0].id,
                category: "Programming",
                level: "Beginner"
            },
            {
                title: "Java Programming",
                description: "Learn Java programming and object-oriented concepts.",
                instructor_id: arun[0].id,
                category: "Programming",
                level: "Intermediate"
            }
        ];

        for (const course of courses) {
            const [existing] = await db.execute(
                `SELECT id FROM courses
                 WHERE title = ? AND instructor_id = ?`,
                [course.title, course.instructor_id]
            );

            if (existing.length === 0) {
                await db.execute(
                    `INSERT INTO courses
                     (title, description, instructor_id, category, level)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        course.title,
                        course.description,
                        course.instructor_id,
                        course.category,
                        course.level
                    ]
                );

                console.log("Added course:", course.title);
            }
        }

        console.log("\nSample users and courses added successfully!");

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await db.end();
    }
}

seedDatabase();