/* ============================================================
   Productivity Dashboard — js/app.js
   Single-file application module. No frameworks, no build step.
   Open index.html directly in a modern browser.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   StorageService
   Thin localStorage wrapper with structured error handling.
   Requirements: 6.1, 6.3
   ------------------------------------------------------------ */
const StorageService = (() => {
  /**
   * Returns true if localStorage is accessible and functional.
   * @returns {boolean}
   */
  function isAvailable() {
    try {
      const probe = '__pd_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieves and JSON-parses the value stored under `key`.
   * Returns null if the key is missing or the value cannot be parsed.
   * @param {string} key
   * @returns {any|null}
   */
  function get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * JSON-stringifies `value` and writes it under `key`.
   * Returns true on success, false if localStorage is unavailable or quota exceeded.
   * @param {string} key
   * @param {any} value
   * @returns {boolean}
   */
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  return { isAvailable, get, set };
})();

/* ============================================================
   localStorage key constants
   ============================================================ */
const KEYS = Object.freeze({
  NAME:     'pd_name',
  THEME:    'pd_theme',
  TASKS:    'pd_tasks',
  LINKS:    'pd_links',
  DURATION: 'pd_pomodoro_duration',
});

/* ------------------------------------------------------------
   ThemeManager
   Manages light/dark theme preference.
   Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   ------------------------------------------------------------ */
const ThemeManager = (() => {
  const VALID_THEMES = ['light', 'dark'];
  const ICON_MAP = { light: '🌙', dark: '☀️' };

  /**
   * Applies `theme` to the <html> element and persists it to storage.
   * Ignores unrecognised values.
   * @param {"light"|"dark"} theme
   */
  function apply(theme) {
    if (!VALID_THEMES.includes(theme)) return;
    document.documentElement.setAttribute('data-theme', theme);
    StorageService.set(KEYS.THEME, theme);

    // Update the toggle button icon to reflect the opposite choice
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const icon = btn.querySelector('.theme-icon');
      if (icon) icon.textContent = ICON_MAP[theme];
    }
  }

  /**
   * Reads the current theme from the <html> attribute, flips it, and applies.
   */
  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    apply(next);
  }

  /**
   * Reads the saved theme from storage (falls back to "light"), applies it,
   * and wires the theme-toggle button click handler.
   */
  function init() {
    const saved = StorageService.get(KEYS.THEME);
    const theme = VALID_THEMES.includes(saved) ? saved : 'light';
    apply(theme);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  }

  return { init, toggle, apply };
})();

/* ------------------------------------------------------------
   GreetingWidget
   Displays personalised greeting, current time, and date.
   Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9
   ------------------------------------------------------------ */
const GreetingWidget = (() => {
  // In-memory name; kept in sync with storage
  let _name = '';

  /**
   * Returns the greeting phrase for a given hour (0–23).
   * @param {number} hour
   * @returns {string}
   */
  function _greetingForHour(hour) {
    if (hour >= 5  && hour <= 11) return 'Good Morning';
    if (hour >= 12 && hour <= 16) return 'Good Afternoon';
    if (hour >= 17 && hour <= 20) return 'Good Evening';
    return 'Good Night'; // 21–23 and 0–4
  }

  /**
   * Pads a number to two digits.
   * @param {number} n
   * @returns {string}
   */
  function _pad(n) {
    return String(n).padStart(2, '0');
  }

  /**
   * Derives greeting text from the current hour and the stored name,
   * then updates all greeting DOM elements.
   */
  function renderGreeting() {
    const now = new Date();
    const hour = now.getHours();

    // Time: HH:MM
    const timeStr = `${_pad(hour)}:${_pad(now.getMinutes())}`;

    // Date: e.g. "Monday, 16 November 2026"
    const dateStr = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Greeting phrase + optional name
    const phrase = _greetingForHour(hour);
    const greetingText = _name ? `${phrase}, ${_name}!` : `${phrase}!`;

    // Update DOM
    const timeEl = document.getElementById('greeting-time');
    const dateEl = document.getElementById('greeting-date');
    const textEl = document.getElementById('greeting-text');

    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
    if (textEl) textEl.textContent = greetingText;
  }

  /**
   * Saves a custom name to storage and re-renders.
   * Empty string clears the stored name (Req 1.9).
   * @param {string} name
   */
  function setName(name) {
    const trimmed = name.trim();
    _name = trimmed;
    StorageService.set(KEYS.NAME, trimmed);
    renderGreeting();
  }

  /**
   * Reads persisted name, renders initial greeting, starts the 60-second
   * interval, and wires the name save button.
   */
  function init() {
    // Restore name from storage (Req 1.8)
    const saved = StorageService.get(KEYS.NAME);
    _name = (typeof saved === 'string') ? saved : '';

    // Initial render
    renderGreeting();

    // Tick every 60 seconds (Req 1.1)
    setInterval(renderGreeting, 60_000);

    // Wire name-save button (Req 1.8, 1.9)
    const saveBtn = document.getElementById('greeting-name-save');
    const nameInput = document.getElementById('greeting-name-input');

    if (saveBtn && nameInput) {
      // Pre-fill the input with any saved name
      nameInput.value = _name;

      saveBtn.addEventListener('click', () => {
        setName(nameInput.value);
      });

      // Allow pressing Enter in the name field to save
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          setName(nameInput.value);
        }
      });
    }
  }

  return { init, setName, renderGreeting };
})();

