// ==================== STATE ====================
let currentUser = null;
let userName = null;
let isReturningUser = false;
let answers = {};
let editAnswers = {};
let visibleQuestions = [];
let editVisibleQuestions = [];
let currentQuestionIndex = 0;
let editQuestionIndex = 0;
let editingDate = null;
let existingDates = new Set();
let countdownInterval = null;
let streakData = { current: 0, best: 0, lastDate: null };

// Unlock time: 4:30 AM
const UNLOCK_HOUR = 4;
const UNLOCK_MINUTE = 30;

// ==================== INIT ====================
let splashComplete = false;

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing...');
    
    // Fallback: if splash is still showing after 5 seconds, force dismiss it
    setTimeout(() => {
        if (!splashComplete) {
            console.log('Fallback: forcing splash dismiss');
            finishSplash();
        }
    }, 5000);
    
    initAuth();
    initTabs();
    initNewSession();
    initHistory();
    
    // Name modal save button with validation
    const saveNameBtn = document.getElementById('save-name-btn');
    if (saveNameBtn) {
        saveNameBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('name-input');
            const nameError = document.getElementById('name-error');
            const name = nameInput.value.trim();
            
            // Validate: must be 1 word, max 15 characters
            const validationResult = validateName(name);
            if (!validationResult.valid) {
                if (nameError) {
                    nameError.textContent = validationResult.message;
                    nameError.classList.remove('hidden');
                }
                return;
            }
            
            // Clear error and save
            if (nameError) nameError.classList.add('hidden');
            await saveUserName(name);
            hideNameModal();
            checkPendingUpdates(); // Refresh pending updates state
        });
    }
    
    // Update button - force refresh
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', forceRefresh);
    }
    
    // Pending updates banner button
    const pendingUpdatesBtn = document.getElementById('pending-updates-btn');
    if (pendingUpdatesBtn) {
        pendingUpdatesBtn.addEventListener('click', handlePendingUpdates);
    }
    
    // Header refresh button
    const refreshBtn = document.getElementById('refresh-app');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            this.classList.add('spinning');
            forceRefresh();
        });
    }
    
    // Edit name button
    const editNameBtn = document.getElementById('edit-name');
    if (editNameBtn) {
        editNameBtn.addEventListener('click', () => {
            // Pre-fill with current name if exists
            const nameInput = document.getElementById('name-input');
            if (nameInput && userName) {
                nameInput.value = userName;
            }
            showNameModal();
        });
    }
});

// ==================== AUTH ====================
// Check if running as standalone PWA (iOS home screen)
function isStandalonePWA() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function initAuth() {
    console.log('Setting up auth, standalone PWA:', isStandalonePWA(), 'iOS:', isIOSDevice());
    
    // Set persistence to LOCAL for iOS PWA support
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
        console.error('Persistence error:', err);
    });
    
    // If iOS PWA, show message that they need to login via Safari first
    if (isStandalonePWA() && isIOSDevice()) {
        const iosPwaWarning = document.createElement('div');
        iosPwaWarning.id = 'ios-pwa-warning';
        iosPwaWarning.style.cssText = 'background:#fff3cd;color:#856404;padding:12px;border-radius:8px;margin-bottom:16px;font-size:14px;text-align:center;';
        iosPwaWarning.innerHTML = `
            <strong>📱 Primeira vez?</strong><br>
            Para fazer login, abra primeiro em Safari:<br>
            <a href="https://tomasbb0.github.io/sleep-diary/" style="color:#0066cc;text-decoration:underline;">tomasbb0.github.io/sleep-diary</a><br>
            <small>Depois de fazer login no Safari, volte aqui.</small>
        `;
        const authCard = document.querySelector('.auth-card');
        if (authCard) {
            authCard.insertBefore(iosPwaWarning, authCard.querySelector('.login-buttons'));
        }
    }
    
    document.getElementById('google-login').addEventListener('click', async () => {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            // Use popup on desktop/Safari, redirect elsewhere
            if (isStandalonePWA() && isIOSDevice()) {
                // In iOS PWA, redirect won't work - just open Safari
                window.location.href = 'https://tomasbb0.github.io/sleep-diary/';
                return;
            }
            await auth.signInWithPopup(provider);
        } catch (error) {
            // Fallback to redirect if popup blocked
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                await auth.signInWithRedirect(provider);
            } else {
                showAuthError(error.message);
            }
        }
    });

    document.getElementById('apple-login').addEventListener('click', async () => {
        try {
            const provider = new firebase.auth.OAuthProvider('apple.com');
            provider.addScope('email');
            provider.addScope('name');
            // Use popup on desktop/Safari, redirect elsewhere
            if (isStandalonePWA() && isIOSDevice()) {
                window.location.href = 'https://tomasbb0.github.io/sleep-diary/';
                return;
            }
            await auth.signInWithPopup(provider);
        } catch (error) {
            if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
                await auth.signInWithRedirect(provider);
            } else {
                showAuthError(error.message);
            }
        }
    });

    document.getElementById('email-login').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        if (!email || !password) { showAuthError('Preencha email e password'); return; }
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            showAuthError(translateError(error.code));
        }
    });

    document.getElementById('email-signup').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        if (!email || !password) { showAuthError('Preencha email e password'); return; }
        if (password.length < 6) { showAuthError('Password mínimo 6 caracteres'); return; }
        try {
            await auth.createUserWithEmailAndPassword(email, password);
        } catch (error) {
            showAuthError(translateError(error.code));
        }
    });

    document.getElementById('logout').addEventListener('click', () => auth.signOut());

    // Handle redirect result for PWA auth - MUST run before onAuthStateChanged
    // This catches the user returning from Google sign-in
    auth.getRedirectResult().then((result) => {
        if (result && result.user) {
            console.log('Redirect auth successful:', result.user.email);
        }
    }).catch((error) => {
        console.error('Redirect auth error:', error.code, error.message);
        if (error.code !== 'auth/popup-closed-by-user') {
            showAuthError('Erro no login: ' + error.message);
        }
    });

    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            await loadUserName();
            
            // Handle splash screen with welcome back if returning user
            if (isReturningUser && userName) {
                showWelcomeBackSplash();
            } else {
                finishSplash();
            }
            
            showScreen('app');
            
            loadExistingDates().then(() => {
                loadStreakData().then(() => checkSessionAvailability());
            });
        } else {
            // Not logged in - finish splash and show auth screen
            finishSplash();
            showScreen('auth');
        }
    });
}


