import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml } from '../src/utils/html.js';

test('escapes untrusted markup and both quote types', () => {
    assert.equal(
        escapeHtml('<img src="x" onerror=\'alert(1)\'>&'),
        '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;',
    );
});

test('handles numbers and empty values', () => {
    assert.equal(escapeHtml(42), '42');
    assert.equal(escapeHtml(''), '');
});
