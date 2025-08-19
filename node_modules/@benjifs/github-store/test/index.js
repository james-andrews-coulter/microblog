import assert from 'node:assert'
import { describe, it, beforeEach, mock } from 'node:test'

import GitHubStore from '../index.js'

describe('GitHubStore', () => {
	const filename = 'src/articles/123.md'
	const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.'
	const b64 = Buffer.from(content).toString('base64')
	const file = { content: b64, sha: 'abc123' }

	let github
	beforeEach(() => {
		github = new GitHubStore({
			token: '123456',
			user: 'user',
			repo: 'repo',
		})
	})

	const mockFetch = (status, response) => {
		mock.method(global, 'fetch', async () => ({
			get ok() { return status == 200 },
			json: () => response,
			status,
		}))
	}

	describe('createFile', () => {
		it('new file', async () => {
			mockFetch(200, { content: { path: filename }})
			const result = await github.createFile(filename, content)
			assert.ok(result?.content)
		})

		it('file exists', async () => {
			mockFetch(422, { content: { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' }})
			const result = await github.createFile(filename, content)
			assert.ok(!result)
		})
	})

	describe('updateFile', () => {
		it('update file', async () => {
			mockFetch(200, { content: { path: filename }})
			const result = await github.updateFile(filename, content, file)
			assert.ok(result?.content)
		})

		it('incorrect sha', async () => {
			mockFetch(409, { message: `${filename} does not match ${file.sha}` })
			const result = await github.updateFile(filename, content, file)
			assert.ok(!result)
		})
	})

	describe('uploadImage', () => {
		it('valid file', async () => {
			mockFetch(200, { content: { path: filename }})
			const result = await github.uploadImage(filename, { content })
			assert.ok(result?.content)
		})
	})

	describe('getFile', () => {
		it('file exists', async () => {
			mockFetch(200, file)
			const result = await github.getFile(filename)
			assert.ok(result)
			assert.equal(result.content, content)
			assert.equal(result.sha, file.sha)
		})

		it('file does not exist', async () => {
			mockFetch(404)
			const result = await github.getFile(filename)
			assert.ok(!result)
		})
	})

	describe('getDirectory', () => {
		it('directory exists', async () => {
			const item = {
				type: 'file',
				name: 'octokit.rb',
				path: 'lib/octokit.rb',
				sha: 'fff6fe3a23bf1c8ea0692b4a883af99bee26fd3b',
			}

			mockFetch(200, [ item, item, item ])
			const result = await github.getDirectory('dir')
			assert.ok(result.files)
			assert.equal(result.files.length, 3)
		})

		it('directory does not exist', async () => {
			mockFetch(404)
			const result = await github.getDirectory('dir')
			assert.ok(!result)
		})
	})

	describe('deleteFile', () => {
		it('file exists', async () => {
			mockFetch(200, file)
			const result = await github.deleteFile(filename, file)
			assert.ok(result?.content)
		})

		it('sha does not match', async () => {
			mockFetch(409, file)
			const result = await github.deleteFile(filename, file)
			assert.ok(!result)
		})

		it('file does not exist', async () => {
			mockFetch(404)
			const result = await github.deleteFile(filename, file)
			assert.ok(!result)
		})
	})
})
