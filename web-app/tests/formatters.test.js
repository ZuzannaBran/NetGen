import assert from 'node:assert/strict';
import test from 'node:test';
import { capitalizeFirst, formatHashtags, parseHashtags } from '../src/utils/formatters.js';

test('normalizes name capitalization', () => {
    assert.equal(capitalizeFirst('aLICE'), 'Alice');
    assert.equal(capitalizeFirst(''), '');
});

test('normalizes comma-separated hashtags', () => {
    assert.deepEqual(parseHashtags(' Dev, NETWORKING, , Startup '), [
        'dev',
        'networking',
        'startup',
    ]);
});

test('drops empty tags from arrays', () => {
    assert.deepEqual(formatHashtags(['  Developer  ', ' ', 'Events']), ['developer', 'events']);
});
