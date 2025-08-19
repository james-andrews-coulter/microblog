import assert from 'node:assert'
import { describe, it, beforeEach } from 'node:test'

import { generateSlug, getPost, uploadImage, createContent, updateContent, deleteContent, undeleteContent } from './content.js'

describe('content', () => {
	const mockStore = () => {
		const files = new Map()
		return {
			reset: () => files.clear(),
			uploadImage: async (filename, file) => {
				files.set(filename, file)
				return filename
			},
			getFile: async (filename) => files.has(filename) ? { content: files.get(filename) } : null,
			createFile: async (filename, content) => {
				if (files.has(filename)) return false
				files.set(filename, content)
				return filename
			},
			updateFile: async (filename, content) => {
				if (!files.has(filename)) return false
				files.set(filename, content)
				return filename
			},
			deleteFile: async (filename) => files.delete(filename),
		}
	}

	const opts = {
		me: 'https://example.com/',
		contentDir: 'src',
		mediaDir: 'upload',
		translateProps: true,
		store: mockStore(),
		formatSlug: () => 'note/1234',
		formatFilename: () => 'src/note/1234.md',
		mediaFilename: (dir, filename) => `${dir}/${filename}`,
	}
	const post = 'article/123'
	const postURL = `${opts.me}${post}`
	const filename = `${opts.contentDir}/${post}.md`
	const jf2 = {
		type: 'entry',
		content: 'Lorem ipsum dolor sit amet,\r\nconsectetur adipiscing elit',
	}
	const fm = `---
type: entry
tags:
  - one
  - two
deleted: true
---
Lorem ipsum dolor sit amet,\r\nconsectetur adipiscing elit\n`
	const file = {
		filename: 'banner.png',
		encoding: '7bit',
		mimeType: 'image/png',
		content: '...',
	}

	beforeEach(() => {
		opts.store.reset()
	})

	describe('generateSlug', () => {
		it('slug for note', () => {
			assert.equal(generateSlug('note', jf2, '1234'), '1234')
		})

		it('slug for article', () => {
			jf2.name = 'Title'
			assert.equal(generateSlug('article', jf2, '1234'), 'title')
		})

		it('slug provided', () => {
			jf2['mp-slug'] = 'test-slug'
			assert.equal(generateSlug('article', jf2, '1234'), 'test-slug')
		})

		it('slug for watch post with cite', () => {
			delete jf2.name
			delete jf2['mp-slug']
			jf2['watch-of'] = {
				type: 'h-cite',
				name: 'Star Wars',
				published: 1977,
			}
			assert.equal(generateSlug('watch', jf2, '1234'), '1234-star-wars-1977')
		})
	})

	describe('getPost', () => {
		it('invalid filename', async () => {
			await assert.rejects(getPost(post, opts), err => err.status == 400)
		})

		it('file not found', async () => {
			await assert.rejects(getPost(postURL, opts), err => err.status == 404)
		})

		it('file found', async () => {
			// Using this to add a file without checking if it exists
			opts.store.uploadImage(`${opts.contentDir}/${post}-test.md`, fm)
			const out = await getPost(`${postURL}-test`, opts)
			assert.ok(out?.post)
		})
	})

	describe('uploadImage', () => {
		it('invalid file or filename', async () => {
			let out = await uploadImage()
			assert.ok(!out)
			out = await uploadImage({})
			assert.ok(!out)
		})

		it('file uploaded', async () => {
			const out = await uploadImage(file, opts)
			assert.ok(out)
		})

		it('no file sent', async () => {
			const out = await uploadImage()
			assert.ok(!out)
		})
	})

	describe('createContent', () => {
		const jf2 = { type: 'entry', content: 'Lorem ipsum dolor sit amet' }

		it('should create a new note', async () => {
			const result = await createContent(jf2, opts)
			assert.ok(result)
		})

		it('post exists, do not create post', async () => {
			await createContent(jf2, opts)
			await assert.rejects(createContent(jf2, opts), err => err.status == 400)
		})

		it('create post with files', async () => {
			const uploadJf2 = {
				...jf2,
				files: [file, file],
			}
			const result = await createContent(uploadJf2, opts)
			assert.ok(result)
			assert.ok(!uploadJf2.files)
			assert.equal(uploadJf2.photo?.length, 2)
		})
	})

	describe('updateContent', () => {
		it('file does not exist', async () => {
			await assert.rejects(updateContent(`${opts.me}/404`, {}, opts), err => err.status == 404)
		})

		it('nothing to update', async () => {
			await opts.store.createFile(filename, fm)
			await assert.rejects(updateContent(postURL, {
				add: { category: [ 'one' ] },
			}, opts), err => err.status == 400)
		})

		it('file updated', async () => {
			await opts.store.createFile(filename, fm)
			const url = await updateContent(postURL, {
				add: { category: [ 'three' ] },
			}, opts)
			assert.equal(url, postURL)
		})
	})

	describe('deleteContent', () => {
		it('temporary delete', async () => {
			// Using this to add a file without checking if it exists
			opts.store.uploadImage(filename, fm.replaceAll('deleted: true', ''))
			const url = await deleteContent(postURL, opts)
			assert.equal(url, postURL)
		})

		it('cannot delete file that does not exist', async () => {
			await assert.rejects(deleteContent(`${opts.me}/404`, opts), err => err.status == 404)
		})

		it('permanently delete file', async () => {
			opts.store.createFile(filename, jf2)
			const url = await deleteContent(postURL, opts, true)
			assert.equal(url, postURL)
		})
	})

	describe('undeleteContent', () => {
		it('cannot undelete file that does not exist', async () => {
			await assert.rejects(undeleteContent(`${opts.me}/404`, opts), err => err.status == 404)
		})

		it('undelete file', async () => {
			await opts.store.createFile(`${opts.contentDir}/${post}-deleted.md`, fm)
			const url = await undeleteContent(`${postURL}-deleted`, opts)
			assert.equal(url, `${postURL}-deleted`)
		})
	})
})
