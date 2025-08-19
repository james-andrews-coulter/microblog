import assert from 'node:assert'
import { describe, it } from 'node:test'

import { parseFrontmatter, toFrontmatter, toMf2, translateProperties } from './frontmatter.js'

describe('frontmatter', () => {
	const fm = `---
type: entry
title: Title
tags:
  - one
  - two
date: '2025-08-09T03:38:03.173Z'
watch-of:
  type: cite
  name: Movie name
  published: 2025
rsvp: maybe
deleted: true
---
Lorem ipsum dolor sit amet,\r\nconsectetur adipiscing elit\n`

	const fmJF2 = {
		type: 'entry',
		title: 'Title',
		content: 'Lorem ipsum dolor sit amet,\r\nconsectetur adipiscing elit',
		tags: [ 'one', 'two' ],
		date: '2025-08-09T03:38:03.173Z',
		'watch-of': {
			type: 'cite',
			name: 'Movie name',
			published: 2025,
		},
		rsvp: 'maybe',
		deleted: true,
	}

	const jf2 = {
		type: 'entry',
		name: 'Title',
		content: 'Lorem ipsum dolor sit amet,\r\nconsectetur adipiscing elit',
		category: [ 'one', 'two' ],
		published: '2025-08-09T03:38:03.173Z',
		'watch-of': {
			type: 'cite',
			name: 'Movie name',
			published: 2025,
		},
		rsvp: 'maybe',
		deleted: true,
	}

	const mf2 = {
		type: [ 'h-entry' ],
		properties: {
			name: [ 'Title' ],
			content: [ 'Lorem ipsum dolor sit amet,\r\nconsectetur adipiscing elit' ],
			category: [ 'one', 'two' ],
			published: [ '2025-08-09T03:38:03.173Z' ],
			'watch-of': [{
				type: [ 'h-cite' ],
				properties: {
					name: [ 'Movie name' ],
					published: [ 2025 ],
				},
			}],
			rsvp: [ 'maybe' ],
			deleted: [ true ],
		},
	}

	describe('translateProperties', () => {
		it('translate all to expected 11ty properties', () => {
			assert.deepEqual(translateProperties(jf2), fmJF2)
		})

		it('translate 11ty properties to jf2', () => {
			assert.deepEqual(translateProperties(fmJF2, true), jf2)
		})
	})

	describe('toFrontmatter', () => {
		it('convert to frontmatter', () => {
			assert.equal(toFrontmatter(fmJF2), fm)
		})
	})

	describe('parseFrontmatter', () => {
		it('parse valid frontmatter', () => {
			assert.deepEqual(parseFrontmatter(fm), fmJF2)
		})
	})

	describe('toMf2', () => {
		it('convert jf2 to mf2', () => {
			assert.deepEqual(toMf2(jf2), mf2)
		})
	})
})
