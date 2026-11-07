// Frontend JavaScript: communicates with the Express API using fetch().
const API = "/api";
let courses = [];
let myCourses = [];
let token = localStorage.getItem("swapna_lms_token") || "";
let currentUser = JSON.parse(localStorage.getItem("swapna_lms_user") || "null");
let authMode = "register";

const $ = id => document.getElementById(id);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[ch]));

async function request(url, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2600);
}
function showMessage(id, message, error = false) {
  $(id).textContent = message;
  $(id).style.color = error ? "#c94c4c" : "#16875d";
}
function updateUserUI() {
  $("sideName").textContent = currentUser ? currentUser.name : "Guest learner";
  $("sideRole").textContent = currentUser ? currentUser.role : "Sign in to get started";
  $("sideAvatar").textContent = currentUser ? currentUser.name.charAt(0).toUpperCase() : "S";
  $("authButton").textContent = currentUser ? currentUser.name : "Login / Register";
  $("logoutButton").hidden = !currentUser;
}
function goTo(page) {
  document.querySelectorAll(".page").forEach(section => section.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.page === page));
  $(page + "Page").classList.add("active");
  $("pageTitle").textContent = ({dashboard:"Dashboard overview",courses:"Explore courses",learning:"My learning",instructor:"Instructor studio"})[page];
  if (page === "courses") loadCourses();
  if (page === "learning") loadLearning();
  if (page === "instructor") loadMyCourses();
}
document.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => goTo(button.dataset.page)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => goTo(button.dataset.go)));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).hidden = true));

async function loadCourses() {
  try {
    courses = await request(`${API}/courses`);
    renderCourses();
  } catch (error) { $("courseGrid").innerHTML = `<div class="empty-card">${escapeHTML(error.message)}</div>`; }
}
function renderCourses() {
  const q = ($("courseSearch").value || "").toLowerCase();
  const rows = courses.filter(c => [c.title,c.category,c.instructor_name,c.level].join(" ").toLowerCase().includes(q));
  $("courseGrid").innerHTML = rows.length ? rows.map(c => `
    <article class="course-card">
      <div class="course-image" style="background-image:url('${escapeHTML(c.image_url || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80")}')"><span>${escapeHTML(c.level)}</span></div>
      <div class="course-body"><small>${escapeHTML(c.category)}</small><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description)}</p>
      <div class="course-meta"><span>By ${escapeHTML(c.instructor_name)}</span><span>${c.lesson_count} lessons</span></div>
      <button class="primary-button full" onclick="viewCourse(${c.course_id})">View course</button></div>
    </article>`).join("") : '<div class="empty-card">No courses found. Try another search.</div>';
}
window.viewCourse = async id => {
  try {
    const c = await request(`${API}/courses/${id}`);
    $("courseDetail").innerHTML = `<span class="hero-tag">${escapeHTML(c.category)} · ${escapeHTML(c.level)}</span>
      <h2>${escapeHTML(c.title)}</h2><p>${escapeHTML(c.description)}</p><p class="muted">Instructor: ${escapeHTML(c.instructor_name)}</p>
      <h3>Course lessons</h3><div class="lesson-list">${c.lessons.length ? c.lessons.map(l => `<article><strong>${l.lesson_order}. ${escapeHTML(l.title)}</strong><p>${escapeHTML(l.content)}</p>${l.video_url ? `<a href="${escapeHTML(l.video_url)}" target="_blank" rel="noopener">Open lesson video ↗</a>` : ""}</article>`).join("") : "<p>No lessons added yet.</p>"}</div>
      ${currentUser && currentUser.role === "student" ? `<button class="primary-button full" onclick="enrollCourse(${c.course_id})">Enroll in this course</button>` : !currentUser ? `<p class="muted">Log in as a student to enroll.</p>` : ""}`;
    $("courseModal").hidden = false;
  } catch (error) { toast(error.message); }
};
window.enrollCourse = async id => {
  try {
    const result = await request(`${API}/enrollments`, {method:"POST",body:JSON.stringify({course_id:id})});
    toast(result.message); $("courseModal").hidden = true; loadLearning(); loadDashboard();
  } catch (error) { toast(error.message); }
};

