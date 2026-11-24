export const APP_NAME = 'Kanji Study';
export const APP_VERSION = '2026.11.24-3';
export const DATA_URL = 'data/kanji.json';
export const SERVICE_WORKER_URL = 'sw.js';
export const LEVELS = ['N5', 'N4', 'N3', 'N2'];
export const LOG_PREFIX = '[kanji-study]';

export const STORAGE_KEY = 'kanjiStudy.v1';
export const ACTIVE_USER_KEY = 'kanjiStudy.activeUser';
export const STORE_VERSION = 1;
export const BACKUP_FILE_PREFIX = 'kanji-study-progress';

// Cloud accounts (Firebase). The project's own values live in firebase-config.js.
export const FIREBASE_SDK_URL = 'https://www.gstatic.com/firebasejs/13.2.0';
export const USERS_COLLECTION = 'users';
export const SYNC_DEBOUNCE_MS = 2500;
export const MIN_PASSWORD_LENGTH = 6;

// Hours until the next review for each SRS stage (index = stage).
export const SRS_INTERVALS_HOURS = [0, 4, 24, 72, 168, 336, 720, 1440, 2880];
export const MAX_STAGE = 8;
export const KNOWN_STAGE = 5;
export const STAGE_GROUPS = [
  { id: 'learning', label: 'Learning', min: 1, max: 2 },
  { id: 'familiar', label: 'Familiar', min: 3, max: 4 },
  { id: 'strong', label: 'Strong', min: 5, max: 6 },
  { id: 'mastered', label: 'Mastered', min: 7, max: 8 },
];
export const NEW_GROUP = { id: 'new', label: 'Not started' };

export const QUESTION_TYPES = [
  { id: 'meaning', label: 'Kanji to meaning' },
  { id: 'kanji', label: 'Meaning to kanji' },
  { id: 'reading', label: 'Kanji to reading' },
  { id: 'word', label: 'Word reading' },
];
export const CHOICES_PER_QUESTION = 4;
export const QUIZ_SIZES = [10, 20, 40];
export const DEFAULT_QUIZ_SIZE = 20;
export const AUTO_ADVANCE_MS = 750;
export const SWIPE_MIN_PX = 60;
export const REVIEW_BATCH_LIMIT = 50;
export const REVIEW_MODES = [
  { id: 'quiz', label: 'Multiple choice', hint: 'Answer a meaning and a reading question for each kanji.' },
  { id: 'cards', label: 'Flashcards', hint: 'Recall it yourself, then grade how well you knew it.' },
];

export const FORECAST_DAYS = 7;
export const FAMILY_MIN_MEMBERS = 3;
export const FAMILY_INDEX_LIMIT = 96;
export const SEARCH_LIMIT = 60;
export const WEAK_LIST_LIMIT = 12;
export const HOME_PREVIEW_LIMIT = 10;
export const THEMES = [
  { id: 'auto', label: 'Match device' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];
