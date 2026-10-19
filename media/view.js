const vscode = acquireVsCodeApi();
const viewType = document.body.dataset.view;

// Podpowiedzi w polu ikony, można wpisać dowolną nazwę codicon
const ICONS = [
    'terminal', 'play', 'debug-start', 'debug-restart', 'run-all', 'stop-circle',
    'git-branch', 'git-commit', 'git-merge', 'git-pull-request', 'repo-pull', 'repo-push',
    'sync', 'refresh', 'cloud-upload', 'cloud-download', 'rocket', 'package',
    'beaker', 'bug', 'check', 'tools', 'gear', 'database', 'server', 'trash',
    'folder', 'file-code', 'search', 'zap', 'flame', 'history'
];

// Kolory czytelne na ciemnym i jasnym motywie
const COLORS = [
    '#3794ff', '#52baff', '#4ec9b0', '#89d185', '#cca700', '#d18616',
    '#f14c4c', '#f48771', '#c586c0', '#b180d7', '#cccccc', '#808080'
];

let buttons = [];
let layout = 'icons';
let hasWorkspace = false;
let editingId = null;
let tooltipTimer;
// Rozwinięcia aliasów gita i statusy uruchomień, oba po id przycisku
let aliasHints = {};
let statuses = {};
// Różnica zegarów webview i rozszerzenia (np. przy zdalnym hoście)
let clockOffset = 0;
let tooltipAnchor = null;

const buttonsEl = document.getElementById('buttons');
const formEl = document.getElementById('form');
const tooltipEl = document.getElementById('tooltip');
const nameInput = document.getElementById('name');
const commandInput = document.getElementById('command');
const iconInput = document.getElementById('icon');
const colorInput = document.getElementById('color');
const colorPreview = document.getElementById('colorPreview');
const swatchesEl = document.getElementById('swatches');
const pickerEl = document.getElementById('picker');
const svEl = document.getElementById('sv');
const svThumb = document.getElementById('svThumb');
const hueEl = document.getElementById('hue');
const hueThumb = document.getElementById('hueThumb');
const iconPreview = document.getElementById('iconPreview');
const errorEl = document.getElementById('error');
const saveBtn = document.getElementById('save');
const workspaceOnlyInput = document.getElementById('workspaceOnly');
const scopeHint = document.getElementById('scopeHint');
const advancedEl = document.getElementById('advanced');
const terminalInput = document.getElementById('terminal');
const insertSelect = document.getElementById('insertVariable');
const questionsField = document.getElementById('questionsField');
const questionsEl = document.getElementById('questions');

// Ustawienia pytań dla ${input:…} w edytowanej komendzie: id -> { list, options, default }
let questionDefs = {};

ICONS.forEach(icon => {
    const option = document.createElement('option');
    option.value = icon;
    document.getElementById('iconList').append(option);
});

COLORS.forEach(color => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.dataset.color = color;
    swatch.title = color;
    swatch.setAttribute('aria-label', color);
    swatch.style.backgroundColor = color;
    swatch.addEventListener('click', () => setColor(color));
    swatchesEl.append(swatch);
});

// Ostatnie pole palety rozwija własny picker
const customSwatch = document.createElement('button');
customSwatch.type = 'button';
customSwatch.className = 'swatch custom';
customSwatch.title = 'Custom color';
customSwatch.setAttribute('aria-label', 'Custom color');
customSwatch.setAttribute('aria-expanded', 'false');
customSwatch.addEventListener('click', () => {
    const show = pickerEl.hidden;
    pickerEl.hidden = !show;
    customSwatch.setAttribute('aria-expanded', String(show));
});
swatchesEl.append(customSwatch);

let hsv = { h: 210, s: 0.8, v: 1 };

function hsvToHex(h, s, v) {
    const f = (n) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return '#' + [f(5), f(3), f(1)]
        .map(x => Math.round(x * 255).toString(16).padStart(2, '0'))
        .join('');
}

function hexToHsv(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    let h = 0;
    if (d) {
        if (max === r) {
            h = ((g - b) / d + 6) % 6;
        } else if (max === g) {
            h = (b - r) / d + 2;
        } else {
            h = (r - g) / d + 4;
        }
        h *= 60;
    }
    return { h: h, s: max ? d / max : 0, v: max };
}

