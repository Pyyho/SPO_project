from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"
ASSETS = ROOT / "tmp" / "report_assets"
OUT.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)
DOCX_PATH = OUT / "Service_trip_system_practicals_1-4.docx"

NAVY = "1F4E78"
BLUE = "DCE6F1"
PALE = "F4F7FA"
GRAY = "D9E0E7"
TEXT = "1F2933"


def set_font(run, name="Aptos", size=10.5, bold=None, color=TEXT):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)
    run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def shade(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=90, start=100, bottom=90, end=100):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_cell_text(cell, text, *, bold=False, color=TEXT, size=8.6, align=None):
    cell.text = ""
    p = cell.paragraphs[0]
    if align is not None:
        p.alignment = align
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.03
    r = p.add_run(str(text))
    set_font(r, size=size, bold=bold, color=color)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)


def add_table(doc, headers, rows, widths=None, font_size=8.6):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.style = "Table Grid"
    header = table.rows[0]
    set_repeat_table_header(header)
    for i, h in enumerate(headers):
        shade(header.cells[i], NAVY)
        set_cell_text(header.cells[i], h, bold=True, color="FFFFFF", size=8.4, align=WD_ALIGN_PARAGRAPH.CENTER)
        if widths:
            header.cells[i].width = Cm(widths[i])
    for ridx, row in enumerate(rows):
        cells = table.add_row().cells
        for i, value in enumerate(row):
            if ridx % 2:
                shade(cells[i], PALE)
            align = WD_ALIGN_PARAGRAPH.CENTER if len(str(value)) < 18 and i != len(row) - 1 else WD_ALIGN_PARAGRAPH.LEFT
            set_cell_text(cells[i], value, size=font_size, align=align)
            if widths:
                cells[i].width = Cm(widths[i])
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(12 if level == 1 else 8)
    p.paragraph_format.space_after = Pt(5)
    for r in p.runs:
        set_font(r, size={1: 15, 2: 12.5, 3: 11}[min(level, 3)], bold=True, color="000000")
    return p