async function loadDashboard() {
  const available = await request(`${API}/courses`);
  $("availableCount").textContent = available.length;
  $("enrollmentCount").textContent = "—";
  $("completedCount").textContent = "—";
  $("instructorCount").textContent = "—";
  if (!currentUser) return;
  try {
    const stats = await request(`${API}/dashboard`);
    if (stats.role === "student") {
      $("enrollmentCount").textContent = stats.enrollments;
      $("completedCount").textContent = stats.completed;
    } else {
      $("instructorCount").textContent = stats.courses;
      $("completedCount").textContent = stats.lessons;
      $("enrollmentCount").textContent = stats.students;
    }
  } catch (error) { toast(error.message); }
}
async function loadLearning() {
  if (!currentUser) { $("learningGrid").innerHTML = '<div class="empty-card">Please login as a student to view your enrolled courses.</div>'; return; }
  if (currentUser.role !== "student") { $("learningGrid").innerHTML = '<div class="empty-card">My learning is available for student accounts. Use Instructor studio to manage your courses.</div>'; return; }
  try {
    const rows = await request(`${API}/my-learning`);
    $("learningGrid").innerHTML = rows.length ? rows.map(c => {
      const percent = c.total_lessons ? Math.round(c.completed_lessons / c.total_lessons * 100) : 0;
      return `<article class="content-card learning-card"><small>${escapeHTML(c.category)}</small><h3>${escapeHTML(c.title)}</h3><p>Instructor: ${escapeHTML(c.instructor_name)}</p><div class="progress-track"><span style="width:${percent}%"></span></div><p>${c.completed_lessons}/${c.total_lessons} lessons completed · ${percent}%</p><button class="outline-button" onclick="openLearningCourse(${c.course_id})">Continue learning</button></article>`;
    }).join("") : '<div class="empty-card">You have not enrolled in any courses yet. Explore the catalogue.</div>';
  } catch (error) { $("learningGrid").innerHTML = `<div class="empty-card">${escapeHTML(error.message)}</div>`; }
}
window.openLearningCourse = async id => {
  try {
    const [course, progress] = await Promise.all([request(`${API}/courses/${id}`), request(`${API}/my-learning`)]);
    const item = progress.find(x => x.course_id === id);
    const completedIds = await request(`/api/courses/${id}/lessons`);
    const done = new Set(item ? [] : []);
    $("courseDetail").innerHTML = `<span class="hero-tag">MY LEARNING</span><h2>${escapeHTML(course.title)}</h2><p>${escapeHTML(course.description)}</p>
      <div class="lesson-list">${course.lessons.map(l => `<article><strong>${l.lesson_order}. ${escapeHTML(l.title)}</strong><p>${escapeHTML(l.content)}</p>${l.video_url ? `<a href="${escapeHTML(l.video_url)}" target="_blank" rel="noopener">Open lesson video ↗</a>` : ""}<button class="outline-button" onclick="markLesson(${l.lesson_id},true)">Mark completed ✓</button></article>`).join("") || "<p>No lessons published yet.</p>"}</div>`;
    $("courseModal").hidden = false;
  } catch (error) { toast(error.message); }
};
window.markLesson = async id => {
  try { const result = await request("/api/progress", {method:"POST",body:JSON.stringify({lesson_id:id,completed:true})}); toast(result.message); loadLearning(); loadDashboard(); }
  catch (error) { toast(error.message); }
};

