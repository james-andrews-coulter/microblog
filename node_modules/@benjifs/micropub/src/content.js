import { mf2tojf2 } from '@paulrobertlloyd/mf2tojf2'
import { toFrontmatter, translateProperties, parseFrontmatter, toMf2 } from './frontmatter.js'
import { postTypes } from './postTypes.js'
import { addProperties, deleteProperties, updateProperties } from './mf2.js'
import { slugify, getPageTitle, urlToFilename } from './utils.js'
import HTTP from './HTTPResponse.js'

// prefix is usually a timestamp
// slug provided: slug
// article: title
// post with name: timestamp-title
// {watch,read,listen,play}-of post: timestamp-medianame-published
// default: timestamp
export const generateSlug = (type, jf2, prefix) => {
	let slug = []
	if ('article' != type && !jf2['mp-slug'] && prefix) slug.push(prefix)
	if (jf2['mp-slug']) {
		slug.push(jf2['mp-slug'])
	} else if (jf2.name) {
		slug.push(jf2.name)
	} else {
		const cite = jf2['watch-of'] || jf2['read-of'] || jf2['listen-of'] || jf2['play-of']
		if (cite?.name) slug.push(cite.name)
		if (cite?.published) slug.push(cite.published)
	}
	return slugify(slug.join('-'))
}

export const getPost = async (url, opts) => {
	let filename = urlToFilename(url, opts.me, opts.contentDir)
	if (!filename) HTTP.BAD_REQUEST.throw(`${url} is not valid`)
	const post = await opts.store.getFile(filename)
	if (!post) HTTP.NOT_FOUND.throw(`${filename} does not exist`)
	return { filename, post }
}

export const uploadImage = async (file, opts) => {
	if (!file?.filename) return
	const filename = opts.mediaFilename(opts.mediaDir, file.filename)
	if (!filename) HTTP.BAD_REQUEST.throw('Could not generate filename')
	const uploaded = await opts.store.uploadImage(filename, file)
	if (uploaded) return `${opts.me}${filename}`
}

export const createContent = async (jf2, opts, client_id) => {
	const type = postTypes(jf2)
	if (!jf2 || !type) HTTP.BAD_REQUEST.throw()
	if (['like', 'bookmark'].includes(type) && !jf2.name) {
		jf2.name = await getPageTitle(jf2[`${type}-of`])
	}
	const date = new Date()
	jf2[!jf2.date && !jf2.published ? 'date' : 'updated'] = date.toISOString()

	const slug = opts.formatSlug(type, generateSlug(type, jf2, Math.round(date / 1000)))
	const filename = opts.formatFilename(opts.contentDir, slug)

	const exists = await opts.store.getFile(filename)
	if (exists) HTTP.BAD_REQUEST.throw('file exists')

	if (jf2.files) {
		let photos = []
		for (const file of jf2.files) {
			try {
				const uploaded = await uploadImage(file, opts)
				if (uploaded) photos.push(uploaded)
			} catch (err) {
				console.error('could not upload file', err?.message)
			}
		}
		if (photos.length > 0) jf2.photo = photos
		delete jf2.files
	}

	const output = opts.translateProps ? translateProperties(jf2) : jf2
	const fm = toFrontmatter(output, client_id)
	console.log('└─>', fm)
	const created = await opts.store.createFile(filename, fm)
	if (created) return `${opts.me.replace(/\/$/, '')}/${slug}`
}

const handleUpdate = (body, post) => {
	if (body?.add) return addProperties(post, body.add)
	if (body?.delete) return deleteProperties(post, body.delete)
	if (body?.replace) return updateProperties(post, body.replace)
}

export const updateContent = async (url, body, opts) => {
	const { filename, post } = await getPost(url, opts)

	let parsedFM = parseFrontmatter(post.content)
	parsedFM = opts.translateProps ? translateProperties(parsedFM, true) : parsedFM
	let mf2 = toMf2(parsedFM)
	const updated = handleUpdate(body, mf2)
	if (!updated) HTTP.BAD_REQUEST.throw('nothing to update')

	const jf2 = mf2tojf2({ items: [updated] })
	const output = opts.translateProps ? translateProperties(jf2) : jf2
	const fm = toFrontmatter(output)
	console.log('└─>', fm)
	const success = await opts.store.updateFile(filename, fm, post)
	if (!success) throw HTTP.BAD_REQUEST.throw('file cannot be updated')
	return url
}

export const deleteContent = async (url, opts, permanent) => {
	if (!permanent) return updateContent(url, { add: { deleted: [ true ] } }, opts)
	const { filename, post } = await getPost(url, opts)
	const res = await opts.store.deleteFile(filename, post)
	if (!res) HTTP.BAD_REQUEST.throw('file cannot be deleted')
	return url
}

export const undeleteContent = async (url, opts) => updateContent(url, { delete: ['deleted'] }, opts)
