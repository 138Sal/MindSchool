// === КОНСТАНТЫ ===
const BRAND_NAME = "SchoolMind 138";

// === БАЗА ДАННЫХ (localStorage) ===
const DB = {
    init() {
        const users = JSON.parse(localStorage.getItem("sm_users") || "[]");
        if (users.length) return;
        
        //Данные для входа в админ панель
        users.push({
            id: 1,
            name: "Администратор",
            login: "admin138",
            password: "admin123",
            role: "admin",
            created_at: new Date().toISOString()
        });
        localStorage.setItem("sm_users", JSON.stringify(users));
    },

    getUsers() { return JSON.parse(localStorage.getItem("sm_users") || "[]"); },
    setUsers(users) { localStorage.setItem("sm_users", JSON.stringify(users)); },
    getTests() { return JSON.parse(localStorage.getItem("sm_tests") || "[]"); },
    setTests(tests) { localStorage.setItem("sm_tests", JSON.stringify(tests)); },

    findUser(login) { return DB.getUsers().find((user) => user.login === login); },

    login(login, password) {
        const user = DB.findUser(login);
        if (!user || user.password !== password) throw new Error("Неверный логин или пароль");
        return user;
    },

    //Процесс создания логина для пользователя 138+класс+первые две буквы фамилии+случайные числа
    createStudent(name, surname, className) {
        const users = DB.getUsers();
        const classPart = className.replace("А", "A").replace("Б", "B");
        const surnamePart = surname.substring(0, 2).toUpperCase();
        let login = `138${classPart}${surnamePart}${Math.floor(1000 + Math.random() * 9000)}`;

        // Проверка уникальности
        while (users.some((u) => u.login === login)) {
            login = `138${classPart}${surnamePart}${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const password = String(Math.floor(1000 + Math.random() * 9000));
        const user = {
            id: Date.now(),
            name: `${name} ${surname}`,
            login, password,
            role: "student",
            class: className,
            created_at: new Date().toISOString()
        };

        users.push(user);
        DB.setUsers(users);
        return { login, password };
    },

    saveTest(userId, score, level) {
        const tests = DB.getTests();
        const test = { id: Date.now(), user_id: userId, score, level, created_at: new Date().toISOString() };
        tests.push(test);
        DB.setTests(tests);
        return test;
    },

    getUserTests(userId) { return DB.getTests().filter((t) => t.user_id === userId); },

    getAllTests() {
        const users = DB.getUsers();
        return DB.getTests().map((test) => {
            const user = users.find((u) => u.id === test.user_id);
            return { ...test, name: user?.name || "Неизвестный", class: user?.class || "-", login: user?.login || "-" };
        });
    },

    // Статистика: total, average, min, max + распределение по уровням + по классам
    getStats(classFilter = "") {
        let tests = DB.getAllTests();
        if (classFilter) tests = tests.filter((t) => t.class === classFilter);

        if (!tests.length) {
            return {
                summary: { total: 0, average: 0, min: 0, max: 0 },
                distribution: [{ level: "low", count: 0 }, { level: "medium", count: 0 }, { level: "high", count: 0 }],
                byClass: []
            };
        }

        const scores = tests.map((t) => t.score);
        const perClass = new Map();

        // Группировка по классам
        tests.forEach((test) => {
            if (!test.class) return;
            if (!perClass.has(test.class)) perClass.set(test.class, { count: 0, total: 0 });
            const cur = perClass.get(test.class);
            cur.count++;
            cur.total += test.score;
        });

        return {
            summary: {
                total: tests.length,
                average: scores.reduce((s, v) => s + v, 0) / tests.length,
                min: Math.min(...scores),
                max: Math.max(...scores)
            },
            distribution: [
                { level: "low", count: tests.filter((t) => t.level === "low").length },
                { level: "medium", count: tests.filter((t) => t.level === "medium").length },
                { level: "high", count: tests.filter((t) => t.level === "high").length }
            ],
            byClass: Array.from(perClass.entries())
                .map(([cls, data]) => ({ class: cls, count: data.count, average_score: data.total / data.count }))
                .sort((a, b) => a.class.localeCompare(b.class, "ru"))
        };
    },

    getClasses() {
        return Array.from(new Set(DB.getUsers().filter((u) => u.class).map((u) => u.class)))
            .sort((a, b) => a.localeCompare(b, "ru"));
    }
};

DB.init();

// === УТИЛИТЫ ===
// Уровни тревожности
const getLevelMeta = {
    low: { label: "Низкий", title: "Низкий уровень тревожности", description: "Выраженных признаков тревожности не видно.", recommendation: "Сохраняйте привычный режим.", tone: "Спокойный фон" },
    medium: { label: "Средний", title: "Средний уровень тревожности", description: "Есть напряжение за которым стоит понаблюдать.", recommendation: "Снизьте нагрузку и повторите тест позже.", tone: "Нужен контроль" },
    high: { label: "Высокий", title: "Высокий уровень тревожности", description: "Тревожность может мешать учебе.", recommendation: "Стоит обсудить результат с школьным специалистом.", tone: "Обратитесь к психологу" }
};

// Определить уровень: >50 = high, >25 = medium, иначе low
const getLevelByScore = (score) => score > 50 ? "high" : score > 25 ? "medium" : "low";

// Экранирование HTML
const escapeAppHtml = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// Дата и время
const formatRuDate = (v) => new Date(v).toLocaleDateString("ru-RU");
const formatRuTime = (v) => new Date(v).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const formatRuDateTime = (v) => `${formatRuDate(v)} · ${formatRuTime(v)}`;

// Склонение: 1 запись, 2 записи, 5 записей
const pluralizeRu = (c, one, few, many) => {
    const mod10 = c % 10, mod100 = c % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
};

// Пути
const getBasePath = () => window.location.pathname.includes("/student/") || window.location.pathname.includes("/psychologist/") ? "../" : "";
const resolvePath = (p) => `${getBasePath()}${p}`;
const redirectTo = (p) => window.location.href = resolvePath(p);

// === АВТОРИЗАЦИЯ ===
const getToken = () => localStorage.getItem("sm_token");
const getUser = () => { const raw = localStorage.getItem("sm_user"); return raw ? JSON.parse(raw) : null; };
const saveAuth = (user) => { localStorage.setItem("sm_token", String(user.id)); localStorage.setItem("sm_user", JSON.stringify(user)); };
const clearAuth = () => { localStorage.removeItem("sm_token"); localStorage.removeItem("sm_user"); };
const logout = () => { clearAuth(); redirectTo("index.html"); };

// Проверка доступа
const checkAuth = () => {
    const token = getToken(), user = getUser(), path = window.location.pathname;
    if (!token || !user) { redirectTo("index.html"); return false; }

    if (user.role === "admin") {
        if (path.includes("dashboard.html")) {
            const title = document.getElementById("page-title");
            const panel = document.getElementById("psychologist-panel");
            const userName = document.getElementById("user-name");
            if (userName) userName.textContent = user.name;
            if (title) title.textContent = "Администратор школы";
            if (panel) panel.style.display = "grid";
        }
        return true;
    }

    // Защита страниц по ролям
    if (path.includes("admin.html") && user.role !== "admin") { redirectTo("dashboard.html"); return false; }
    if (path.includes("/student/") && user.role !== "student") { redirectTo("dashboard.html"); return false; }
    if (path.includes("/psychologist/") && user.role !== "psychologist") { redirectTo("dashboard.html"); return false; }

    if (path.includes("dashboard.html")) {
        const userName = document.getElementById("user-name");
        const pageTitle = document.getElementById("page-title");
        const studentPanel = document.getElementById("student-panel");
        const psychologistPanel = document.getElementById("psychologist-panel");

        if (userName) userName.textContent = user.name;
        if (user.role === "student") {
            if (pageTitle) pageTitle.textContent = "Кабинет ученика";
            if (studentPanel) studentPanel.style.display = "grid";
        } else if (user.role === "psychologist") {
            if (pageTitle) pageTitle.textContent = "Аналитический кабинет";
            if (psychologistPanel) psychologistPanel.style.display = "grid";
        }
    }
    return true;
};

// === TOAST ===
const ensureToastStack = () => {
    let stack = document.querySelector(".app-toast-stack");
    if (stack) return stack;
    stack = document.createElement("div");
    stack.className = "app-toast-stack";
    document.body.appendChild(stack);
    return stack;
};

const showToast = (message, tone = "neutral") => {
    const stack = ensureToastStack();
    const toast = document.createElement("div");
    toast.className = `app-toast app-toast--${tone}`;
    toast.textContent = message;
    stack.appendChild(toast);
    window.setTimeout(() => {
        toast.classList.add("is-leaving");
        window.setTimeout(() => toast.remove(), 220);
    }, 2200);
};

// === ФОРМЫ ===
// Вход по Enter
const handleLoginKeydown = (event) => {
    if (event.key !== "Enter" || event.target?.id !== "login-email") return;
    event.preventDefault();
    document.getElementById("login-password")?.focus();
};

// Обработка входа
const doLogin = (event) => {
    if (event) event.preventDefault();
    const login = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    if (errorEl) errorEl.textContent = "";

    if (!login || !password) { if (errorEl) errorEl.textContent = "Введите логин и пароль"; return; }

    try {
        const user = DB.login(login, password);
        saveAuth(user);
        if (user.role === "admin") window.location.href = "admin.html";
        else if (user.role === "psychologist") window.location.href = "psychologist/stats.html";
        else window.location.href = "dashboard.html";
    } catch (error) { if (errorEl) errorEl.textContent = error.message; }
};

// Feedback после создания
const renderCreateFeedback = (state, title, text, details = "") => {
    const feedback = document.getElementById("create-feedback");
    if (!feedback) return false;
    feedback.hidden = false;
    feedback.className = `inline-feedback ${state}`;
    feedback.innerHTML = `<div class="inline-feedback-copy"><span class="inline-feedback-title">${title}</span><span class="inline-feedback-text">${text}</span></div>${details}`;
    return true;
};

// Создание ученика в локальной бдшке
const createStudent = (event) => {
    if (event) event.preventDefault();
    const name = document.getElementById("student-name").value.trim();
    const surname = document.getElementById("student-surname").value.trim();
    const className = document.getElementById("student-class").value;

    if (!name || !surname || !className) {
        renderCreateFeedback("error", "Заполните форму", "Укажите имя, фамилию и класс ученика.");
        return;
    }

    const result = DB.createStudent(name, surname, className);
    renderCreateFeedback("success", "Доступ создан", "Логин и пароль готовы.", `
        <div class="inline-feedback-creds">
            <span class="account-cred">Логин: <strong>${result.login}</strong></span>
            <span class="account-cred">Пароль: <strong>${result.password}</strong></span>
        </div>
    `);

    document.getElementById("student-name").value = "";
    document.getElementById("student-surname").value = "";
    document.getElementById("student-class").value = "";
    loadAccounts();
};

// === СПИСКИ УЧЕНИКОВ ===
const accountsUiState = { expanded: false };
const toggleAccountsExpanded = () => { accountsUiState.expanded = !accountsUiState.expanded; loadAccounts(); };

// Загрузить список учеников
const loadAccounts = () => {
    const students = DB.getUsers().filter((u) => u.role === "student");
    const container = document.getElementById("accounts-list");
    const searchInput = document.getElementById("accounts-search");
    const toggleButton = document.getElementById("accounts-toggle");
    const totalEl = document.getElementById("accounts-total");
    const classesEl = document.getElementById("accounts-classes");
    const visibleEl = document.getElementById("accounts-visible");
    const lastCreatedEl = document.getElementById("accounts-last-created");
    const statusEl = document.getElementById("accounts-status");

    if (!container) return;
    const query = (searchInput?.value || "").trim().toLowerCase();

    if (!students.length) {
        if (totalEl) totalEl.textContent = "0";
        if (classesEl) classesEl.textContent = "0";
        if (visibleEl) visibleEl.textContent = "0";
        if (lastCreatedEl) lastCreatedEl.textContent = "—";
        if (statusEl) statusEl.textContent = "Пока нет выданных доступов.";
        if (toggleButton) toggleButton.style.display = "none";
        container.innerHTML = `<div class="empty-state">Список появится после создания первого аккаунта.</div>`;
        return;
    }

    // Поиск
    const sorted = [...students].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const filtered = query ? sorted.filter((u) => [u.name, u.class, u.login].filter(Boolean).some((v) => v.toLowerCase().includes(query))) : sorted;

    if (!filtered.length) {
        if (toggleButton) toggleButton.style.display = "none";
        if (statusEl) statusEl.textContent = "Совпадений нет.";
        container.innerHTML = `<div class="empty-state">Ничего не найдено.</div>`;
        return;
    }

    const visible = query || accountsUiState.expanded ? filtered : filtered.slice(0, 3);
    const classCount = new Set(students.map((u) => u.class).filter(Boolean)).size;

    if (totalEl) totalEl.textContent = String(students.length);
    if (classesEl) classesEl.textContent = String(classCount);
    if (visibleEl) visibleEl.textContent = String(visible.length);
    if (lastCreatedEl) lastCreatedEl.textContent = sorted[0]?.created_at ? formatRuDateTime(sorted[0].created_at) : "—";
    if (statusEl) statusEl.textContent = query
        ? `Найдено ${filtered.length} ${pluralizeRu(filtered.length, "запись", "записи", "записей")}.`
        : `Показаны последние ${visible.length} ${pluralizeRu(visible.length, "аккаунт", "аккаунта", "аккаунтов")}.`;

    if (toggleButton) {
        const shouldShow = !query && filtered.length > 3;
        toggleButton.style.display = shouldShow ? "inline-flex" : "none";
        toggleButton.innerHTML = accountsUiState.expanded ? `Свернуть <span aria-hidden="true">↑</span>` : `Последние 3 <span aria-hidden="true">↓</span>`;
    }

    container.innerHTML = visible.map((u) => `
        <div class="history-item account-item">
            <div class="account-meta">
                <span class="account-name">${escapeAppHtml(u.name)}</span>
                <span class="meta-text">Класс: ${escapeAppHtml(u.class)} · ${formatRuDateTime(u.created_at)}</span>
            </div>
            <span class="account-cred">Логин: <strong>${escapeAppHtml(u.login)}</strong></span>
            <span class="account-cred">Пароль: <strong>${escapeAppHtml(u.password)}</strong></span>
        </div>
    `).join("");
};

// === ИСТОРИЯ ===
const loadHistory = () => {
    const user = getUser();
    const container = document.getElementById("history-list");
    if (!user || !container) return;

    const tests = DB.getUserTests(user.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!tests.length) { container.innerHTML = `<div class="empty-state">Здесь появятся сохранённые результаты.</div>`; return; }

    container.innerHTML = tests.map((test) => {
        const meta = getLevelMeta[test.level];
        return `<div class="history-item"><div class="history-main"><span class="history-date">${formatRuDateTime(test.created_at)}</span><span class="history-score">${test.score} из 75</span></div><div class="badge-row"><span class="level-badge ${test.level}">${meta.label}</span></div></div>`;
    }).join("");
};

// === СТАТИСТИКА ===
const loadClasses = () => {
    const classes = DB.getClasses();
    document.querySelectorAll("#class-filter").forEach((select) => {
        select.querySelectorAll("option:not(:first-child)").forEach((o) => o.remove());
        classes.forEach((cls) => { const o = document.createElement("option"); o.value = cls; o.textContent = cls; select.appendChild(o); });
    });
};

// статистика
const loadStats = () => {
    const classFilter = document.getElementById("class-filter")?.value || "";
    const stats = DB.getStats(classFilter);
    const filteredTests = DB.getAllTests().filter((t) => !classFilter || t.class === classFilter);

    const totalEl = document.getElementById("total-tests");
    const avgEl = document.getElementById("avg-score");
    const dominantEl = document.getElementById("dominant-level");
    const classesCountEl = document.getElementById("stats-classes-count");
    const scopeEl = document.getElementById("stats-scope");
    const distributionStatusEl = document.getElementById("distribution-status");
    const classStatusEl = document.getElementById("class-status");
    const distributionEl = document.getElementById("distribution");
    const byClassEl = document.getElementById("by-class");

    const dominant = [...stats.distribution].sort((a, b) => b.count - a.count)[0];
    const dominantMeta = dominant?.count ? getLevelMeta[dominant.level] : null;
    const classesCount = new Set(filteredTests.map((t) => t.class).filter(Boolean)).size;

    if (totalEl) totalEl.textContent = String(stats.summary.total);
    if (avgEl) avgEl.textContent = stats.summary.total ? stats.summary.average.toFixed(1) : "—";
    if (dominantEl) dominantEl.textContent = dominantMeta ? dominantMeta.label : "—";
    if (classesCountEl) classesCountEl.textContent = String(classesCount);
    if (scopeEl) scopeEl.textContent = classFilter ? `Класс ${classFilter}` : "Вся школа";

    if (!stats.summary.total) {
        if (distributionStatusEl) distributionStatusEl.textContent = "Нет данных.";
        if (classStatusEl) classStatusEl.textContent = "Статистика появится после первых результатов.";
        if (distributionEl) distributionEl.innerHTML = `<div class="empty-state">Нет данных.</div>`;
        if (byClassEl) byClassEl.innerHTML = `<div class="empty-state">Нет данных.</div>`;
        return;
    }

    if (distributionStatusEl) distributionStatusEl.textContent = `Мин: ${stats.summary.min} · Макс: ${stats.summary.max} · Средний: ${stats.summary.average.toFixed(1)}`;
    if (classStatusEl) classStatusEl.textContent = `${classesCount} ${pluralizeRu(classesCount, "класс", "класса", "классов")} в текущем срезе.`;

    if (distributionEl) {
        distributionEl.innerHTML = stats.distribution.map((item) => {
            const meta = getLevelMeta[item.level];
            const percent = stats.summary.total ? (item.count / stats.summary.total) * 100 : 0;
            return `<article class="distribution-card"><div class="distribution-card-top"><span class="level-badge ${item.level}">${meta.label}</span><strong>${item.count}</strong></div><div class="distribution-meter"><span class="distribution-meter-fill ${item.level}" style="width:${Math.max(percent, item.count ? 8 : 0)}%"></span></div><span class="meta-text">${percent.toFixed(1)}%</span></article>`;
        }).join("");
    }

    if (byClassEl) {
        if (!stats.byClass.length) { byClassEl.innerHTML = `<div class="empty-state">Нет данных по классам.</div>`; return; }
        byClassEl.innerHTML = stats.byClass.map((item) => `
            <article class="class-stat-card">
                <div class="class-stat-top"><strong>${escapeAppHtml(item.class)}</strong><span class="badge">${item.count} ${pluralizeRu(item.count, "тест", "теста", "тестов")}</span></div>
                <div class="class-stat-bar"><span class="class-stat-bar-fill ${getLevelByScore(item.average_score)}" style="width:${Math.max((item.average_score / 75) * 100, 8)}%"></span></div>
                <span class="meta-text">Средний балл: ${item.average_score.toFixed(1)} из 75</span>
            </article>
        `).join("");
    }
};

// === ТАБЛИЦА ТЕСТОВ ===
const loadAllTests = () => {
    const classFilter = document.getElementById("class-filter")?.value || "";
    const searchQuery = document.getElementById("tests-search")?.value.trim().toLowerCase() || "";
    const tbody = document.getElementById("tests-table");
    const totalEl = document.getElementById("tests-total");
    const averageEl = document.getElementById("tests-average");
    const classesEl = document.getElementById("tests-classes");
    const latestEl = document.getElementById("tests-latest");
    const scopeEl = document.getElementById("tests-scope");
    const statusEl = document.getElementById("tests-status");

    if (!tbody) return;
    let tests = DB.getAllTests();
    if (classFilter) tests = tests.filter((t) => t.class === classFilter);
    if (searchQuery) tests = tests.filter((t) => {
        const meta = getLevelMeta[t.level];
        return [t.name, t.class, t.login, meta.label].filter(Boolean).some((v) => v.toLowerCase().includes(searchQuery));
    });

    const sorted = [...tests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const average = sorted.length ? sorted.reduce((s, t) => s + t.score, 0) / sorted.length : 0;
    const classesCount = new Set(sorted.map((t) => t.class).filter(Boolean)).size;

    if (totalEl) totalEl.textContent = String(sorted.length);
    if (averageEl) averageEl.textContent = sorted.length ? average.toFixed(1) : "—";
    if (classesEl) classesEl.textContent = String(classesCount);
    if (latestEl) latestEl.textContent = sorted[0] ? formatRuDateTime(sorted[0].created_at) : "—";
    if (scopeEl) scopeEl.textContent = classFilter ? `Класс ${classFilter}` : "Вся школа";
    if (statusEl) statusEl.textContent = searchQuery ? `Найдено ${sorted.length} ${pluralizeRu(sorted.length, "совпадение", "совпадения", "совпадений")}.` : "Все записи.";

    if (!sorted.length) { tbody.innerHTML = `<tr><td colspan="5" class="meta-text">Нет данных.</td></tr>`; return; }

    tbody.innerHTML = sorted.map((test) => {
        const meta = getLevelMeta[test.level];
        return `<tr><td><div class="table-cell-stack"><strong>${formatRuDate(test.created_at)}</strong><span class="table-cell-meta">${formatRuTime(test.created_at)}</span></div></td><td><div class="table-cell-stack"><strong>${escapeAppHtml(test.name)}</strong><span class="table-cell-meta">${escapeAppHtml(test.login)}</span></div></td><td><strong>${escapeAppHtml(test.class)}</strong></td><td><div class="score-stack"><div class="score-row"><strong>${test.score}</strong><span class="table-cell-meta">/ 75</span></div><div class="score-track"><span class="score-track-fill ${test.level}" style="width:${Math.max((test.score / 75) * 100, 8)}%"></span></div></div></td><td><span class="level-badge ${test.level}">${meta.label}</span></td></tr>`;
    }).join("");
};

// === ЭКСПОРТ ===
const buildCsvRows = (tests, users) => {
    const header = "Дата;Фамилия Имя;Класс;Логин;Балл;Уровень\n";
    const rows = tests.map((test) => {
        const user = users.find((u) => u.id === test.user_id);
        return `${formatRuDate(test.created_at)};${user?.name || ""};${user?.class || ""};${user?.login || ""};${test.score};${getLevelMeta[test.level].label}`;
    });
    return header + rows.join("\n");
};

// Гугл таблицы (доработать)
const exportToGoogleSheets = () => {
    const tests = DB.getAllTests();
    const users = DB.getUsers();
    if (!tests.length) { showToast("Нет данных для экспорта", "warning"); return; }

    const csv = buildCsvRows(tests, users);
    const encoded = encodeURIComponent(csv);
    const url = `https://docs.google.com/spreadsheets/u/0/create?usp=sharing&title=${encodeURIComponent(BRAND_NAME)}&text=${encoded}`;
    window.open(url, "_blank");
    showToast("Открыта новая таблица Google", "success");
};

const downloadCSV = () => {
    const tests = DB.getAllTests();
    const users = DB.getUsers();
    if (!tests.length) { showToast("Нет данных для экспорта", "warning"); return; }

    const csv = buildCsvRows(tests, users);
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    // (недоделано)
    link.href = URL.createObjectURL(blob);
    link.download = "schoolmind138_chelyabinsk.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("CSV сохранён", "success");
};