function updatePicker() {
    svEl.style.backgroundColor = 'hsl(' + hsv.h + ', 100%, 50%)';
    svThumb.style.left = hsv.s * 100 + '%';
    svThumb.style.top = (1 - hsv.v) * 100 + '%';
    hueThumb.style.top = hsv.h / 360 * 100 + '%';
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

// Przeciąganie myszą po polu / pasku z przechwyceniem wskaźnika
function trackPointer(el, onMove) {
    el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        onMove(e);
    });
    el.addEventListener('pointermove', (e) => {
        if (el.hasPointerCapture(e.pointerId)) {
            onMove(e);
        }
    });
}

trackPointer(svEl, (e) => {
    const r = svEl.getBoundingClientRect();
    hsv.s = clamp01((e.clientX - r.left) / r.width);
    hsv.v = 1 - clamp01((e.clientY - r.top) / r.height);
    setColor(hsvToHex(hsv.h, hsv.s, hsv.v), true);
});

trackPointer(hueEl, (e) => {
    const r = hueEl.getBoundingClientRect();
    hsv.h = Math.min(359.9, clamp01((e.clientY - r.top) / r.height) * 360);
    setColor(hsvToHex(hsv.h, hsv.s, hsv.v), true);
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'buttonsUpdate':
            buttons = message.buttons;
            layout = message.layout === 'list' ? 'list' : 'icons';
            hasWorkspace = !!message.hasWorkspace;
            renderLegacyNotice(message.legacyCount || 0);
            aliasHints = message.aliasHints || {};
            statuses = message.statuses || {};
            clockOffset = Date.now() - message.now;
            render();
            break;
        case 'statusUpdate':
            statuses = message.statuses || {};
            clockOffset = Date.now() - message.now;
            applyStatuses();
            break;
        case 'editButton':
            openForm(buttons.find(b => b.id === message.buttonId));
            break;
    }
});

function isIconName(value) {
    return /^[a-z0-9-]+$/.test(value);
}

function getInitials(name) {
    const words = name.split(' ').filter(Boolean);
    const initials = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
    return initials.toUpperCase();
}

// Tylko textContent i style przez DOM - dane z ustawień nie trafiają do HTML
function createIcon(icon, name) {
    const span = document.createElement('span');
    span.className = 'icon';
    if (icon && isIconName(icon)) {
        span.classList.add('codicon', 'codicon-' + icon);
    } else {
        const initials = document.createElement('span');
        initials.className = 'initials';
        initials.textContent = getInitials(name);
        span.append(initials);
    }
    return span;
}

function createText(className, text) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
}

function render() {
    hideTooltip();
    buttonsEl.className = 'buttons ' + layout;
    buttonsEl.replaceChildren();

    // Nagłówki grup tylko, gdy są przyciski i z tego workspace, i globalne
    const grouped = buttons.some(b => b.scope === 'workspace') && buttons.some(b => b.scope !== 'workspace');
    let currentScope = null;

    buttons.forEach(button => {
        if (grouped && button.scope !== currentScope) {
            currentScope = button.scope;
            buttonsEl.append(createGroupLabel(currentScope));
        }

        // div zamiast <button>, bo w wierszu listy są zagnieżdżone akcje edit / delete
        const el = document.createElement('div');
        el.className = 'cmd';
        el.tabIndex = 0;
        el.dataset.id = button.id;
        el.setAttribute('role', 'button');
        el.style.setProperty('--btn-color', button.color || '');
        // aria-label i menu prawego kliknięcia (data-vscode-context) ustawia applyStatuses

        const grip = document.createElement('span');
        grip.className = 'grip codicon codicon-gripper';
        grip.setAttribute('aria-hidden', 'true');

        const text = document.createElement('span');
        text.className = 'text';
        text.append(
            createText('label', button.name),
            createText('command', button.command)
        );

        // Kropka statusu ostatniego uruchomienia, uzupełniana w applyStatuses
        const status = document.createElement('span');
        status.className = 'status';
        status.hidden = true;
        status.setAttribute('aria-hidden', 'true');

        el.append(
            grip,
            createIcon(button.icon, button.name),
            text,
            status,
            createRowActions(button)
        );
        el.addEventListener('click', () => runButton(button));
        el.addEventListener('keydown', (e) => {
            if (e.target !== el) {
                return;
            }
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowLeft')) {
                e.preventDefault();
                moveBy(button.id, -1);
            } else if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) {
                e.preventDefault();
                moveBy(button.id, 1);
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                runButton(button);
            }
        });
        attachTooltip(el, button.name, button.command, button);
        attachDrag(el, button);
        buttonsEl.append(el);
    });
    applyStatuses();

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'cmd add';
    add.setAttribute('aria-label', 'Add button');
    const addIcon = document.createElement('span');
    addIcon.className = 'icon codicon codicon-add';
    add.append(addIcon, createText('label', 'Add button'));
    add.addEventListener('click', () => openForm());
    attachTooltip(add, 'Add button');
    buttonsEl.append(add);
}

