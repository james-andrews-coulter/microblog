import { Readable } from 'node:stream'
import { Buffer } from 'node:buffer'
import Busboy from 'busboy'

const readableStreamToBuffer = async (stream) => {
	const buffers = []
	for await (const buffer of stream) {
		buffers.push(buffer)
	}
	return Buffer.concat(buffers)
}

const parseMultipart = async (req) => {
	const bodyBuffer = await readableStreamToBuffer(req.body)
	const stream = Readable.from(bodyBuffer)
	const headers = Object.fromEntries(req.headers.entries())

	const addProperty = (store, name, value) => {
		const isArray = name.endsWith('[]')
		const key = isArray ? name.slice(0, -2) : name
		if (isArray) {
			if (!store[key]) store[key] = []
			store[key].push(value)
		} else {
			store[key] = value
		}
	}

	return new Promise((resolve, reject) => {
		const bb = Busboy({ headers })
		const files = []
		const fields = {}

		bb.on('file', async (name, file, info) => {
			const chunks = []
			file.on('data', chunk => chunks.push(chunk))
			file.on('end', () => {
				files.push({
					...info,
					content: Buffer.concat(chunks),
				})
			})
		})

		bb.on('field', (field, value) => addProperty(fields, field, value))
		bb.on('error', reject)
		bb.on('finish', () => resolve({
			...fields,
			files,
		}))

		stream.pipe(bb)
	})
}

const dataToJson = data => {
	if (!data) return
	const entries = Array.from(data.keys()).map(key => {
		const values = data.getAll(key)
		const normalizedKey = key.endsWith('[]') ? key.slice(0, -2) : key
		return [normalizedKey, values.length === 1 ? values[0] : values]
	})
	return Object.fromEntries(entries)
}

export const parseBody = async (req) => {
	const contentType = req.headers.get('content-type')
	console.log('parseBody', contentType)
	let body
	if (contentType?.includes('application/json')) {
		body = await req.json()
	} else if (contentType?.includes('multipart/form-data')) {
		try {
			body = await parseMultipart(req)
		} catch (err) {
			console.error(`Could not parse body with content-type: ${contentType}`, err)
		}
	} else if (contentType?.includes('application/x-www-form-urlencoded')) {
		const form = await req.formData()
		body = dataToJson(form)
	} else {
		body = new URL(req.url).searchParams
		body = dataToJson(body)
	}
	console.log('└─>', body)
	return body
}