def add_body(doc, text, bold_lead=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.line_spacing = 1.12
    if bold_lead:
        r = p.add_run(bold_lead)
        set_font(r, bold=True)
    r = p.add_run(text)
    set_font(r)
    return p


def add_bullets(doc, items, level=0):
    for item in items:
        p = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
        p.paragraph_format.space_after = Pt(2.5)
        p.paragraph_format.line_spacing = 1.05
        set_font(p.add_run(item))


def add_numbered(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Number")
        p.paragraph_format.space_after = Pt(2.5)
        p.paragraph_format.line_spacing = 1.05
        set_font(p.add_run(item))


def add_caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(7)
    r = p.add_run(text)
    set_font(r, size=9, color="4A5560")
    r.italic = True


def page_break(doc):
    doc.add_page_break()


FONT_REG = r"C:\Windows\Fonts\arial.ttf"
FONT_BOLD = r"C:\Windows\Fonts\arialbd.ttf"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size)


def centered(draw, box, text, fnt, fill="#1F2933", spacing=6):
    x1, y1, x2, y2 = box
    bbox = draw.multiline_textbbox((0, 0), text, font=fnt, align="center", spacing=spacing)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.multiline_text(((x1+x2-w)/2, (y1+y2-h)/2), text, font=fnt, fill=fill, align="center", spacing=spacing)


def draw_arrow(draw, start, end, both=False, fill="#1F4E78", width=5):
    draw.line([start, end], fill=fill, width=width)
    def head(a, b):
        import math
        ang = math.atan2(b[1]-a[1], b[0]-a[0])
        length = 18
        for off in (2.55, -2.55):
            p = (b[0] + length * math.cos(ang + off), b[1] + length * math.sin(ang + off))
            draw.line([b, p], fill=fill, width=width)
    head(start, end)
    if both:
        head(end, start)


def draw_architecture(path):
    im = Image.new("RGB", (2400, 1040), "white")
    d = ImageDraw.Draw(im)
    d.text((1200, 85), "Один репозиторий и один серверный контур Node.js", font=font(44, True), fill="#1F2933", anchor="mm")
    blocks = [
        (80, 330, 500, 730, "Браузер\nпользователя", "React UI\nформы и списки"),
        (640, 250, 1110, 810, "Next.js", "маршрутизация\nSSR и раздача UI"),
        (1260, 250, 1730, 810, "Express", "REST API\nвалидация и правила"),
        (1870, 330, 2320, 730, "PostgreSQL", "транзакции\nи ограничения"),
    ]
    for x1, y1, x2, y2, title, body in blocks:
        d.rounded_rectangle((x1, y1, x2, y2), radius=28, fill="#F4F7FA", outline="#1F4E78", width=5)
        centered(d, (x1, y1+55, x2, y1+215), title, font(43, True))
        centered(d, (x1, y1+210, x2, y2-35), body, font(30), fill="#4A5560")
    for x1, x2, label in [(500, 640, "HTTPS"), (1110, 1260, "вызов API"), (1730, 1870, "SQL")]:
        draw_arrow(d, (x1+10, 525), (x2-10, 525), both=True, width=4)
        centered(d, (x1, 430, x2, 500), label, font(23), fill="#1F4E78")
    im.save(path)


def draw_actor(d, x, y, name):
    d.ellipse((x-24, y-80, x+24, y-32), outline="#1F2933", width=5)
    d.line((x, y-32, x, y+45), fill="#1F2933", width=5)
    d.line((x-45, y, x+45, y), fill="#1F2933", width=5)
    d.line((x, y+45, x-38, y+102), fill="#1F2933", width=5)
    d.line((x, y+45, x+38, y+102), fill="#1F2933", width=5)
    centered(d, (x-150, y+110, x+150, y+180), name, font(25, True))


def draw_use_cases(path):
    im = Image.new("RGB", (2400, 1440), "white")
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((480, 110, 1920, 1330), radius=28, fill="#FBFCFE", outline="#1F4E78", width=5)
    d.text((1200, 160), "Система оформления служебных поездок", font=font(39, True), fill="#1F2933", anchor="mm")
    actors = {"Сотрудник": (185, 355), "Руководитель": (185, 940), "Координатор": (2215, 355), "Бухгалтер": (2215, 905), "Администратор": (2215, 1195)}
    cases = {
        "Создать и отправить\nзаявку": (830, 390), "Согласовать или\nотклонить": (830, 720),
        "Проверить бюджет": (1570, 720), "Организовать поездку": (1570, 390),
        "Просмотреть статус\nи историю": (830, 1090), "Вести справочники\nи роли": (1570, 1090),
    }
    links = [((335, 355), (580, 390)), ((335, 440), (580, 1090)), ((335, 940), (580, 720)), ((335, 990), (580, 1090)),
             ((2065, 355), (1820, 390)), ((2065, 450), (1080, 1090)), ((2065, 905), (1820, 720)), ((2065, 970), (1080, 1090)), ((2065, 1195), (1820, 1090))]
    for s, e in links:
        d.line([s, e], fill="#60758A", width=4)
    for name, (x, y) in actors.items():
        draw_actor(d, x, y, name)
    for name, (x, y) in cases.items():
        d.ellipse((x-245, y-105, x+245, y+105), fill="#DCE6F1", outline="#1F4E78", width=4)
        centered(d, (x-230, y-95, x+230, y+95), name, font(27))
    im.save(path)


def draw_er(path):
    im = Image.new("RGB", (2600, 1800), "white")
    d = ImageDraw.Draw(im)
    d.text((1300, 70), "Логическая ER-модель первой версии", font=font(46, True), fill="#1F2933", anchor="mm")
    d.text((1300, 125), "N:M связи раскрыты через user_roles и trip_participants", font=font(27), fill="#4A5560", anchor="mm")
    entities = {
        "roles": (70, 230, 420, ["PK id", "code", "name"]),
        "users": (560, 210, 480, ["PK id", "email UQ", "password_hash", "full_name"]),
        "departments": (1130, 230, 430, ["PK id", "code UQ", "name UQ"]),
        "user_roles": (80, 720, 420, ["PK FK user_id", "PK FK role_id", "assigned_at"]),
        "employee_profiles": (1040, 680, 520, ["PK FK user_id", "FK department_id", "personnel_no UQ", "FK manager_user_id"]),
        "trip_requests": (1740, 440, 560, ["PK id", "FK created_by_user_id", "FK department_id", "destination", "starts_on / ends_on", "status"]),
        "trip_participants": (1770, 980, 480, ["PK FK request_id", "PK FK user_id", "is_primary"]),
        "expense_estimates": (2110, 1390, 430, ["PK id", "FK request_id", "category", "amount", "currency"]),
        "approval_steps": (1420, 1375, 450, ["PK id", "FK request_id", "FK approver_user_id", "step_no", "decision"]),
        "attachments": (790, 1400, 420, ["PK id", "FK request_id", "FK uploaded_by", "storage_key UQ"]),
        "trip_status_history": (120, 1380, 470, ["PK id", "FK request_id", "FK changed_by", "from_status", "to_status"]),
    }
    dims = {name: (x, y, w, 105 + 43*len(fields)) for name, (x, y, w, fields) in entities.items()}
    def pt(name, side):
        x, y, w, h = dims[name]
        return {"left": (x, y+h//2), "right": (x+w, y+h//2), "top": (x+w//2, y), "bottom": (x+w//2, y+h)}[side]
    edges = [
        ("roles", "bottom", "user_roles", "top", "1", "N"), ("users", "left", "user_roles", "right", "1", "N"),
        ("users", "bottom", "employee_profiles", "top", "1", "0..1"), ("departments", "bottom", "employee_profiles", "top", "1", "N"),
        ("users", "right", "trip_requests", "left", "1", "N"), ("departments", "right", "trip_requests", "top", "1", "N"),
        ("trip_requests", "bottom", "trip_participants", "top", "1", "N"), ("users", "bottom", "trip_participants", "left", "1", "N"),
        ("trip_requests", "bottom", "expense_estimates", "top", "1", "N"), ("trip_requests", "bottom", "approval_steps", "top", "1", "N"),
        ("trip_requests", "left", "attachments", "top", "1", "N"), ("trip_requests", "left", "trip_status_history", "top", "1", "N"),
    ]
    for a, sa, b, sb, la, lb in edges:
        s, e = pt(a, sa), pt(b, sb)
        d.line([s, e], fill="#91A2B2", width=4)
        d.text((int(s[0]*0.88+e[0]*0.12), int(s[1]*0.88+e[1]*0.12)), la, font=font(20, True), fill="#1F4E78")
        d.text((int(s[0]*0.12+e[0]*0.88), int(s[1]*0.12+e[1]*0.88)), lb, font=font(20, True), fill="#1F4E78")
    for name, (x, y, w, fields) in entities.items():
        h = dims[name][3]
        d.rounded_rectangle((x, y, x+w, y+h), radius=18, fill="white", outline="#1F4E78", width=4)
        d.rounded_rectangle((x, y, x+w, y+70), radius=18, fill="#1F4E78", outline="#1F4E78", width=2)
        centered(d, (x, y, x+w, y+70), name, font(27, True), fill="white")
        for i, field_name in enumerate(fields):
            d.text((x+22, y+90+i*43), field_name, font=font(22), fill="#1F2933")
    im.save(path)


arch = ASSETS / "architecture.png"
uc = ASSETS / "use_case.png"
er = ASSETS / "er_diagram.png"
draw_architecture(arch)
draw_use_cases(uc)
draw_er(er)


doc = Document()
section = doc.sections[0]
section.top_margin = Cm(1.8)
section.bottom_margin = Cm(1.7)
section.left_margin = Cm(2.0)
section.right_margin = Cm(1.7)

styles = doc.styles
styles["Normal"].font.name = "Aptos"
styles["Normal"]._element.rPr.rFonts.set(qn("w:ascii"), "Aptos")
styles["Normal"]._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos")
styles["Normal"].font.size = Pt(10.5)
for style_name in ("Title", "Heading 1", "Heading 2", "Heading 3"):
    styles[style_name].font.name = "Aptos Display"
    styles[style_name]._element.rPr.rFonts.set(qn("w:ascii"), "Aptos Display")
    styles[style_name]._element.rPr.rFonts.set(qn("w:hAnsi"), "Aptos Display")
    styles[style_name].font.color.rgb = RGBColor(0, 0, 0)

# Title page
for _ in range(4):
    doc.add_paragraph()
p = doc.add_paragraph(style="Title")
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(16)
r = p.add_run("Система оформления служебных поездок")
set_font(r, name="Aptos Display", size=25, bold=True, color="000000")
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Отчет по практическим работам 1-4")
set_font(r, name="Aptos Display", size=17, bold=True, color="000000")
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_before = Pt(18)
r = p.add_run("Веб-приложение для подачи, согласования и учета заявок на служебные поездки")
set_font(r, size=12, color="4A5560")
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("PostgreSQL  |  Next.js  |  Express  |  React")
set_font(r, size=11, bold=True, color=NAVY)
for _ in range(7):
    doc.add_paragraph()
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Учебный проект  |  2026")
set_font(r, size=10.5, color="4A5560")
page_break(doc)

add_heading(doc, "Назначение и состав отчета", 1)
add_body(doc, "Отчет фиксирует решения первых четырех практических работ единого проекта. Он определяет границы продукта, переводит идею в проверяемые требования, проектирует логическую модель данных и доводит ее до исполняемой физической схемы PostgreSQL. Результатом является согласованный базис для реализации React-интерфейса и серверной части на Next.js и Express.")
add_body(doc, "ФИО участников и реквизиты учебной группы в исходных данных не предоставлены. В разделе о команде оставлены явно обозначенные строки для заполнения перед сдачей; технические роли, ответственность и границы работ уже определены.")

add_heading(doc, "Содержание", 1)
add_numbered(doc, [
    "Практическая работа 1 Старт проекта",
    "Практическая работа 2 Анализ требований и план разработки",
    "Практическая работа 3 База данных и логическая модель",
    "Практическая работа 4 Физическая схема и проверка",
    "Приложение А Матрица трассировки требований",
    "Приложение Б Комплект SQL-скриптов",
])

add_heading(doc, "Принятые допущения", 1)
add_bullets(doc, [
    "Next.js используется как React-фреймворк и серверный слой доставки интерфейса; Express реализует REST API и бизнес-правила в том же Node.js-контуре.",
    "Первая версия поддерживает внутренний процесс организации поездки и не интегрируется с внешними системами бронирования, кадровыми и бухгалтерскими системами.",
    "Одна заявка может включать нескольких участников, но имеет ровно одного основного участника.",
    "Денежная оценка хранится построчно. Итог рассчитывается представлением, чтобы не дублировать производное значение.",
    "Роли могут совмещаться одним пользователем, поэтому связь пользователей и ролей реализована как N:M.",
])

page_break(doc)
add_heading(doc, "Практическая работа 1 Старт проекта", 1)
add_body(doc, "Цель работы - сформировать понятный проект, определить пользователей, первую ценность продукта, состав команды и правила совместной работы.")

add_heading(doc, "Паспорт проекта", 2)
add_table(doc, ["Параметр", "Решение"], [
    ("Рабочее название", "Система оформления служебных поездок"),
    ("Проблема", "Заявки на поездки согласуются через письма и таблицы. Участники не видят единый статус, документы теряются, а состав расходов и история решений трудно проверяются."),
    ("Назначение", "Объединить подачу заявки, маршрут согласования, расчет предварительных расходов, документы и историю статусов в одном веб-приложении."),
    ("Ожидаемый результат", "Сотрудник оформляет заявку по единой форме; руководитель и бухгалтер принимают решение; координатор видит утвержденные поездки; каждое изменение статуса сохраняется."),
    ("Критерий первой демонстрации", "Полный сценарий от создания заявки до решения руководителя выполняется через интерфейс и сохраняется в PostgreSQL без ручного изменения данных."),
], widths=[4.2, 12.2], font_size=9)

add_heading(doc, "Пользователи и ожидаемые функции", 2)
add_table(doc, ["Роль", "Задачи", "Доступ к данным"], [
    ("Сотрудник", "Создает черновик, добавляет участников и расходы, прикладывает документы, отправляет и отслеживает заявку.", "Свои заявки и поездки, где он участник."),
    ("Руководитель", "Проверяет цель, сроки и состав участников; согласует или отклоняет заявку с комментарием.", "Заявки сотрудников своего подразделения."),
    ("Координатор поездок", "Получает утвержденные заявки, организует поездку, контролирует документы и завершение процесса.", "Утвержденные и обрабатываемые заявки."),
    ("Бухгалтер", "Проверяет источник финансирования и предварительный бюджет, фиксирует финансовое решение.", "Расходы и необходимые реквизиты заявок."),
    ("Администратор", "Назначает роли, поддерживает учетные записи и справочники.", "Системные справочники и настройки доступа."),
], widths=[3.0, 8.4, 5.0], font_size=8.7)
add_body(doc, "Предполагаемые функции первой и следующих версий:")
add_bullets(doc, [
    "вход в систему и разграничение доступа по ролям;",
    "создание и редактирование черновика заявки;",
    "добавление одного или нескольких участников;",
    "ввод места, дат, цели, транспорта и источника финансирования;",
    "расчет предварительных расходов по категориям;",
    "отправка заявки на последовательное согласование;",
    "согласование или отклонение с обязательным комментарием;",
    "список заявок с фильтрами по статусу, датам и подразделению;",
    "прикрепление подтверждающих файлов;",
    "просмотр истории статусов и действий;",
])

add_heading(doc, "Состав команды", 2)
add_table(doc, ["Участник", "Проектная роль", "Обязанности"], [
    ("Участник 1 - ФИО внести перед сдачей", "Владелец продукта и аналитик", "Уточняет требования, ведет backlog, принимает пользовательские сценарии."),
    ("Участник 2 - ФИО внести перед сдачей", "Backend разработчик", "Express API, бизнес-правила, доступ к PostgreSQL, миграции."),
    ("Участник 3 - ФИО внести перед сдачей", "Frontend разработчик", "React-компоненты, формы, состояния загрузки и ошибок."),
    ("Участник 4 - ФИО внести перед сдачей", "Инженер данных", "ER-модель, ограничения, индексы, тестовые данные и запросы."),
    ("Участник 5 - ФИО внести перед сдачей", "Тестировщик и DevOps", "Тест-кейсы, окружение, сборка, проверка релиза и документация."),
], widths=[5.0, 4.2, 7.2], font_size=8.6)
add_body(doc, "Если участников меньше пяти, роли совмещаются. Владелец продукта остается ответственным за приемку требований, а автор SQL-изменения не выполняет его итоговую проверку в одиночку.")

add_heading(doc, "Границы первой версии", 2)
add_table(doc, ["Обязательно в MVP", "Оставлено на следующие итерации"], [
    ("Вход с ролью и просмотр доступных заявок", "Единый вход организации и многофакторная аутентификация"),
    ("Создание черновика и заполнение основных полей", "Автозаполнение из кадровой системы"),
    ("Участники и предварительные расходы", "Курсы валют и автоматический расчет суточных"),
    ("Отправка, согласование, отклонение и комментарий", "Гибкий конструктор маршрутов согласования"),
    ("История статусов и базовые вложения", "Электронная подпись и юридически значимый архив"),
    ("Списки и фильтры по статусам", "Интеграции с билетами, гостиницами и бухгалтерией"),
], widths=[8.2, 8.2], font_size=8.8)

add_heading(doc, "Правила командной работы", 2)
add_table(doc, ["Область", "Правило"], [
    ("Код", "Git-репозиторий; защищенная основная ветка main; изменение через короткую feature-ветку и merge request."),
    ("Задачи", "Backlog с ответственным, приоритетом, критерием готовности и ссылкой на FR."),
    ("Решения", "Существенные решения фиксируются в каталоге docs/decisions как короткие ADR."),
    ("База данных", "Каждое изменение схемы оформляется новой миграцией; ранее примененные миграции не переписываются."),
    ("Проверка", "Минимум один участник проверяет код; для SQL обязательны запуск миграции, seed и verification."),
    ("Секреты", "Пароли и строки подключения хранятся в переменных среды; в Git размещается только .env.example."),
    ("Готовность", "Задача готова, если выполнен критерий приемки, обновлена документация и пройдены проверки."),
], widths=[3.5, 12.9], font_size=8.8)

page_break(doc)
add_heading(doc, "Практическая работа 2 Анализ требований и план разработки", 1)
add_body(doc, "Цель работы - преобразовать границы проекта в требования, которые можно проверить по интерфейсу, API и состоянию данных.")

add_heading(doc, "Роли пользователей", 2)
add_body(doc, "Сотрудник инициирует процесс. Руководитель подтверждает служебную необходимость. Бухгалтер проверяет допустимость предварительных расходов. Координатор работает только с утвержденными заявками. Администратор управляет доступом, но не принимает бизнес-решения за согласующих.")

fr_rows = [
    ("FR-01", "P0", "Система идентифицирует пользователя и применяет назначенные ему роли."),
    ("FR-02", "P0", "Сотрудник создает черновик заявки и редактирует его до отправки."),
    ("FR-03", "P0", "Автор добавляет участников; один участник отмечается основным."),
    ("FR-04", "P0", "Автор добавляет статьи предварительных расходов с категорией, суммой и валютой."),
    ("FR-05", "P0", "Заявка отправляется только при заполненных обязательных полях и корректном диапазоне дат."),
    ("FR-06", "P0", "Руководитель согласует или отклоняет назначенный ему шаг; при отклонении комментарий обязателен."),
    ("FR-07", "P0", "Бухгалтер принимает финансовое решение после решения руководителя."),
    ("FR-08", "P0", "Координатор видит утвержденные заявки и переводит их к организации поездки."),
    ("FR-09", "P0", "Пользователь просматривает доступные заявки и фильтрует их по статусу и датам."),
    ("FR-10", "P1", "Система показывает исполнителю новые задачи согласования внутри приложения."),
    ("FR-11", "P1", "Пользователь прикрепляет файлы до 10 МБ разрешенных типов."),
    ("FR-12", "P0", "Каждая смена статуса сохраняется с автором, временем и комментарием."),
    ("FR-13", "P1", "Администратор назначает роли и включает или блокирует учетную запись."),
    ("FR-14", "P1", "Автор отменяет заявку до начала поездки с сохранением причины."),
    ("FR-15", "P1", "Координатор завершает поездку после выполнения обязательных действий."),
]
add_heading(doc, "Функциональные требования", 2)
add_table(doc, ["ID", "Приоритет", "Проверяемое требование"], fr_rows, widths=[2.0, 2.2, 12.2], font_size=8.6)
add_body(doc, "P0 входит в MVP. P1 реализуется после устойчивого сквозного сценария. Приоритет не отменяет требования, а задает порядок разработки.")

nfr_rows = [
    ("NFR-01", "Производительность", "95-й процентиль ответа API не более 2 с при 50 одновременных пользователях на учебном стенде."),
    ("NFR-02", "Надежность", "Все операции изменения заявки выполняются в транзакции; частично записанное состояние не допускается."),
    ("NFR-03", "Доступ", "Каждый защищенный endpoint проверяет аутентификацию и право на конкретную заявку."),
    ("NFR-04", "Пароли", "Пароли хранятся только как bcrypt cost не ниже 12 или Argon2id; исходный пароль не журналируется."),
    ("NFR-05", "Валидация", "100 процентов изменяющих запросов проходят серверную проверку типов, диапазонов и обязательных полей."),
    ("NFR-06", "Целостность", "Ссылочная целостность, даты, суммы, статусы и уникальность поддерживаются ограничениями PostgreSQL."),
    ("NFR-07", "Аудит", "Для каждой смены статуса доступны пользователь, время, исходный и новый статусы."),
    ("NFR-08", "Резервирование", "RPO не более 24 ч и RTO не более 4 ч для учебного окружения."),
    ("NFR-09", "Совместимость", "Поддерживаются две последние стабильные версии Chrome, Edge и Firefox при ширине от 1280 px."),
    ("NFR-10", "Удобство", "Не менее 4 из 5 тестовых пользователей отправляют корректную заявку без подсказки за 5 минут."),
    ("NFR-11", "Файлы", "Размер одного вложения не более 10 МБ; бинарное содержимое не хранится в основной таблице заявок."),
    ("NFR-12", "Наблюдаемость", "Ошибки API имеют correlation id; журналы не содержат пароль, токен или строку подключения."),
]
add_heading(doc, "Нефункциональные требования", 2)
add_table(doc, ["ID", "Категория", "Измеримый критерий"], nfr_rows, widths=[2.0, 3.2, 11.2], font_size=8.5)

add_heading(doc, "Сценарии использования", 2)
use_cases = [
    ("UC-01 Подать заявку", "Сотрудник", "Пользователь вошел; профиль активен.", "Создать черновик; заполнить цель, место, даты и транспорт; добавить участника и расходы; отправить.", "Статус in_approval; сформированы шаги; создана запись истории.", "Некорректные даты или пустые поля - 400, данные остаются в черновике."),
    ("UC-02 Принять решение", "Руководитель", "Есть ожидающий шаг, назначенный этому пользователю.", "Открыть заявку; проверить данные; выбрать согласовать или отклонить; при отклонении ввести комментарий.", "Решение и время сохранены; активирован следующий шаг либо заявка отклонена.", "Повторное решение или чужая заявка - 409 либо 403."),
    ("UC-03 Проверить бюджет", "Бухгалтер", "Руководитель согласовал; финансовый шаг активен.", "Проверить статьи и источник финансирования; согласовать или отклонить.", "При согласовании заявка становится approved; история дополнена.", "Отрицательная сумма или неизвестная валюта блокируются до отправки."),
    ("UC-04 Организовать поездку", "Координатор", "Заявка approved.", "Найти утвержденную заявку; проверить участников и документы; начать организацию; завершить процесс.", "Заявка доступна в рабочем списке координатора; действия отражены в статусе.", "Неполный набор документов отмечается как ограничение следующей версии."),
    ("UC-05 Просмотреть историю", "Автор или участник", "Есть право чтения заявки.", "Открыть карточку; просмотреть текущий статус, маршрут согласования и журнал изменений.", "Пользователь видит последовательность событий без возможности редактировать историю.", "Отсутствие доступа - 403; отсутствующая заявка - 404."),
]
add_table(doc, ["Сценарий", "Актор", "Предусловие", "Основной поток", "Результат", "Альтернатива"], use_cases,
          widths=[2.5, 2.0, 2.7, 4.2, 3.0, 3.0], font_size=7.6)
doc.add_picture(str(uc), width=Inches(6.45))
add_caption(doc, "Рисунок 1 Диаграмма вариантов использования")

add_heading(doc, "Стек и схема взаимодействия", 2)
doc.add_picture(str(arch), width=Inches(6.45))
add_caption(doc, "Рисунок 2 Взаимодействие браузера, монолитного приложения и базы данных")
add_table(doc, ["Компонент", "Выбор", "Причина"], [
    ("Клиент", "React в составе Next.js", "Компонентный UI, маршрутизация, управляемые формы и единая модель сборки."),
    ("Веб-слой", "Next.js", "Доставка React-приложения, серверный рендеринг и маршрутизация страниц."),
    ("API", "Express", "Явные middleware для аутентификации, валидации, обработки ошибок и REST-маршрутов."),
    ("Данные", "PostgreSQL", "Транзакции, внешние ключи, CHECK, частичные индексы и зрелые средства миграций."),
    ("Архитектура", "Модульный монолит", "Один контур развертывания для учебной команды, но раздельные модули UI, API, домена и доступа к данным."),
], widths=[3.1, 4.0, 9.3], font_size=8.6)

add_heading(doc, "План разработки", 2)
add_table(doc, ["Этап", "Результат", "Зависит от", "Ответственный"], [
    ("1 Требования", "FR, NFR, Use Case, критерии приемки", "Паспорт проекта", "Аналитик"),
    ("2 Данные", "ER-модель, миграция, seed, проверки", "FR-02-FR-12", "Инженер данных и backend"),
    ("3 Серверный каркас", "Express-модули, подключение БД, обработка ошибок", "Физическая схема", "Backend разработчик"),
    ("4 Пользовательский срез", "Создание и отправка заявки", "API черновика и отправки", "Frontend и backend"),
    ("5 Согласование", "Решение руководителя и бухгалтера", "Маршрут и роли", "Backend, frontend, тестировщик"),
    ("6 Приемка MVP", "Сквозные тесты и демонстрация", "Этапы 1-5", "Вся команда"),
], widths=[3.0, 5.2, 4.5, 3.7], font_size=8.4)

add_heading(doc, "Риски и действия", 2)
add_table(doc, ["Риск", "Вероятность", "Влияние", "Действие"], [
    ("Неясный маршрут согласования", "Средняя", "Высокое", "Зафиксировать последовательность руководитель -> бухгалтер; гибкие маршруты вынести из MVP."),
    ("Расхождение UI и API", "Средняя", "Высокое", "Согласовать JSON-контракты до формы и проверять их интеграционным тестом."),
    ("Потеря истории статусов", "Низкая", "Высокое", "Менять статус и писать историю в одной транзакции."),
    ("Изменение схемы ломает данные", "Средняя", "Высокое", "Только версионированные миграции; проверка на копии seed-данных."),
    ("Утечка секретов", "Низкая", "Высокое", "Переменные среды, .env.example без значений, проверка истории Git."),
], widths=[4.2, 2.5, 2.5, 7.2], font_size=8.4)

page_break(doc)
add_heading(doc, "Практическая работа 3 База данных и логическая модель", 1)
add_body(doc, "Цель работы - определить данные, необходимые для требований первой версии, и связать их без дублирования и неоднозначных отношений.")

add_heading(doc, "Функции с постоянным хранением", 2)
add_table(doc, ["Требования", "Что хранится", "Основные сущности"], [
    ("FR-01 FR-13", "Учетная запись, активность, роли и профиль сотрудника", "users, roles, user_roles, employee_profiles"),
    ("FR-02 FR-03 FR-05", "Реквизиты заявки, подразделение и участники", "trip_requests, departments, trip_participants"),
    ("FR-04", "Категория, описание, сумма и валюта каждой статьи", "expense_estimates"),
    ("FR-06 FR-07", "Порядок согласования, согласующий, решение и комментарий", "approval_steps"),
    ("FR-11", "Метаданные файла и ключ внешнего хранилища", "attachments"),
    ("FR-12 FR-14 FR-15", "Переход статуса, пользователь, время и причина", "trip_status_history"),
], widths=[3.3, 7.3, 5.8], font_size=8.6)

add_heading(doc, "Сущности и назначение", 2)
entity_rows = [
    ("roles", "Справочник бизнес-ролей."), ("users", "Учетные записи и общие сведения пользователя."),
    ("departments", "Организационные подразделения."), ("user_roles", "Назначение нескольких ролей одному пользователю."),
    ("employee_profiles", "Кадровый профиль, подразделение и руководитель."), ("trip_requests", "Заявка и ее текущее состояние."),
    ("trip_participants", "Участники поездки и основной участник."), ("expense_estimates", "Предварительные статьи затрат."),
    ("approval_steps", "Последовательность и решения согласующих."), ("attachments", "Метаданные приложенных файлов."),
    ("trip_status_history", "Неизменяемая хронология смены статуса."),
]
add_table(doc, ["Сущность", "Назначение"], entity_rows, widths=[4.8, 11.6], font_size=8.8)

logical_attrs = [
    ("roles", "id, code, name", "Ключ; машинный код; отображаемое имя"),
    ("users", "id, email, password_hash, full_name, is_active, timestamps", "Идентификация, вход, имя и жизненный цикл учетной записи"),
    ("departments", "id, code, name, is_active", "Код и название подразделения"),
    ("user_roles", "user_id, role_id, assigned_at", "Составной ключ назначения роли"),
    ("employee_profiles", "user_id, department_id, personnel_no, position_title, manager_user_id", "Сотрудник, подразделение, должность и прямой руководитель"),
    ("trip_requests", "id, created_by, department_id, destination, dates, purpose, transport_type, funding_source, status, timestamps", "Содержание заявки и текущее состояние"),
    ("trip_participants", "request_id, user_id, is_primary, added_at", "Связь поездки и сотрудников"),
    ("expense_estimates", "id, request_id, category, description, amount, currency", "Строка предварительного бюджета"),
    ("approval_steps", "id, request_id, step_no, approver_id, decision, comment, decided_at", "Один шаг маршрута согласования"),
    ("attachments", "id, request_id, uploaded_by, file_name, storage_key, mime_type, size, uploaded_at", "Файл хранится отдельно; в БД остается адрес и метаданные"),
    ("trip_status_history", "id, request_id, from_status, to_status, changed_by, changed_at, comment", "Аудит переходов"),
]
add_heading(doc, "Логические атрибуты", 2)
add_table(doc, ["Сущность", "Атрибуты", "Смысл"], logical_attrs, widths=[3.5, 7.4, 5.5], font_size=7.9)

add_heading(doc, "Связи и кратности", 2)
add_table(doc, ["Связь", "Кратность", "Реализация и смысл"], [
    ("users - roles", "N:M", "user_roles позволяет пользователю совмещать роли, например сотрудник и руководитель."),
    ("users - employee_profiles", "1:0..1", "Не каждая системная учетная запись обязана быть сотрудником; профиль имеет тот же ключ."),
    ("departments - employee_profiles", "1:N", "Каждый профиль относится к одному подразделению."),
    ("users - employee_profiles manager", "1:N", "Один руководитель может быть назначен нескольким сотрудникам."),
    ("users - trip_requests", "1:N", "Один пользователь создает много заявок; автор заявки неизменяем."),
    ("trip_requests - users", "N:M", "trip_participants раскрывает групповые поездки."),
    ("trip_requests - expense_estimates", "1:N", "У заявки несколько статей расходов."),
    ("trip_requests - approval_steps", "1:N", "Маршрут состоит из упорядоченных шагов."),
    ("trip_requests - attachments", "1:N", "У заявки может быть несколько файлов."),
    ("trip_requests - trip_status_history", "1:N", "Заявка имеет последовательность переходов статуса."),
], widths=[4.5, 2.1, 9.8], font_size=8.4)

add_heading(doc, "Ключи", 2)
add_body(doc, "Технические сущности используют bigint identity как первичный ключ. Связующие таблицы user_roles и trip_participants имеют составные первичные ключи, которые одновременно являются внешними. employee_profiles использует user_id как PK и FK, что фиксирует отношение 1:0..1. Все дочерние записи заявки с собственным жизненным циклом имеют отдельный id; уникальность шага согласования обеспечивается парой request_id и step_no.")

doc.add_picture(str(er), width=Inches(6.45))
add_caption(doc, "Рисунок 3 Первая ER-диаграмма")

add_heading(doc, "Открытые вопросы целостности", 2)
add_table(doc, ["Вопрос", "Решение первой версии", "Следующая проверка"], [
    ("Можно ли менять состав участников после отправки", "Нет; API блокирует изменение вне draft.", "Уточнить процесс замены участника."),
    ("Сколько основных участников допустимо", "Не более одного; частичный UNIQUE индекс.", "Решить, обязателен ли основной участник на уровне БД или транзакции."),
    ("Как задается маршрут", "Два шага: руководитель, затем бухгалтер.", "Нужен ли конструктор маршрутов по подразделениям и суммам."),
    ("Как хранить файлы", "Бинарные данные во внешнем хранилище; в БД только метаданные.", "Выбрать конкретное S3-совместимое хранилище."),
    ("Нужна ли мультивалютность", "Каждая статья имеет валюту; отчет MVP суммирует RUB отдельно.", "Добавить курс и дату пересчета после согласования требований."),
], widths=[4.4, 6.2, 5.8], font_size=8.3)

page_break(doc)
add_heading(doc, "Практическая работа 4 Физическая схема и проверка", 1)
add_body(doc, "Цель работы - уточнить логическую модель, определить типы и ограничения PostgreSQL, обосновать индексы и права, а затем проверить DDL, тестовые данные и типовые запросы.")

add_heading(doc, "Изменения модели после самопроверки", 2)
add_table(doc, ["Изменение", "Причина", "Результат"], [
    ("Роли вынесены в roles и user_roles", "Один человек может быть сотрудником и руководителем.", "Нет дублирования пользователей; права назначаются независимо."),
    ("Итог расходов удален из trip_requests", "Итог полностью зависит от строк расходов.", "Сумма рассчитывается в v_trip_request_totals."),
    ("Добавлена отдельная история статусов", "Текущий статус не объясняет последовательность решений.", "Сохраняются автор, время и переход."),
    ("Введен частичный уникальный индекс", "В заявке не должно быть двух основных участников.", "Условие контролирует PostgreSQL."),
    ("Файлы представлены метаданными", "Большие бинарные данные усложняют резервное копирование основной БД.", "БД хранит storage_key, тип и размер."),
    ("Шаг согласования отделен от статуса заявки", "У заявки несколько последовательных решений.", "Каждый шаг имеет своего исполнителя и состояние."),
], widths=[5.0, 5.7, 5.7], font_size=8.4)

physical = {
    "roles": [
        ("id", "bigint identity", "PK", "NOT NULL, авто"), ("code", "varchar(32)", "-", "NOT NULL, UNIQUE, CHECK regexp"), ("name", "varchar(100)", "-", "NOT NULL, UNIQUE")],
    "users": [
        ("id", "bigint identity", "PK", "NOT NULL"), ("email", "varchar(254)", "-", "NOT NULL, CHECK; UNIQUE lower(email)"),
        ("password_hash", "varchar(255)", "-", "NOT NULL"), ("full_name", "varchar(200)", "-", "NOT NULL, CHECK length"),
        ("is_active", "boolean", "-", "NOT NULL DEFAULT true"), ("created_at", "timestamptz", "-", "NOT NULL DEFAULT now"), ("updated_at", "timestamptz", "-", "NOT NULL DEFAULT now, trigger")],
    "departments": [
        ("id", "bigint identity", "PK", "NOT NULL"), ("code", "varchar(20)", "-", "NOT NULL UNIQUE"), ("name", "varchar(160)", "-", "NOT NULL UNIQUE"), ("is_active", "boolean", "-", "NOT NULL DEFAULT true")],
    "user_roles": [
        ("user_id", "bigint", "PK, FK -> users", "NOT NULL, ON DELETE CASCADE"), ("role_id", "bigint", "PK, FK -> roles", "NOT NULL, ON DELETE RESTRICT"), ("assigned_at", "timestamptz", "-", "NOT NULL DEFAULT now")],
    "employee_profiles": [
        ("user_id", "bigint", "PK, FK -> users", "NOT NULL, ON DELETE CASCADE"), ("department_id", "bigint", "FK -> departments", "NOT NULL, RESTRICT"),
        ("personnel_no", "varchar(30)", "-", "NOT NULL UNIQUE"), ("position_title", "varchar(160)", "-", "NOT NULL"),
        ("manager_user_id", "bigint", "FK -> users", "NULL, CHECK not self")],
    "trip_requests": [
        ("id", "bigint identity", "PK", "NOT NULL"), ("created_by_user_id", "bigint", "FK -> users", "NOT NULL, RESTRICT"),
        ("department_id", "bigint", "FK -> departments", "NOT NULL, RESTRICT"), ("destination", "varchar(200)", "-", "NOT NULL, CHECK length"),
        ("starts_on", "date", "-", "NOT NULL"), ("ends_on", "date", "-", "NOT NULL, CHECK >= starts_on, <= 180 days"),
        ("purpose", "text", "-", "NOT NULL, CHECK length >= 10"), ("transport_type", "varchar(20)", "-", "NOT NULL, CHECK allowed values"),
        ("funding_source", "varchar(160)", "-", "NOT NULL"), ("status", "varchar(24)", "-", "NOT NULL DEFAULT draft, CHECK"),
        ("created_at", "timestamptz", "-", "NOT NULL DEFAULT now"), ("submitted_at", "timestamptz", "-", "NULL; required outside draft"),
        ("updated_at", "timestamptz", "-", "NOT NULL DEFAULT now, trigger")],
    "trip_participants": [
        ("request_id", "bigint", "PK, FK -> trip_requests", "NOT NULL, CASCADE"), ("user_id", "bigint", "PK, FK -> users", "NOT NULL, RESTRICT"),
        ("is_primary", "boolean", "-", "NOT NULL DEFAULT false, partial UNIQUE"), ("added_at", "timestamptz", "-", "NOT NULL DEFAULT now")],
    "expense_estimates": [
        ("id", "bigint identity", "PK", "NOT NULL"), ("request_id", "bigint", "FK -> trip_requests", "NOT NULL, CASCADE"),
        ("category", "varchar(24)", "-", "NOT NULL, CHECK allowed values"), ("description", "varchar(300)", "-", "NULL"),
        ("amount", "numeric(12,2)", "-", "NOT NULL, CHECK >= 0"), ("currency", "char(3)", "-", "NOT NULL DEFAULT RUB, CHECK ISO pattern")],
    "approval_steps": [
        ("id", "bigint identity", "PK", "NOT NULL"), ("request_id", "bigint", "FK -> trip_requests", "NOT NULL, CASCADE"),
        ("step_no", "smallint", "-", "NOT NULL, CHECK > 0, UNIQUE with request"), ("approver_user_id", "bigint", "FK -> users", "NOT NULL, RESTRICT"),
        ("decision", "varchar(16)", "-", "NOT NULL DEFAULT pending, CHECK"), ("decision_comment", "varchar(1000)", "-", "Required for rejection, min 5 chars"),
        ("decided_at", "timestamptz", "-", "NULL only for pending"), ("created_at", "timestamptz", "-", "NOT NULL DEFAULT now")],
    "attachments": [
        ("id", "bigint identity", "PK", "NOT NULL"), ("request_id", "bigint", "FK -> trip_requests", "NOT NULL, CASCADE"),
        ("uploaded_by_user_id", "bigint", "FK -> users", "NOT NULL, RESTRICT"), ("file_name", "varchar(255)", "-", "NOT NULL"),
        ("storage_key", "varchar(500)", "-", "NOT NULL UNIQUE"), ("mime_type", "varchar(120)", "-", "NOT NULL"),
        ("size_bytes", "bigint", "-", "NOT NULL, CHECK 1..10485760"), ("uploaded_at", "timestamptz", "-", "NOT NULL DEFAULT now")],
    "trip_status_history": [
        ("id", "bigint identity", "PK", "NOT NULL"), ("request_id", "bigint", "FK -> trip_requests", "NOT NULL, CASCADE"),
        ("from_status", "varchar(24)", "-", "NULL for first event, CHECK"), ("to_status", "varchar(24)", "-", "NOT NULL, CHECK"),
        ("changed_by_user_id", "bigint", "FK -> users", "NOT NULL, RESTRICT"), ("changed_at", "timestamptz", "-", "NOT NULL DEFAULT now"),
        ("comment", "varchar(1000)", "-", "NULL")],
}
add_heading(doc, "Физическое описание таблиц", 2)
for name, rows in physical.items():
    add_heading(doc, name, 3)
    add_table(doc, ["Поле", "Тип", "Ключ", "Ограничения"], rows, widths=[4.0, 3.2, 4.0, 5.2], font_size=8.0)

add_heading(doc, "Нормализация", 2)
add_bullets(doc, [
    "Первая нормальная форма соблюдена: поля атомарны, повторяющиеся участники, роли, расходы и шаги вынесены в отдельные строки.",
    "Вторая нормальная форма соблюдена: в связующих таблицах неключевые поля зависят от полного составного ключа.",
    "Третья нормальная форма соблюдена: названия ролей и подразделений хранятся один раз; итог расходов не хранится в заявке; кадровые сведения отделены от учетной записи.",
    "Осознанная денормализация отсутствует. Поле status в trip_requests хранится вместе с полной историей ради быстрого списка заявок; его изменение и запись истории должны выполняться одной транзакцией.",
])

add_heading(doc, "Индексы", 2)
add_table(doc, ["Индекс", "Назначение"], [
    ("ux_users_email_ci", "Регистронезависимая уникальность email и быстрый поиск при входе."),
    ("ix_trip_requests_department_status", "Рабочие списки руководителя и координатора."),
    ("ix_trip_requests_dates", "Фильтр поездок по диапазону дат."),
    ("ix_trip_participants_user", "Список поездок конкретного участника."),
    ("ix_approval_pending_by_user", "Очередь незавершенных задач согласующего; частичный индекс не хранит завершенные шаги."),
    ("ix_status_history_request_time", "Хронология заявки без дополнительной сортировки полного набора."),
    ("ux_trip_one_primary_participant", "Гарантия не более одного основного участника на заявку."),
], widths=[6.0, 10.4], font_size=8.7)
add_body(doc, "Индексы не добавлены на каждый внешний ключ автоматически. Они выбраны для конкретных списков и соединений MVP; после появления реальных объемов план выполнения следует проверить через EXPLAIN ANALYZE.")

add_heading(doc, "Права доступа", 2)
add_table(doc, ["Уровень", "Разрешения", "Принцип"], [
    ("Владелец миграций", "DDL в схеме trip_mgmt", "Не используется приложением во время работы."),
    ("trip_app", "SELECT INSERT UPDATE DELETE; доступ к sequence", "NOLOGIN групповая роль для runtime-пользователя."),
    ("trip_auditor", "SELECT", "Только чтение для проверки и отчетности."),
    ("Пользователь приложения", "Операции через API", "Бизнес-права проверяются Express по роли и принадлежности заявки."),
], widths=[4.0, 5.7, 6.7], font_size=8.6)
add_body(doc, "DDL не выдает приложению права CREATE, ALTER или DROP. Секреты ролей входа создаются вне миграции. В production рекомендуется дополнить модель Row Level Security после согласования матрицы доступа и способа передачи user_id в сессию PostgreSQL.")

add_heading(doc, "SQL-скрипты", 2)
add_table(doc, ["Файл", "Назначение"], [
    ("001_schema.sql", "Схема trip_mgmt, 11 таблиц, ограничения, индексы, triggers и представление итогов."),
    ("002_seed.sql", "Демонстрационные роли, пользователи, подразделения, заявка, расходы, шаги и история."),
    ("003_verification.sql", "Три типовых выборки и четыре исполняемые проверки ограничений."),
    ("004_access_control.sql", "Групповые роли и минимальные права; запускается владельцем БД."),
], widths=[5.0, 11.4], font_size=8.8)

add_heading(doc, "Результаты проверки", 2)
add_body(doc, "Скрипты выполнены последовательно на PostgreSQL-совместимом движке PGlite 0.5.8 с остановкой при ошибке. DDL, seed, verification и access control завершились со статусом PASS.")
add_table(doc, ["Проверка", "Ожидание", "Фактический результат", "Статус"], [
    ("Создание схемы", "Все объекты создаются без ошибки", "001_schema.sql завершен", "PASS"),
    ("Загрузка seed", "1 заявка, 1 участник, 3 расхода, 2 шага", "002_seed.sql завершен", "PASS"),
    ("Очередь руководителя", "1 заявка, шаг 1", "Возвращена заявка в Санкт-Петербург", "PASS"),
    ("Итог расходов", "18000 + 24000 + 4000", "46000.00 RUB", "PASS"),
    ("История", "draft -> submitted -> in_approval", "3 события по времени", "PASS"),
    ("Некорректные даты", "INSERT отклонен", "CHECK violation перехвачен", "PASS"),
    ("Второй основной участник", "INSERT отклонен", "UNIQUE violation перехвачен", "PASS"),
    ("Отклонение без комментария", "INSERT отклонен", "CHECK violation перехвачен", "PASS"),
    ("Права доступа", "Роли и GRANT создаются", "004_access_control.sql завершен", "PASS"),
], widths=[4.4, 4.4, 5.0, 2.6], font_size=8.2)
add_body(doc, "Проверка подтверждает синтаксическую и логическую согласованность учебной схемы. Перед развертыванием на целевом сервере PostgreSQL 15 следует повторить скрипты через psql -v ON_ERROR_STOP=1, поскольку управление login-ролями и расширениями зависит от конкретной платформы.")

page_break(doc)
add_heading(doc, "Приложение А Матрица трассировки требований", 1)
trace_rows = [
    ("FR-01", "users, roles, user_roles", "UC-01", "Вход и проверка роли"),
    ("FR-02", "trip_requests", "UC-01", "Создание и обновление draft"),
    ("FR-03", "trip_participants", "UC-01", "Участник и уникальный основной"),
    ("FR-04", "expense_estimates, view totals", "UC-01 UC-03", "Суммы и итог 46000 RUB"),
    ("FR-05", "trip_requests, approval_steps, history", "UC-01", "CHECK дат и смена статуса"),
    ("FR-06", "approval_steps, history", "UC-02", "Решение руководителя"),
    ("FR-07", "approval_steps, history", "UC-03", "Финансовое решение"),
    ("FR-08", "trip_requests", "UC-04", "Фильтр approved"),
    ("FR-09", "trip_requests indexes", "UC-05", "Список и фильтры"),
    ("FR-10", "approval_steps pending index", "UC-02", "Очередь согласующего"),
    ("FR-11", "attachments", "UC-01 UC-04", "Метаданные и лимит 10 МБ"),
    ("FR-12", "trip_status_history", "UC-05", "Хронология переходов"),
    ("FR-13", "users, user_roles", "Администрирование", "Назначение ролей и is_active"),
    ("FR-14", "trip_requests, history", "Отмена", "Статус cancelled и причина"),
    ("FR-15", "trip_requests, history", "UC-04", "Статус completed"),
]
add_table(doc, ["FR", "Сущности", "Сценарий", "Доказательство проекта"], trace_rows, widths=[1.7, 5.4, 3.0, 6.3], font_size=8.0)

add_heading(doc, "Приложение Б Комплект SQL-скриптов", 1)
add_body(doc, "Исполняемые файлы находятся в каталоге output/sql. Рекомендуемый порядок: 001_schema.sql, 002_seed.sql, 003_verification.sql. Скрипт 004_access_control.sql выполняет владелец базы данных. README.md содержит команды psql и предупреждение о том, что seed предназначен только для демонстрационной базы.")

add_heading(doc, "Итог", 1)
add_body(doc, "Работы 1-4 образуют непротиворечивую основу проекта. Пользователи и MVP связаны с FR и NFR; сценарии определяют ожидаемое поведение; логическая модель раскрывает связи 1:1, 1:N и N:M; физическая схема реализует эти решения в PostgreSQL и проходит набор позитивных и негативных проверок. Следующий шаг - создать репозиторий приложения, подключить миграцию и реализовать первый серверный сценарий FR-02 и FR-05.")

# Footer with page number
for sec in doc.sections:
    footer = sec.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Система оформления служебных поездок   |   ")
    set_font(r, size=8, color="6B7280")
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    p._p.append(fld)

doc.core_properties.title = "Система оформления служебных поездок Практические работы 1-4"
doc.core_properties.subject = "Проектирование требований и PostgreSQL базы данных"
doc.core_properties.author = "Проектная команда"
doc.core_properties.keywords = "PostgreSQL, Next.js, Express, React, служебные поездки"
doc.save(DOCX_PATH)
print(DOCX_PATH)