async function loadMyCourses() {
  if (!currentUser || currentUser.role !== "instructor") {
    $("myCoursesTable").innerHTML = '<tr><td colspan="5" class="empty">Log in with an instructor account to manage courses.</td></tr>';
    $("myCourseCount").textContent = "0 courses"; return;
  }
  try {
    myCourses = await request(`${API}/my-courses`);
    $("myCourseCount").textContent = `${myCourses.length} course(s)`;
    $("myCoursesTable").innerHTML = myCourses.length ? myCourses.map(c => `<tr><td><strong>${escapeHTML(c.title)}</strong><br><small>${escapeHTML(c.category)}</small></td><td>${escapeHTML(c.level)}</td><td>${c.lesson_count}</td><td>${c.student_count}</td><td><button class="action-btn" onclick="showLessonForm(${c.course_id})">＋ Lesson</button><button class="action-btn delete" onclick="deleteCourse(${c.course_id})">Delete</button></td></tr>`).join("") : '<tr><td colspan="5" class="empty">Create your first course.</td></tr>';
  } catch (error) { toast(error.message); }
}
window.showLessonForm = id => {
  $("lessonForm").reset(); $("lessonForm").elements.course_id.value = id;
  $("lessonFormCard").hidden = false; showMessage("lessonMessage", "");
  $("lessonFormCard").scrollIntoView({behavior:"smooth"});
};
window.deleteCourse = async id => {
  if (!confirm("Delete this course and its lessons/enrollments?")) return;
  try { const result = await request(`${API}/courses/${id}`, {method:"DELETE"}); toast(result.message); loadMyCourses(); loadCourses(); loadDashboard(); }
  catch (error) { toast(error.message); }
};

function openAuth(mode) {
  authMode = mode; $("authTitle").textContent = mode === "register" ? "Create your account" : "Welcome back";
  $("nameField").hidden = mode === "login"; $("roleField").hidden = mode === "login";
  $("authForm").elements.name.required = mode === "register";
  $("authSubmit").textContent = mode === "register" ? "Create account" : "Login";
  $("registerTab").classList.toggle("active", mode === "register");
  $("loginTab").classList.toggle("active", mode === "login");
  showMessage("authMessage", ""); $("authModal").hidden = false;
}
$("authButton").addEventListener("click", () => currentUser ? toast(`Signed in as ${currentUser.name}`) : openAuth("register"));
$("logoutButton").addEventListener("click", () => {
  token = ""; currentUser = null; localStorage.removeItem("swapna_lms_token"); localStorage.removeItem("swapna_lms_user");
  updateUserUI(); loadDashboard(); loadLearning(); loadMyCourses(); toast("Logged out successfully.");
});
$("registerTab").addEventListener("click", () => openAuth("register"));
$("loginTab").addEventListener("click", () => openAuth("login"));
$("closeAuth").addEventListener("click", () => $("authModal").hidden = true);
$("closeCourse").addEventListener("click", () => $("courseModal").hidden = true);
$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = Object.fromEntries(new FormData(e.currentTarget).entries());
  try {
    const result = await request(`${API}/${authMode}`, {method:"POST",body:JSON.stringify(form)});
    token = result.token; currentUser = result.user;
    localStorage.setItem("swapna_lms_token", token); localStorage.setItem("swapna_lms_user", JSON.stringify(currentUser));
    updateUserUI(); $("authModal").hidden = true; toast(result.message);
    loadDashboard(); loadLearning(); loadMyCourses();
  } catch (error) { showMessage("authMessage", error.message, true); }
});
$("addCourseBtn").addEventListener("click", () => {
  if (!currentUser || currentUser.role !== "instructor") { toast("Please log in with an instructor account."); return; }
  $("courseForm").reset(); $("courseFormCard").hidden = false; showMessage("courseMessage", "");
});
$("courseForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const result = await request("/api/courses", {method:"POST",body:JSON.stringify(data)});
    $("courseFormCard").hidden = true; toast(result.message); loadMyCourses(); loadCourses(); loadDashboard();
  } catch (error) { showMessage("courseMessage", error.message, true); }
});
$("lessonForm").addEventListener("submit", async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  const id = data.course_id; delete data.course_id;
  try {
    const result = await request(`/api/courses/${id}/lessons`, {method:"POST",body:JSON.stringify(data)});
    $("lessonFormCard").hidden = true; toast(result.message); loadMyCourses(); loadCourses();
  } catch (error) { showMessage("lessonMessage", error.message, true); }
});
$("courseSearch").addEventListener("input", renderCourses);
$("refreshButton").addEventListener("click", () => { loadDashboard(); loadCourses(); });
$("reloadLearning").addEventListener("click", loadLearning);
$("courseModal").addEventListener("click", e => { if (e.target === $("courseModal")) $("courseModal").hidden = true; });
$("authModal").addEventListener("click", e => { if (e.target === $("authModal")) $("authModal").hidden = true; });

updateUserUI();
loadCourses();
loadDashboard().catch(error => toast(error.message));