// ==================== USER NAME ====================
async function loadUserName() {
    try {
        // Only use name from Firestore that was manually set by user
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists && doc.data().name && doc.data().nameManuallySet) {
            userName = doc.data().name;
            isReturningUser = true;
        } else {
            // No manually set name - will be handled by pending updates system
            userName = null;
            isReturningUser = false;
        }
        updateGreeting();
        checkPendingUpdates(); // Check if there are pending updates to show banner
    } catch (error) {
        console.error('Error loading user name:', error);
        userName = null;
        updateGreeting();
        checkPendingUpdates();
    }
}

async function saveUserName(name) {
    try {
        await db.collection('users').doc(currentUser.uid).set({
            name: name,
            email: currentUser.email,
            nameManuallySet: true  // Flag to indicate user manually set this name
        }, { merge: true });
        userName = name;
        updateGreeting();
    } catch (error) {
        console.error('Error saving user name:', error);
    }
}

function updateGreeting() {
    const greetingEl = document.getElementById('user-greeting');
    if (greetingEl && userName) {
        greetingEl.textContent = `Olá, ${userName}`;
    }
}

function showNameModal() {
    const modal = document.getElementById('name-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideNameModal() {
    const modal = document.getElementById('name-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showWelcomeBackSplash() {
    const splash = document.getElementById('splash-screen');
    const titleEl = document.getElementById('splash-title');
    const subtitleEl = document.getElementById('splash-subtitle');
    
    if (splash && titleEl && subtitleEl && userName) {
        // Update text for welcome back
        titleEl.textContent = 'Bem-vindo de volta,';
        subtitleEl.textContent = userName;
        subtitleEl.classList.add('welcome-name-style');
        
        // Show for 1.5s, then zoom out
        setTimeout(() => {
            splash.classList.add('zoom-out');
            // Wait for animation to complete (2s) + buffer, then hide splash
            setTimeout(() => {
                splash.classList.add('hidden');
                splashComplete = true;
            }, 2200);
        }, 1500);
    } else {
        finishSplash();
    }
}

function finishSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash && !splashComplete) {
        // Simple fade out for non-returning users
        setTimeout(() => {
            splash.classList.add('zoom-out');
            setTimeout(() => {
                splash.classList.add('hidden');
                splashComplete = true;
            }, 2200);
        }, 1000);
    }
}

// ==================== COMPLETION HELPERS ====================
function getRequiredQuestions(answers) {
    // Get questions that should be answered based on conditions
    return QUESTIONS.filter(q => {
        if (!q.condition) return true;
        const val = answers[q.condition.field];
        if (typeof q.condition.value === 'function') return q.condition.value(val);
        return val === q.condition.value;
    });
}

function isAnswered(val) {
    // A question is answered if it has any value that's not undefined, null, or empty string
    if (val === undefined || val === null) return false;
    if (typeof val === 'number') return true; // 0 is a valid answer
    if (typeof val === 'string') return val.trim() !== '';
    return true;
}

function calculateCompletion(answers) {
    const required = getRequiredQuestions(answers);
    const answered = required.filter(q => isAnswered(answers[q.id]));
    const missing = required.filter(q => !isAnswered(answers[q.id]));
    
    return {
        total: required.length,
        completed: answered.length,
        percentage: required.length > 0 ? Math.round((answered.length / required.length) * 100) : 100,
        missing: missing
    };
}

