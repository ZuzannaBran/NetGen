// Main Application Logic
import './style.css';
import * as contactService from './services/contactService.js';
import {
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    deleteCurrentUserAccount,
} from './services/firebase.js';
import * as networkGraph from './services/networkGraph.js';

// DOM Elements
const mainMenu = document.getElementById('mainMenu');
const searchMenu = document.getElementById('searchMenu');
const listMenu = document.getElementById('listMenu');
const contactCreatorSection = document.getElementById('contactCreator');
const contactCreatorForm = document.getElementById('contactCreatorForm');
const landingContactCreatorForm = document.getElementById('landingContactCreatorForm');
const globalBack = document.getElementById('globalBack');
const feedbackEndpoint =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FEEDBACK_ENDPOINT
        ? import.meta.env.VITE_FEEDBACK_ENDPOINT.trim()
        : '';
const emailjsEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const emailjsConfig = {
    serviceId: (emailjsEnv.VITE_EMAILJS_SERVICE_ID || '').trim(),
    templateId: (emailjsEnv.VITE_EMAILJS_TEMPLATE_ID || '').trim(),
    publicKey: (emailjsEnv.VITE_EMAILJS_PUBLIC_KEY || '').trim(),
};
if (typeof window !== 'undefined' && window.emailjs && emailjsConfig.publicKey) {
    window.emailjs.init(emailjsConfig.publicKey);
}
const feedbackMailSubject = 'NetGen feedback';
const addContactForm = document.getElementById('addContactForm');
const contentArea = document.getElementById('contentArea');
const contentDisplay = document.getElementById('contentDisplay');
const loading = document.getElementById('loading');
const modal = document.getElementById('modal');
const landingPage = document.getElementById('landingPage');
const authContainer = document.getElementById('authContainer');
const inlineDialogHost = document.getElementById('inlineDialogHost');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const policyConsent = document.getElementById('policyConsent');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const authResetNotice = document.getElementById('authResetNotice');
const authResetNoticeText = document.getElementById('authResetNoticeText');
const logoutBtn = document.getElementById('logoutBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const userStatus = document.getElementById('userStatus');
const networkGraphView = document.getElementById('networkGraphView');
const networkGraphContainer = document.getElementById('networkGraphContainer');
const graphContactProfile = document.getElementById('graphContactProfile');
const graphZoomIn = document.getElementById('graphZoomIn');
const graphZoomOut = document.getElementById('graphZoomOut');
const graphReset = document.getElementById('graphReset');
const statisticsView = document.getElementById('statisticsView');
const statisticsContent = document.getElementById('statisticsContent');
const addIntroducerContactBtn = document.getElementById('addIntroducerContactBtn');
const helperModeNotice = document.getElementById('helperModeNotice');
const backToPreviousContactBtn = document.getElementById('backToPreviousContactBtn');
const formErrorMessage = document.getElementById('formErrorMessage');
const searchForm = document.getElementById('searchForm');
const searchRowsContainer = document.getElementById('searchRowsContainer');
const addSearchRowBtn = document.getElementById('addSearchRow');
const searchFormError = document.getElementById('searchFormError');
const searchResultsContainer = document.getElementById('searchResults');
const pwaGuideSection = document.getElementById('pwaGuide');
const searchSuggestionCache = {
    ids: [],
    names: [],
    hashtags: [],
    events: [],
};
let searchSuggestionsLoaded = false;
let searchSuggestionsPromise = null;
const graphProfilePlaceholderMarkup = `
    <div class="graph-profile-placeholder">
        <h3>Select a contact</h3>
        <p>Click any person in the graph to display the full profile here.</p>
    </div>
`;

// State
let currentView = 'main';
let pendingDuplicates = null;
let helperModeActive = false;
const urlParams = new URLSearchParams(window.location.search);
let pendingIntroducerPrefill = '';
const contactCache = new Map();
const navigableViews = new Set([
    'landing',
    'main',
    'search',
    'list',
    'contact-creator',
    'add',
    'content',
    'network-graph',
    'statistics',
]);
const authRequiredViews = new Set([
    'main',
    'search',
    'list',
    'contact-creator',
    'add',
    'content',
    'network-graph',
    'statistics',
]);
const listViewState = {
    mode: 'brief',
    contacts: [],
    expandedKeys: new Set(),
    loaded: false,
    active: false,
};

if (urlParams.has('introducerContact')) {
    pendingIntroducerPrefill = (urlParams.get('introducerContact') || '').trim();
    helperModeActive = true;
    urlParams.delete('introducerContact');
    const remainingQuery = urlParams.toString();
    const cleanUrl = remainingQuery
        ? `${window.location.pathname}?${remainingQuery}`
        : window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}

function resetListViewState() {
    listViewState.mode = 'brief';
    listViewState.contacts = [];
    listViewState.expandedKeys.clear();
    listViewState.loaded = false;
    listViewState.active = false;
}

// Show/Hide Functions
function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

function updateHistoryState(view, mode = 'push') {
    if (!navigableViews.has(view)) {
        return;
    }
    const state = { view };
    const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (mode === 'replace') {
        window.history.replaceState(state, document.title, url);
        return;
    }
    if (mode === 'push') {
        window.history.pushState(state, document.title, url);
    }
}

function showView(view, options = {}) {
    const { history = 'push' } = options;
    // Debug: log view changes to help trace unexpected navigations
    try {
        // eslint-disable-next-line no-console
        console.log('[showView] switching to view:', view);
        // eslint-disable-next-line no-console
        console.trace();
    } catch (e) {
        // ignore
    }
    if (view !== 'content') {
        listViewState.active = false;
    }
    // Hide all views
    [
        landingPage,
        mainMenu,
        searchMenu,
        listMenu,
        contactCreatorSection,
        addContactForm,
        contentArea,
        networkGraphView,
        statisticsView,
    ].forEach((el) => {
        el.classList.add('hidden');
    });

    // Remove footer back bars for views we're leaving
    if (view !== 'list') {
        removeListBackBar();
    }
    if (view !== 'network-graph') {
        removeFooterBackBar('graph');
    }
    if (view !== 'statistics') {
        removeFooterBackBar('statistics');
    }
    if (view !== 'content') {
        removeFooterBackBar('success');
    }

    // Show requested view
    switch (view) {
        case 'main':
            mainMenu.classList.remove('hidden');
            break;
        case 'landing':
            landingPage.classList.remove('hidden');
            break;
        case 'search':
            searchMenu.classList.remove('hidden');
            break;
        case 'list':
            listMenu.classList.remove('hidden');
            break;
        case 'contact-creator':
            contactCreatorSection.classList.remove('hidden');
            break;
        case 'add':
            addContactForm.classList.remove('hidden');
            break;
        case 'content':
            contentArea.classList.remove('hidden');
            break;
        case 'network-graph':
            networkGraphView.classList.remove('hidden');
            injectFooterBackBar('graph', 'Back to menu');
            break;
        case 'statistics':
            statisticsView.classList.remove('hidden');
            injectFooterBackBar('statistics', 'Back to menu');
            break;
    }

    currentView = view;
    updateGlobalBackVisibility(view);
    if (history !== 'none') {
        updateHistoryState(view, history);
    }
    // Scroll to top on view change
    scrollPageToTop();
}

function updateGlobalBackVisibility(view) {
    if (!globalBack) {
        return;
    }
    const shouldShow = !['landing', 'main'].includes(view);
    globalBack.classList.toggle('hidden', !shouldShow);
}

function scrollPageToTop() {
    if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') {
        return;
    }
    try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        window.scrollTo(0, 0);
    }
}

function showLanding() {
    authContainer.classList.add('hidden');
    document.getElementById('loginHeaderBtn').classList.remove('hidden');
    document.getElementById('signupHeaderBtn').classList.remove('hidden');
    if (deleteAccountBtn) {
        deleteAccountBtn.classList.add('hidden');
    }
    showView('landing', { history: 'replace' });
}

function showAuth() {
    authContainer.classList.remove('hidden');
    landingPage.classList.add('hidden');
    document.getElementById('loginHeaderBtn').classList.add('hidden');
    document.getElementById('signupHeaderBtn').classList.add('hidden');
    clearAuthResetNotice();
    showView('main', { history: 'replace' });
    mainMenu.classList.add('hidden');
    scrollPageToTop();
}

function clearAuthResetNotice() {
    if (!authResetNotice) {
        return;
    }
    authResetNotice.classList.add('hidden');
    authResetNotice.classList.remove('auth-notice-success');
    if (authResetNoticeText) {
        authResetNoticeText.textContent = '';
    }
}

function showAuthResetNotice(message, variant = 'danger') {
    if (!authResetNotice) {
        return;
    }
    authResetNotice.classList.remove('hidden');
    authResetNotice.classList.toggle('auth-notice-success', variant === 'success');
    if (authResetNoticeText) {
        authResetNoticeText.textContent = message;
    }
}

function showApp(userEmail) {
    authContainer.classList.add('hidden');
    landingPage.classList.add('hidden');
    document.getElementById('loginHeaderBtn').classList.add('hidden');
    document.getElementById('signupHeaderBtn').classList.add('hidden');
    userStatus.textContent = userEmail;
    userStatus.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    if (deleteAccountBtn) {
        deleteAccountBtn.classList.remove('hidden');
    }
    showView('main', { history: 'replace' });
}

function returnToPreviousContact() {
    if (window.opener && !window.opener.closed) {
        window.opener.focus();
    }
    window.close();
}

function updateHelperModeNotice() {
    if (!helperModeNotice) {
        return;
    }
    if (helperModeActive) {
        helperModeNotice.classList.remove('hidden');
    } else {
        helperModeNotice.classList.add('hidden');
    }
}

function prefillContactFormWithName(fullName) {
    const trimmedName = (fullName || '').trim();
    showView('add');

    const contactFormEl = document.getElementById('contactForm');
    if (contactFormEl) {
        contactFormEl.reset();
    }

    if (trimmedName) {
        const [firstName, ...rest] = trimmedName.split(' ');
        const nameInputEl = document.getElementById('name');
        const surnameInputEl = document.getElementById('surname');
        if (nameInputEl) {
            nameInputEl.value = firstName || '';
        }
        if (surnameInputEl) {
            surnameInputEl.value = rest.join(' ');
        }
    }

    const errorElements = [
        document.getElementById('nameError'),
        document.getElementById('surnameError'),
        document.getElementById('noteError'),
        document.getElementById('introducerError'),
    ];
    errorElements.forEach((el) => el && el.classList.add('hidden'));

    if (formErrorMessage) {
        formErrorMessage.classList.add('hidden');
        formErrorMessage.textContent = '';
    }

    const noteCountEl = document.getElementById('noteCount');
    const advantageCountEl = document.getElementById('advantageCount');
    if (noteCountEl) {
        noteCountEl.textContent = '0';
    }
    if (advantageCountEl) {
        advantageCountEl.textContent = '0';
    }

    const noteInputEl = document.getElementById('note');
    if (noteInputEl) {
        noteInputEl.focus();
    }

    if (helperModeActive) {
        updateHelperModeNotice();
    } else if (helperModeNotice) {
        helperModeNotice.classList.add('hidden');
    }
}

function resetContactForm() {
    const contactFormEl = document.getElementById('contactForm');
    if (contactFormEl) {
        contactFormEl.reset();
    }

    if (noteCount) {
        noteCount.textContent = '0';
    }
    if (advantageCount) {
        advantageCount.textContent = '0';
    }

    const errorElements = [
        document.getElementById('nameError'),
        document.getElementById('surnameError'),
        document.getElementById('noteError'),
        document.getElementById('introducerError'),
    ];
    errorElements.forEach((el) => el && el.classList.add('hidden'));

    if (formErrorMessage) {
        formErrorMessage.classList.add('hidden');
        formErrorMessage.textContent = '';
    }
}

