import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "C:\\Users\\Данил\\Desktop\\CPO project";
const SKILL_DIR = "C:\\Users\\Данил\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.915.20218\\skills\\presentations";
const TMP_DIR = path.join(workspaceDir, ".build", "presentation", "preview");
const FINAL_PPTX = path.join(workspaceDir, "output", "Service_trip_system_practicals_1-4_final_v2.pptx");
const RUNTIME_PYTHON = "C:\\Users\\Данил\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

const utils = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href);
const { makeNativeBulletParagraphs, finalizePresentation } = utils;

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });

const W = 1280;
const H = 720;
const FONT = "Arial";
const NAVY = "#163A5F";
const BLUE = "#2F6B9A";
const LIGHT = "#EAF1F7";
const PALE = "#F7F9FB";
const TEXT = "#17212B";
const MUTED = "#5B6772";
const GOLD = "#D89B38";
const RED = "#A84242";
const GREEN = "#367A58";
const WHITE = "#FFFFFF";

const deck = Presentation.create({ slideSize: { width: W, height: H } });

function shape(slide, geometry, left, top, width, height, fill="none", lineFill="none", lineWidth=0) {
  return slide.shapes.add({
    geometry,
    position: { left, top, width, height },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
  });
}

function textBox(slide, text, left, top, width, height, opts={}) {
  const s = shape(slide, "textbox", left, top, width, height, opts.fill ?? "none", opts.lineFill ?? "none", opts.lineWidth ?? 0);
  s.text = text;
  s.text.style = {
    typeface: FONT,
    fontSize: opts.fontSize ?? 24,
    bold: opts.bold ?? false,
    color: opts.color ?? TEXT,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    autoFit: opts.autoFit ?? "shrinkText",
    insets: opts.insets ?? { top: 3, right: 3, bottom: 3, left: 3 },
  };
  return s;
}

function richText(slide, paragraphs, left, top, width, height, opts={}) {
  const s = shape(slide, "textbox", left, top, width, height);
  s.text.set(paragraphs);
  s.text.style = {
    typeface: FONT,
    fontSize: opts.fontSize ?? 24,
    color: opts.color ?? TEXT,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    autoFit: "shrinkText",
    insets: opts.insets ?? { top: 3, right: 3, bottom: 3, left: 3 },
  };
  return s;
}

function bullets(slide, items, left, top, width, height, opts={}) {
  const s = shape(slide, "textbox", left, top, width, height);
  s.text = makeNativeBulletParagraphs(items, {
    marginLeftPoints: opts.marginLeftPoints ?? 19,
    hangingPoints: opts.hangingPoints ?? 9,
    spaceAfterPoints: opts.spaceAfterPoints ?? 8,
  });
  s.text.style = {
    typeface: FONT,
    fontSize: opts.fontSize ?? 22,
    color: opts.color ?? TEXT,
    autoFit: "shrinkText",
    insets: { top: 4, right: 6, bottom: 4, left: 4 },
  };
  return s;
}

function title(slide, text, number) {
  textBox(slide, text, 64, 36, 1090, 58, { fontSize: 34, bold: true, color: NAVY, valign: "middle" });
  shape(slide, "line", 64, 100, 1152, 0, "none", "#C9D7E3", 1.2);
  textBox(slide, String(number).padStart(2, "0"), 1180, 40, 44, 36, { fontSize: 17, bold: true, color: BLUE, align: "right", valign: "middle" });
}

function label(slide, text, left, top, width, color=BLUE) {
  textBox(slide, text.toUpperCase(), left, top, width, 30, { fontSize: 15, bold: true, color, valign: "middle" });
}

function lineBetween(slide, a, b, options={}) {
  return slide.shapes.connect(a, b, {
    kind: options.kind ?? "straight",
    fromSide: options.fromSide,
    toSide: options.toSide,
    line: { style: options.style ?? "solid", fill: options.color ?? "#7E94A7", width: options.width ?? 2 },
    head: options.head ? { type: "triangle", width: "sm", length: "sm" } : undefined,
    tail: options.tail ? { type: "triangle", width: "sm", length: "sm" } : undefined,
  });
}

