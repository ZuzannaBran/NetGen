// Contact normalization and persistence operations
import * as firebase from './firebase.js';
import { capitalizeFirst, parseHashtags } from '../utils/formatters.js';

/**
 * Create new contact with formatted data
 * @param {Object} contactData - Raw contact data from form
 * @returns {Promise<Object>} Created contact
 */
export async function createContact(contactData) {
    const formattedContact = {
        name: capitalizeFirst(contactData.name),
        surname: capitalizeFirst(contactData.surname),
        note: contactData.note,
        advantage: contactData.advantage || '',
        source_type: contactData.source_type || '',
        source_value: contactData.source_value ? capitalizeFirst(contactData.source_value) : '',
        contact_methods: contactData.contact_methods || [],
        // Handle both array and string hashtags
        hashtags: Array.isArray(contactData.hashtags)
            ? contactData.hashtags.map((tag) => tag.toLowerCase().trim()).filter((tag) => tag)
            : parseHashtags(contactData.hashtags || ''),
        created_at: new Date().toISOString(),
    };

    return await firebase.addContact(formattedContact);
}

/**
 * Get all contacts
 * @returns {Promise<Array>} All contacts
 */
export async function listAllContacts() {
    return await firebase.getAllContacts();
}

/**
 * Get event details by name
 * @param {string} name - Event name
 * @returns {Promise<Object|null>} Event object or null
 */
export async function getEventByName(name) {
    return await firebase.findEventByName(name);
}

/**
 * Save event description
 * @param {string} name - Event name
 * @param {string} description - Event description
 * @returns {Promise<Object>} Event object
 */
export async function saveEventDescription(name, description) {
    return await firebase.upsertEventByName(name, description);
}

/**
 * Delete event and all connected contacts
 * @param {string} name - Event name
 * @returns {Promise<void>}
 */
export async function deleteEventByName(name) {
    await firebase.deleteEventAndContactsByName(name);
}

/**
 * Search contact by ID
 * @param {number} id - Contact ID
 * @returns {Promise<Array>} Matching contacts
 */
export async function searchById(id) {
    return await firebase.findContactById(parseInt(id));
}

/**
 * Search contacts by name and surname
 * @param {string} name - Contact name
 * @param {string} surname - Contact surname
 * @returns {Promise<Array>} Matching contacts
 */
export async function searchByName(name, surname) {
    const formattedName = capitalizeFirst(name);
    const formattedSurname = capitalizeFirst(surname);
    return await firebase.findContactByName(formattedName, formattedSurname);
}

/**
 * Search contacts by hashtag
 * @param {string} hashtag - Hashtag to search
 * @returns {Promise<Array>} Matching contacts
 */
export async function searchByHashtag(hashtag) {
    return await firebase.findContactsByHashtag(hashtag);
}

/**
 * Search contacts by event
 * @param {string} event - Event name to search
 * @returns {Promise<Array>} Matching contacts
 */
export async function searchByEvent(event) {
    return await firebase.findContactsByEvent(event);
}

/**
 * Delete contact by ID
 * @param {number} id - Contact ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteById(id) {
    const contacts = await firebase.findContactById(parseInt(id));
    if (contacts.length === 0) {
        throw new Error('Contact not found');
    }
    await firebase.deleteContact(contacts[0].docId);
    return true;
}

/**
 * Delete contact by name and surname
 * Handles duplicates - returns array if multiple matches
 * @param {string} name - Contact name
 * @param {string} surname - Contact surname
 * @returns {Promise<Object>} {success: boolean, duplicates?: Array}
 */
export async function deleteByName(name, surname) {
    const contacts = await searchByName(name, surname);

    if (contacts.length === 0) {
        throw new Error('Contact not found');
    }

    if (contacts.length > 1) {
        return { success: false, duplicates: contacts };
    }

    await firebase.deleteContact(contacts[0].docId);
    return { success: true };
}

/**
 * Delete contact by document ID (for handling duplicates)
 * @param {string} docId - Firestore document ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteByDocId(docId) {
    await firebase.deleteContact(docId);
    return true;
}

/**
 * Update an existing contact
 * @param {string} docId - Firestore document ID
 * @param {Object} contactData - Updated contact payload
 * @returns {Promise<Object>} Updated contact object
 */
export async function updateContact(docId, contactData) {
    const formattedContact = {
        name: capitalizeFirst(contactData.name),
        surname: capitalizeFirst(contactData.surname),
        note: contactData.note,
        advantage: contactData.advantage || '',
        source_type: contactData.source_type || '',
        source_value: contactData.source_value ? capitalizeFirst(contactData.source_value) : '',
        contact_methods: contactData.contact_methods || [],
        hashtags: Array.isArray(contactData.hashtags)
            ? contactData.hashtags.map((tag) => tag.toLowerCase().trim()).filter((tag) => tag)
            : parseHashtags(contactData.hashtags || ''),
        updated_at: new Date().toISOString(),
    };

    await firebase.updateContact(docId, formattedContact);

    return {
        ...contactData,
        ...formattedContact,
        docId,
    };
}
