# Swapna's Online Courses Learning Management System

**Mini project:** FSD Lab  
**Stack:** HTML, CSS, JavaScript, Node.js, Express.js and MySQL

## Features

- Student and instructor registration/login.
- Passwords are hashed using bcryptjs.
- Browse and search the course catalogue.
- Instructor can create courses and add lessons.
- Students can enroll in courses.
- Students can mark lessons completed and track progress.
- Dashboard counts are loaded dynamically from MySQL.
- Express API uses parameterized SQL queries.

## 1. Create the database

1. Open MySQL Workbench.
2. Open `schema.sql` from this project.
3. Execute the complete script.
4. The database `swapna_lms` and five tables will be created:
   - `users`
   - `courses`
   - `lessons`
   - `enrollments`
   - `lesson_progress`

## 2. Configure the project

Open the project folder in VS Code terminal:

```bash
npm install
```

Create a copy of `.env.example` named `.env`. Enter your actual MySQL password:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=swapna_lms
PORT=3000
JWT_SECRET=use_a_long_random_secret_here
```

Do not upload `.env` to GitHub.

## 3. Run the application

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## 4. Project structure

```text
Swapna_Online_Courses_LMS/
│
├── app.js
├── package.json
├── schema.sql
├── .env.example
├── .gitignore
├── README.md
│
└── public/
    ├── index.html
    ├── style.css
    └── script.js
```

## 5. How it works

1. HTML forms collect user/course/lesson details.
2. Frontend JavaScript sends requests using `fetch()`.
3. Express receives the request through API routes.
4. MySQL stores or retrieves the data.
5. Frontend updates the dashboard and course cards.

## 6. Main API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/register` | Register student/instructor |
| POST | `/api/login` | Login |
| GET | `/api/courses` | View courses |
| GET | `/api/courses/:id` | View course and lessons |
| POST | `/api/courses` | Create instructor course |
| PUT | `/api/courses/:id` | Update own course |
| DELETE | `/api/courses/:id` | Delete own course |
| POST | `/api/courses/:id/lessons` | Add lesson |
| POST | `/api/enrollments` | Enroll student |
| GET | `/api/my-learning` | View enrolled courses/progress |
| POST | `/api/progress` | Mark lesson completed |
| GET | `/api/my-courses` | Instructor's courses |

## Important

- Start MySQL Server before running the application.
- Run `schema.sql` before starting Node.js.
- Use the same MySQL password that works in MySQL Workbench.
- Use an instructor account to create courses and lessons.
- Use a student account to enroll and track learning.
- Images and Google Fonts use external URLs and need internet access.