// Belka o przyciskach z .vscode/settings.json, dopóki ich nie przeniesiesz albo nie wybierzesz "Keep"
const legacyNotice = document.getElementById('legacyNotice');
const legacyText = document.getElementById('legacyText');

function renderLegacyNotice(count) {
    legacyNotice.hidden = count === 0;
    legacyText.textContent = count === 1
        ? "1 button is saved in this project's .vscode/settings.json and can end up in commits."
        : count + " buttons are saved in this project's .vscode/settings.json and can end up in commits.";
}

document.getElementById('legacyMove').addEventListener('click', () => {
    vscode.postMessage({ type: 'migrateLegacy' });
});

document.getElementById('legacyKeep').addEventListener('click', () => {
    vscode.postMessage({ type: 'dismissLegacy' });
});

// W liście nagłówek grupy, w ikonach pionowa kreska z opisem w dymku
function createGroupLabel(scope) {
    const label = scope === 'workspace' ? 'This workspace' : 'All workspaces';
    const el = document.createElement('div');
    el.className = 'group-label';
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-label', label);
    el.title = label;
    el.append(createText('group-text', label));
    return el;
}

function runButton(button) {
    hideTooltip();
    vscode.postMessage({ type: 'runButton', buttonId: button.id });
}

// Akcje widoczne po najechaniu na wiersz w trybie listy; stop / restart tylko gdy komenda działa
function createRowActions(button) {
    const wrap = document.createElement('span');
    wrap.className = 'row-actions';
    [
        ['debug-stop', 'Stop', 'when-running', () => vscode.postMessage({ type: 'stopButton', buttonId: button.id })],
        ['debug-restart', 'Restart', 'when-running', () => vscode.postMessage({ type: 'restartButton', buttonId: button.id })],
        ['edit', 'Edit', '', () => openForm(button)],
        ['trash', 'Delete', '', () => vscode.postMessage({ type: 'deleteButton', buttonId: button.id })]
    ].forEach(([icon, label, extraClass, action]) => {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'icon-action codicon codicon-' + icon + (extraClass ? ' ' + extraClass : '');
        actionBtn.title = label;
        actionBtn.setAttribute('aria-label', label + ' ' + button.name);
        actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            action();
        });
        wrap.append(actionBtn);
    });
    return wrap;
}

// Zmiana kolejności przeciąganiem: w liście góra / dół wiersza, w ikonach lewa / prawa
let dragId = null;

function isAfter(el, e) {
    const r = el.getBoundingClientRect();
    return layout === 'list' ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
}

function clearDropMarkers() {
    buttonsEl.querySelectorAll('.drop-before, .drop-after').forEach(el => {
        el.classList.remove('drop-before', 'drop-after');
    });
}

function attachDrag(el, button) {
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
        dragId = button.id;
        hideTooltip();
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', button.id);
    });
    el.addEventListener('dragend', () => {
        dragId = null;
        el.classList.remove('dragging');
        clearDropMarkers();
    });
    el.addEventListener('dragover', (e) => {
        const dragged = dragId && buttons.find(b => b.id === dragId);
        if (!dragged || dragId === button.id || dragged.scope !== button.scope) {
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const after = isAfter(el, e);
        if (!el.classList.contains(after ? 'drop-after' : 'drop-before')) {
            clearDropMarkers();
            el.classList.add(after ? 'drop-after' : 'drop-before');
        }
    });
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromId = dragId;
        clearDropMarkers();
        moveButton(fromId, button.id, isAfter(el, e));
    });
}

function moveButton(fromId, toId, after) {
    if (!fromId || fromId === toId) {
        return;
    }
    const moved = buttons.find(b => b.id === fromId);
    const rest = buttons.filter(b => b.id !== fromId);
    const index = rest.findIndex(b => b.id === toId);
    // Przenoszenie między grupami zmienia zakres - to robi formularz, nie przeciąganie
    if (!moved || index < 0 || rest[index].scope !== moved.scope) {
        return;
    }
    rest.splice(after ? index + 1 : index, 0, moved);
    buttons = rest;
    render();
    vscode.postMessage({ type: 'reorderButtons', ids: buttons.map(b => b.id) });
}

