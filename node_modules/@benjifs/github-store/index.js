const Base64 = {
	encode: content => Buffer.from(content).toString('base64'),
	decode: content => Buffer.from(content, 'base64').toString('utf8'),
}

// https://docs.github.com/en/rest/repos/contents
export default class GitHubStore {
	#token
	#user
	#repo
	#branch
	#committer

	/**
	 * @typedef {Object} Committer
	 * @property {string} name
	 * @property {string} email
	 */

	/**
	 * @typedef {Object} GitHubOptions
	 * @property {string} token - GitHub access token
	 * @property {string} user - GitHub username
	 * @property {string} repo - GitHub repository name
	 * @property {string} [branch] - GitHub branch (defaults to repo's default)
	 * @property {Committer} [committer] - Custom committer info
	 */

	/**
	 * @param {GitHubOptions} options
	 */
	constructor({ token, user, repo, branch, committer }) {
		this.#token = token
		this.#user = user
		this.#repo = repo
		this.#branch = branch // Default: the repository's default branch
		this.#committer = committer // Default: the authenticated user
	}

	// https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents
	async createFile(filename, content) {
		console.log('GITHUB.createFile', content)
		return await this.upload('PUT', filename, {
			content: Base64.encode(content),
			message: `add: ${filename}`,
		})
	}

	// https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents
	async updateFile(filename, content, original) {
		console.log('GITHUB.updateFile', content)
		return await this.upload('PUT', filename, {
			content: Base64.encode(content),
			sha: original.sha,
			message: `update: ${filename}`,
		})
	}

	// https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents
	async uploadImage(filename, file) {
		console.log('GITHUB.uploadImage', filename, file.filename)
		return await this.upload('PUT', filename, {
			content: Base64.encode(file.content),
			message: `upload: ${filename}`,
		})
	}

	async upload(method, filename, json) {
		return await this.request(method, encodeURIComponent(filename), json)
	}

	#getBranchRef() {
		return this.#branch ? `?ref=${this.#branch}` : ''
	}

	// https://docs.github.com/en/rest/reference/repos#get-repository-content
	async getFile(filename) {
		const body = await this.request('GET', encodeURIComponent(filename) + this.#getBranchRef())
		if (body) {
			return {
				filename,
				content: Base64.decode(body.content),
				sha: body.sha,
			}
		}
	}

	// Same as `getFile`
	// Keeping as a separate function in case this needs to change since
	// GitHub Contents returns first 1000 files sorted by filename in dir
	// Might switch to tree API later
	// https://docs.github.com/en/rest/reference/git#get-a-tree
	async getDirectory(dir) {
		const body = await this.request('GET', encodeURIComponent(dir) + this.#getBranchRef())
		if (Array.isArray(body)) return { files: body }
	}

	// https://docs.github.com/en/rest/reference/repos#delete-a-file
	async deleteFile(filename, original) {
		return await this.request('DELETE', encodeURIComponent(filename), {
			sha: original.sha,
			message: `delete: ${filename}`,
		})
	}

	async request(method = 'GET', endpoint, json = null) {
		console.log(`GITHUB.${method}`, endpoint)
		if (json) {
			if (this.#branch) json.branch = this.#branch
			if (this.#committer) json.committer = this.#committer
		}
		try {
			const res = await fetch(`https://api.github.com/repos/${this.#user}/${this.#repo}/contents/${endpoint}`, {
				method,
				headers: {
					'Accept': 'application/vnd.github.v3+json',
					'Authorization': `Bearer ${this.#token}`,
					...(json && { 'Content-Type': 'application/json' }),
				},
				...(json && { body: JSON.stringify(json) }),
			})
			if (!res.ok) {
				console.error('ERROR', res)
				return null
			}
			const body = await res.json()
			console.log('└─>', body)
			return body
		} catch(err) {
			const { response } = err
			console.error('ERROR', response.statusCode, response.body)
		}
	}
}