function isSessionComplete(answers) {
    return calculateCompletion(answers).percentage === 100;
}

// ==================== NAME VALIDATION ====================
function validateName(name) {
    if (!name || name.length === 0) {
        return { valid: false, message: 'Por favor, introduza um nome' };
    }
    if (name.includes(' ')) {
        return { valid: false, message: 'Apenas um nome, sem espaços' };
    }
    if (name.length > 15) {
        return { valid: false, message: 'Nome deve ter no máximo 15 caracteres' };
    }
    return { valid: true };
}

// ==================== PENDING UPDATES SYSTEM ====================
// List of required updates - add new checks here for future updates
const PENDING_UPDATE_CHECKS = [
    {
        id: 'name',
        check: () => !userName,
        label: 'Adicionar nome',
        action: showNameModal
    }
    // Add future required updates here, e.g.:
    // {
    //     id: 'phone',
    //     check: () => !userPhone,
    //     label: 'Adicionar telefone',
    //     action: showPhoneModal
    // }
];

function getPendingUpdates() {
    return PENDING_UPDATE_CHECKS.filter(update => update.check());
}

function checkPendingUpdates() {
    const pendingUpdates = getPendingUpdates();
    const banner = document.getElementById('pending-updates-banner');
    const textEl = document.getElementById('pending-updates-text');
    
    if (!banner) return;
    
    if (pendingUpdates.length > 0) {
        // Show banner with count
        if (pendingUpdates.length === 1) {
            textEl.textContent = pendingUpdates[0].label;
        } else {
            textEl.textContent = `${pendingUpdates.length} atualizações pendentes`;
        }
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function handlePendingUpdates() {
    const pendingUpdates = getPendingUpdates();
    if (pendingUpdates.length > 0) {
        // Execute the first pending update's action
        pendingUpdates[0].action();
    }
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    setTimeout(() => el.textContent = '', 5000);
}

function translateError(code) {
    const errors = {
        'auth/email-already-in-use': 'Email já registado',
        'auth/invalid-email': 'Email inválido',
        'auth/user-not-found': 'Utilizador não encontrado',
        'auth/wrong-password': 'Password incorreta'
    };
    return errors[code] || 'Erro de autenticação';
}

function showScreen(screen) {
    document.getElementById('auth-screen').classList.toggle('active', screen === 'auth');
    document.getElementById('app-screen').classList.toggle('active', screen === 'app');
}

// ==================== TABS ====================
function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
            if (tab.dataset.tab === 'history') loadHistory();
        });
    });
}

// ==================== DATE UTILS ====================
function getSessionDate() {
    // Returns the "night date" - the date of the night we're recording
    // After 4:30 AM on Jan 14 -> we record the night of Jan 13 (last night)
    // Before 4:30 AM on Jan 14 -> we record the night of Jan 13 (same night, not yet ended)
    const now = new Date();
    
    // Always record "last night" = yesterday's date
    // Unless it's before 4:30 AM, then it's 2 days ago (because yesterday hasn't "ended" yet)
    if (now.getHours() < UNLOCK_HOUR || (now.getHours() === UNLOCK_HOUR && now.getMinutes() < UNLOCK_MINUTE)) {
        // Before 4:30 AM - still recording the night that started 2 days ago
        now.setDate(now.getDate() - 2);
    } else {
        // After 4:30 AM - recording last night (yesterday)
        now.setDate(now.getDate() - 1);
    }
    return now.toISOString().split('T')[0];
}

function getNextUnlockTime() {
    const now = new Date();
    const unlock = new Date(now);
    unlock.setHours(UNLOCK_HOUR, UNLOCK_MINUTE, 0, 0);
    if (now >= unlock) {
        unlock.setDate(unlock.getDate() + 1);
    }
    return unlock;
}

function formatDatePT(dateStr) {
    if (!dateStr) return 'data desconhecida';
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return 'data inválida';
    return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}

function formatDateLong(dateStr) {
    if (!dateStr) return 'data desconhecida';
    const date = new Date(dateStr + 'T12:00:00');
    if (isNaN(date.getTime())) return 'data inválida';
    return date.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatSessionRange(nightDate) {
    // nightDate is the date when sleep started (e.g., 13 Jan)
    // Morning is the next day (e.g., 14 Jan)
    const night = new Date(nightDate + 'T12:00:00');
    const morning = new Date(night);
    morning.setDate(morning.getDate() + 1);
    
    const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    
    const nightDay = weekdays[night.getDay()];
    const morningDay = weekdays[morning.getDay()];
    const nightNum = night.getDate();
    const morningNum = morning.getDate();
    const month = months[morning.getMonth()];
    
    return `${nightDay} → ${morningDay}, ${nightNum}/${morningNum} ${month}`;
}

// ==================== NEW SESSION ====================
function initNewSession() {
    document.getElementById('start-session').addEventListener('click', startNewSession);
    document.getElementById('cancel-session').addEventListener('click', cancelSession);
    document.getElementById('prev-question').addEventListener('click', () => navigateQuestion(-1));
    document.getElementById('next-question').addEventListener('click', () => navigateQuestion(1));
}

async function loadExistingDates() {
    if (!currentUser) return;
    existingDates.clear();
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('entries').get();
        snapshot.forEach(doc => existingDates.add(doc.id));
    } catch (e) {
        console.error('Error loading dates:', e);
    }
}