function moveBy(id, delta) {
    const index = buttons.findIndex(b => b.id === id);
    const target = buttons[index + delta];
    if (!target) {
        return;
    }
    moveButton(id, target.id, delta > 0);
    const moved = Array.from(buttonsEl.children).find(c => c.dataset.id === id);
    if (moved) {
        moved.focus();
    }
}

// Status do dymka - te same teksty co formatStatus w src/runStatus.ts
function formatDuration(ms) {
    const seconds = Math.max(0, ms) / 1000;
    if (seconds < 10) {
        return seconds.toFixed(1) + 's';
    }
    if (seconds < 60) {
        return Math.floor(seconds) + 's';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return minutes + 'm ' + String(Math.floor(seconds % 60)).padStart(2, '0') + 's';
    }
    return Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
}

function formatAgo(ms) {
    const seconds = Math.floor(Math.max(0, ms) / 1000);
    if (seconds < 10) {
        return 'just now';
    }
    if (seconds < 60) {
        return seconds + 's ago';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return minutes + ' min ago';
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return hours + ' h ago';
    }
    return Math.floor(hours / 24) + ' d ago';
}

function formatStatus(status) {
    const now = Date.now() - clockOffset;
    if (status.state === 'running') {
        return 'Running… ' + formatDuration(now - status.startedAt);
    }
    const ended = status.endedAt || status.startedAt;
    const ago = formatAgo(now - ended);
    if (status.state === 'unknown') {
        return 'Last run: sent, result unknown · ' + ago;
    }
    const result = status.state === 'success' ? 'succeeded' : 'failed (exit ' + status.exitCode + ')';
    return 'Last run: ' + result + ' · ' + formatDuration(ended - status.startedAt) + ' · ' + ago;
}

const STATUS_LABELS = {
    running: 'running',
    success: 'last run succeeded',
    error: 'last run failed',
    unknown: 'last run result unknown'
};

// Kropki statusu bez przebudowy przycisków
function applyStatuses() {
    buttonsEl.querySelectorAll('.cmd[data-id]').forEach(el => {
        const button = buttons.find(b => b.id === el.dataset.id);
        const dot = el.querySelector('.status');
        if (!button || !dot) {
            return;
        }
        const status = statuses[button.id];
        const running = !!status && status.state === 'running';
        dot.hidden = !status;
        dot.className = 'status' + (status ? ' status-' + status.state : '');
        el.classList.toggle('running', running);
        el.setAttribute('aria-label', button.name + ': ' + button.command +
            (status ? ', ' + STATUS_LABELS[status.state] : ''));
        // Prawy klik: Run / Edit / Delete, a gdy komenda działa także Stop / Restart
        el.dataset.vscodeContext = JSON.stringify({
            webviewSection: 'terminalCommandButtons.button',
            buttonId: button.id,
            viewType: viewType,
            running: running,
            preventDefaultContextMenuItems: true
        });
    });
    if (tooltipAnchor) {
        tooltipAnchor.refresh();
    }
}

// Dymek z komendą, rozwinięciem aliasu i statusem w obu układach
function attachTooltip(el, name, command, button) {
    const show = () => {
        clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => showTooltip(el, name, command, button), 200);
    };
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('blur', hideTooltip);
}

function showTooltip(anchor, name, command, button) {
    const alias = button && aliasHints[button.id];
    const status = button && statuses[button.id];
    // W liście nazwa i komenda są w wierszu - sam "Add button" nie potrzebuje dymka
    if (layout !== 'icons' && !command) {
        hideTooltip();
        return;
    }

    tooltipEl.replaceChildren(createText('tooltip-name', name));
    if (command) {
        tooltipEl.append(createText('tooltip-command', command));
    }
    if (alias) {
        tooltipEl.append(createText('tooltip-alias', alias));
    }
    const where = button ? [
        button.legacy ? 'Saved in .vscode/settings.json'
            : button.scope === 'workspace' ? 'This workspace only' : '',
        button.terminal ? 'Terminal: ' + button.terminal : ''
    ].filter(Boolean).join(' · ') : '';
    if (where) {
        tooltipEl.append(createText('tooltip-meta', where));
    }
    if (status) {
        tooltipEl.append(createText('tooltip-status status-' + status.state, formatStatus(status)));
    }
    if (command) {
        const hint = status && status.state === 'running'
            ? 'Right-click to stop or restart'
            : 'Click to run · Right-click to edit · Drag to reorder';
        tooltipEl.append(createText('tooltip-hint', hint));
    }
    tooltipEl.style.display = 'block';

    // Odświeżanie przy zmianie statusu i co sekundę, gdy komenda trwa
    clearTimeout(tooltipTimer);
    tooltipAnchor = { refresh: () => showTooltip(anchor, name, command, button) };
    if (status && status.state === 'running') {
        tooltipTimer = setTimeout(tooltipAnchor.refresh, 1000);
    }

    const a = anchor.getBoundingClientRect();
    const t = tooltipEl.getBoundingClientRect();
    let top = a.bottom + 6;
    if (top + t.height > window.innerHeight - 4) {
        top = Math.max(4, a.top - t.height - 6);
    }
    let left = a.left + a.width / 2 - t.width / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - t.width - 4));

    tooltipEl.style.top = top + 'px';
    tooltipEl.style.left = left + 'px';
}

