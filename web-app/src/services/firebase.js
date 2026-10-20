// Firebase initialization and Firestore data access
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, updateDoc, getDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    deleteUser
} from 'firebase/auth';

// Firebase configuration
const firebaseEnv = import.meta.env;
const firebaseConfig = {
    apiKey: firebaseEnv.VITE_FIREBASE_API_KEY || '',
    authDomain: firebaseEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: firebaseEnv.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: firebaseEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: firebaseEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: firebaseEnv.VITE_FIREBASE_APP_ID || '',
    measurementId: firebaseEnv.VITE_FIREBASE_MEASUREMENT_ID || ''
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    sendEmailVerification
};

// Collection name
const CONTACTS_COLLECTION = 'contacts';
const EVENTS_COLLECTION = 'events';

const FIRESTORE_BATCH_SIZE = 450;

async function deleteDocumentsInBatches(collectionName, documents) {
    for (let i = 0; i < documents.length; i += FIRESTORE_BATCH_SIZE) {
        const batch = writeBatch(db);
        documents.slice(i, i + FIRESTORE_BATCH_SIZE).forEach((snapshot) => {
            batch.delete(doc(db, collectionName, snapshot.id));
        });
        await batch.commit();
    }
}

async function deleteCollectionByOwner(collectionName, ownerId) {
    const ownerQuery = query(collection(db, collectionName), where('ownerId', '==', ownerId));
    const snapshot = await getDocs(ownerQuery);
    await deleteDocumentsInBatches(collectionName, snapshot.docs);
}

function requireUserId() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    return user.uid;
}

