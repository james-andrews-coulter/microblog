import { isAuthorized, isValidScope } from './auth.js'
import { parseBody } from './parseBody.js'
import { toJf2 } from './jf2.js'
import { pick } from './utils.js'
import { parseFrontmatter, toMf2, translateProperties } from './frontmatter.js'
import { getPost, uploadImage, createContent, updateContent, deleteContent, undeleteContent } from './content.js'

import HTTP from './HTTPResponse.js'
import defaultConfig from './config.js'

export default class MicropubEndpoint {
	/**
	 * @typedef {Object} SyndicationTarget
	 * @property {string} uid - URL to syndicate to
	 * @property {string} name - Human readable name
	 * @property {boolean} [checked] - If item is selected by default (optional)
	*/

	/**
	 * @typedef {Object} PostType
	 * @property {string} type - The post type (e.g. "note", "photo")
	 * @property {string} name - Human readable name
	 */

	/**
	 * @typedef {Object} MicropubConfig
	 * @property {string} ['media-endpoint'] - URL for media endpoint if enabled (optional)
	 * @property {SyndicationTarget[]} ['syndicate-to'] - List of syndication targets
	 * @property {PostType[]} ['post-types'] - Supported post types
	 */

	/**
	 * @typedef {Object} MicropubOptions
	 * @property {string} me
	 * @property {string} tokenEndpoint
	 * @property {string} [contentDir="src"] - Directory to upload posts to
	 * @property {string} [mediaDir="uploads"] - Directory to upload files for media_endpoint
	 * @property {Object} store
	 */
	#options

	/**
	 * @param {MicropubOptions} options
	 */
	constructor(options) {
		this.#options = {
			...defaultConfig,
			...options,
		}
	}

	#isConfigured = () => this.#options && this.#options.store && this.#options.me && this.#options.tokenEndpoint

	#isMethodAllowed = (method, allowed = ['GET', 'POST']) => allowed.includes(method)

	#micropubQuery = async (query) => {
		if (!query) HTTP.BAD_REQUEST.throw()
		const { q } = query
		if ('config' === q) {
			return HTTP.OK.send(this.#options.config)
		} else if (['media-endpoint', 'post-types', 'syndicate-to'].includes(q)) {
			return HTTP.OK.send({
				[q]: this.#options?.config[q],
			})
		}
		const { url, properties } = query
		if (!('source' === q && url)) HTTP.BAD_REQUEST.throw()

		const { post } = await getPost(url, this.#options)
		let parsedFM = parseFrontmatter(post.content)
		parsedFM = this.#options.translateProps ? translateProperties(parsedFM, true) : parsedFM
		const mf2 = toMf2(parsedFM)
		if (properties?.length > 0) {
			let filtered = pick(properties, mf2.properties)
			return HTTP.OK.send({ properties: filtered })
		}
		return HTTP.OK.send(mf2)
	}

	micropubHandler = async (req) => {
		try {
			if (!this.#isConfigured()) HTTP.BAD_REQUEST.throw('not configured')
			if (!this.#isMethodAllowed(req.method)) HTTP.METHOD_NOT_ALLOWED.throw()

			const body = await parseBody(req)
			const { client_id, scope } = await isAuthorized(req, body, this.#options.tokenEndpoint, this.#options.me)
			if ('GET' === req.method) return await this.#micropubQuery(body)

			const action = (body.action || 'create').toLowerCase()
			if (!isValidScope(scope, action)) HTTP.FORBIDDEN.throw('token has insufficient scope', 'insufficient_scope')

			const jf2 = toJf2(req.headers.get('content-type'), body)
			console.log('jf2')
			console.log('└─>', jf2)

			let slug
			if ('create' == action) {
				slug = await createContent(jf2, this.#options, client_id)
			} else if ('update' == action) {
				slug = await updateContent(body.url, body, this.#options)
			} else if ('delete' == action) {
				slug = await deleteContent(body.url, this.#options)
			} else if ('undelete' == action) {
				slug = await undeleteContent(body.url, this.#options)
			} else {
				// unknown or unsupported action
				HTTP.BAD_REQUEST.throw(`action "${action}" not supported`)
			}

			if (!slug) HTTP.BAD_REQUEST.throw(`an error occured while processing action "${action}"`)
			if ('create' == action) {
				return HTTP.CREATED.send('created', {
					'Location': slug,
				})
			}
		} catch (err) {
			return HTTP.fromError(err)
		}

		return HTTP.NO_CONTENT.send()
	}

	#mediaQuery = async (query) => {
		if (!query || 'source' !== query.q) HTTP.BAD_REQUEST.throw()
		// https://github.com/indieweb/micropub-extensions/issues/14
		const { offset = 0, limit = 10 } = query
		const exists = await this.#options.store.getDirectory(this.#options.mediaDir)
		if (!exists) HTTP.BAD_REQUEST.throw('directory does not exist')
		let items = []
		for (let file of exists.files) {
			items.push({ url: `${this.#options.me}${file.path}` })
		}
		// Since `url` should start with timestamp, sort by `url` and first item should be the newest
		items.sort((a, b) => a.url < b.url ? 1 : a.url > b.url ? -1 : 0)
		items = items.slice(offset, offset + limit)
		return HTTP.OK.send({
			items,
			count: items.length,
			total: exists.files.length,
		})
	}

	mediaHandler = async (req) => {
		try {
			if (!this.#isConfigured()) HTTP.BAD_REQUEST.throw('not configured')
			if (!this.#isMethodAllowed(req.method)) HTTP.METHOD_NOT_ALLOWED.throw()

			const body = await parseBody(req)
			const { scope } = await isAuthorized(req, body, this.#options.tokenEndpoint, this.#options.me)
			if ('GET' === req.method) return await this.#mediaQuery(body)

			const action = (body.action || 'media create').toLowerCase()
			if (!isValidScope(scope, action)) HTTP.FORBIDDEN.throw('token has insufficient scope', 'insufficient_scope')

			if (!body.files?.length) HTTP.BAD_REQUEST.throw('no files to upload')
			const uploaded = await uploadImage(body.files[0], this.#options)
			if (uploaded) {
				return HTTP.CREATED.send('created', {
					'Location': uploaded,
				})
			}
		} catch (err) {
			return HTTP.fromError(err)
		}

		return HTTP.BAD_REQUEST.send()
	}
}