// 1 Cover
{
  const s = deck.slides.add();
  s.background.fill = NAVY;
  shape(s, "rect", 0, 0, 22, H, GOLD);
  textBox(s, "Система оформления\nслужебных поездок", 86, 142, 1030, 190, { fontSize: 52, bold: true, color: WHITE, valign: "middle" });
  textBox(s, "Практические работы 1-4", 92, 350, 690, 56, { fontSize: 27, color: "#DCE8F2", valign: "middle" });
  textBox(s, "PostgreSQL, Next.js, Express, React", 92, 430, 780, 44, { fontSize: 22, color: "#BFD1E1" });
  textBox(s, "ФИО и группа добавляются перед сдачей", 92, 603, 620, 34, { fontSize: 17, color: "#DCE8F2" });
  textBox(s, "2026", 1120, 603, 90, 34, { fontSize: 18, bold: true, color: GOLD, align: "right" });
}

// 2 Passport
{
  const s = deck.slides.add(); s.background.fill = WHITE; title(s, "Паспорт проекта", 2);
  label(s, "Проблема", 68, 136, 290, RED);
  textBox(s, "Заявки согласуются в письмах и таблицах. Пользователи не видят единый статус, документы теряются, а историю решений трудно проверить.", 68, 175, 500, 175, { fontSize: 25, bold: true, color: TEXT });
  shape(s, "line", 620, 150, 0, 450, "none", "#C9D7E3", 1.4);
  label(s, "Назначение", 674, 136, 300);
  bullets(s, [
    "единая форма заявки и предварительных расходов",
    "последовательное согласование руководителем и бухгалтером",
    "рабочий список координатора поездок",
    "история статусов с автором и временем",
  ], 674, 176, 500, 270, { fontSize: 23, spaceAfterPoints: 9 });
  label(s, "Результат первой версии", 674, 488, 390, GREEN);
  textBox(s, "Сотрудник отправляет заявку, согласующие принимают решение, а PostgreSQL сохраняет данные и ограничения процесса.", 674, 526, 500, 118, { fontSize: 23, bold: true, color: GREEN });
}

// 3 Users and team
{
  const s = deck.slides.add(); s.background.fill = WHITE; title(s, "Пользователи и команда", 3);
  label(s, "Пользователи", 66, 132, 260);
  const users = [
    ["Сотрудник", "создает и отслеживает заявку"],
    ["Руководитель", "проверяет служебную необходимость"],
    ["Бухгалтер", "проверяет бюджет"],
    ["Координатор", "организует утвержденную поездку"],
    ["Администратор", "управляет ролями и учетными записями"],
  ];
  users.forEach((u, i) => {
    textBox(s, u[0], 72, 180+i*82, 190, 36, { fontSize: 22, bold: true, color: NAVY });
    textBox(s, u[1], 274, 180+i*82, 300, 48, { fontSize: 19, color: MUTED });
  });
  shape(s, "line", 618, 150, 0, 475, "none", "#C9D7E3", 1.3);
  label(s, "Проектные роли", 670, 132, 320);
  const teamParas = [
    [{ run: "Владелец продукта", textStyle: { bold: true, color: NAVY } }, { run: "  требования и приемка" }],
    [{ run: "Backend разработчик", textStyle: { bold: true, color: NAVY } }, { run: "  Express API и бизнес-правила" }],
    [{ run: "Frontend разработчик", textStyle: { bold: true, color: NAVY } }, { run: "  React-интерфейс" }],
    [{ run: "Инженер данных", textStyle: { bold: true, color: NAVY } }, { run: "  PostgreSQL и миграции" }],
    [{ run: "Тестировщик и DevOps", textStyle: { bold: true, color: NAVY } }, { run: "  проверки и окружение" }],
  ];
  richText(s, teamParas, 670, 180, 500, 320, { fontSize: 22 });
  textBox(s, "Если участников меньше пяти, роли совмещаются. ФИО команда вносит перед сдачей.", 670, 530, 500, 82, { fontSize: 20, color: MUTED, bold: true });
}