function normalizeValue(value) {
    return (value || '')
        .toString()
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function formatFullName(contact) {
    if (!contact) {
        return '';
    }
    return `${contact.name || ''} ${contact.surname || ''}`.trim();
}

function resolveFallbackSource(contact, nameMap, visited = new Set()) {
    if (!contact) {
        return { source_type: '', source_value: '' };
    }

    if (contact.source_type === 'event' && contact.source_value) {
        return { source_type: 'event', source_value: contact.source_value };
    }

    if (contact.source_type === 'contact' && contact.source_value) {
        const parentKey = normalizeValue(contact.source_value);
        const parentContact = nameMap.get(parentKey);

        if (parentContact && parentContact.docId && !visited.has(parentContact.docId)) {
            visited.add(parentContact.docId);
            const inherited = resolveFallbackSource(parentContact, nameMap, visited);
            if (inherited.source_type) {
                return inherited;
            }

            const parentName = formatFullName(parentContact);
            if (parentName) {
                return { source_type: 'contact', source_value: parentName };
            }
        }

        return { source_type: 'contact', source_value: contact.source_value };
    }

    return { source_type: '', source_value: '' };
}

/**
 * Get all contacts from Firestore
 * @returns {Promise<Array>} Array of contact objects
 */
export async function getAllContacts() {
    const userId = requireUserId();
    const contactsCol = collection(db, CONTACTS_COLLECTION);
    const q = query(contactsCol, where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    const contacts = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
    // Sort by ID on client side to avoid needing a composite index
    return contacts.sort((a, b) => a.id - b.id);
}

/**
 * Find event by name
 * @param {string} name - Event name
 * @returns {Promise<Object|null>} Event object or null
 */
export async function findEventByName(name) {
    const userId = requireUserId();
    const eventsCol = collection(db, EVENTS_COLLECTION);
    const q = query(eventsCol, where('ownerId', '==', userId), where('name', '==', name));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const docSnap = snapshot.docs[0];
    return { docId: docSnap.id, ...docSnap.data() };
}

/**
 * Create or update event description by name
 * @param {string} name - Event name
 * @param {string} description - Event description
 * @returns {Promise<Object>} Event object
 */
export async function upsertEventByName(name, description = '') {
    const userId = requireUserId();
    const eventsCol = collection(db, EVENTS_COLLECTION);
    const existing = await findEventByName(name);
    const payload = {
        name,
        description: description || '',
        ownerId: userId,
        updated_at: new Date().toISOString()
    };

    if (existing && existing.docId) {
        await updateDoc(doc(db, EVENTS_COLLECTION, existing.docId), payload);
        return { ...existing, ...payload };
    }

    const createPayload = { ...payload, created_at: new Date().toISOString() };
    const docRef = await addDoc(eventsCol, createPayload);
    return { docId: docRef.id, ...createPayload };
}

/**
 * Delete event by name and remove all contacts connected to it
 * @param {string} name - Event name
 * @returns {Promise<void>}
 */
export async function deleteEventAndContactsByName(name) {
    const userId = requireUserId();
    const contactsCol = collection(db, CONTACTS_COLLECTION);
    const eventsCol = collection(db, EVENTS_COLLECTION);

    const contactsQuery = query(
        contactsCol,
        where('ownerId', '==', userId),
        where('source_type', '==', 'event'),
        where('source_value', '==', name)
    );
    const contactsSnapshot = await getDocs(contactsQuery);
    await deleteDocumentsInBatches(CONTACTS_COLLECTION, contactsSnapshot.docs);

    // Delete the event document if it exists
    const eventQuery = query(eventsCol, where('ownerId', '==', userId), where('name', '==', name));
    const eventSnapshot = await getDocs(eventQuery);
    await deleteDocumentsInBatches(EVENTS_COLLECTION, eventSnapshot.docs);
}

/**
 * Add new contact to Firestore
 * @param {Object} contact - Contact object
 * @returns {Promise<Object>} Added contact with ID
 */
export async function addContact(contact) {
    const userId = requireUserId();
    const contactsCol = collection(db, CONTACTS_COLLECTION);

    // Get next ID - query without ordering to avoid index requirement
    const q = query(contactsCol, where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    const allContacts = snapshot.docs.map(doc => doc.data());

    const nextId = allContacts.length > 0
        ? Math.max(...allContacts.map(c => c.id)) + 1
        : 1;

    const contactWithId = { ...contact, id: nextId, ownerId: userId };
    const docRef = await addDoc(contactsCol, contactWithId);

    return { docId: docRef.id, ...contactWithId };
}

/**
 * Delete contact by Firestore document ID
 * @param {string} docId - Firestore document ID
 * @returns {Promise<void>}
 */
export async function deleteContact(docId) {
    const userId = requireUserId();
    const contactDoc = doc(db, CONTACTS_COLLECTION, docId);
    const snapshot = await getDoc(contactDoc);

    if (!snapshot.exists()) {
        throw new Error('Contact not found');
    }

    const data = snapshot.data();
    if (data.ownerId !== userId) {
        throw new Error('You do not have permission to delete this contact.');
    }

    await reassignIntroductions(data, userId);
    await deleteDoc(contactDoc);
}

async function reassignIntroductions(deletedContact, userId) {
    const deletedFullName = formatFullName(deletedContact);
    const normalizedDeletedName = normalizeValue(deletedFullName);
    if (!normalizedDeletedName) {
        return;
    }

    const contactsCol = collection(db, CONTACTS_COLLECTION);
    const ownerQuery = query(contactsCol, where('ownerId', '==', userId));
    const snapshot = await getDocs(ownerQuery);
    if (snapshot.empty) {
        return;
    }

    const contacts = snapshot.docs.map(docSnap => ({
        docId: docSnap.id,
        ...docSnap.data()
    }));

    const nameMap = new Map();
    contacts.forEach(contact => {
        const normalizedName = normalizeValue(formatFullName(contact));
        if (normalizedName) {
            nameMap.set(normalizedName, contact);
        }
    });

    const dependents = contacts.filter(contact =>
        contact.source_type === 'contact' &&
        normalizeValue(contact.source_value) === normalizedDeletedName
    );

    if (dependents.length === 0) {
        return;
    }

    let fallbackUpdates = { source_type: '', source_value: '' };
    if (deletedContact.source_type === 'contact' && deletedContact.source_value) {
        // Collapse chain: parent becomes the introducer for all dependents.
        fallbackUpdates = { source_type: 'contact', source_value: deletedContact.source_value };
    } else if (deletedContact.source_type === 'event' && deletedContact.source_value) {
        fallbackUpdates = { source_type: 'event', source_value: deletedContact.source_value };
    } else {
        fallbackUpdates = resolveFallbackSource(deletedContact, nameMap);
    }
    // Keep every write batch below Firestore's 500-operation limit.
    for (let i = 0; i < dependents.length; i += FIRESTORE_BATCH_SIZE) {
        const batch = writeBatch(db);
        dependents.slice(i, i + FIRESTORE_BATCH_SIZE).forEach((dependent) => {
            batch.update(doc(db, CONTACTS_COLLECTION, dependent.docId), fallbackUpdates);
        });
        await batch.commit();
    }
}

/**
 * Update contact by Firestore document ID
 * @param {string} docId - Firestore document ID
 * @param {Object} updates - Partial contact data to update
 * @returns {Promise<void>}
 */
export async function updateContact(docId, updates) {
    const userId = requireUserId();
    const contactDoc = doc(db, CONTACTS_COLLECTION, docId);
    const snapshot = await getDoc(contactDoc);

    if (!snapshot.exists()) {
        throw new Error('Contact not found');
    }

    const data = snapshot.data();
    if (data.ownerId !== userId) {
        throw new Error('You do not have permission to edit this contact.');
    }

    await updateDoc(contactDoc, updates);
}

/**
 * Find contacts by ID
 * @param {number} id - Contact ID
 * @returns {Promise<Array>} Array of matching contacts
 */
export async function findContactById(id) {
    const userId = requireUserId();
    const contactsCol = collection(db, CONTACTS_COLLECTION);
    const q = query(contactsCol, where('ownerId', '==', userId), where('id', '==', id));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
}

/**
 * Find contacts by name and surname
 * @param {string} name - Contact name
 * @param {string} surname - Contact surname
 * @returns {Promise<Array>} Array of matching contacts
 */
export async function findContactByName(name, surname) {
    const userId = requireUserId();
    const contactsCol = collection(db, CONTACTS_COLLECTION);
    const q = query(
        contactsCol,
        where('ownerId', '==', userId),
        where('name', '==', name),
        where('surname', '==', surname)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
}

/**
 * Find contacts by hashtag
 * @param {string} hashtag - Hashtag to search for
 * @returns {Promise<Array>} Array of matching contacts
 */
export async function findContactsByHashtag(hashtag) {
    const userId = requireUserId();
    const contactsCol = collection(db, CONTACTS_COLLECTION);
    const q = query(
        contactsCol,
        where('ownerId', '==', userId),
        where('hashtags', 'array-contains', hashtag.toLowerCase())
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
}

/**
 * Find contacts by event (source_value when source_type is 'event')
 * @param {string} event - Event name to search for
 * @returns {Promise<Array>} Array of matching contacts
 */
export async function findContactsByEvent(event) {
    const allContacts = await getAllContacts();
    return allContacts.filter(contact =>
        contact.source_type === 'event' &&
        contact.source_value.toLowerCase().includes(event.toLowerCase())
    );
}

export { db };

/**
 * Delete the current user's data and authentication account.
 * @returns {Promise<void>}
 */
export async function deleteCurrentUserAccount() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }
    const userId = user.uid;

    await deleteCollectionByOwner(CONTACTS_COLLECTION, userId);
    await deleteCollectionByOwner(EVENTS_COLLECTION, userId);
    await deleteUser(user);
}