function cacheContacts(contacts = []) {
    contacts.forEach((contact) => {
        if (contact && contact.docId) {
            contactCache.set(contact.docId, contact);
        }
    });
}

function resetGraphProfilePanel() {
    if (!graphContactProfile) {
        return;
    }
    graphContactProfile.innerHTML = graphProfilePlaceholderMarkup;
    graphContactProfile.classList.add('graph-profile-empty');
}

function displayGraphContactProfile(contact) {
    if (!graphContactProfile) {
        return;
    }

    if (!contact) {
        resetGraphProfilePanel();
        return;
    }

    graphContactProfile.innerHTML = `
        <div class="graph-profile-header">
            <h3>Selected contact</h3>
            <p>Tap another person in the graph to switch profiles.</p>
        </div>
        ${renderContact(contact)}
    `;
    graphContactProfile.classList.remove('graph-profile-empty');
    graphContactProfile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function displayGraphEventProfile(eventData) {
    if (!graphContactProfile) {
        return;
    }

    const eventName = (eventData?.name || '').trim();
    if (!eventName) {
        resetGraphProfilePanel();
        return;
    }

    let description = '';
    try {
        const eventDoc = await contactService.getEventByName(eventName);
        description = eventDoc?.description || '';
    } catch (error) {
        console.error('Unable to load event details', error);
    }

    graphContactProfile.innerHTML = `
        <div class="graph-profile-header">
            <h3>Selected event</h3>
            <p>Edit the event description or remove the event and all connected contacts.</p>
        </div>
        <div class="contact-card">
            <div class="contact-field"><strong>Event:</strong> ${escapeHtml(eventName)}</div>
            <div class="form-group">
                <label for="eventDescriptionInput">Description</label>
                <textarea id="eventDescriptionInput" rows="4" placeholder="Add an event description">${escapeHtml(description)}</textarea>
            </div>
            <div class="form-buttons">
                <button type="button" class="submit-btn" id="saveEventDescriptionBtn">Save description</button>
                <button type="button" class="cancel-btn" id="deleteEventBtn">Delete event</button>
            </div>
        </div>
    `;
    graphContactProfile.classList.remove('graph-profile-empty');
    graphContactProfile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    const saveBtn = document.getElementById('saveEventDescriptionBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const inputEl = document.getElementById('eventDescriptionInput');
            const newDescription = inputEl ? inputEl.value.trim() : '';
            try {
                showLoading();
                await contactService.saveEventDescription(eventName, newDescription);
                hideLoading();
                await alertDialog('Event description saved.', 'Event updated', 'success');
            } catch (error) {
                hideLoading();
                await alertDialog(
                    error.message || 'Unable to save the event description right now.',
                    'Save failed',
                    'danger',
                );
            }
        });
    }

    const deleteBtn = document.getElementById('deleteEventBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const confirmed = await confirmDialog(
                'Deleting this event will delete all contacts connected to it. Do you want to continue?',
                { title: 'Delete event', confirmText: 'Delete event', variant: 'danger' },
            );
            if (!confirmed) {
                return;
            }
            try {
                showLoading();
                await contactService.deleteEventByName(eventName);
                hideLoading();
                resetGraphProfilePanel();
                await handleNetworkGraph();
                await alertDialog(
                    'Event deleted along with its connected contacts.',
                    'Event deleted',
                    'success',
                );
            } catch (error) {
                hideLoading();
                await alertDialog(
                    error.message || 'Unable to delete this event right now.',
                    'Delete failed',
                    'danger',
                );
            }
        });
    }
}

// Search Form Helpers
const defaultSearchPlaceholder = 'Enter a value';
const searchPlaceholderByType = {
    id: '42',
    name: 'Maya Patel',
    hashtag: 'startup',
    event: 'Web Summit 2024',
};

function scrollToElement(element, options = {}) {
    if (!element || typeof element.scrollIntoView !== 'function') {
        return;
    }
    const { behavior = 'smooth', block = 'center' } = options;
    try {
        element.scrollIntoView({ behavior, block });
    } catch (error) {
        // Fallback without smooth scrolling
        element.scrollIntoView(true);
    }
}

function clearSearchFormError() {
    if (searchFormError) {
        searchFormError.textContent = '';
        searchFormError.classList.add('hidden');
    }
}

function showSearchFormError(message) {
    if (searchFormError) {
        searchFormError.textContent = message;
        searchFormError.classList.remove('hidden');
        scrollToElement(searchFormError, { block: 'center' });
    }
}

function setSearchRowPlaceholder(selectEl) {
    if (!selectEl) {
        return;
    }
    const row = selectEl.closest('.search-row');
    if (!row) {
        return;
    }
    const valueInput = row.querySelector('.search-value');
    if (valueInput) {
        valueInput.placeholder =
            searchPlaceholderByType[selectEl.value] || defaultSearchPlaceholder;
    }
}

function resetSearchRow(row) {
    if (!row) {
        return;
    }
    const typeSelect = row.querySelector('.search-type');
    const valueInput = row.querySelector('.search-value');
    if (typeSelect) {
        typeSelect.value = '';
    }
    if (valueInput) {
        valueInput.value = '';
        valueInput.placeholder = defaultSearchPlaceholder;
    }
}

function createSearchRow() {
    const row = document.createElement('div');
    row.className = 'search-row';
    row.innerHTML = `
        <select class="search-type">
            <option value="">Select filter</option>
            <option value="id">ID</option>
            <option value="name">Name & Surname</option>
            <option value="hashtag">Hashtag</option>
            <option value="event">Event</option>
        </select>
        <div class="autocomplete-wrapper">
            <input type="text" class="search-value" placeholder="${defaultSearchPlaceholder}" autocomplete="off">
            <ul class="autocomplete-list hidden"></ul>
            <button type="button" class="btn-remove-search" title="Remove" aria-label="Remove filter">✕</button>
        </div>
    `;
    return row;
}