// 4 MVP
{
  const s = deck.slides.add(); s.background.fill = PALE; title(s, "Границы первой версии", 4);
  textBox(s, "В MVP", 82, 142, 490, 48, { fontSize: 28, bold: true, color: GREEN });
  bullets(s, [
    "вход и роли пользователей",
    "черновик заявки с местом, датами и целью",
    "участники и статьи расходов",
    "отправка и два шага согласования",
    "списки заявок и история статусов",
    "базовые вложения до 10 МБ",
  ], 82, 202, 500, 390, { fontSize: 23, spaceAfterPoints: 9 });
  shape(s, "line", 632, 142, 0, 470, "none", "#B7C8D6", 1.4);
  textBox(s, "После MVP", 684, 142, 470, 48, { fontSize: 28, bold: true, color: BLUE });
  bullets(s, [
    "интеграция с кадровой системой",
    "автоматический расчет суточных и курсов валют",
    "гибкий конструктор маршрутов",
    "электронная подпись",
    "интеграции с билетами и гостиницами",
    "обмен с бухгалтерской системой",
  ], 684, 202, 500, 390, { fontSize: 23, spaceAfterPoints: 9 });
}

// 5 Requirements
{
  const s = deck.slides.add(); s.background.fill = WHITE; title(s, "Требования к первой версии", 5);
  textBox(s, "10", 72, 128, 140, 90, { fontSize: 66, bold: true, color: NAVY, align: "center", valign: "middle" });
  textBox(s, "требований P0", 72, 214, 200, 40, { fontSize: 19, bold: true, color: MUTED, align: "center" });
  textBox(s, "5", 296, 128, 140, 90, { fontSize: 66, bold: true, color: BLUE, align: "center", valign: "middle" });
  textBox(s, "требований P1", 266, 214, 200, 40, { fontSize: 19, bold: true, color: MUTED, align: "center" });
  shape(s, "line", 506, 134, 0, 480, "none", "#C9D7E3", 1.3);
  label(s, "Ключевые функциональные требования", 554, 132, 570);
  bullets(s, [
    "FR-02  создание и редактирование черновика",
    "FR-05  отправка только после серверной проверки",
    "FR-06  решение руководителя с комментарием",
    "FR-07  финансовое решение бухгалтера",
    "FR-12  журнал каждой смены статуса",
  ], 554, 174, 620, 260, { fontSize: 21, spaceAfterPoints: 8 });
  label(s, "Измеримые NFR", 554, 460, 350, GREEN);
  bullets(s, [
    "p95 ответа API не более 2 секунд при 50 пользователях",
    "100 процентов изменяющих запросов проходят серверную валидацию",
    "RPO 24 часа и RTO 4 часа для учебного стенда",
  ], 554, 500, 620, 138, { fontSize: 20, spaceAfterPoints: 6 });
}