async function loadStreakData() {
    if (!currentUser) return;
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists && doc.data().streak) {
            streakData = doc.data().streak;
        }
    } catch (e) {
        console.error('Error loading streak:', e);
    }
}

async function saveStreakData() {
    if (!currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid).set({ streak: streakData }, { merge: true });
    } catch (e) {
        console.error('Error saving streak:', e);
    }
}

function updateStreakDisplay() {
    // Update all streak displays
    const elements = ['streak-count', 'streak-count-locked'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = streakData.current;
    });
    
    const bestEl = document.getElementById('best-streak');
    if (bestEl) bestEl.textContent = streakData.best;
    
    // Update display state based on streak
    const displays = document.querySelectorAll('.streak-display');
    displays.forEach(d => {
        d.classList.remove('streak-lost', 'streak-active');
        if (streakData.current > 0) {
            d.classList.add('streak-active');
        } else {
            d.classList.add('streak-lost');
        }
    });
    
    // Also update the streak section styling based on session state
    const sessionLocked = document.getElementById('session-locked');
    const sessionAvailable = document.getElementById('session-available');
    if (sessionLocked && !sessionLocked.classList.contains('hidden')) {
        // Session done today - show success styling
        document.querySelectorAll('.streak-section').forEach(s => {
            s.classList.add('streak-success');
        });
    }
}

function checkSessionAvailability() {
    const sessionDate = getSessionDate();
    const hasEntry = existingDates.has(sessionDate);
    
    document.getElementById('session-available').classList.toggle('hidden', hasEntry);
    document.getElementById('session-locked').classList.toggle('hidden', !hasEntry);
    document.getElementById('session-form').classList.add('hidden');
    
    updateStreakDisplay();
    startCountdown();
}