function hideTooltip() {
    clearTimeout(tooltipTimer);
    tooltipAnchor = null;
    tooltipEl.style.display = 'none';
}

function updateIconPreview() {
    const icon = iconInput.value.trim();
    iconPreview.className = isIconName(icon) ? 'codicon codicon-' + icon : '';
}

function isHexColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(value);
}

function updateColorPreview() {
    const color = colorInput.value.trim().toLowerCase();
    colorPreview.style.backgroundColor = isHexColor(color) ? color : 'transparent';
    swatchesEl.querySelectorAll('.swatch').forEach(swatch => {
        // Pole "custom" zaznaczone, gdy kolor spoza palety
        const pressed = swatch.dataset.color
            ? swatch.dataset.color === color
            : isHexColor(color) && !COLORS.includes(color);
        swatch.setAttribute('aria-pressed', String(pressed));
    });
}

// fromPicker: kolor z pickera - nie przeliczaj HSV z hex, żeby nie gubić odcienia przy szarościach
function setColor(color, fromPicker) {
    colorInput.value = color;
    updateColorPreview();
    if (!fromPicker && isHexColor(color)) {
        hsv = hexToHsv(color.toLowerCase());
    }
    updatePicker();
}

function openForm(button) {
    hideTooltip();
    editingId = button ? button.id : null;
    nameInput.value = button ? button.name : '';
    commandInput.value = button ? button.command : '';
    iconInput.value = button && button.icon ? button.icon : '';
    // Bez otwartego folderu checkbox zostaje widoczny, ale wyłączony - z wyjaśnieniem
    workspaceOnlyInput.disabled = !hasWorkspace;
    workspaceOnlyInput.checked = hasWorkspace && !!button && button.scope === 'workspace';
    scopeHint.textContent = hasWorkspace
        ? "Saved inside VS Code, not in the project's files."
        : 'Open a folder to keep a button for one workspace only.';
    terminalInput.value = button && button.terminal ? button.terminal : '';
    // Advanced rozwinięte, gdy przycisk już coś w nim ma
    advancedEl.open = !!terminalInput.value;
    questionDefs = {};
    (button && button.inputs || []).forEach(input => {
        questionDefs[input.id] = {
            list: input.type === 'pickString',
            options: (input.options || []).join(', '),
            default: input.default || '',
            description: input.description,
            password: input.password
        };
    });
    renderQuestions();
    setColor(button && isHexColor(button.color) ? button.color.toLowerCase() : COLORS[0]);
    pickerEl.hidden = true;
    customSwatch.setAttribute('aria-expanded', 'false');
    saveBtn.textContent = button ? 'Save' : 'Add';
    errorEl.textContent = '';
    updateIconPreview();
    document.body.classList.add('editing');
    nameInput.focus();
}

// Id pytań w kolejności wystąpienia, bez powtórzeń
function inputIds(command) {
    const ids = [];
    for (const match of command.matchAll(/\$\{input:([\w-]+)\}/g)) {
        if (!ids.includes(match[1])) {
            ids.push(match[1]);
        }
    }
    return ids;
}

function splitOptions(text) {
    return (text || '').split(',').map(o => o.trim()).filter(Boolean);
}

