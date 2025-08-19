import assert from 'node:assert'
import { describe, it } from 'node:test'

import { jsonToJf2, formToJf2 } from './jf2.js'

describe('jf2', () => {
	const content = 'Lorem ipsum dolor sit amet,\r\nconsectetur adipiscing elit'
	const json = {
		type: [ 'h-entry' ],
		properties: {
			content: [ content ],
		},
	}
	const jf2 = {
		type: 'entry',
		content,
	}
	// This should already be translated from FormData() to JSON
	const form = {
		h: 'entry',
		content,
	}

	it('jsonToJf2', () => {
		assert.deepEqual(jsonToJf2(json), jf2)
	})

	it('formToJf2', () => {
		assert.deepEqual(formToJf2(form), jf2)
	})
})