function startCountdown() {
    updateCountdown();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    const now = new Date();
    const unlock = getNextUnlockTime();
    const diff = unlock - now;
    
    if (diff <= 0) {
        if (countdownInterval) clearInterval(countdownInterval);
        // Check if streak should be lost (no entry for current session)
        const sessionDate = getSessionDate();
        if (!existingDates.has(sessionDate) && streakData.current > 0) {
            streakData.current = 0;
            saveStreakData();
        }
        loadExistingDates().then(() => {
            loadStreakData().then(() => checkSessionAvailability());
        });
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    // Update countdown displays
    const streakTime = document.getElementById('streak-time');
    const nextSessionTime = document.getElementById('next-session-time');
    
    if (streakTime) streakTime.textContent = timeStr;
    if (nextSessionTime) nextSessionTime.textContent = timeStr;
    
    // Update warning text based on urgency
    const warning = document.getElementById('streak-warning');
    if (warning) {
        if (hours < 2) {
            warning.classList.add('urgent');
            warning.textContent = 'Rápido! O streak vai acabar!';
        } else {
            warning.classList.remove('urgent');
            warning.textContent = 'para manter o streak!';
        }
    }
}

function incrementStreak() {
    const today = getSessionDate();
    const yesterday = getPrevDate(today);
    
    // Check if this continues the streak or starts new one
    if (streakData.lastDate === yesterday) {
        // Continuing streak
        streakData.current++;
    } else if (streakData.lastDate !== today) {
        // Starting new streak (or first entry ever)
        streakData.current = 1;
    }
    // If lastDate === today, already counted, do nothing
    
    streakData.lastDate = today;
    
    // Update best streak
    if (streakData.current > streakData.best) {
        streakData.best = streakData.current;
    }
    
    saveStreakData();
    updateStreakDisplay();
}

function getPrevDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

function startNewSession() {
    const sessionDate = getSessionDate();
    answers = {};
    currentQuestionIndex = 0;
    
    document.getElementById('form-date').textContent = `Noite de ${formatDatePT(sessionDate)}`;
    document.getElementById('session-available').classList.add('hidden');
    document.getElementById('session-form').classList.remove('hidden');
    
    renderQuestions('questions-container', answers, 'new');
    showQuestion(0, 'new');
}

function cancelSession() {
    document.getElementById('session-form').classList.add('hidden');
    document.getElementById('session-available').classList.remove('hidden');
}

function navigateQuestion(dir) {
    // Validate current question before advancing
    if (dir === 1) {
        const currentQ = visibleQuestions[currentQuestionIndex];
        if (currentQ && !answers[currentQ.id]) {
            alert('Por favor responda à pergunta antes de continuar.');
            return;
        }
        
        if (currentQuestionIndex >= visibleQuestions.length - 1) {
            // Validate all questions before saving
            const unanswered = visibleQuestions.find(q => !answers[q.id]);
            if (unanswered) {
                alert('Por favor responda a todas as perguntas.');
                return;
            }
            saveNewEntry();
            return;
        }
    }
    currentQuestionIndex = Math.max(0, Math.min(visibleQuestions.length - 1, currentQuestionIndex + dir));
    showQuestion(currentQuestionIndex, 'new');
}

async function saveNewEntry() {
    const sessionDate = getSessionDate();
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('entries').doc(sessionDate).set({
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                date: sessionDate,
                answers: answers,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        existingDates.add(sessionDate);
        incrementStreak();
        checkSessionAvailability();
    } catch (e) {
        console.error('Error saving:', e);
        alert('Erro ao guardar. Tente novamente.');
    }
}

// ==================== HISTORY ====================
function initHistory() {
    document.getElementById('add-past-entry').addEventListener('click', showAddPastModal);
    document.getElementById('cancel-add-past').addEventListener('click', hideAddPastModal);
    document.getElementById('confirm-add-past').addEventListener('click', confirmAddPast);
    document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
    document.getElementById('save-edit').addEventListener('click', saveEdit);
    document.getElementById('edit-prev-question').addEventListener('click', () => navigateEditQuestion(-1));
    document.getElementById('edit-next-question').addEventListener('click', () => navigateEditQuestion(1));
    document.getElementById('export-data').addEventListener('click', exportData);
    
    // Incomplete action modal buttons
    document.getElementById('complete-incomplete').addEventListener('click', completeIncomplete);
    document.getElementById('edit-incomplete').addEventListener('click', editIncomplete);
    document.getElementById('cancel-incomplete').addEventListener('click', hideIncompleteModal);
    
    // Set max date for date picker
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('past-date-picker').max = today;
}

async function loadHistory() {
    if (!currentUser) return;
    const list = document.getElementById('history-list');
    const editMode = document.getElementById('history-edit-mode');
    const modal = document.getElementById('add-past-modal');
    
    // Show list, hide edit mode
    list.classList.remove('hidden');
    editMode.classList.add('hidden');
    modal.classList.add('hidden');
    
    list.innerHTML = '<p style="text-align:center;color:#666;">A carregar...</p>';
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('entries').orderBy('date', 'desc').limit(60).get();
        
        await loadExistingDates();
        
        if (snapshot.empty) {
            list.innerHTML = `<div class="empty-state"><div class="empty-state-icon"></div><p>Ainda não há registos.</p></div>`;
            return;
        }
        
        // Build sessions map: nightDate -> session data
        const sessions = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            sessions[data.date] = data.answers || {};
        });
        
        const sessionDates = Object.keys(sessions).sort().reverse();
        const today = new Date().toISOString().split('T')[0];
        
        list.innerHTML = '';
        
        sessionDates.forEach((nightDate, index) => {
            const a = sessions[nightDate];
            const completion = calculateCompletion(a);
            const complete = completion.percentage === 100;
            
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-item-content">
                    <div class="history-date">${formatSessionRange(nightDate)}</div>
                    <div class="history-summary">
                        Deitou ${a.deitou || '—'} · 
                        Acordou ${a.acordou || '—'} · 
                        Sono: ${a.sono_total || '—'}
                    </div>
                </div>
                <div class="history-status ${complete ? 'status-complete' : 'status-incomplete'}">
                    ${complete ? 'Completo' : completion.percentage + '%'}
                </div>
            `;
            item.addEventListener('click', () => handleHistoryClick(nightDate, a, complete));
            list.appendChild(item);
        });
    } catch (e) {
        console.error('Error loading history:', e);
        list.innerHTML = '<p style="color:#d32f2f;text-align:center;">Erro ao carregar</p>';
    }
}

function getNextDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function showAddPastModal() {
    document.getElementById('add-past-modal').classList.remove('hidden');
    document.getElementById('add-past-error').textContent = '';
    document.getElementById('past-date-picker').value = '';
}

function hideAddPastModal() {
    document.getElementById('add-past-modal').classList.add('hidden');
}

function confirmAddPast() {
    const dateStr = document.getElementById('past-date-picker').value;
    const errorEl = document.getElementById('add-past-error');
    
    if (!dateStr) {
        errorEl.textContent = 'Selecione uma data';
        return;
    }
    
    const selected = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (selected > today) {
        errorEl.textContent = 'Não pode adicionar datas futuras';
        return;
    }
    
    if (existingDates.has(dateStr)) {
        errorEl.textContent = 'Esta data já existe. Clique na entrada para editar.';
        return;
    }
    
    hideAddPastModal();
    startEdit(dateStr, {});
}

// Variables for complete-only-missing mode
let completeOnlyMissing = false;
let pendingIncompleteDate = null;
let pendingIncompleteAnswers = null;

function handleHistoryClick(dateStr, answers, isComplete) {
    if (isComplete) {
        // Complete entries go straight to edit
        startEdit(dateStr, answers, false);
    } else {
        // Incomplete entries show action modal
        pendingIncompleteDate = dateStr;
        pendingIncompleteAnswers = answers;
        const completion = calculateCompletion(answers);
        document.getElementById('incomplete-percentage').textContent = `${completion.percentage}% completo`;
        document.getElementById('incomplete-action-modal').classList.remove('hidden');
    }
}

function hideIncompleteModal() {
    document.getElementById('incomplete-action-modal').classList.add('hidden');
}

function clearPendingIncomplete() {
    pendingIncompleteDate = null;
    pendingIncompleteAnswers = null;
}

function completeIncomplete() {
    // Complete only missing questions - save values before hiding modal
    const dateStr = pendingIncompleteDate;
    const answers = pendingIncompleteAnswers;
    hideIncompleteModal();
    clearPendingIncomplete();
    startEdit(dateStr, answers, true);
}

function editIncomplete() {
    // Edit all questions - save values before hiding modal
    const dateStr = pendingIncompleteDate;
    const answers = pendingIncompleteAnswers;
    hideIncompleteModal();
    clearPendingIncomplete();
    startEdit(dateStr, answers, false);
}

function startEdit(dateStr, existingAnswers, onlyMissing = false) {
    editingDate = dateStr;
    editAnswers = { ...existingAnswers };
    editQuestionIndex = 0;
    completeOnlyMissing = onlyMissing;
    
    document.getElementById('edit-date').textContent = `Noite de ${formatDatePT(dateStr)}`;
    document.getElementById('history-list').classList.add('hidden');
    document.getElementById('history-edit-mode').classList.remove('hidden');
    
    renderQuestions('edit-questions-container', editAnswers, 'edit', onlyMissing);
    showQuestion(0, 'edit');
}

function cancelEdit() {
    document.getElementById('history-edit-mode').classList.add('hidden');
    document.getElementById('history-list').classList.remove('hidden');
    editingDate = null;
}

async function saveEdit() {
    if (!editingDate) return;
    
    try {
        await db.collection('users').doc(currentUser.uid)
            .collection('entries').doc(editingDate).set({
                date: editingDate,
                answers: editAnswers,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        existingDates.add(editingDate);
        
        // Show success feedback
        const btn = document.getElementById('save-edit');
        btn.textContent = 'Guardado!';
        setTimeout(() => { btn.textContent = 'Guardar'; }, 2000);
        
        // Go back to list
        cancelEdit();
        loadHistory();
    } catch (e) {
        console.error('Error saving:', e);
        alert('Erro ao guardar');
    }
}

function navigateEditQuestion(dir) {
    editQuestionIndex = Math.max(0, Math.min(editVisibleQuestions.length - 1, editQuestionIndex + dir));
    showQuestion(editQuestionIndex, 'edit');
}

async function exportData() {
    if (!currentUser) return;
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid)
            .collection('entries').orderBy('date', 'asc').get();
        const entries = [];
        snapshot.forEach(doc => entries.push(doc.data()));
        
        const headers = ['Data', ...QUESTIONS.map(q => q.title.replace(/^\d+\.\s*/, '')), 'Data de Criação'];
        const rows = entries.map(e => [e.date, ...QUESTIONS.map(q => e.answers?.[q.id] || ''), e.createdAt ? e.createdAt.toDate().toISOString() : '']);
        const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diario-sono-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Export error:', e);
        alert('Erro ao exportar');
    }
}

// ==================== QUESTIONS RENDERING ====================
function renderQuestions(containerId, answersObj, mode, onlyMissing = false) {
    const isEdit = mode === 'edit';
    let questionsList = QUESTIONS.filter(q => {
        if (!q.condition) return true;
        const val = answersObj[q.condition.field];
        if (typeof q.condition.value === 'function') return q.condition.value(val);
        return val === q.condition.value;
    });
    
    // If only showing missing questions, filter to unanswered ones
    if (onlyMissing) {
        questionsList = questionsList.filter(q => !isAnswered(answersObj[q.id]));
    }
    
    if (isEdit) {
        editVisibleQuestions = questionsList;
    } else {
        visibleQuestions = questionsList;
    }
    
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    questionsList.forEach((q, index) => {
        const questionEl = document.createElement('div');
        questionEl.className = 'question' + (index === 0 ? ' active' : '');
        questionEl.dataset.index = index;
        
        let inputHtml = '';
        
        if (q.type === 'choice') {
            inputHtml = `<div class="options">
                ${q.options.map(opt => `
                    <button class="option ${answersObj[q.id] === opt ? 'selected' : ''}" data-value="${opt}">
                        ${opt}
                    </button>
                `).join('')}
            </div>`;
        } else if (q.type === 'time-picker') {
            const val = answersObj[q.id] || '12:00';
            const [h, m] = val.split(':');
            inputHtml = createTimePicker(q.id, parseInt(h) || 12, parseInt(m) || 0);
        } else if (q.type === 'duration-picker') {
            const val = parseInt(answersObj[q.id]) || 15;
            inputHtml = createDurationPicker(q.id, val);
        } else if (q.type === 'sleep-duration-picker') {
            const val = answersObj[q.id] || '7h 00min';
            const match = val.match(/(\d+)h?\s*(\d+)?/);
            const hours = match ? parseInt(match[1]) : 7;
            const mins = match ? parseInt(match[2] || 0) : 0;
            inputHtml = createSleepDurationPicker(q.id, hours, mins);
        } else if (q.type === 'text') {
            inputHtml = `<textarea class="text-input" rows="3" placeholder="Escreva aqui..." data-id="${q.id}">${answersObj[q.id] || ''}</textarea>`;
        }
        
        questionEl.innerHTML = `
            <div class="question-section">${q.section}</div>
            <h3 class="question-title">${q.title}</h3>
            ${q.subtitle ? `<p class="question-subtitle">${q.subtitle}</p>` : ''}
            ${inputHtml}
        `;
        
        container.appendChild(questionEl);
    });
    
    addQuestionListeners(container, answersObj, mode);
}

function addQuestionListeners(container, answersObj, mode) {
    const isEdit = mode === 'edit';
    const questionsList = isEdit ? editVisibleQuestions : visibleQuestions;
    
    container.querySelectorAll('.options .option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            const questionEl = e.target.closest('.question');
            const idx = parseInt(questionEl.dataset.index);
            const question = questionsList[idx];
            questionEl.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
            e.target.classList.add('selected');
            answersObj[question.id] = e.target.dataset.value;
            
            // Auto-advance to next question after selection
            setTimeout(() => {
                if (isEdit) {
                    if (editQuestionIndex < questionsList.length - 1) {
                        editQuestionIndex++;
                        showQuestion(editQuestionIndex, 'edit');
                    }
                } else {
                    if (currentQuestionIndex < questionsList.length - 1) {
                        currentQuestionIndex++;
                        showQuestion(currentQuestionIndex, 'new');
                    }
                }
            }, 200);
        });
    });
    
    container.querySelectorAll('.text-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const questionEl = e.target.closest('.question');
            const idx = parseInt(questionEl.dataset.index);
            const question = questionsList[idx];
            answersObj[question.id] = e.target.value;
        });
    });
    
    container.querySelectorAll('.picker-container').forEach(picker => {
        initWheelPicker(picker, answersObj);
    });
}

function showQuestion(index, mode) {
    const isEdit = mode === 'edit';
    const containerId = isEdit ? 'edit-questions-container' : 'questions-container';
    const progressId = isEdit ? 'edit-question-progress' : 'question-progress';
    const prevBtnId = isEdit ? 'edit-prev-question' : 'prev-question';
    const nextBtnId = isEdit ? 'edit-next-question' : 'next-question';
    const questionsList = isEdit ? editVisibleQuestions : visibleQuestions;
    
    document.querySelectorAll(`#${containerId} .question`).forEach((q, i) => {
        q.classList.toggle('active', i === index);
    });
    
    document.getElementById(progressId).textContent = `${index + 1} / ${questionsList.length}`;
    document.getElementById(prevBtnId).disabled = index === 0;
    
    const nextBtn = document.getElementById(nextBtnId);
    if (!isEdit) {
        nextBtn.textContent = index === questionsList.length - 1 ? '💾 Guardar' : 'Próxima →';
    }
}