// Wiersz na każde ${input:…} z komendy: Text albo List z opcjami, plus wartość domyślna
function renderQuestions() {
    const ids = inputIds(commandInput.value);
    questionsField.hidden = ids.length === 0;
    questionsEl.replaceChildren();

    ids.forEach(id => {
        const def = questionDefs[id] || (questionDefs[id] = { list: false, options: '', default: '' });
        const row = document.createElement('div');
        row.className = 'question';

        const name = createText('question-name', id);

        const type = document.createElement('select');
        type.setAttribute('aria-label', 'Answer type for ' + id);
        [['text', 'Text'], ['list', 'List']].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            type.append(option);
        });
        type.value = def.list ? 'list' : 'text';

        const options = document.createElement('input');
        options.className = 'question-options';
        options.placeholder = 'main, develop';
        options.setAttribute('aria-label', 'Options for ' + id + ', separated by commas');
        options.autocomplete = 'off';
        options.spellcheck = false;
        options.value = def.options;
        options.hidden = !def.list;

        const defaultValue = document.createElement('input');
        defaultValue.className = 'question-default';
        defaultValue.placeholder = 'Default (optional)';
        defaultValue.setAttribute('aria-label', 'Default answer for ' + id);
        defaultValue.autocomplete = 'off';
        defaultValue.spellcheck = false;
        defaultValue.value = def.default;

        type.addEventListener('change', () => {
            def.list = type.value === 'list';
            options.hidden = !def.list;
            if (def.list) {
                options.focus();
            }
        });
        options.addEventListener('input', () => {
            def.options = options.value;
        });
        defaultValue.addEventListener('input', () => {
            def.default = defaultValue.value;
        });

        row.append(name, type, options, defaultValue);
        questionsEl.append(row);
    });
}

// Wstawienie zmiennej w miejscu kursora; przy pytaniu zaznaczamy nazwę do nadpisania
function insertVariable(kind) {
    const value = commandInput.value;
    const start = commandInput.selectionStart ?? value.length;
    const end = commandInput.selectionEnd ?? value.length;
    let token;
    let selectFrom;
    let selectTo;

    if (kind === 'input') {
        const used = inputIds(value);
        let name = 'value';
        for (let i = 2; used.includes(name); i++) {
            name = 'value' + i;
        }
        token = '${input:' + name + '}';
        selectFrom = start + '${input:'.length;
        selectTo = selectFrom + name.length;
    } else {
        token = '${' + kind + '}';
        selectFrom = selectTo = start + token.length;
    }

    commandInput.value = value.slice(0, start) + token + value.slice(end);
    commandInput.focus();
    commandInput.setSelectionRange(selectFrom, selectTo);
    renderQuestions();
}

insertSelect.addEventListener('change', () => {
    if (insertSelect.value) {
        insertVariable(insertSelect.value);
    }
    insertSelect.value = '';
});

commandInput.addEventListener('input', renderQuestions);

function closeForm() {
    editingId = null;
    document.body.classList.remove('editing');
}

formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const command = commandInput.value.trim();
    const icon = iconInput.value.trim();
    const color = colorInput.value.trim().toLowerCase();

    if (!name || !command) {
        errorEl.textContent = 'Name and command are required.';
        return;
    }
    if (icon && !isIconName(icon)) {
        errorEl.textContent = 'Icon must be a codicon name, e.g. git-branch.';
        return;
    }
    if (!isHexColor(color)) {
        errorEl.textContent = 'Color must be a hex value, e.g. #3794ff.';
        return;
    }

    const inputs = [];
    for (const id of inputIds(command)) {
        const def = questionDefs[id] || {};
        const options = splitOptions(def.options);
        if (def.list && options.length === 0) {
            errorEl.textContent = 'Add options for "' + id + '", separated by commas.';
            return;
        }
        const input = { id: id };
        if (def.list) {
            input.type = 'pickString';
            input.options = options;
        }
        if (def.default) {
            input.default = def.default;
        }
        // Pola ustawione ręcznie w settings.json zostają
        if (def.description) {
            input.description = def.description;
        }
        if (def.password) {
            input.password = true;
        }
        if (Object.keys(input).length > 1) {
            inputs.push(input);
        }
    }

    vscode.postMessage({
        type: 'saveButton',
        button: {
            id: editingId,
            name: name,
            command: command,
            color: color,
            icon: icon,
            scope: hasWorkspace && workspaceOnlyInput.checked ? 'workspace' : 'global',
            terminal: terminalInput.value.trim(),
            inputs: inputs
        }
    });
    closeForm();
});

document.getElementById('cancel').addEventListener('click', closeForm);
iconInput.addEventListener('input', updateIconPreview);
colorInput.addEventListener('input', () => {
    const color = colorInput.value.trim().toLowerCase();
    updateColorPreview();
    if (isHexColor(color)) {
        hsv = hexToHsv(color);
        updatePicker();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('editing')) {
        closeForm();
    }
});

window.addEventListener('scroll', hideTooltip, true);

// Request initial buttons
vscode.postMessage({ type: 'getButtons' });
