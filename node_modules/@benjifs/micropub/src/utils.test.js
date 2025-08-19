import assert from 'node:assert'
import { describe, it, mock } from 'node:test'

import { getPageTitle, pick, slugify, urlToFilename } from './utils.js'

describe('getPageTitle', () => {
	const html = '<!DOCTYPE html><html><head><title>Title of the document</title></head><body>The content of the document......</body></html>'

	const mockFetch = (status, response) => {
		mock.method(global, 'fetch', async () => ({
			get ok() { return status == 200 },
			text: () => response,
			status,
		}))
	}

	it('should find title', async () => {
		mockFetch(200, html)
		const title = await getPageTitle('https://example.com')
		assert.equal(title, 'Title of the document')
	})

	it('Invalid html', async () => {
		mockFetch(200, '{}')
		const title = await getPageTitle('https://example.com')
		assert.ok(!title)
	})
})

describe('pick', () => {
	const data = { one: 1, two: 2, three: 3 }

	it('only return props from allow list', () => {
		const res = pick([ 'one', 'two' ], data)
		assert.ok(res?.one)
		assert.ok(res?.two)
		assert.ok(!res?.three)
	})

	it('dont return props from allow list not in data', () => {
		const res = pick([ 'one', 'two', 'four' ], data)
		assert.ok(res?.one)
		assert.ok(res?.two)
		assert.ok(!res?.three)
		assert.ok(!res?.four)
	})

	it('dont return props from allow list not in data', () => {
		const res = pick([ 'one', 'two', 'four' ], {})
		assert.ok(!res?.one)
		assert.ok(!res?.two)
		assert.ok(!res?.three)
		assert.ok(!res?.four)
	})
})

describe('slugify', () => {
	const string = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. $ % ^ &'
	const slug = 'lorem-ipsum-dolor-sit-amet-consectetur-adipiscing-elit'

	it('lowercase', () => {
		assert.equal(slugify(string.toLowerCase()), slug)
	})

	it('uppercase', () => {
		assert.equal(slugify(string.toUpperCase()), slug)
	})

	it('mixed case', () => {
		assert.equal(slugify(string), slug)
	})
})

describe('urlToFilename', () => {
	const url = 'https://example.com'

	it('invalid URL', () => {
		assert.ok(!urlToFilename('httpexample.net/file', url))
		assert.ok(!urlToFilename('https://example.net/file', url))
	})

	it('valid URL', () => {
		const path = 'articles/123'
		assert.equal(urlToFilename(`${url}/${path}`, url), `${path}.md`)
		assert.equal(urlToFilename(`${url}/${path}`, url, 'src'), `src/${path}.md`)
		assert.equal(urlToFilename(`${url}/${path}`, url, 'src/'), `src/${path}.md`)
	})
})