function clearSearchResults() {
    if (!searchResultsContainer) {
        return;
    }
    searchResultsContainer.innerHTML = '';
    searchResultsContainer.classList.add('hidden');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function ensureSearchSuggestions() {
    if (searchSuggestionsLoaded) {
        return;
    }

    if (searchSuggestionsPromise) {
        await searchSuggestionsPromise;
        return;
    }

    searchSuggestionsPromise = (async () => {
        try {
            const contacts = await contactService.listAllContacts();
            buildSearchSuggestionCache(contacts);
            searchSuggestionsLoaded = true;
        } catch (error) {
            console.error('Unable to load search suggestions', error);
            searchSuggestionsLoaded = false;
        } finally {
            searchSuggestionsPromise = null;
        }
    })();

    await searchSuggestionsPromise;
}

function buildSearchSuggestionCache(contacts) {
    const ids = new Set();
    const names = new Set();
    const hashtags = new Set();
    const events = new Set();

    contacts.forEach((contact) => {
        if (typeof contact.id !== 'undefined' && contact.id !== null) {
            ids.add(contact.id);
        }

        const fullName = `${contact.name || ''} ${contact.surname || ''}`.trim();
        if (fullName) {
            names.add(fullName);
        }

        if (Array.isArray(contact.hashtags)) {
            contact.hashtags.forEach((tag) => {
                const normalized = (tag || '').toString().trim().toLowerCase();
                if (normalized) {
                    hashtags.add(normalized);
                }
            });
        }

        if (contact.source_type === 'event' && contact.source_value) {
            events.add(contact.source_value);
        }
    });

    searchSuggestionCache.ids = Array.from(ids)
        .sort((a, b) => Number(a) - Number(b))
        .map((value) => value.toString());
    searchSuggestionCache.names = Array.from(names).sort((a, b) => a.localeCompare(b));
    searchSuggestionCache.hashtags = Array.from(hashtags).sort((a, b) => a.localeCompare(b));
    searchSuggestionCache.events = Array.from(events).sort((a, b) => a.localeCompare(b));
}

function getSuggestionsForType(type) {
    switch (type) {
        case 'id':
            return searchSuggestionCache.ids;
        case 'name':
            return searchSuggestionCache.names;
        case 'hashtag':
            return searchSuggestionCache.hashtags;
        case 'event':
            return searchSuggestionCache.events;
        default:
            return [];
    }
}

function filterSearchSuggestions(type, query) {
    const normalizedQuery = (query || '').trim().toLowerCase();
    const source = getSuggestionsForType(type);
    if (!normalizedQuery) {
        return source.slice(0, 8);
    }
    return source.filter((item) => item.toLowerCase().includes(normalizedQuery)).slice(0, 8);
}

function hideSearchSuggestionList(listEl) {
    if (listEl) {
        listEl.classList.add('hidden');
    }
}

function applySearchSuggestion(row, value) {
    if (!row) {
        return;
    }
    const input = row.querySelector('.search-value');
    const list = row.querySelector('.autocomplete-list');
    if (input) {
        input.value = value;
    }
    hideSearchSuggestionList(list);
    clearSearchResults();
}

async function showSearchSuggestions(row) {
    const typeSelect = row.querySelector('.search-type');
    const input = row.querySelector('.search-value');
    const list = row.querySelector('.autocomplete-list');

    if (!typeSelect || !input || !list) {
        return;
    }

    const currentType = typeSelect.value;
    if (!currentType) {
        hideSearchSuggestionList(list);
        return;
    }

    await ensureSearchSuggestions();
    const suggestions = filterSearchSuggestions(currentType, input.value);

    if (!suggestions || suggestions.length === 0) {
        hideSearchSuggestionList(list);
        return;
    }

    list.innerHTML = suggestions
        .map(
            (value) =>
                `<li class="autocomplete-item" data-value="${escapeHtml(value)}">${escapeHtml(value)}</li>`,
        )
        .join('');
    list.classList.remove('hidden');
}

function setupSearchRowAutocomplete(row) {
    const input = row.querySelector('.search-value');
    const list = row.querySelector('.autocomplete-list');

    if (!input || !list) {
        return;
    }

    input.addEventListener('focus', () => {
        showSearchSuggestions(row);
    });

    input.addEventListener('input', () => {
        showSearchSuggestions(row);
    });

    const handleSuggestionSelection = (event) => {
        const item = event.target.closest('.autocomplete-item');
        if (!item) {
            return;
        }
        const value = item.dataset.value || item.textContent || '';
        if (event.type === 'mousedown') {
            event.preventDefault();
        }
        applySearchSuggestion(row, value);
    };

    list.addEventListener('mousedown', handleSuggestionSelection);
    list.addEventListener('click', handleSuggestionSelection);

    input.addEventListener('blur', () => {
        setTimeout(() => hideSearchSuggestionList(list), 120);
    });
}

function renderSearchResults(contacts) {
    if (!searchResultsContainer) {
        return;
    }

    cacheContacts(contacts);

    if (!contacts || contacts.length === 0) {
        searchResultsContainer.innerHTML =
            '<p class="search-results-empty">No contacts match these filters yet.</p>';
    } else {
        const matchLabel = contacts.length === 1 ? 'match' : 'matches';
        const summary = `<p class="search-results-summary">${contacts.length} ${matchLabel} found</p>`;
        const cards = contacts.map((contact) => renderContact(contact)).join('');
        searchResultsContainer.innerHTML = summary + cards;
    }

    searchResultsContainer.classList.remove('hidden');
    searchResultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function refreshSearchResultsSummary() {
    if (!searchResultsContainer) {
        return;
    }
    const summaryEl = searchResultsContainer.querySelector('.search-results-summary');
    if (!summaryEl) {
        return;
    }
    const cards = searchResultsContainer.querySelectorAll('.contact-card');
    if (cards.length === 0) {
        searchResultsContainer.innerHTML =
            '<p class="search-results-empty">No contacts match these filters yet.</p>';
    } else {
        const matchLabel = cards.length === 1 ? 'match' : 'matches';
        summaryEl.textContent = `${cards.length} ${matchLabel} found`;
    }
}

async function executeSearchFilters(filters) {
    let combinedResults = null;

    for (const filter of filters) {
        let filterResults = [];

        switch (filter.type) {
            case 'id':
                filterResults = await contactService.searchById(filter.value);
                break;
            case 'name':
                filterResults = await contactService.searchByName(filter.name, filter.surname);
                break;
            case 'hashtag':
                filterResults = await contactService.searchByHashtag(filter.value);
                break;
            case 'event':
                filterResults = await contactService.searchByEvent(filter.value);
                break;
            default:
                filterResults = [];
        }

        if (combinedResults === null) {
            combinedResults = filterResults;
        } else {
            const allowedIds = new Set(filterResults.map((contact) => contact.id));
            combinedResults = combinedResults.filter((contact) => allowedIds.has(contact.id));
        }

        if (!combinedResults || combinedResults.length === 0) {
            return [];
        }
    }

    return combinedResults || [];
}

async function handleSearchFormSubmit(event) {
    event.preventDefault();

    if (!searchRowsContainer) {
        return;
    }

    clearSearchFormError();
    clearSearchResults();

    const rows = Array.from(searchRowsContainer.querySelectorAll('.search-row'));
    const rawFilters = [];
    let hasIncompleteRow = false;

    rows.forEach((row) => {
        const typeEl = row.querySelector('.search-type');
        const valueEl = row.querySelector('.search-value');
        const type = typeEl ? typeEl.value : '';
        const value = valueEl ? valueEl.value.trim() : '';

        if (!type && !value) {
            return;
        }

        if (!type || !value) {
            hasIncompleteRow = true;
            return;
        }

        rawFilters.push({ type, value });
    });

    if (hasIncompleteRow) {
        showSearchFormError(
            'Please select both a filter type and value for every row you want to use.',
        );
        return;
    }

    if (rawFilters.length === 0) {
        showSearchFormError('Add at least one filter before running a search.');
        return;
    }

    const preparedFilters = [];

    for (const filter of rawFilters) {
        switch (filter.type) {
            case 'id': {
                const numericId = parseInt(filter.value, 10);
                if (Number.isNaN(numericId)) {
                    showSearchFormError('Contact ID should be a number.');
                    return;
                }
                preparedFilters.push({ type: 'id', value: numericId });
                break;
            }
            case 'name': {
                const pieces = filter.value.split(/\s+/).filter(Boolean);
                if (pieces.length < 2) {
                    showSearchFormError(
                        'Enter both the name and surname for the Name & Surname filter.',
                    );
                    return;
                }
                const [firstName, ...rest] = pieces;
                preparedFilters.push({
                    type: 'name',
                    name: firstName,
                    surname: rest.join(' '),
                });
                break;
            }
            case 'hashtag': {
                const normalizedHashtag = filter.value.replace(/^#/, '').trim();
                if (!normalizedHashtag) {
                    showSearchFormError('Hashtag value cannot be empty.');
                    return;
                }
                preparedFilters.push({ type: 'hashtag', value: normalizedHashtag.toLowerCase() });
                break;
            }
            case 'event': {
                const eventName = filter.value.trim();
                if (!eventName) {
                    showSearchFormError('Event value cannot be empty.');
                    return;
                }
                preparedFilters.push({ type: 'event', value: eventName });
                break;
            }
            default:
                showSearchFormError('Unknown filter type selected.');
                return;
        }
    }

    try {
        showLoading();
        const results = await executeSearchFilters(preparedFilters);
        hideLoading();

        renderSearchResults(results);
    } catch (error) {
        hideLoading();
        showSearchFormError(error.message || 'Unable to run the search right now.');
    }
}

async function finalizeContactCreation(contactData) {
    try {
        showLoading();
        await contactService.createContact(contactData);
        hideLoading();
        resetContactForm();
        showSuccess('Contact added successfully!');
        listViewState.loaded = false;
        listViewState.contacts = [];
        listViewState.expandedKeys.clear();
    } catch (error) {
        hideLoading();
        if (formErrorMessage) {
            formErrorMessage.textContent = 'Error: ' + error.message;
            formErrorMessage.classList.remove('hidden');
            scrollToElement(formErrorMessage, { block: 'center' });
        }
    }
}

async function handleContactSubmission(contactData, options = {}) {
    const { skipDuplicateCheck = false } = options;

    if (!skipDuplicateCheck) {
        try {
            showLoading();
            const duplicates = await contactService.searchByName(
                contactData.name,
                contactData.surname,
            );
            hideLoading();

            if (duplicates.length > 0) {
                showDuplicatePrompt(contactData, duplicates.length);
                return;
            }
        } catch (error) {
            hideLoading();
            if (formErrorMessage) {
                formErrorMessage.textContent = 'Error checking duplicates: ' + error.message;
                formErrorMessage.classList.remove('hidden');
                scrollToElement(formErrorMessage, { block: 'center' });
            }
            return;
        }
    }

    await finalizeContactCreation(contactData);
}

function showDuplicatePrompt(contactData, duplicatesCount) {
    if (!formErrorMessage) {
        return;
    }

    const entriesLabel = duplicatesCount === 1 ? 'existing entry' : 'existing entries';
    formErrorMessage.innerHTML = `
        <p>Contact ${contactData.name} ${contactData.surname} already exists (${duplicatesCount} ${entriesLabel}). Do you want to add another?</p>
        <div class="form-error-actions">
            <button type="button" id="confirmDuplicateBtn" class="btn-primary">Add anyway</button>
            <button type="button" id="cancelDuplicateBtn" class="btn-outline">Cancel</button>
        </div>
    `;
    formErrorMessage.classList.remove('hidden');
    scrollToElement(formErrorMessage, { block: 'center' });

    const confirmBtn = document.getElementById('confirmDuplicateBtn');
    const cancelBtn = document.getElementById('cancelDuplicateBtn');

    if (confirmBtn) {
        confirmBtn.addEventListener(
            'click',
            async () => {
                formErrorMessage.classList.add('hidden');
                await handleContactSubmission(contactData, { skipDuplicateCheck: true });
            },
            { once: true },
        );
    }

    if (cancelBtn) {
        cancelBtn.addEventListener(
            'click',
            () => {
                formErrorMessage.classList.add('hidden');
            },
            { once: true },
        );
    }
}

// Display Functions
function showError(message) {
    listViewState.active = false;
    contentDisplay.innerHTML = `<div class="error">${message}</div>`;
    showView('content');
    removeFooterBackBar('success');
    scrollToElement(contentDisplay, { block: 'start' });
}

// Map Firebase auth error codes to user-friendly messages
function formatAuthError(error) {
    if (!error || !error.code) {
        return 'Something went wrong. Please try again.';
    }

    const code = error.code.replace('auth/', '');
    const messages = {
        'invalid-email': 'Please enter a valid email address.',
        'user-disabled': 'This account is disabled. Contact support if this is unexpected.',
        'user-not-found': "We couldn't find an account with that email.",
        'wrong-password': 'Incorrect password. Try again or reset your password.',
        'invalid-credential': 'Incorrect email or password. Please try again.',
        'email-already-in-use': 'That email is already registered. Try signing in instead.',
        'weak-password': 'Password is too short. Use at least 6 characters.',
        'too-many-requests': 'Too many attempts. Please wait a moment and try again.',
        'popup-closed-by-user': 'Google sign-in popup was closed before completing sign-in.',
        'popup-blocked': 'Popup was blocked by the browser. Allow popups and try again.',
        'cancelled-popup-request':
            'Another sign-in popup is already open. Complete it or close it first.',
        'unauthorized-domain': 'This domain is not authorized in Firebase Authentication settings.',
    };

    return messages[code] || 'Incorrect email or password. Please try again.';
}

function showSuccess(message) {
    listViewState.active = false;
    let html = `<div class="success">${message}</div>`;
    if (helperModeActive) {
        html += `
            <div class="helper-return-inline">
                <p>Finished with this introducer? Go back to the contact you were editing.</p>
                <button type="button" id="returnToPreviousAfterSuccess" class="btn-primary">Back to previous contact</button>
            </div>
        `;
    }
    contentDisplay.innerHTML = html;
    showView('content');
    injectFooterBackBar('success', 'Back to menu');

    if (helperModeActive) {
        const successReturnBtn = document.getElementById('returnToPreviousAfterSuccess');
        if (successReturnBtn) {
            successReturnBtn.addEventListener('click', () => {
                returnToPreviousContact();
            });
        }
    }
}

function buildContactDetailSections(contact, options = {}) {
    const {
        includeId = true,
        includeCreatedAt = true,
        includeAdvantage = true,
        includeSource = true,
        includeContactMethods = true,
        includeHashtags = true,
    } = options;

    const details = [];

    if (includeId && typeof contact.id !== 'undefined') {
        details.push(
            `<div class="contact-field"><strong>ID:</strong> ${escapeHtml(contact.id)}</div>`,
        );
    }

    if (includeCreatedAt && contact.created_at) {
        details.push(
            `<div class="contact-field"><strong>Connected:</strong> ${new Date(contact.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>`,
        );
    }

    if (contact.note) {
        details.push(
            `<div class="contact-field"><strong>Note:</strong> ${escapeHtml(contact.note)}</div>`,
        );
    }

    if (includeAdvantage && contact.advantage) {
        details.push(
            `<div class="contact-field"><strong>Advantage:</strong> ${escapeHtml(contact.advantage)}</div>`,
        );
    }

    if (includeSource && contact.source_type) {
        const sourceType = escapeHtml(contact.source_type);
        const sourceDetails = contact.source_value ? ` - ${escapeHtml(contact.source_value)}` : '';
        details.push(
            `<div class="contact-field"><strong>Source:</strong> ${sourceType}${sourceDetails}</div>`,
        );
    }

    if (includeContactMethods && contact.contact_methods && contact.contact_methods.length > 0) {
        details.push(`
            <div class="contact-field">
                <strong>Contact Info:</strong>
                <div class="contact-methods-list">
                    ${contact.contact_methods
                        .map((method) => {
                            const type = escapeHtml(method.type || '');
                            const value = escapeHtml(method.value || '');
                            return `<div class="contact-method-item"><span class="method-type">${type}:</span> <span class="method-value">${value}</span></div>`;
                        })
                        .join('')}
                </div>
            </div>
        `);
    }

    if (includeHashtags && contact.hashtags && contact.hashtags.length > 0) {
        details.push(`
            <div class="contact-field">
                <strong>Hashtags:</strong>
                ${contact.hashtags.map((tag) => `<span class="hashtag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
        `);
    }

    return details;
}

function renderContact(contact, brief = false) {
    const docIdAttr = contact.docId ? ` data-doc-id="${escapeHtml(contact.docId)}"` : '';
    const contactIdAttr =
        typeof contact.id !== 'undefined' ? ` data-contact-id="${escapeHtml(contact.id)}"` : '';
    const fullName = escapeHtml(
        `${contact.name || ''} ${contact.surname || ''}`.trim() || 'Unnamed contact',
    );
    const detailOptions = brief
        ? {
              includeCreatedAt: false,
              includeAdvantage: false,
              includeSource: false,
              includeContactMethods: false,
              includeHashtags: false,
          }
        : {};
    const details = buildContactDetailSections(contact, detailOptions);

    const hasActions = Boolean(contact.docId);
    const actionsMarkup = hasActions
        ? `
                <div class="contact-card-actions">
                        <button type="button" class="btn-outline btn-edit-contact" data-action="edit-contact" data-doc-id="${contact.docId}">Edit</button>
                        <button type="button" class="btn-danger btn-delete-contact" data-action="delete-contact" data-doc-id="${contact.docId}">Delete</button>
                </div>
        `
        : '';
    const editContainer = hasActions ? '<div class="contact-edit-container hidden"></div>' : '';

    return `
        <div class="contact-card"${docIdAttr}${contactIdAttr}>
            <h3>${fullName}${brief ? '' : ''}</h3>
            ${details.join('')}
            ${actionsMarkup}
            ${editContainer}
        </div>
    `;
}

function renderContactMethodRow(method = {}) {
    const type = (method.type || '').toString();
    const value = escapeHtml(method.value || '');
    const options = [
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' },
        { value: 'Linkedin', label: 'LinkedIn' },
        { value: 'Instagram', label: 'Instagram' },
        { value: 'Facebook', label: 'Facebook' },
        { value: 'other', label: 'Other' },
    ];
    const optionsMarkup = [
        '<option value="">Select type</option>',
        ...options.map((opt) => {
            const selected = opt.value.toLowerCase() === type.toLowerCase() ? 'selected' : '';
            return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        }),
    ].join('');

    return `
        <div class="contact-method-row">
            <select class="contact-type">
                ${optionsMarkup}
            </select>
            <input type="text" class="contact-value" placeholder="Enter contact details" value="${value}">
            <button type="button" class="btn-remove-contact" data-action="edit-remove-method" title="Remove" aria-label="Remove contact method">✕</button>
        </div>
    `;
}

function renderHashtagRow(tag = '') {
    return `
        <div class="hashtag-row">
            <input type="text" class="hashtag-input" placeholder="developer, startup, designer, mentor" value="${escapeHtml(tag)}">
            <button type="button" class="btn-remove-hashtag" data-action="edit-remove-hashtag" title="Remove" aria-label="Remove tag">✕</button>
        </div>
    `;
}

function renderContactEditForm(contact) {
    const methods =
        contact.contact_methods && contact.contact_methods.length > 0
            ? contact.contact_methods
            : [{ type: '', value: '' }];
    const hashtags = contact.hashtags && contact.hashtags.length > 0 ? contact.hashtags : [''];

    return `
        <form class="contact-edit-form" data-doc-id="${contact.docId}">
            <div class="form-group">
                <label>Name *</label>
                <input type="text" name="name" value="${escapeHtml(contact.name || '')}" autocomplete="off">
                <small class="input-error hidden" data-error-field="name">Please fill this field.</small>
            </div>
            <div class="form-group">
                <label>Surname *</label>
                <input type="text" name="surname" value="${escapeHtml(contact.surname || '')}" autocomplete="off">
                <small class="input-error hidden" data-error-field="surname">Please fill this field.</small>
            </div>
            <div class="form-group">
                <label>Note *</label>
                <textarea name="note" maxlength="1000">${escapeHtml(contact.note || '')}</textarea>
                <small class="char-count"><span data-role="edit-note-count">${(contact.note || '').length}</span>/1000</small>
                <small class="input-error hidden" data-error-field="note">Please fill this field.</small>
            </div>
            <div class="form-group">
                <label>Advantage</label>
                <textarea name="advantage" maxlength="1000">${escapeHtml(contact.advantage || '')}</textarea>
                <small class="char-count"><span data-role="edit-advantage-count">${(contact.advantage || '').length}</span>/1000</small>
            </div>
            <div class="form-group">
                <label>Event/Place where you met</label>
                <input type="text" name="eventName" placeholder="Tech Conference 2024, University of Warsaw" value="${contact.source_type === 'event' ? escapeHtml(contact.source_value || '') : ''}" autocomplete="off">
            </div>
            <div class="form-group">
                <label>Introduced by (person)</label>
                <input type="text" name="introducerName" placeholder="John Smith" value="${contact.source_type === 'contact' ? escapeHtml(contact.source_value || '') : ''}" autocomplete="off">
                <small class="input-error hidden" data-error-field="introducer">Please select someone already in your contacts or add them first.</small>
            </div>
            <div class="form-group">
                <label>Contact Information</label>
                <div class="contact-methods-container" data-role="edit-contact-methods">
                    ${methods.map(renderContactMethodRow).join('')}
                </div>
                <button type="button" class="btn-add-field" data-action="edit-add-method">+ Add another contact method</button>
            </div>
            <div class="form-group">
                <label>Tags - categories to help you find this contact</label>
                <div class="hashtags-container" data-role="edit-hashtags">
                    ${hashtags.map(renderHashtagRow).join('')}
                </div>
                <button type="button" class="btn-add-field" data-action="edit-add-hashtag">+ Add another tag</button>
            </div>
            <div class="form-buttons">
                <button type="submit" class="submit-btn">Save</button>
                <button type="button" class="cancel-btn" data-action="cancel-edit" data-doc-id="${contact.docId}">Cancel</button>
            </div>
            <div class="form-error-message contact-edit-error hidden"></div>
        </form>
    `;
}

function initializeContactEditForm(form) {
    if (!form) {
        return;
    }

    const noteInput = form.querySelector('textarea[name="note"]');
    const noteCount = form.querySelector('[data-role="edit-note-count"]');
    if (noteInput && noteCount) {
        noteInput.addEventListener('input', () => {
            noteCount.textContent = noteInput.value.length;
        });
    }

    const advantageInput = form.querySelector('textarea[name="advantage"]');
    const advantageCount = form.querySelector('[data-role="edit-advantage-count"]');
    if (advantageInput && advantageCount) {
        advantageInput.addEventListener('input', () => {
            advantageCount.textContent = advantageInput.value.length;
        });
    }
}

function getContactCardByDocId(docId) {
    if (!docId) {
        return null;
    }
    return document.querySelector(`.contact-card[data-doc-id="${docId}"]`);
}

function closeContactEditForm(docId) {
    const card = getContactCardByDocId(docId);
    if (!card) {
        return;
    }
    const container = card.querySelector('.contact-edit-container');
    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }
}

async function toggleContactEditForm(docId) {
    const card = getContactCardByDocId(docId);
    if (!card) {
        return;
    }
    const container = card.querySelector('.contact-edit-container');
    if (!container) {
        return;
    }

    if (!container.classList.contains('hidden')) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    const contact = contactCache.get(docId);
    if (!contact) {
        await alertDialog(
            'Contact details are not available right now. Please refresh and try again.',
            'Contact unavailable',
            'danger',
        );
        return;
    }

    container.innerHTML = renderContactEditForm(contact);
    container.classList.remove('hidden');
    const form = container.querySelector('.contact-edit-form');
    initializeContactEditForm(form);
}

function refreshContactCard(contact) {
    if (!contact || !contact.docId) {
        return;
    }
    const card = getContactCardByDocId(contact.docId);
    if (!card) {
        return;
    }
    if (card.classList.contains('list-view-card')) {
        updateContactInListState(contact);
        renderListView();
        return;
    }
    card.outerHTML = renderContact(contact);
}

function clearInlineEditErrors(form) {
    if (!form) {
        return;
    }
    form.querySelectorAll('.input-error').forEach((el) => el.classList.add('hidden'));
    const errorBox = form.querySelector('.contact-edit-error');
    if (errorBox) {
        errorBox.textContent = '';
        errorBox.classList.add('hidden');
    }
}

function setInlineFieldError(form, field, visible) {
    if (!form) {
        return;
    }
    const errorEl = form.querySelector(`.input-error[data-error-field="${field}"]`);
    if (errorEl) {
        if (visible) {
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }
    }
}

function setInlineEditError(form, message) {
    if (!form) {
        return;
    }
    const errorBox = form.querySelector('.contact-edit-error');
    if (errorBox) {
        errorBox.textContent = message;
        errorBox.classList.remove('hidden');
    } else {
        alertDialog(message, 'Error', 'danger');
    }
}

function getContactUniqueKey(contact) {
    if (contact.docId) {
        return contact.docId;
    }
    if (typeof contact.id !== 'undefined') {
        return `id-${contact.id}`;
    }
    return `${(contact.name || 'unknown').toLowerCase()}-${(contact.surname || 'unknown').toLowerCase()}`;
}

function renderListContactCard(contact) {
    const docIdAttr = contact.docId ? ` data-doc-id="${escapeHtml(contact.docId)}"` : '';
    const contactIdAttr =
        typeof contact.id !== 'undefined' ? ` data-contact-id="${escapeHtml(contact.id)}"` : '';
    const fullName = escapeHtml(
        `${contact.name || ''} ${contact.surname || ''}`.trim() || 'Unnamed contact',
    );
    const contactKey = getContactUniqueKey(contact);
    const contactKeyAttr = escapeHtml(contactKey);
    const isExpanded = listViewState.mode === 'full' || listViewState.expandedKeys.has(contactKey);
    const details = buildContactDetailSections(contact, { includeId: false });
    const detailMarkup =
        details.length > 0
            ? details.join('')
            : '<div class="contact-field"><em>No additional details yet.</em></div>';
    const hasActions = Boolean(contact.docId);
    const actionsMarkup = hasActions
        ? `
                <div class="contact-card-actions">
                        <button type="button" class="btn-outline btn-edit-contact" data-action="edit-contact" data-doc-id="${contact.docId}">Edit</button>
                        <button type="button" class="btn-danger btn-delete-contact" data-action="delete-contact" data-doc-id="${contact.docId}">Delete</button>
                </div>
        `
        : '';
    const editContainer = hasActions ? '<div class="contact-edit-container hidden"></div>' : '';
    const expandToggle =
        listViewState.mode === 'brief'
            ? `
            <button type="button" class="btn-link contact-expand-toggle" data-action="toggle-contact-details" data-contact-key="${contactKey}">
                ${isExpanded ? 'Collapse details' : 'Expand details'}
            </button>
        `
            : '';

    return `
        <div class="contact-card list-view-card"${docIdAttr}${contactIdAttr} data-contact-key="${contactKeyAttr}">
            <div class="contact-summary">
                <span class="contact-summary-name">${fullName}</span>
                ${typeof contact.id !== 'undefined' ? `<span class="contact-summary-id">ID: ${escapeHtml(contact.id)}</span>` : ''}
            </div>
            ${expandToggle}
            <div class="contact-details ${isExpanded ? '' : 'hidden'}">
                ${detailMarkup}
                ${actionsMarkup}
                ${editContainer}
            </div>
        </div>
    `;
}

function renderListView() {
    if (!contentDisplay) {
        return;
    }

    // Reset any existing list back bar before re-rendering
    removeListBackBar();
    const toggleTarget = listViewState.mode === 'brief' ? 'full' : 'brief';
    const toggleLabel =
        listViewState.mode === 'brief'
            ? 'Switch to full list (all details)'
            : 'Switch to brief list';

    const cardsMarkup =
        listViewState.contacts.length > 0
            ? listViewState.contacts.map((contact) => renderListContactCard(contact)).join('')
            : '<p class="list-view-empty">No contacts yet. Add your first one to get started.</p>';

    contentDisplay.innerHTML = `
        <div class="list-view-toolbar">
            <button class="btn-outline list-view-toggle" data-action="toggle-list-view" data-target-mode="${toggleTarget}">
                ${toggleLabel}
            </button>
        </div>
        <div class="list-view-results">
            ${cardsMarkup}
        </div>
    `;

    showView('content');
    listViewState.active = true;

    // Inject a local back bar right above the footer for list view
    injectListBackBar();
}

function injectFooterBackBar(scope, label = 'Back to menu') {
    const footer = document.querySelector('.site-footer');
    if (!footer) {
        return;
    }
    removeFooterBackBar(scope);
    const backBar = document.createElement('div');
    backBar.className = 'list-view-global-back';
    backBar.dataset.backScope = scope;
    backBar.innerHTML = `<button class="back-btn list-view-back" data-action="back">${label}</button>`;
    footer.parentNode.insertBefore(backBar, footer);
}

function removeFooterBackBar(scope) {
    document
        .querySelectorAll(`.list-view-global-back[data-back-scope="${scope}"]`)
        .forEach((el) => el.remove());
}

function injectListBackBar() {
    injectFooterBackBar('list', 'Back to menu');
}

function removeListBackBar() {
    removeFooterBackBar('list');
}

async function showListView(mode = 'brief', options = {}) {
    const { forceReload = false, resetExpanded = false } = options;
    const normalizedMode = mode === 'full' ? 'full' : 'brief';
    const needsReload = forceReload || !listViewState.loaded;

    if (needsReload) {
        try {
            showLoading();
            const contacts = await contactService.listAllContacts();
            hideLoading();
            listViewState.contacts = contacts;
            listViewState.loaded = true;
            cacheContacts(contacts);
            listViewState.expandedKeys.clear();
        } catch (error) {
            hideLoading();
            showError(error.message || 'Unable to load contacts right now.');
            return;
        }
    } else if (resetExpanded || normalizedMode === 'full') {
        listViewState.expandedKeys.clear();
    }

    listViewState.mode = normalizedMode;

    if (normalizedMode === 'full') {
        listViewState.expandedKeys.clear();
    }

    renderListView();
}

function toggleListContactDetails(contactKey) {
    if (!contactKey || !listViewState.active || listViewState.mode !== 'brief') {
        return;
    }
    if (listViewState.expandedKeys.has(contactKey)) {
        listViewState.expandedKeys.delete(contactKey);
    } else {
        listViewState.expandedKeys.add(contactKey);
    }
    renderListView();
}

function updateContactInListState(updatedContact) {
    if (!updatedContact || !updatedContact.docId) {
        return;
    }
    const index = listViewState.contacts.findIndex(
        (contact) => contact.docId === updatedContact.docId,
    );
    if (index !== -1) {
        listViewState.contacts[index] = { ...listViewState.contacts[index], ...updatedContact };
    }
}

function removeContactFromListState(docId) {
    if (!docId || listViewState.contacts.length === 0) {
        return;
    }
    const initialLength = listViewState.contacts.length;
    listViewState.contacts = listViewState.contacts.filter((contact) => contact.docId !== docId);
    if (initialLength !== listViewState.contacts.length) {
        listViewState.expandedKeys.delete(docId);
    }
}

// Modal Functions
function showModal(title, body, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    const modalContent = modal?.querySelector('.modal-content');
    if (modalContent) {
        modalContent.classList.remove('modal-danger', 'modal-info', 'modal-neutral');
        modalContent.classList.add('modal-neutral');
    }
    modal.classList.remove('hidden');

    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');
    if (confirmBtn) {
        confirmBtn.textContent = 'Confirm';
    }
    if (cancelBtn) {
        cancelBtn.textContent = 'Cancel';
        cancelBtn.classList.remove('hidden');
    }

    const handleConfirm = () => {
        onConfirm();
        closeModal();
    };

    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = closeModal;
}

function closeModal() {
    modal.classList.add('hidden');
    pendingDuplicates = null;
}

function getInlineDialogHost() {
    if (inlineDialogHost) {
        return inlineDialogHost;
    }

    if (authContainer && !authContainer.classList.contains('hidden')) {
        return authContainer;
    }

    const candidates = {
        add: addContactForm,
        search: searchMenu,
        list: listMenu,
        main: mainMenu,
        'contact-creator': contactCreatorSection,
        'network-graph': graphContactProfile || networkGraphView,
        statistics: statisticsView,
        content: contentArea,
    };

    const candidate = candidates[currentView];
    if (candidate && !candidate.classList.contains('hidden')) {
        return candidate;
    }

    switch (currentView) {
        default:
            return contentArea || document.body;
    }
}

function clearInlineDialog() {
    document.querySelectorAll('.inline-dialog').forEach((el) => el.remove());
}

function openInlineDialog(options = {}) {
    const {
        title = 'Notice',
        bodyHtml = '',
        confirmText = 'OK',
        cancelText = 'Cancel',
        showCancel = false,
        focusSelector = null,
        variant = 'error',
    } = options;

    return new Promise((resolve) => {
        clearInlineDialog();
        const host = getInlineDialogHost();
        if (!host) {
            resolve(false);
            return;
        }

        const dialog = document.createElement('div');
        dialog.className = `form-error-message inline-dialog inline-dialog-${variant}`;
        dialog.innerHTML = `
            <div class="inline-dialog-title">${escapeHtml(title)}</div>
            <div class="inline-dialog-body">${bodyHtml}</div>
            <div class="form-error-actions inline-dialog-actions">
                <button type="button" class="btn-primary inline-dialog-confirm">${escapeHtml(confirmText)}</button>
                ${showCancel ? `<button type="button" class="btn-outline inline-dialog-cancel">${escapeHtml(cancelText)}</button>` : ''}
            </div>
        `;

        host.appendChild(dialog);
        scrollToElement(dialog, { block: 'center' });

        const confirmBtn = dialog.querySelector('.inline-dialog-confirm');
        const cancelBtn = dialog.querySelector('.inline-dialog-cancel');

        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                dialog.remove();
                resolve(true);
            });
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                dialog.remove();
                resolve(false);
            });
        }

        if (focusSelector) {
            setTimeout(() => {
                const focusEl =
                    dialog.querySelector(focusSelector) || document.querySelector(focusSelector);
                if (focusEl && typeof focusEl.focus === 'function') {
                    focusEl.focus();
                }
            }, 0);
        }
    });
}

async function alertDialog(message, title = 'Notice', variant = 'error') {
    await openInlineDialog({
        title,
        bodyHtml: `<p>${escapeHtml(message)}</p>`,
        confirmText: 'OK',
        showCancel: false,
        variant,
    });
}

async function confirmDialog(message, options = {}) {
    const {
        title = 'Confirm action',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        variant = 'error',
    } = options;

    return await openInlineDialog({
        title,
        bodyHtml: `<p>${escapeHtml(message)}</p>`,
        confirmText,
        cancelText,
        showCancel: true,
        variant,
    });
}

async function promptDialog(options = {}) {
    const {
        title = 'Enter value',
        label = 'Value',
        placeholder = '',
        confirmText = 'Continue',
        cancelText = 'Cancel',
        initialValue = '',
    } = options;

    const inputId = 'inlineDialogPromptInput';
    const bodyHtml = `
        <div class="form-group">
            <label for="${inputId}">${escapeHtml(label)}</label>
            <input type="text" id="${inputId}" value="${escapeHtml(initialValue)}" placeholder="${escapeHtml(placeholder)}">
        </div>
    `;

    const confirmed = await openInlineDialog({
        title,
        bodyHtml,
        confirmText,
        cancelText,
        showCancel: true,
        focusSelector: `#${inputId}`,
    });

    if (!confirmed) {
        return null;
    }

    const inputEl = document.getElementById(inputId);
    return inputEl ? inputEl.value.trim() : '';
}

// Action Handlers
async function handleNetworkGraph() {
    try {
        showLoading();
        const contacts = await contactService.listAllContacts();
        hideLoading();

        showView('network-graph');
        cacheContacts(contacts);
        resetGraphProfilePanel();

        // Initialize graph with contacts data
        networkGraph.initializeGraph(networkGraphContainer, contacts, {
            onNodeSelect: (contact) => displayGraphContactProfile(contact),
            onEventSelect: (event) => displayGraphEventProfile(event),
            onBackgroundClick: () => resetGraphProfilePanel(),
        });
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

async function handleStatistics() {
    try {
        showLoading();
        const contacts = await contactService.listAllContacts();
        hideLoading();

        showView('statistics');

        // Calculate statistics
        const stats = calculateStatistics(contacts);
        displayStatistics(stats);
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

function calculateStatistics(contacts) {
    const totalContacts = contacts.length;

    // Source statistics (event vs contact)
    const sourceStats = {};
    const eventStats = {};
    const introducerStats = {};

    contacts.forEach((contact) => {
        // Count by source type
        if (contact.source_type) {
            sourceStats[contact.source_type] = (sourceStats[contact.source_type] || 0) + 1;

            // If event, count specific events
            if (contact.source_type === 'event' && contact.source_value) {
                const eventName = contact.source_value;
                eventStats[eventName] = (eventStats[eventName] || 0) + 1;
            }

            // If introduced by person, count introducers
            if (contact.source_type === 'contact' && contact.source_value) {
                const introducerName = contact.source_value;
                introducerStats[introducerName] = (introducerStats[introducerName] || 0) + 1;
            }
        }
    });

    // Sort events by count
    const sortedEvents = Object.entries(eventStats).sort((a, b) => b[1] - a[1]);

    // Sort introducers by count
    const sortedIntroducers = Object.entries(introducerStats).sort((a, b) => b[1] - a[1]);

    return {
        totalContacts,
        sourceStats,
        eventStats: sortedEvents,
        introducerStats: sortedIntroducers,
        mostPopularEvent: sortedEvents[0] || null,
        leastPopularEvent: sortedEvents[sortedEvents.length - 1] || null,
        topIntroducer: sortedIntroducers[0] || null,
        leastIntroducer: sortedIntroducers[sortedIntroducers.length - 1] || null,
    };
}

function displayStatistics(stats) {
    let html = `
        <div class="stat-card">
            <h3>General Statistics</h3>
            <div class="stat-item">
                <span class="stat-label">Total contacts:</span>
                <span class="stat-value">${stats.totalContacts}</span>
            </div>
        </div>
    `;

    // Source type breakdown
    if (Object.keys(stats.sourceStats).length > 0) {
        html += `
            <div class="stat-card">
                <h3>Contact Sources</h3>
        `;
        Object.entries(stats.sourceStats).forEach(([type, count]) => {
            const percentage = ((count / stats.totalContacts) * 100).toFixed(1);
            const label = type === 'event' ? 'Events' : type === 'contact' ? 'Referrals' : type;
            html += `
                <div class="stat-item">
                    <span class="stat-label">${label}:</span>
                    <span class="stat-value">${count} (${percentage}%)</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Event statistics
    if (stats.eventStats.length > 0) {
        html += `
            <div class="stat-card">
                <h3>Event Statistics</h3>
        `;

        stats.eventStats.forEach(([eventName, count]) => {
            html += `
                <div class="stat-item">
                    <span class="stat-label">${eventName}:</span>
                    <span class="stat-value">${count} ${count === 1 ? 'person' : 'people'}</span>
                </div>
            `;
        });

        if (stats.mostPopularEvent) {
            html += `
                <div class="stat-highlight">
                    <strong>Most popular event:</strong> ${stats.mostPopularEvent[0]} (${stats.mostPopularEvent[1]} ${stats.mostPopularEvent[1] === 1 ? 'person' : 'people'})
                </div>
            `;
        }

        html += `</div>`;
    }

    // Introducer statistics
    if (stats.introducerStats.length > 0) {
        html += `
            <div class="stat-card">
                <h3>Introducers</h3>
        `;

        stats.introducerStats.forEach(([introducerName, count]) => {
            html += `
                <div class="stat-item">
                    <span class="stat-label">${introducerName}:</span>
                    <span class="stat-value">${count} ${count === 1 ? 'person' : 'people'}</span>
                </div>
            `;
        });

        if (stats.topIntroducer) {
            html += `
                <div class="stat-highlight">
                    <strong>Most introductions:</strong> ${stats.topIntroducer[0]} (${stats.topIntroducer[1]} ${stats.topIntroducer[1] === 1 ? 'person' : 'people'})
                </div>
            `;
        }

        if (stats.leastIntroducer && stats.introducerStats.length > 1) {
            html += `
                <div class="stat-highlight">
                    <strong>Fewest introductions:</strong> ${stats.leastIntroducer[0]} (${stats.leastIntroducer[1]} ${stats.leastIntroducer[1] === 1 ? 'person' : 'people'})
                </div>
            `;
        }

        html += `</div>`;
    }

    if (stats.totalContacts === 0) {
        html =
            '<div class="stat-card"><p>You don\'t have any contacts yet. Add your first contact to see statistics!</p></div>';
    }

    statisticsContent.innerHTML = html;
}

async function handleListFull() {
    await showListView('full', { forceReload: true });
}

async function handleListBrief() {
    await showListView('brief', { forceReload: true, resetExpanded: true });
}

async function handleDeleteById() {
    const id = await promptDialog({
        title: 'Delete contact',
        label: 'Contact ID',
        placeholder: 'Enter contact ID',
    });
    if (!id) return;

    const confirmDelete = await confirmDialog(
        `Are you sure you want to delete contact with ID ${id}?`,
        { title: 'Confirm deletion', confirmText: 'Delete contact', variant: 'danger' },
    );
    if (!confirmDelete) {
        return;
    }

    try {
        showLoading();
        await contactService.deleteById(id);
        hideLoading();
        showSuccess('Contact deleted successfully!');
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

async function handleDeleteByName() {
    const name = await promptDialog({
        title: 'Delete contact',
        label: 'Name',
        placeholder: 'Enter name',
    });
    if (!name) return;
    const surname = await promptDialog({
        title: 'Delete contact',
        label: 'Surname',
        placeholder: 'Enter surname',
    });
    if (!surname) return;

    try {
        showLoading();
        const result = await contactService.deleteByName(name, surname);
        hideLoading();

        if (result.success) {
            showSuccess('Contact deleted successfully!');
        } else {
            // Handle duplicates
            const duplicatesHtml = result.duplicates
                .map(
                    (contact, index) => `
        <div class="contact-card" style="cursor: pointer;" data-index="${index}">
          <h4>${index + 1}. ID: ${contact.id}</h4>
          <p><strong>Note:</strong> ${contact.note}</p>
          ${contact.advantage ? `<p><strong>Advantage:</strong> ${contact.advantage}</p>` : ''}
        </div>
      `,
                )
                .join('');

            pendingDuplicates = result.duplicates;

            showModal(
                'Multiple Contacts Found',
                `<p>Found ${result.duplicates.length} contacts with this name. Select one to delete:</p>${duplicatesHtml}`,
                () => {}, // Will be handled by card click
            );

            // Add click handlers to cards
            setTimeout(() => {
                document.querySelectorAll('#modalBody .contact-card').forEach((card) => {
                    card.addEventListener('click', async () => {
                        const index = parseInt(card.dataset.index);
                        const contactToDelete = pendingDuplicates[index];
                        closeModal();

                        const confirmDuplicateDelete = await confirmDialog(
                            `Delete contact ID ${contactToDelete.id}: ${contactToDelete.name} ${contactToDelete.surname}?`,
                            {
                                title: 'Confirm deletion',
                                confirmText: 'Delete contact',
                                variant: 'danger',
                            },
                        );
                        if (confirmDuplicateDelete) {
                            try {
                                showLoading();
                                await contactService.deleteByDocId(contactToDelete.docId);
                                hideLoading();
                                showSuccess('Contact deleted successfully!');
                            } catch (error) {
                                hideLoading();
                                showError(error.message);
                            }
                        }
                    });
                });
            }, 100);
        }
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
}

async function handleInlineDelete(docId) {
    if (!docId) {
        await alertDialog('This contact is missing an identifier.', 'Missing identifier', 'danger');
        return;
    }

    const cachedContact = contactCache.get(docId);
    const displayName = cachedContact
        ? `${cachedContact.name || ''} ${cachedContact.surname || ''}`.trim()
        : 'this contact';
    const confirmed = await confirmDialog(
        `Are you sure you want to delete ${displayName || 'this contact'}?`,
        { title: 'Confirm deletion', confirmText: 'Delete contact', variant: 'danger' },
    );
    if (!confirmed) {
        return;
    }

    try {
        showLoading();
        await contactService.deleteByDocId(docId);
        hideLoading();
        contactCache.delete(docId);
        const card = getContactCardByDocId(docId);
        if (card) {
            const isListViewCard = card.classList.contains('list-view-card');
            const isInSearchResults =
                searchResultsContainer && searchResultsContainer.contains(card);
            card.remove();
            if (isInSearchResults) {
                refreshSearchResultsSummary();
            }
            if (isListViewCard) {
                removeContactFromListState(docId);
                renderListView();
            }
        }
        await alertDialog('Contact deleted successfully.', 'Contact deleted', 'success');
    } catch (error) {
        hideLoading();
        await alertDialog(
            error.message || 'Unable to delete this contact right now.',
            'Delete failed',
            'danger',
        );
    }
}

async function handleInlineEditSubmit(form) {
    if (!form) {
        return;
    }

    const docId = form.dataset.docId;
    if (!docId) {
        setInlineEditError(form, 'Missing contact identifier.');
        return;
    }

    clearInlineEditErrors(form);

    const nameInput = form.querySelector('input[name="name"]');
    const surnameInput = form.querySelector('input[name="surname"]');
    const noteInput = form.querySelector('textarea[name="note"]');
    const advantageInput = form.querySelector('textarea[name="advantage"]');
    const eventInput = form.querySelector('input[name="eventName"]');
    const introducerInput = form.querySelector('input[name="introducerName"]');

    const name = nameInput ? nameInput.value.trim() : '';
    const surname = surnameInput ? surnameInput.value.trim() : '';
    const note = noteInput ? noteInput.value.trim() : '';
    const advantage = advantageInput ? advantageInput.value.trim() : '';
    const eventName = eventInput ? eventInput.value.trim() : '';
    const introducerName = introducerInput ? introducerInput.value.trim() : '';

    let hasErrors = false;
    if (!name) {
        setInlineFieldError(form, 'name', true);
        hasErrors = true;
    }
    if (!surname) {
        setInlineFieldError(form, 'surname', true);
        hasErrors = true;
    }
    if (!note) {
        setInlineFieldError(form, 'note', true);
        hasErrors = true;
    }

    if (hasErrors) {
        setInlineEditError(form, 'Please fix the highlighted fields before saving.');
        return;
    }

    if (introducerName) {
        const introducerExists = await isIntroducerKnown(introducerName);
        if (!introducerExists) {
            setInlineFieldError(form, 'introducer', true);
            setInlineEditError(
                form,
                'Please select someone already in your contacts or add them first.',
            );
            return;
        }
    } else {
        setInlineFieldError(form, 'introducer', false);
    }

    const contactMethods = [];
    const methodRows = form.querySelectorAll(
        '[data-role="edit-contact-methods"] .contact-method-row',
    );
    methodRows.forEach((row) => {
        const type = row.querySelector('.contact-type')?.value || '';
        const value = row.querySelector('.contact-value')?.value.trim() || '';
        if (type && value) {
            contactMethods.push({ type, value });
        }
    });

    const hashtags = [];
    const hashtagRows = form.querySelectorAll('[data-role="edit-hashtags"] .hashtag-row');
    hashtagRows.forEach((row) => {
        const value = row.querySelector('.hashtag-input')?.value.trim();
        if (value) {
            hashtags.push(value);
        }
    });

    let source_type = '';
    let source_value = '';

    if (eventName && introducerName) {
        source_type = 'event';
        source_value = `${eventName} (introduced by ${introducerName})`;
    } else if (eventName) {
        source_type = 'event';
        source_value = eventName;
    } else if (introducerName) {
        source_type = 'contact';
        source_value = introducerName;
    }

    const cachedContact = contactCache.get(docId) || {};

    const payload = {
        ...cachedContact,
        name,
        surname,
        note,
        advantage,
        source_type,
        source_value,
        contact_methods: contactMethods,
        hashtags,
    };

    try {
        showLoading();
        const updatedContact = await contactService.updateContact(docId, payload);
        hideLoading();
        const mergedContact = { ...cachedContact, ...updatedContact };
        contactCache.set(docId, mergedContact);
        refreshContactCard(mergedContact);
        await alertDialog('Contact updated successfully.', 'Contact updated', 'success');
    } catch (error) {
        hideLoading();
        setInlineEditError(form, error.message || 'Unable to save this contact right now.');
    }
}

// Handle adding/removing hashtags
const hashtagsContainer = document.getElementById('hashtagsContainer');
const addHashtagBtn = document.getElementById('addHashtag');

addHashtagBtn.addEventListener('click', () => {
    const newRow = document.createElement('div');
    newRow.className = 'hashtag-row';
    newRow.innerHTML = `
        <div class="autocomplete-wrapper">
            <input type="text" class="hashtag-input" placeholder="developer, startup, designer, mentor" autocomplete="off">
            <ul class="autocomplete-list hidden"></ul>
        </div>
        <button type="button" class="btn-remove-hashtag" title="Remove" aria-label="Remove tag">✕</button>
    `;
    const input = newRow.querySelector('.hashtag-input');
    const suggestionsList = newRow.querySelector('.autocomplete-list');
    setupHashtagAutocomplete(input, suggestionsList);
    hashtagsContainer.appendChild(newRow);
});

// Event delegation for removing hashtag rows
hashtagsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove-hashtag')) {
        const rows = hashtagsContainer.querySelectorAll('.hashtag-row');
        if (rows.length > 1) {
            e.target.closest('.hashtag-row').remove();
        } else {
            // Reset first row instead of removing
            e.target.closest('.hashtag-row').querySelector('.hashtag-input').value = '';
        }
    }
});

// Autocomplete functions
async function getExistingEvents() {
    try {
        const contacts = await contactService.listAllContacts();
        const events = new Set();
        contacts.forEach((c) => {
            if (c.source_type === 'event' && c.source_value) {
                events.add(c.source_value);
            }
        });
        return Array.from(events).sort();
    } catch {
        return [];
    }
}

async function getExistingIntroducers() {
    try {
        const contacts = await contactService.listAllContacts();
        const introducers = new Set();
        // Add all contacts as potential introducers (full name)
        contacts.forEach((c) => {
            if (c.name && c.surname) {
                introducers.add(`${c.name} ${c.surname}`);
            }
        });
        return Array.from(introducers).sort();
    } catch {
        return [];
    }
}

async function isIntroducerKnown(introducerName) {
    if (!introducerName) {
        return true;
    }
    const existingIntroducers = await getExistingIntroducers();
    const normalized = introducerName.trim().toLowerCase();
    return existingIntroducers.some((name) => name.toLowerCase() === normalized);
}

async function getExistingTags() {
    try {
        const contacts = await contactService.listAllContacts();
        const tags = new Set();
        contacts.forEach((c) => {
            if (c.hashtags && Array.isArray(c.hashtags)) {
                c.hashtags.forEach((tag) => tags.add(tag));
            }
        });
        return Array.from(tags).sort();
    } catch {
        return [];
    }
}

function showAutocomplete(input, suggestionsList, items) {
    const value = input.value.trim().toLowerCase();
    if (!value) {
        suggestionsList.classList.add('hidden');
        return;
    }

    const filtered = items.filter((item) => item.toLowerCase().includes(value));

    if (filtered.length === 0) {
        suggestionsList.classList.add('hidden');
        return;
    }

    suggestionsList.innerHTML = filtered
        .map((item) => `<li class="autocomplete-item">${item}</li>`)
        .join('');
    suggestionsList.classList.remove('hidden');
}

function setupEventAutocomplete() {
    const eventInput = document.getElementById('eventName');
    const eventList = document.getElementById('eventSuggestions');
    let existingEvents = [];

    eventInput.addEventListener('focus', async () => {
        existingEvents = await getExistingEvents();
        // Show all events on focus
        if (existingEvents.length > 0) {
            eventList.innerHTML = existingEvents
                .map((item) => `<li class="autocomplete-item">${item}</li>`)
                .join('');
            eventList.classList.remove('hidden');
        }
    });

    eventInput.addEventListener('input', () => {
        showAutocomplete(eventInput, eventList, existingEvents);
    });

    eventList.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-item')) {
            eventInput.value = e.target.textContent;
            eventList.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== eventInput && !eventList.contains(e.target)) {
            eventList.classList.add('hidden');
        }
    });
}

function setupIntroducerAutocomplete() {
    const introducerInput = document.getElementById('introducerName');
    const introducerList = document.getElementById('introducerSuggestions');
    let existingIntroducers = [];

    introducerInput.addEventListener('focus', async () => {
        existingIntroducers = await getExistingIntroducers();
        // Show all introducers on focus
        if (existingIntroducers.length > 0) {
            introducerList.innerHTML = existingIntroducers
                .map((item) => `<li class="autocomplete-item">${item}</li>`)
                .join('');
            introducerList.classList.remove('hidden');
        }
    });

    introducerInput.addEventListener('input', () => {
        showAutocomplete(introducerInput, introducerList, existingIntroducers);
    });

    introducerList.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-item')) {
            introducerInput.value = e.target.textContent;
            introducerList.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== introducerInput && !introducerList.contains(e.target)) {
            introducerList.classList.add('hidden');
        }
    });
}

function setupHashtagAutocomplete(input, suggestionsList) {
    let existingTags = [];

    input.addEventListener('focus', async () => {
        existingTags = await getExistingTags();
    });

    input.addEventListener('input', () => {
        showAutocomplete(input, suggestionsList, existingTags);
    });

    suggestionsList.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-item')) {
            input.value = e.target.textContent;
            suggestionsList.classList.add('hidden');
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input && !suggestionsList.contains(e.target)) {
            suggestionsList.classList.add('hidden');
        }
    });
}

// Initialize autocomplete for existing fields
setupEventAutocomplete();
setupIntroducerAutocomplete();

// Setup autocomplete for initial hashtag field
const initialHashtagInput = document.querySelector('.hashtag-row .hashtag-input');
const initialHashtagList = document.querySelector('.hashtag-row .autocomplete-list');
if (initialHashtagInput && initialHashtagList) {
    setupHashtagAutocomplete(initialHashtagInput, initialHashtagList);
}

// Search form interactions
if (searchRowsContainer) {
    const initialSearchRows = Array.from(searchRowsContainer.querySelectorAll('.search-row'));
    initialSearchRows.forEach(setupSearchRowAutocomplete);
}

if (addSearchRowBtn && searchRowsContainer) {
    addSearchRowBtn.addEventListener('click', () => {
        const newRow = createSearchRow();
        searchRowsContainer.appendChild(newRow);
        setupSearchRowAutocomplete(newRow);
        clearSearchResults();
    });
}

if (searchRowsContainer) {
    searchRowsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-search')) {
            const rows = searchRowsContainer.querySelectorAll('.search-row');
            if (rows.length > 1) {
                e.target.closest('.search-row').remove();
            } else if (rows.length === 1) {
                resetSearchRow(rows[0]);
            }
            clearSearchFormError();
            clearSearchResults();
        }
    });

    searchRowsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('search-type')) {
            const row = e.target.closest('.search-row');
            setSearchRowPlaceholder(e.target);
            clearSearchFormError();
            clearSearchResults();
            if (row) {
                const list = row.querySelector('.autocomplete-list');
                hideSearchSuggestionList(list);
                const input = row.querySelector('.search-value');
                if (input && document.activeElement === input && input.value.trim()) {
                    showSearchSuggestions(row);
                }
            }
        }
    });

    searchRowsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('search-value')) {
            clearSearchFormError();
            clearSearchResults();
        }
    });
}

if (searchForm) {
    searchForm.addEventListener('submit', handleSearchFormSubmit);
}

if (addIntroducerContactBtn) {
    addIntroducerContactBtn.addEventListener('click', () => {
        const introducerInputEl = document.getElementById('introducerName');
        if (!introducerInputEl) {
            return;
        }

        const introducerValue = introducerInputEl.value.trim();
        if (!introducerValue) {
            return;
        }

        const baseUrl = window.location.href.split('?')[0];
        const redirectUrl = `${baseUrl}?introducerContact=${encodeURIComponent(introducerValue)}`;
        window.open(redirectUrl, '_blank');
    });
}

if (backToPreviousContactBtn) {
    backToPreviousContactBtn.addEventListener('click', () => {
        returnToPreviousContact();
    });
}

// Character counter for note field
const noteInput = document.getElementById('note');
const noteCount = document.getElementById('noteCount');
if (noteInput && noteCount) {
    noteInput.addEventListener('input', () => {
        noteCount.textContent = noteInput.value.length;
    });
}

// Character counter for advantage field
const advantageInput = document.getElementById('advantage');
const advantageCount = document.getElementById('advantageCount');
if (advantageInput && advantageCount) {
    advantageInput.addEventListener('input', () => {
        advantageCount.textContent = advantageInput.value.length;
    });
}

const addContactMethodBtn = document.getElementById('addContactMethod');
const contactMethodsContainer = document.getElementById('contactMethodsContainer');

if (addContactMethodBtn && contactMethodsContainer) {
    addContactMethodBtn.addEventListener('click', () => {
        const newRow = document.createElement('div');
        newRow.className = 'contact-method-row';
        newRow.innerHTML = `
            <select class="contact-type">
                <option value="">Select type</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="linkedin">LinkedIn</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
                <option value="twitter">Twitter/X</option>
                <option value="github">GitHub</option>
                <option value="website">Website</option>
                <option value="other">Other</option>
            </select>
            <input type="text" class="contact-value" placeholder="Enter contact details">
            <button type="button" class="btn-remove-contact" title="Remove" aria-label="Remove contact method">✕</button>
        `;
        contactMethodsContainer.appendChild(newRow);
    });
}

// Event delegation for removing contact method rows
if (contactMethodsContainer) {
    contactMethodsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-contact')) {
            const rows = contactMethodsContainer.querySelectorAll('.contact-method-row');
            if (rows.length > 1) {
                e.target.closest('.contact-method-row').remove();
            } else {
                // Reset first row instead of removing
                const row = e.target.closest('.contact-method-row');
                row.querySelector('.contact-type').value = '';
                row.querySelector('.contact-value').value = '';
            }
        }
    });
}

const contactForm = document.getElementById('contactForm');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (formErrorMessage) {
            formErrorMessage.classList.add('hidden');
            formErrorMessage.textContent = '';
        }

        const nameErrorEl = document.getElementById('nameError');
        const surnameErrorEl = document.getElementById('surnameError');
        const noteErrorEl = document.getElementById('noteError');
        const introducerErrorEl = document.getElementById('introducerError');
        [nameErrorEl, surnameErrorEl, noteErrorEl, introducerErrorEl].forEach(
            (el) => el && el.classList.add('hidden'),
        );

        // Validate required fields
        const name = document.getElementById('name').value.trim();
        const surname = document.getElementById('surname').value.trim();
        const note = document.getElementById('note').value.trim();
        const introducerName = document.getElementById('introducerName').value.trim();

        let hasErrors = false;

        if (!name && nameErrorEl) {
            nameErrorEl.classList.remove('hidden');
            hasErrors = true;
        }
        if (!surname && surnameErrorEl) {
            surnameErrorEl.classList.remove('hidden');
            hasErrors = true;
        }
        if (!note && noteErrorEl) {
            noteErrorEl.classList.remove('hidden');
            hasErrors = true;
        }

        if (introducerName) {
            const introducerExists = await isIntroducerKnown(introducerName);
            if (!introducerExists) {
                if (introducerErrorEl) {
                    introducerErrorEl.classList.remove('hidden');
                }
                hasErrors = true;
            }
        }

        if (hasErrors) {
            if (formErrorMessage) {
                formErrorMessage.textContent = 'Please fix the highlighted fields.';
                formErrorMessage.classList.remove('hidden');
            }
            return;
        }

        // Collect optional hashtags
        const hashtagRows = hashtagsContainer.querySelectorAll('.hashtag-row');
        const hashtags = [];

        hashtagRows.forEach((row) => {
            const tag = row.querySelector('.hashtag-input').value.trim();
            if (tag) {
                hashtags.push(tag);
            }
        });

        // Determine source_type and source_value based on what was filled
        let source_type = '';
        let source_value = '';

        const eventName = document.getElementById('eventName').value.trim();

        if (eventName && introducerName) {
            // Both filled - prioritize event, store introducer in advantage or note
            source_type = 'event';
            source_value = eventName + ' (introduced by ' + introducerName + ')';
        } else if (eventName) {
            source_type = 'event';
            source_value = eventName;
        } else if (introducerName) {
            source_type = 'contact';
            source_value = introducerName;
        }

        // Collect contact methods
        const contactMethods = [];
        if (contactMethodsContainer) {
            const methodRows = contactMethodsContainer.querySelectorAll('.contact-method-row');
            methodRows.forEach((row) => {
                const type = row.querySelector('.contact-type').value;
                const value = row.querySelector('.contact-value').value.trim();
                if (type && value) {
                    contactMethods.push({ type, value });
                }
            });
        }

        const contactData = {
            name: name,
            surname: surname,
            note: note,
            advantage: document.getElementById('advantage').value,
            source_type: source_type,
            source_value: source_value,
            contact_methods: contactMethods,
            hashtags: hashtags,
        };

        await handleContactSubmission(contactData);
    });
}

const buildCreatorMailtoLink = (body) =>
    `mailto:baran_zuzanna@outlook.com?subject=${encodeURIComponent(feedbackMailSubject)}&body=${encodeURIComponent(body)}`;

const sendFeedbackViaCloud = async (message, name = '') => {
    if (
        window.emailjs &&
        emailjsConfig.serviceId &&
        emailjsConfig.templateId &&
        emailjsConfig.publicKey
    ) {
        const payload = {
            name: name || 'Anonymous',
            time: new Date().toLocaleString('en-US'),
            message,
        };
        await window.emailjs.send(
            emailjsConfig.serviceId,
            emailjsConfig.templateId,
            payload,
            emailjsConfig.publicKey,
        );
        return true;
    }

    if (!feedbackEndpoint) {
        return false;
    }

    const response = await fetch(feedbackEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
    });

    if (!response.ok) {
        throw new Error(`Feedback endpoint returned ${response.status}`);
    }

    return true;
};

if (contactCreatorForm) {
    const submitBtn = contactCreatorForm.querySelector('button[type="submit"]');
    const submitDefaultText = submitBtn?.textContent || 'Send suggestion';

    contactCreatorForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = (document.getElementById('creatorMessage')?.value || '').trim();
        const name = (document.getElementById('creatorName')?.value || '').trim();
        const nameErrorEl = document.getElementById('creatorNameError');

        if (nameErrorEl) {
            nameErrorEl.classList.add('hidden');
        }

        let hasCreatorErrors = false;

        if (!name) {
            hasCreatorErrors = true;
            if (nameErrorEl) {
                nameErrorEl.classList.remove('hidden');
            }
        }
        if (!message) {
            hasCreatorErrors = true;
            await alertDialog(
                'Please describe your suggestion or issue before sending.',
                'Missing message',
                'danger',
            );
        }
        if (hasCreatorErrors) {
            return;
        }

        const openMailClient = () => {
            window.location.href = buildCreatorMailtoLink(message);
        };

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
        }

        try {
            const sentViaCloud = await sendFeedbackViaCloud(message, name);
            if (!sentViaCloud) {
                openMailClient();
                return;
            }

            await alertDialog(
                'Message sent! Thank you for your feedback.',
                'Message sent',
                'success',
            );
            contactCreatorForm.reset();
        } catch (error) {
            console.error('Feedback send error:', error);
            await alertDialog(
                'Automatic send failed. Opening your email app so you can send the message manually.',
                'Send failed',
                'danger',
            );
            openMailClient();
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitDefaultText;
            }
        }
    });
}

if (landingContactCreatorForm) {
    const submitBtn = landingContactCreatorForm.querySelector('button[type="submit"]');
    const submitDefaultText = submitBtn?.textContent || 'Send message';
    const noticeEl = document.getElementById('landingCreatorNotice');
    const noticeTextEl = document.getElementById('landingCreatorNoticeText');

    const clearLandingCreatorNotice = () => {
        if (!noticeEl) {
            return;
        }
        noticeEl.classList.add('hidden');
        noticeEl.classList.remove('landing-creator-notice-success');
        if (noticeTextEl) {
            noticeTextEl.textContent = '';
        }
    };

    const showLandingCreatorNotice = (message, variant = 'danger') => {
        if (!noticeEl) {
            return;
        }
        noticeEl.classList.remove('hidden');
        noticeEl.classList.toggle('landing-creator-notice-success', variant === 'success');
        if (noticeTextEl) {
            noticeTextEl.textContent = message;
        }
    };

    landingContactCreatorForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearLandingCreatorNotice();

        const message = (document.getElementById('landingCreatorMessage')?.value || '').trim();
        const name = (document.getElementById('landingCreatorName')?.value || '').trim();
        const nameErrorEl = document.getElementById('landingCreatorNameError');

        if (nameErrorEl) {
            nameErrorEl.classList.add('hidden');
        }

        let hasErrors = false;

        if (!name) {
            hasErrors = true;
            if (nameErrorEl) {
                nameErrorEl.classList.remove('hidden');
            }
        }
        if (!message) {
            hasErrors = true;
            showLandingCreatorNotice(
                'Please describe your suggestion or issue before sending.',
                'danger',
            );
        }
        if (hasErrors) {
            return;
        }

        const openMailClient = () => {
            window.location.href = buildCreatorMailtoLink(message);
        };

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
        }

        try {
            const sentViaCloud = await sendFeedbackViaCloud(message, name);
            if (!sentViaCloud) {
                openMailClient();
                return;
            }

            showLandingCreatorNotice('Message sent! Thank you for your feedback.', 'success');
            landingContactCreatorForm.reset();
        } catch (error) {
            console.error('Landing feedback send error:', error);
            showLandingCreatorNotice(
                'Automatic send failed. Opening your email app so you can send the message manually.',
                'danger',
            );
            openMailClient();
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitDefaultText;
            }
        }
    });
}

// Event Delegation for Menu Buttons
document.addEventListener('click', async (e) => {
    const actionTarget = e.target.closest('[data-action]');
    const action = actionTarget?.dataset.action;
    if (!action) return;

    switch (action) {
        case 'open-auth':
            showAuth();
            break;
        case 'scroll-guide':
            if (pwaGuideSection) {
                pwaGuideSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            break;
        case 'landing':
            showLanding();
            break;
        // Main menu
        case 'search':
            showView('search');
            break;
        case 'list':
            await showListView('brief', { forceReload: true, resetExpanded: true });
            break;
        case 'contact-creator':
            showView('contact-creator');
            break;
        case 'add':
            showView('add');
            break;
        case 'back':
            showView('main');
            break;

        // Network graph
        case 'network-graph':
            await handleNetworkGraph();
            break;

        // Statistics
        case 'statistics':
            await handleStatistics();
            break;

        // List actions
        case 'list-full':
            handleListFull();
            break;
        case 'list-brief':
            handleListBrief();
            break;
        case 'toggle-list-view': {
            const targetMode = e.target.dataset.targetMode === 'full' ? 'full' : 'brief';
            const resetExpanded = targetMode === 'brief';
            await showListView(targetMode, { resetExpanded });
            break;
        }
        case 'toggle-contact-details': {
            const contactKey = e.target.dataset.contactKey;
            toggleListContactDetails(contactKey);
            break;
        }

        // Delete actions
        case 'delete-id':
            await handleDeleteById();
            break;
        case 'delete-name':
            await handleDeleteByName();
            break;
        case 'edit-contact': {
            const docId = e.target.dataset.docId;
            await toggleContactEditForm(docId);
            break;
        }
        case 'cancel-edit': {
            const docId = e.target.dataset.docId;
            closeContactEditForm(docId);
            break;
        }
        case 'edit-add-method': {
            const form = e.target.closest('.contact-edit-form');
            if (form) {
                const container = form.querySelector('[data-role="edit-contact-methods"]');
                if (container) {
                    container.insertAdjacentHTML('beforeend', renderContactMethodRow());
                }
            }
            break;
        }
        case 'edit-remove-method': {
            const form = e.target.closest('.contact-edit-form');
            if (form) {
                const container = form.querySelector('[data-role="edit-contact-methods"]');
                const row = e.target.closest('.contact-method-row');
                if (container && row) {
                    const rows = container.querySelectorAll('.contact-method-row');
                    if (rows.length > 1) {
                        row.remove();
                    } else {
                        const typeEl = row.querySelector('.contact-type');
                        const valueEl = row.querySelector('.contact-value');
                        if (typeEl) typeEl.value = '';
                        if (valueEl) valueEl.value = '';
                    }
                }
            }
            break;
        }
        case 'edit-add-hashtag': {
            const form = e.target.closest('.contact-edit-form');
            if (form) {
                const container = form.querySelector('[data-role="edit-hashtags"]');
                if (container) {
                    container.insertAdjacentHTML('beforeend', renderHashtagRow());
                }
            }
            break;
        }
        case 'edit-remove-hashtag': {
            const form = e.target.closest('.contact-edit-form');
            if (form) {
                const container = form.querySelector('[data-role="edit-hashtags"]');
                const row = e.target.closest('.hashtag-row');
                if (container && row) {
                    const rows = container.querySelectorAll('.hashtag-row');
                    if (rows.length > 1) {
                        row.remove();
                    } else {
                        const input = row.querySelector('.hashtag-input');
                        if (input) input.value = '';
                    }
                }
            }
            break;
        }
        case 'delete-contact': {
            const docId = e.target.dataset.docId;
            await handleInlineDelete(docId);
            break;
        }
    }
});

// Back to Menu button removed per request; keep navigation via other controls.

document.addEventListener('submit', async (event) => {
    if (event.target.classList.contains('contact-edit-form')) {
        event.preventDefault();
        await handleInlineEditSubmit(event.target);
    }
});

// Auth handlers
loginBtn.addEventListener('click', async () => {
    clearAuthResetNotice();
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) {
        showError('Email and password are required');
        return;
    }

    try {
        showLoading();
        await signInWithEmailAndPassword(auth, email, password);
        hideLoading();
    } catch (error) {
        hideLoading();
        showError(formatAuthError(error));
    }
});

registerBtn.addEventListener('click', async () => {
    clearAuthResetNotice();
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (policyConsent && !policyConsent.checked) {
        showAuthResetNotice('Please accept the Privacy & Data Storage Policy to continue.', 'danger');
        return;
    }
    if (!email || !password) {
        showError('Email and password are required');
        return;
    }

    try {
        showLoading();
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        hideLoading();
        showApp(userCredential.user.email || 'Signed in');
    } catch (error) {
        hideLoading();
        showError(formatAuthError(error));
    }
});

if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        clearAuthResetNotice();
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        try {
            showLoading();
            await signInWithPopup(auth, provider);
            hideLoading();
        } catch (error) {
            hideLoading();
            showError(formatAuthError(error));
        }
    });
}

if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        if (!email) {
            showAuthResetNotice(
                'Please enter your email address first to reset the password.',
                'danger',
            );
            return;
        }

        try {
            showLoading();
            await sendPasswordResetEmail(auth, email);
            hideLoading();
            showAuthResetNotice(
                'Check your email inbox (and spam folder). We sent a password reset link.',
                'success',
            );
        } catch (error) {
            hideLoading();
            showAuthResetNotice(formatAuthError(error), 'danger');
        }
    });
}

// Network graph controls
graphZoomIn.addEventListener('click', () => {
    networkGraph.zoomIn();
});

graphZoomOut.addEventListener('click', () => {
    networkGraph.zoomOut();
});

graphReset.addEventListener('click', () => {
    networkGraph.resetView();
});

logoutBtn.addEventListener('click', async () => {
    try {
        showLoading();
        await signOut(auth);
        hideLoading();
    } catch (error) {
        hideLoading();
        showError(error.message);
    }
});

if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog(
            'Are you sure you want to delete your account? All data will be permanently lost.',
            {
                title: 'Delete account',
                confirmText: 'Yes, delete account',
                cancelText: 'No, keep account',
                variant: 'danger',
            },
        );
        if (!confirmed) {
            return;
        }

        try {
            showLoading();
            await deleteCurrentUserAccount();
            hideLoading();
            await alertDialog('Your account and data have been deleted.', 'Account deleted', 'success');
        } catch (error) {
            hideLoading();
            if (error && error.code === 'auth/requires-recent-login') {
                showError('Please sign in again and retry account deletion.');
            } else {
                showError(error.message || 'Unable to delete your account right now.');
            }
        }
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        showApp(user.email || 'Signed in');
        if (pendingIntroducerPrefill) {
            prefillContactFormWithName(pendingIntroducerPrefill);
            pendingIntroducerPrefill = '';
        }
    } else {
        userStatus.textContent = '';
        userStatus.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        if (deleteAccountBtn) {
            deleteAccountBtn.classList.add('hidden');
        }
        resetListViewState();
        showLanding();
    }
});

window.addEventListener('popstate', (event) => {
    const nextView = event.state?.view;
    if (!nextView || !navigableViews.has(nextView)) {
        return;
    }

    const isAuthed = Boolean(auth.currentUser);
    if (authRequiredViews.has(nextView) && !isAuthed) {
        showLanding();
        return;
    }

    showView(nextView, { history: 'none' });
});

// PWA Install
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBtn').style.display = 'block';
});

document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response: ${outcome}`);
        deferredPrompt = null;
        document.getElementById('installBtn').style.display = 'none';
    }
});

// Initialize
console.log('Networking By Zuzia PWA loaded!');
console.log('Remember to configure Firebase in src/services/firebase.js');
