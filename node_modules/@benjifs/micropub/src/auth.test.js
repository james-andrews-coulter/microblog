import assert from 'node:assert'
import { describe, it, mock } from 'node:test'

import { validateToken, parseToken, isAuthorized, isValidScope } from './auth.js'

describe('auth', () => {
	const validResponse = {
		me: 'https://example.com/',
		issued_by: 'https://tokens.indieauth.com/token',
		client_id: 'https://example.net/',
		issued_at: 1532235856,
		scope: 'create media delete',
		nonce: 1234567,
	}

	const mockFetch = (status, response) => {
		mock.method(global, 'fetch', async () => ({
			get ok() { return status == 200 },
			json: () => response,
			status,
		}))
	}

	describe('validateToken', () => {
		it('valid token', async () => {
			mockFetch(200, validResponse)
			const res = await validateToken('https://auth.example.com', '12345')
			assert.ok(res)
		})

		it('invalid token', async () => {
			mockFetch(400)
			const res = await validateToken('https://auth.example.com', 'abcd')
			assert.ok(!res)
		})
	})

	describe('parseToken', () => {
		const headers = new Headers({ authorization: 'Bearer 123' })
		const body = { access_token: 'abc' }

		it('get token from header', () => {
			assert.equal(parseToken(headers), '123')
		})

		it('get token from body', () => {
			assert.equal(parseToken(null, body), 'abc')
		})

		it('should conform to RFC6750', () => {
			assert.throws(() => parseToken(headers, body), '123')
		})

		it('no headers or body', () => {
			assert.ok(!parseToken())
		})
	})

	describe('isAuthorized', () => {
		const req = {
			headers: new Headers({ authorization: 'Bearer 123' }),
		}

		it('is valid', async () => {
			mockFetch(200, validResponse)
			const res = await isAuthorized(req, null, 'https://auth.example.com', 'https://example.com/')
			assert.ok(res)
		})

		it('"me" does not match', async () => {
			mockFetch(200, validResponse)
			await assert.rejects(isAuthorized(req, null, 'https://auth.example.com', 'https://example.net/'))
		})

		it('no token provided', async () => {
			mockFetch(200, validResponse)
			await assert.rejects(isAuthorized(null, null, 'https://auth.example.com', 'https://example.net/'))
		})
	})

	describe('isValidScope', () => {
		describe('multiple allowed scopes', () => {
			it('single scope is in list', () => {
				assert.ok(isValidScope(validResponse.scope, 'create'))
			})

			it('single scope is not in list', () => {
				assert.ok(!isValidScope(validResponse.scope, 'update'))
			})

			it('one of the scopes is in list', () => {
				assert.ok(isValidScope(validResponse.scope, 'update create'))
			})

			it('none of the scopes are in the list', () => {
				assert.ok(!isValidScope(validResponse.scope, 'update other'))
			})
		})

		describe('single allowed scope', () => {
			it('single scope matches `scope`', () => {
				assert.ok(isValidScope('create', 'create'))
			})

			it('single scope does not match `scope`', () => {
				assert.ok(!isValidScope('create', 'update'))
			})

			it('one of the scopes matches `scope`', () => {
				assert.ok(isValidScope('create', 'update create'))
			})

			it('none of the scopes match `scope`', () => {
				assert.ok(!isValidScope('create', 'update media'))
			})
		})
	})
})
