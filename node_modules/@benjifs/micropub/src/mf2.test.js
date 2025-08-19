import assert from 'node:assert'
import { describe, it, beforeEach } from 'node:test'

import { addProperties, deleteProperties, updateProperties } from './mf2.js'

describe('mf2', () => {
	const url = 'https://example.com'
	let mf2 = {}
	beforeEach(() => {
		mf2 = {
			type: [ 'h-entry' ],
			properties: {
				content: [ 'Lorem ipsum dolor sit amet,\r\nconsectetur adipiscing elit' ],
				category: [ 'one', 'two' ],
				rsvp: [ 'maybe' ],
			},
		}
	})

	// https://micropub.spec.indieweb.org/#add
	describe('addProperties', () => {
		it('add single property', () => {
			const { properties } = addProperties(mf2, { syndication: [ url ] })
			assert.deepEqual(properties.syndication, [ url ])
		})

		it('add categories', () => {
			const { properties } = addProperties(mf2, { category: [ 'micropub', 'indieweb' ] })
			assert.equal(properties.category.length, 4)
		})

		it('dont add duplicate categories', () => {
			const { properties } = addProperties(mf2, { category: [ 'one', 'indieweb' ] })
			assert.equal(properties.category.length, 3)
		})
	})

	// https://micropub.spec.indieweb.org/#remove
	describe('deleteProperties', () => {
		it('remove a single property', () => {
			const { properties } = deleteProperties(mf2, [ 'category' ])
			assert.ok(!properties.category)
		})

		it('remove multiple properties', () => {
			const { properties } = deleteProperties(mf2, [ 'category', 'rsvp' ])
			assert.ok(!properties.category)
			assert.ok(!properties.rsvp)
		})

		it('remove a single value of a property', () => {
			const { properties } = deleteProperties(mf2, {
				category: [ 'one' ],
			})
			assert.equal(properties.category.length, 1)
		})

		it('remove all categories', () => {
			const { properties } = deleteProperties(mf2, {
				category: [ 'one', 'two' ],
			})
			assert.ok(!properties.category)
		})

		it('trying to remove item that does not exist', () => {
			const updated = deleteProperties(mf2, { syndication: [ url ] })
			assert.ok(!updated)
		})
	})

	// https://micropub.spec.indieweb.org/#replace
	describe('updateProperties', () => {
		it('update content', () => {
			const { properties } = updateProperties(mf2, { content: [ 'goodnight loon' ] })
			assert.equal(properties.content[0], 'goodnight loon')
		})

		it('update content with same value', () => {
			const updated = updateProperties(mf2, { content: mf2.properties.content })
			assert.ok(!updated)
		})

		it('add new property if it does not exist', () => {
			const { properties } = updateProperties(mf2, { syndication: [ url ] })
			assert.ok(properties.syndication)
			assert.equal(properties.syndication.length, 1)
		})

		it('update all categories', () => {
			const { properties } = updateProperties(mf2, { category: [ 'one' ] })
			assert.equal(properties.category.length, 1)
		})

		// micropub.rocks (405) | Reject the request if operation is not an array
		it('Do not allow if value is not an array', () => {
			const updated = updateProperties(mf2, { category: 'one' })
			assert.ok(!updated)
		})
	})
})
