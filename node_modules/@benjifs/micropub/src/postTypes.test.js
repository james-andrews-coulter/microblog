import assert from 'node:assert'
import { describe, it } from 'node:test'

import { postTypes } from './postTypes.js'

describe('postTypes', () => {
	const url = 'https://example.com/post'

	it('is rsvp', () => {
		assert.notEqual(postTypes({ rsvp: 'yes' }), 'rsvp')
		assert.notEqual(postTypes({ rsvp: 'invalid', 'in-reply-to': url }), 'rsvp')
		assert.equal(postTypes({ rsvp: 'yes', 'in-reply-to': url }), 'rsvp')
	})

	it('is reply', () => {
		assert.equal(postTypes({ 'in-reply-to': url }), 'reply')
	})

	it('is repost', () => {
		assert.equal(postTypes({ 'repost-of': url }), 'repost')
	})

	it('is like', () => {
		assert.equal(postTypes({ 'like-of': url }), 'like')
	})

	it('is bookmark', () => {
		assert.equal(postTypes({ 'bookmark-of': url }), 'bookmark')
	})

	it('is photo', () => {
		assert.equal(postTypes({ 'photo': url }), 'photo')
	})

	it('is article', () => {
		assert.equal(postTypes({ 'name': 'title' }), 'article')
	})

	it('is watch', () => {
		assert.equal(postTypes({ 'watch-of': url }), 'watch')
	})

	it('is read', () => {
		assert.equal(postTypes({ 'read-of': url }), 'read')
	})

	it('is listen', () => {
		assert.equal(postTypes({ 'listen-of': url }), 'listen')
	})

	it('is play', () => {
		assert.equal(postTypes({ 'play-of': url }), 'play')
	})

	it('is note', () => {
		assert.equal(postTypes({ 'content': 'lorem ipsum' }), 'note')
	})

	it('is not valid', () => {
		assert.ok(!postTypes())
		assert.ok(!postTypes({}))
		assert.ok(!postTypes('ab'))
		assert.ok(!postTypes([]))
	})
})