// 6 Use case
{
  const s = deck.slides.add(); s.background.fill = WHITE; title(s, "Основные сценарии использования", 6);
  const boundary = shape(s, "roundRect", 290, 132, 700, 500, "#FAFCFE", BLUE, 1.6);
  textBox(s, "Система", 560, 142, 170, 34, { fontSize: 18, bold: true, color: NAVY, align: "center" });
  const cases = [
    ["Подать заявку", 390, 206], ["Принять решение", 660, 206],
    ["Проверить бюджет", 390, 350], ["Организовать поездку", 660, 350],
    ["Просмотреть статус", 520, 494],
  ];
  const caseShapes = {};
  for (const [name, x, y] of cases) {
    const c = shape(s, "ellipse", x, y, 230, 84, LIGHT, BLUE, 1.4);
    c.text = name; c.text.style = { typeface: FONT, fontSize: 19, color: TEXT, bold: true, alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText" };
    caseShapes[name] = c;
  }
  const actors = [
    ["Сотрудник", 62, 210], ["Бухгалтер", 62, 356],
    ["Руководитель", 1040, 210], ["Координатор", 1040, 356],
  ];
  const actorShapes = {};
  for (const [name, x, y] of actors) {
    const a = shape(s, "roundRect", x, y, 170, 72, "#FFFFFF", NAVY, 1.5);
    a.text = name; a.text.style = { typeface: FONT, fontSize: 19, bold: true, color: NAVY, alignment: "center", verticalAlignment: "middle", autoFit: "none" };
    actorShapes[name] = a;
  }
  lineBetween(s, actorShapes["Сотрудник"], caseShapes["Подать заявку"], { fromSide: "right", toSide: "left" });
  lineBetween(s, actorShapes["Руководитель"], caseShapes["Принять решение"], { fromSide: "left", toSide: "right" });
  lineBetween(s, actorShapes["Координатор"], caseShapes["Организовать поездку"], { fromSide: "left", toSide: "right" });
  lineBetween(s, actorShapes["Бухгалтер"], caseShapes["Проверить бюджет"], { fromSide: "right", toSide: "left" });
  textBox(s, "Статус и историю видят автор, участники и назначенные согласующие", 425, 584, 430, 34, { fontSize: 15, color: MUTED, align: "center" });
}

// 7 Architecture
{
  const s = deck.slides.add(); s.background.fill = PALE; title(s, "Архитектура и стек", 7);
  const data = [
    ["Браузер", "React UI\nформы и списки", 58, LIGHT],
    ["Next.js", "маршрутизация\nи доставка UI", 355, "#DFEAF3"],
    ["Express", "REST API\nи бизнес-правила", 652, "#D2E2EE"],
    ["PostgreSQL", "транзакции\nи ограничения", 949, "#C5D9E8"],
  ];
  const blocks = [];
  for (const [name, body, x, fill] of data) {
    const b = shape(s, "roundRect", x, 212, 240, 220, fill, NAVY, 1.5);
    b.text.set([[{ run: name, textStyle: { bold: true, color: NAVY, fontSize: "25pt" } }], [body]]);
    b.text.style = { typeface: FONT, fontSize: 21, color: TEXT, alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText", insets: { top: 12, right: 10, bottom: 12, left: 10 } };
    blocks.push(b);
  }
  for (let i=0; i<blocks.length-1; i++) lineBetween(s, blocks[i], blocks[i+1], { fromSide: "right", toSide: "left", head: true, width: 2.4, color: BLUE });
  textBox(s, "Один репозиторий и один серверный контур Node.js", 300, 486, 680, 44, { fontSize: 24, bold: true, color: NAVY, align: "center" });
  textBox(s, "Модульный монолит сокращает сложность развертывания, сохраняя разделение UI, API, домена и доступа к данным.", 190, 544, 900, 78, { fontSize: 21, color: MUTED, align: "center" });
}

// 8 Logical model
{
  const s = deck.slides.add(); s.background.fill = WHITE; title(s, "Логическая модель данных", 8);
  const specs = [
    ["users", "PK id\nemail UQ\nfull_name", 56, 170, 210, 122],
    ["roles", "PK id\ncode UQ", 56, 392, 210, 104],
    ["departments", "PK id\ncode UQ", 330, 150, 230, 104],
    ["trip_requests", "PK id\nFK created_by\nFK department\ndates, status", 500, 292, 280, 166],
    ["participants", "PK FK request\nPK FK user\nis_primary", 830, 138, 230, 126],
    ["approval_steps", "FK request\nFK approver\nstep_no, decision", 910, 338, 240, 142],
    ["expenses", "FK request\ncategory\namount, currency", 780, 520, 230, 126],
    ["status_history", "FK request\nFK changed_by\nfrom, to, time", 330, 520, 250, 126],
  ];
  const nodes = {};
  for (const [name, body, x, y, w, h] of specs) {
    const n = shape(s, "roundRect", x, y, w, h, "#F9FBFD", BLUE, 1.3);
    n.text.set([[{ run: name, textStyle: { bold: true, color: NAVY, fontSize: "20pt" } }], [body]]);
    n.text.style = { typeface: FONT, fontSize: 16.5, color: TEXT, alignment: "left", verticalAlignment: "middle", autoFit: "shrinkText", insets: { top: 8, right: 8, bottom: 8, left: 12 } };
    nodes[name] = n;
  }
  lineBetween(s, nodes.users, nodes.trip_requests, { kind: "elbow", fromSide: "right", toSide: "left" });
  lineBetween(s, nodes.departments, nodes.trip_requests, { fromSide: "bottom", toSide: "top" });
  s.shapes.add({ geometry: "line", position: { left: 161, top: 292, width: 0, height: 100 }, fill: "none", line: { style: "dashed", fill: "#7E94A7", width: 2 } });
  lineBetween(s, nodes.trip_requests, nodes.participants, { fromSide: "right", toSide: "left" });
  lineBetween(s, nodes.trip_requests, nodes.approval_steps, { fromSide: "right", toSide: "left" });
  lineBetween(s, nodes.trip_requests, nodes.expenses, { fromSide: "bottom", toSide: "top" });
  lineBetween(s, nodes.trip_requests, nodes.status_history, { fromSide: "bottom", toSide: "top" });
  textBox(s, "N:M связи раскрыты через user_roles и trip_participants", 70, 112, 560, 28, { fontSize: 16, color: MUTED });
}

// 9 Physical schema
{
  const s = deck.slides.add(); s.background.fill = PALE; title(s, "Физическая схема PostgreSQL", 9);
  const paragraphs = [
    [{ run: "Целостность", textStyle: { bold: true, color: NAVY } }, { run: "  PK, FK, NOT NULL, UNIQUE и CHECK контролируют связи, даты, суммы и статусы." }],
    [{ run: "Нормализация", textStyle: { bold: true, color: NAVY } }, { run: "  роли, участники, расходы и решения вынесены в отдельные таблицы. Итог расходов рассчитывает view." }],
    [{ run: "Индексы", textStyle: { bold: true, color: NAVY } }, { run: "  поддерживают очередь согласующего, фильтры по статусу и датам, историю и поиск участника." }],
    [{ run: "Доступ", textStyle: { bold: true, color: NAVY } }, { run: "  trip_app изменяет данные, trip_auditor только читает, а владелец миграций выполняет DDL." }],
  ];
  richText(s, paragraphs, 74, 145, 790, 360, { fontSize: 23 });
  shape(s, "line", 894, 150, 0, 450, "none", "#C9D7E3", 1.3);
  textBox(s, "11", 936, 176, 220, 100, { fontSize: 72, bold: true, color: NAVY, align: "center", valign: "middle" });
  textBox(s, "таблиц", 936, 272, 220, 38, { fontSize: 21, bold: true, color: MUTED, align: "center" });
  textBox(s, "1", 936, 350, 220, 90, { fontSize: 64, bold: true, color: BLUE, align: "center", valign: "middle" });
  textBox(s, "представление итогов", 910, 440, 270, 58, { fontSize: 20, bold: true, color: MUTED, align: "center" });
  textBox(s, "0", 936, 520, 220, 76, { fontSize: 56, bold: true, color: GREEN, align: "center", valign: "middle" });
  textBox(s, "дублируемых итоговых сумм", 895, 596, 300, 48, { fontSize: 18, bold: true, color: MUTED, align: "center" });
}

// 10 Verification
{
  const s = deck.slides.add(); s.background.fill = WHITE; title(s, "Проверка SQL-скриптов", 10);
  textBox(s, "Тестовая заявка", 70, 135, 360, 44, { fontSize: 26, bold: true, color: NAVY });
  textBox(s, "Санкт-Петербург, 12-15 октября 2026", 70, 180, 500, 40, { fontSize: 20, color: MUTED });
  const costs = [["18 000 ₽", "билеты"], ["24 000 ₽", "гостиница"], ["4 000 ₽", "суточные"]];
  costs.forEach((c, i) => {
    textBox(s, c[0], 74+i*190, 268, 170, 60, { fontSize: 28, bold: true, color: BLUE, align: "center" });
    textBox(s, c[1], 74+i*190, 328, 170, 36, { fontSize: 18, color: MUTED, align: "center" });
  });
  shape(s, "line", 622, 150, 0, 470, "none", "#C9D7E3", 1.3);
  textBox(s, "46 000 ₽", 688, 150, 450, 95, { fontSize: 58, bold: true, color: GREEN, align: "center", valign: "middle" });
  textBox(s, "рассчитанный итог тестовых данных", 688, 246, 450, 40, { fontSize: 19, color: MUTED, align: "center" });
  label(s, "Фактический запуск", 684, 320, 380, GREEN);
  bullets(s, [
    "001_schema.sql  PASS",
    "002_seed.sql  PASS",
    "003_verification.sql  PASS",
    "004_access_control.sql  PASS",
  ], 684, 360, 450, 190, { fontSize: 22, spaceAfterPoints: 7 });
  textBox(s, "Отрицательные даты, второй основной участник и отклонение без комментария база не принимает.", 684, 558, 470, 70, { fontSize: 20, bold: true, color: RED });
}

// 11 Plan and risks
{
  const s = deck.slides.add(); s.background.fill = PALE; title(s, "План разработки и риски", 11);
  label(s, "Этапы", 64, 132, 200);
  const stages = ["Требования", "Данные", "Серверный каркас", "Пользовательский срез", "Согласование", "Приемка MVP"];
  stages.forEach((st, i) => {
    textBox(s, String(i+1), 70, 180+i*70, 44, 44, { fontSize: 20, bold: true, color: WHITE, fill: NAVY, align: "center", valign: "middle" });
    textBox(s, st, 130, 180+i*70, 390, 44, { fontSize: 22, bold: i < 2, color: i < 2 ? NAVY : TEXT, valign: "middle" });
  });
  shape(s, "line", 592, 150, 0, 470, "none", "#C9D7E3", 1.3);
  label(s, "Главные риски", 642, 132, 300, RED);
  const riskParas = [
    [{ run: "Маршрут согласования", textStyle: { bold: true, color: RED } }, { run: "  фиксируем два шага в MVP" }],
    [{ run: "Расхождение UI и API", textStyle: { bold: true, color: RED } }, { run: "  согласуем контракт до формы" }],
    [{ run: "Потеря истории", textStyle: { bold: true, color: RED } }, { run: "  статус и журнал меняются в одной транзакции" }],
    [{ run: "Изменение схемы", textStyle: { bold: true, color: RED } }, { run: "  только новые миграции и проверка seed" }],
    [{ run: "Утечка секретов", textStyle: { bold: true, color: RED } }, { run: "  переменные среды и .env.example" }],
  ];
  richText(s, riskParas, 642, 180, 540, 390, { fontSize: 22 });
}

// 12 Result
{
  const s = deck.slides.add(); s.background.fill = NAVY;
  textBox(s, "Результат работ 1-4", 72, 58, 760, 70, { fontSize: 40, bold: true, color: WHITE, valign: "middle" });
  const results = [
    ["1", "Паспорт проекта, пользователи, MVP и правила команды"],
    ["2", "15 FR, 12 NFR, пять сценариев, архитектура и план"],
    ["3", "Логическая модель с 1:1, 1:N и N:M связями"],
    ["4", "Физическая схема PostgreSQL, seed и проверенные запросы"],
  ];
  results.forEach((r, i) => {
    textBox(s, r[0], 84, 170+i*95, 54, 54, { fontSize: 25, bold: true, color: NAVY, fill: GOLD, align: "center", valign: "middle" });
    textBox(s, r[1], 162, 164+i*95, 920, 70, { fontSize: 24, color: WHITE, valign: "middle" });
  });
  shape(s, "line", 84, 575, 1070, 0, "none", "#6E8AA3", 1.2);
  textBox(s, "Следующий шаг", 84, 602, 220, 36, { fontSize: 18, bold: true, color: GOLD });
  textBox(s, "Практика 5  серверный каркас, подключение PostgreSQL и первая операция FR-02", 300, 594, 820, 56, { fontSize: 22, bold: true, color: WHITE });
}

// Export previews for direct visual inspection.
for (let i = 0; i < deck.slides.items.length; i++) {
  const slide = deck.slides.items[i];
  const preview = await deck.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(path.join(TMP_DIR, `slide-${String(i+1).padStart(2, "0")}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const requirements = {
  explicitTotalSlideCount: 12,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
};
const fontPolicy = { basis: "design", families: [FONT] };
const stagingDir = path.join(workspaceDir, ".build", "presentation", "finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "candidate.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidatePath);

const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "presentation-final-v2.validation.json"),
});

console.log(JSON.stringify({ final: FINAL_PPTX, validation: result }, null, 2));