// ==================== WHEEL PICKERS ====================
function createTimePicker(id, hours, minutes) {
    const hourOptions = Array.from({length: 24}, (_, i) => 
        `<div class="wheel-item ${i === hours ? 'selected' : ''}" data-value="${i}">${String(i).padStart(2, '0')}</div>`
    ).join('');
    
    const minOptions = Array.from({length: 12}, (_, i) => {
        const m = i * 5;
        return `<div class="wheel-item ${m === Math.floor(minutes/5)*5 ? 'selected' : ''}" data-value="${m}">${String(m).padStart(2, '0')}</div>`;
    }).join('');
    
    return `
        <div class="picker-container" data-id="${id}" data-type="time">
            <div class="picker-display">
                <span class="picker-value">${String(hours).padStart(2, '0')}:${String(Math.floor(minutes/5)*5).padStart(2, '0')}</span>
            </div>
            <div class="wheel-picker-modal hidden">
                <div class="wheel-picker-content">
                    <div class="wheel-picker-header">
                        <button class="picker-cancel">Cancelar</button>
                        <button class="picker-done">OK</button>
                    </div>
                    <div class="wheel-picker" data-component="hours">
                        <div class="wheel-highlight"></div>
                        <div class="wheel-scroll">${hourOptions}</div>
                    </div>
                    <div class="wheel-separator">:</div>
                    <div class="wheel-picker" data-component="minutes">
                        <div class="wheel-highlight"></div>
                        <div class="wheel-scroll">${minOptions}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createDurationPicker(id, minutes) {
    const options = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180].map(m => 
        `<div class="wheel-item ${m === minutes ? 'selected' : ''}" data-value="${m}">${m} min</div>`
    ).join('');
    
    return `
        <div class="picker-container" data-id="${id}" data-type="duration">
            <div class="picker-display">
                <span class="picker-value">${minutes} min</span>
            </div>
            <div class="wheel-picker-modal hidden">
                <div class="wheel-picker-content single">
                    <div class="wheel-picker-header">
                        <button class="picker-cancel">Cancelar</button>
                        <button class="picker-done">OK</button>
                    </div>
                    <div class="wheel-picker" data-component="duration">
                        <div class="wheel-highlight"></div>
                        <div class="wheel-scroll">${options}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createSleepDurationPicker(id, hours, minutes) {
    const hourOptions = Array.from({length: 16}, (_, i) => 
        `<div class="wheel-item ${i === hours ? 'selected' : ''}" data-value="${i}">${i}h</div>`
    ).join('');
    
    const minOptions = [0, 15, 30, 45].map(m => 
        `<div class="wheel-item ${m === minutes ? 'selected' : ''}" data-value="${m}">${String(m).padStart(2, '0')}min</div>`
    ).join('');
    
    return `
        <div class="picker-container" data-id="${id}" data-type="sleep-duration">
            <div class="picker-display">
                <span class="picker-value">${hours}h ${String(minutes).padStart(2, '0')}min</span>
            </div>
            <div class="wheel-picker-modal hidden">
                <div class="wheel-picker-content">
                    <div class="wheel-picker-header">
                        <button class="picker-cancel">Cancelar</button>
                        <button class="picker-done">OK</button>
                    </div>
                    <div class="wheel-picker" data-component="hours">
                        <div class="wheel-highlight"></div>
                        <div class="wheel-scroll">${hourOptions}</div>
                    </div>
                    <div class="wheel-picker" data-component="minutes">
                        <div class="wheel-highlight"></div>
                        <div class="wheel-scroll">${minOptions}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initWheelPicker(container, answersObj) {
    const display = container.querySelector('.picker-display');
    const modal = container.querySelector('.wheel-picker-modal');
    const cancel = container.querySelector('.picker-cancel');
    const done = container.querySelector('.picker-done');
    const type = container.dataset.type;
    const id = container.dataset.id;
    
    display.addEventListener('click', () => {
        modal.classList.remove('hidden');
        container.querySelectorAll('.wheel-scroll').forEach(scroll => {
            const selected = scroll.querySelector('.selected');
            if (selected) {
                scroll.scrollTop = selected.offsetTop - scroll.offsetHeight / 2 + selected.offsetHeight / 2;
            }
        });
    });
    
    cancel.addEventListener('click', () => modal.classList.add('hidden'));
    
    done.addEventListener('click', () => {
        let value;
        if (type === 'time') {
            const hours = getSelectedValue(container, 'hours');
            const mins = getSelectedValue(container, 'minutes');
            value = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
            display.querySelector('.picker-value').textContent = value;
        } else if (type === 'duration') {
            value = getSelectedValue(container, 'duration');
            display.querySelector('.picker-value').textContent = `${value} min`;
        } else if (type === 'sleep-duration') {
            const hours = getSelectedValue(container, 'hours');
            const mins = getSelectedValue(container, 'minutes');
            value = `${hours}h ${String(mins).padStart(2, '0')}min`;
            display.querySelector('.picker-value').textContent = value;
        }
        answersObj[id] = value;
        modal.classList.add('hidden');
    });
    
    container.querySelectorAll('.wheel-scroll').forEach(scroll => {
        scroll.addEventListener('scroll', debounce(() => {
            const items = scroll.querySelectorAll('.wheel-item');
            let closest = null;
            let closestDist = Infinity;
            const center = scroll.scrollTop + scroll.offsetHeight / 2;
            
            items.forEach(item => {
                const itemCenter = item.offsetTop + item.offsetHeight / 2;
                const dist = Math.abs(center - itemCenter);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = item;
                }
            });
            
            if (closest) {
                scroll.querySelectorAll('.wheel-item').forEach(i => i.classList.remove('selected'));
                closest.classList.add('selected');
            }
        }, 50));
    });
}

function getSelectedValue(container, component) {
    const scroll = container.querySelector(`[data-component="${component}"] .wheel-scroll`);
    const selected = scroll.querySelector('.selected');
    return selected ? parseInt(selected.dataset.value) : 0;
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// ==================== FORCE REFRESH ====================
function forceRefresh() {
    // Clear caches
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
    // Unregister service worker and reload
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(reg => reg.unregister());
        });
    }
    // Force hard reload
    setTimeout(() => window.location.reload(true), 100);
}

// ==================== PWA ====================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err));
}