/* ------------------------------------------------------------
   FocusTimer
   Pomodoro countdown timer with idle/running/paused state machine.
   Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9
   ------------------------------------------------------------ */
const FocusTimer = (() => {
  // State machine: 'idle' | 'running' | 'paused'
  let _state = 'idle';

  // Duration in minutes (1–60), default 25
  let _durationMinutes = 25;

  // Remaining time in seconds
  let _remainingSeconds = 25 * 60;

  // setInterval handle
  let _intervalId = null;

  /**
   * Pads a number to two digits.
   * @param {number} n
   * @returns {string}
   */
  function _pad(n) {
    return String(n).padStart(2, '0');
  }

  /**
   * Formats a total number of seconds as "MM:SS".
   * @param {number} totalSeconds
   * @returns {string}
   */
  function _formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${_pad(m)}:${_pad(s)}`;
  }

  /**
   * Updates the timer display element with the current remaining time.
   */
  function _updateDisplay() {
    const el = document.getElementById('timer-time');
    if (el) el.textContent = _formatTime(_remainingSeconds);
  }

  /**
   * Hides the session-complete notification banner.
   */
  function _hideNotification() {
    const notif = document.getElementById('timer-notification');
    if (notif) notif.hidden = true;
  }

  /**
   * Shows the session-complete notification banner (Req 2.5).
   */
  function _showNotification() {
    const notif = document.getElementById('timer-notification');
    if (notif) notif.hidden = false;
  }

  /**
   * Hides the duration error message.
   */
  function _hideDurationError() {
    const err = document.getElementById('timer-duration-error');
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
  }

  /**
   * Shows an inline duration error message (Req 2.9).
   * @param {string} msg
   */
  function _showDurationError(msg) {
    const err = document.getElementById('timer-duration-error');
    if (err) {
      err.textContent = msg;
      err.hidden = false;
    }
  }

  /**
   * Updates the visual state of Start/Stop buttons to reflect _state.
   */
  function _updateButtons() {
    const startBtn = document.getElementById('timer-start');
    const stopBtn  = document.getElementById('timer-stop');

    if (startBtn) {
      // Start button is active when idle or paused
      startBtn.disabled = (_state === 'running');
    }
    if (stopBtn) {
      // Stop button is active only when running
      stopBtn.disabled = (_state !== 'running');
    }
  }

  /**
   * Called on each 1-second tick while running.
   */
  function _tick() {
    _remainingSeconds -= 1;
    _updateDisplay();

    if (_remainingSeconds <= 0) {
      // Countdown complete — auto-stop (Req 2.5)
      _remainingSeconds = 0;
      clearInterval(_intervalId);
      _intervalId = null;
      _state = 'idle';
      _updateButtons();
      _showNotification();
    }
  }

  /**
   * Starts or resumes the countdown.
   * Valid transitions: idle → running, paused → running (Req 2.2)
   */
  function start() {
    if (_state === 'running') return;
    _hideNotification();
    _state = 'running';
    _intervalId = setInterval(_tick, 1000);
    _updateButtons();
  }

  /**
   * Pauses the countdown.
   * Valid transition: running → paused (Req 2.3)
   */
  function stop() {
    if (_state !== 'running') return;
    clearInterval(_intervalId);
    _intervalId = null;
    _state = 'paused';
    _updateButtons();
  }

  /**
   * Stops the countdown and resets display to configured duration.
   * Valid transitions: running → idle, paused → idle (Req 2.4)
   */
  function reset() {
    if (_intervalId !== null) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
    _state = 'idle';
    _remainingSeconds = _durationMinutes * 60;
    _hideNotification();
    _updateDisplay();
    _updateButtons();
  }

  /**
   * Validates and saves a new Pomodoro duration (1–60 minutes).
   * On success: persists to storage, updates _durationMinutes.
   * On failure: shows inline error without changing state (Req 2.8, 2.9)
   * @param {number} minutes
   */
  function setDuration(minutes) {
    const n = Number(minutes);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      _showDurationError('Duration must be a whole number between 1 and 60.');
      return;
    }
    _hideDurationError();
    _durationMinutes = n;
    StorageService.set(KEYS.DURATION, n);

    // If the timer is idle, update the display to reflect the new duration (Req 2.8)
    if (_state === 'idle') {
      _remainingSeconds = _durationMinutes * 60;
      _updateDisplay();
    }
  }

  /**
   * Reads persisted duration, renders initial display, and wires all controls.
   */
  function init() {
    // Restore duration from storage; fall back to 25 (Req 2.1, 2.7)
    const saved = StorageService.get(KEYS.DURATION);
    if (typeof saved === 'number' && saved >= 1 && saved <= 60) {
      _durationMinutes = saved;
    } else {
      _durationMinutes = 25;
    }

    _remainingSeconds = _durationMinutes * 60;
    _state = 'idle';
    _updateDisplay();
    _updateButtons();

    // Pre-fill the duration input with the current duration
    const durationInput = document.getElementById('timer-duration-input');
    if (durationInput) durationInput.value = _durationMinutes;

    // Wire Start button (Req 2.2)
    const startBtn = document.getElementById('timer-start');
    if (startBtn) startBtn.addEventListener('click', start);

    // Wire Stop button (Req 2.3)
    const stopBtn = document.getElementById('timer-stop');
    if (stopBtn) stopBtn.addEventListener('click', stop);

    // Wire Reset button (Req 2.4)
    const resetBtn = document.getElementById('timer-reset');
    if (resetBtn) resetBtn.addEventListener('click', reset);

    // Wire Set duration button (Req 2.8, 2.9)
    const durationSaveBtn = document.getElementById('timer-duration-save');
    if (durationSaveBtn && durationInput) {
      durationSaveBtn.addEventListener('click', () => {
        setDuration(durationInput.value);
      });
      // Allow Enter key in the duration input
      durationInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') setDuration(durationInput.value);
      });
    }
  }

  return { init, start, stop, reset, setDuration };
})();

/* ------------------------------------------------------------
   TodoList
   Full CRUD task manager with inline validation and persistence.
   Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10
   ------------------------------------------------------------ */
const TodoList = (() => {
  // In-memory task array; kept in sync with storage
  /** @type {Array<{id: string, description: string, completed: boolean, createdAt: number}>} */
  let _tasks = [];

  // The task currently being edited (id or null)
  let _editingId = null;

  /**
   * Generates a unique ID for a new task.
   * Uses crypto.randomUUID() when available, falls back to Date.now().
   * @returns {string}
   */
  function _generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Persists the current task list to localStorage.
   */
  function _persist() {
    StorageService.set(KEYS.TASKS, _tasks);
  }

  /**
   * Shows an inline validation error for the add-task form.
   * @param {string} msg
   */
  function _showAddError(msg) {
    const err = document.getElementById('todo-add-error');
    if (err) {
      err.textContent = msg;
      err.hidden = false;
    }
  }

  /**
   * Hides the add-task inline validation error.
   */
  function _hideAddError() {
    const err = document.getElementById('todo-add-error');
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
  }

  /**
   * Updates the pending (incomplete) task count badge.
   */
  function _updateBadge() {
    const badge = document.getElementById('todo-count-badge');
    if (badge) {
      const pending = _tasks.filter(t => !t.completed).length;
      badge.textContent = pending;
    }
  }

  /**
   * Escapes a string for safe insertion as text content.
   * We use textContent rather than innerHTML, so this is a belt-and-suspenders guard.
   * @param {string} str
   * @returns {string}
   */
  function _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Builds and returns a <li> element for a single task.
   * Renders either view mode or edit mode depending on _editingId.
   * @param {{id: string, description: string, completed: boolean, createdAt: number}} task
   * @returns {HTMLLIElement}
   */
  function _buildTaskItem(task) {
    const li = document.createElement('li');
    li.className = `todo-item${task.completed ? ' todo-item--done' : ''}`;
    li.dataset.id = task.id;

    if (_editingId === task.id) {
      // ---- Edit mode ----
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input todo-edit-input';
      input.value = task.description;
      input.maxLength = 200;
      input.setAttribute('aria-label', 'Edit task description');

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-primary btn-sm';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => {
        saveEdit(task.id, input.value);
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary btn-sm';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        _editingId = null;
        renderList();
      });

      // Allow Enter to save, Escape to cancel
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  saveEdit(task.id, input.value);
        if (e.key === 'Escape') { _editingId = null; renderList(); }
      });

      const editError = document.createElement('p');
      editError.className = 'form-error';
      editError.setAttribute('role', 'alert');
      editError.hidden = true;
      editError.id = `todo-edit-error-${task.id}`;

      const editRow = document.createElement('div');
      editRow.className = 'todo-edit-row';
      editRow.appendChild(input);
      editRow.appendChild(saveBtn);
      editRow.appendChild(cancelBtn);

      li.appendChild(editRow);
      li.appendChild(editError);

      // Auto-focus the edit input after render
      requestAnimationFrame(() => input.focus());
    } else {
      // ---- View mode ----
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo-checkbox';
      checkbox.checked = task.completed;
      checkbox.setAttribute('aria-label', `Mark "${_escapeHtml(task.description)}" as ${task.completed ? 'incomplete' : 'complete'}`);
      checkbox.addEventListener('change', () => toggleComplete(task.id));

      const label = document.createElement('span');
      label.className = 'todo-description';
      label.textContent = task.description;

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary btn-sm';
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('aria-label', `Edit task: ${_escapeHtml(task.description)}`);
      editBtn.addEventListener('click', () => beginEdit(task.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', `Delete task: ${_escapeHtml(task.description)}`);
      deleteBtn.addEventListener('click', () => deleteTask(task.id));

      const actions = document.createElement('div');
      actions.className = 'todo-actions';
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      li.appendChild(checkbox);
      li.appendChild(label);
      li.appendChild(actions);
    }

    return li;
  }

  /**
   * Re-renders the full task list from _tasks and updates the badge.
   * Requirements: 3.9, 3.10
   */
  function renderList() {
    const listEl = document.getElementById('todo-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    _tasks.forEach(task => {
      listEl.appendChild(_buildTaskItem(task));
    });

    _updateBadge();
  }

  /**
   * Adds a new task with the given description.
   * Trims the description; rejects empty/whitespace-only with an inline error.
   * Requirements: 3.1, 3.2
   * @param {string} description
   */
  function addTask(description) {
    const trimmed = (typeof description === 'string') ? description.trim() : '';
    if (!trimmed) {
      _showAddError('Task description cannot be empty.');
      return;
    }
    _hideAddError();

    /** @type {{id: string, description: string, completed: boolean, createdAt: number}} */
    const task = {
      id: _generateId(),
      description: trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    _tasks.push(task);
    _persist();
    renderList();
  }

  /**
   * Toggles the completed state of the task identified by `id`.
   * Requirements: 3.3, 3.4
   * @param {string} id
   */
  function toggleComplete(id) {
    const task = _tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    _persist();
    renderList();
  }

  /**
   * Enters edit mode for the task identified by `id`.
   * Requirements: 3.5
   * @param {string} id
   */
  function beginEdit(id) {
    const task = _tasks.find(t => t.id === id);
    if (!task) return;
    _editingId = id;
    renderList();
  }

  /**
   * Saves a new description for the task identified by `id`.
   * Rejects empty/whitespace-only descriptions and retains the original.
   * Requirements: 3.6, 3.7
   * @param {string} id
   * @param {string} newDescription
   */
  function saveEdit(id, newDescription) {
    const task = _tasks.find(t => t.id === id);
    if (!task) return;

    const trimmed = (typeof newDescription === 'string') ? newDescription.trim() : '';
    if (!trimmed) {
      // Show inline error inside the edit row (Req 3.7)
      const errEl = document.getElementById(`todo-edit-error-${id}`);
      if (errEl) {
        errEl.textContent = 'Description cannot be empty.';
        errEl.hidden = false;
      }
      return;
    }

    task.description = trimmed;
    _editingId = null;
    _persist();
    renderList();
  }

  /**
   * Removes the task identified by `id` from the list.
   * Requirements: 3.8
   * @param {string} id
   */
  function deleteTask(id) {
    const idx = _tasks.findIndex(t => t.id === id);
    if (idx === -1) return;

    // If the deleted task was being edited, clear edit state
    if (_editingId === id) _editingId = null;

    _tasks.splice(idx, 1);
    _persist();
    renderList();
  }

  /**
   * Reads persisted tasks from storage, renders the list, and wires the
   * add-task form controls.
   * Requirements: 3.9
   */
  function init() {
    // Restore tasks from storage (Req 3.9)
    const saved = StorageService.get(KEYS.TASKS);
    _tasks = Array.isArray(saved) ? saved : [];

    // Initial render
    renderList();

    // Wire add-task button (Req 3.1, 3.2)
    const addBtn   = document.getElementById('todo-add');
    const addInput = document.getElementById('todo-input');

    if (addBtn && addInput) {
      addBtn.addEventListener('click', () => {
        addTask(addInput.value);
        // Clear the input field on successful add (error guard handled inside addTask)
        const trimmed = addInput.value.trim();
        if (trimmed) addInput.value = '';
      });

      addInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          addTask(addInput.value);
          const trimmed = addInput.value.trim();
          if (trimmed) addInput.value = '';
        }
      });

      // Hide validation error when user starts typing again
      addInput.addEventListener('input', _hideAddError);
    }
  }

  return { init, addTask, toggleComplete, beginEdit, saveEdit, deleteTask, renderList };
})();

/* ------------------------------------------------------------
   QuickLinks
   Quick-access link manager with label/URL validation and persistence.
   Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
   ------------------------------------------------------------ */
const QuickLinks = (() => {
  // In-memory links array; kept in sync with storage
  /** @type {Array<{id: string, label: string, url: string, createdAt: number}>} */
  let _links = [];

  /**
   * Generates a unique ID for a new link.
   * Uses crypto.randomUUID() when available, falls back to Date.now().
   * @returns {string}
   */
  function _generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Persists the current links array to localStorage.
   */
  function _persist() {
    StorageService.set(KEYS.LINKS, _links);
  }

  /**
   * Shows an inline validation error for the add-link form.
   * @param {string} msg
   */
  function _showAddError(msg) {
    const err = document.getElementById('links-add-error');
    if (err) {
      err.textContent = msg;
      err.hidden = false;
    }
  }

  /**
   * Hides the add-link inline validation error.
   */
  function _hideAddError() {
    const err = document.getElementById('links-add-error');
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
  }

  /**
   * Builds and returns a chip element for a single link.
   * Renders an <a target="_blank"> that opens the URL in a new tab,
   * alongside a delete button.
   * @param {{id: string, label: string, url: string, createdAt: number}} link
   * @returns {HTMLDivElement}
   */
  function _buildLinkChip(link) {
    const chip = document.createElement('div');
    chip.className = 'link-chip';
    chip.dataset.id = link.id;

    const anchor = document.createElement('a');
    anchor.href = link.url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = link.label;
    anchor.setAttribute('aria-label', `Open ${link.label} in a new tab`);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = '✕';
    deleteBtn.setAttribute('aria-label', `Delete link: ${link.label}`);
    deleteBtn.addEventListener('click', () => deleteLink(link.id));

    chip.appendChild(anchor);
    chip.appendChild(deleteBtn);

    return chip;
  }

  /**
   * Re-renders the full links list from _links.
   * Requirements: 4.6
   */
  function renderLinks() {
    const listEl = document.getElementById('links-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    _links.forEach(link => {
      listEl.appendChild(_buildLinkChip(link));
    });
  }

  /**
   * Validates and adds a new quick link.
   * Rejects: empty label, empty URL, URL not starting with http:// or https://.
   * Requirements: 4.1, 4.2, 4.3
   * @param {string} label
   * @param {string} url
   */
  function addLink(label, url) {
    const trimmedLabel = (typeof label === 'string') ? label.trim() : '';
    const trimmedUrl   = (typeof url   === 'string') ? url.trim()   : '';

    if (!trimmedLabel) {
      _showAddError('Link label cannot be empty.');
      return;
    }

    if (!trimmedUrl) {
      _showAddError('Link URL cannot be empty.');
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      _showAddError('URL must start with "http://" or "https://".');
      return;
    }

    _hideAddError();

    /** @type {{id: string, label: string, url: string, createdAt: number}} */
    const link = {
      id:        _generateId(),
      label:     trimmedLabel,
      url:       trimmedUrl,
      createdAt: Date.now(),
    };

    _links.push(link);
    _persist();
    renderLinks();
  }

  /**
   * Removes the link identified by `id` from the list.
   * Requirements: 4.5
   * @param {string} id
   */
  function deleteLink(id) {
    const idx = _links.findIndex(l => l.id === id);
    if (idx === -1) return;
    _links.splice(idx, 1);
    _persist();
    renderLinks();
  }

  /**
   * Reads persisted links from storage, renders the list, and wires the
   * add-link form controls.
   * Requirements: 4.6
   */
  function init() {
    // Restore links from storage (Req 4.6)
    const saved = StorageService.get(KEYS.LINKS);
    _links = Array.isArray(saved) ? saved : [];

    // Initial render
    renderLinks();

    // Wire add-link button (Req 4.1, 4.2, 4.3)
    const addBtn    = document.getElementById('links-add');
    const labelInput = document.getElementById('links-label-input');
    const urlInput   = document.getElementById('links-url-input');

    if (addBtn && labelInput && urlInput) {
      addBtn.addEventListener('click', () => {
        const label = labelInput.value;
        const url   = urlInput.value;
        addLink(label, url);
        // Clear inputs only on successful add
        const tLabel = label.trim();
        const tUrl   = url.trim();
        if (
          tLabel &&
          tUrl &&
          (tUrl.startsWith('http://') || tUrl.startsWith('https://'))
        ) {
          labelInput.value = '';
          urlInput.value   = '';
        }
      });

      // Allow Enter key in either field to submit
      const handleEnter = (e) => {
        if (e.key === 'Enter') addBtn.click();
      };
      labelInput.addEventListener('keydown', handleEnter);
      urlInput.addEventListener('keydown', handleEnter);

      // Hide validation error when user starts typing again
      labelInput.addEventListener('input', _hideAddError);
      urlInput.addEventListener('input', _hideAddError);
    }
  }

  return { init, addLink, deleteLink, renderLinks };
})();

/* ------------------------------------------------------------
   App Controller
   Initialises all modules in order on DOMContentLoaded.
   Requirements: 6.1, 6.3, 7.4
   ------------------------------------------------------------ */
const App = (() => {
  function showStorageWarning() {
    const banner = document.getElementById('storage-warning');
    if (banner) banner.hidden = false;
  }

  function init() {
    // 1. Check localStorage availability; warn if unavailable (Req 6.3)
    if (!StorageService.isAvailable()) {
      showStorageWarning();
      // Modules will fall back to their in-memory defaults (each stub handles this)
    }

    // 2. Apply theme before first paint to avoid flash (Req 5.3)
    ThemeManager.init();

    // 3. Greeting widget
    GreetingWidget.init();

    // 4. Focus timer
    FocusTimer.init();

    // 5. To-do list
    TodoList.init();

    // 6. Quick links
    QuickLinks.init();
  }

  return { init };
})();

/* ------------------------------------------------------------
   Bootstrap
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
