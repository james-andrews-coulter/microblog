import matter from 'gray-matter'

const renameProperties = {
	name: 'title',
	category: 'tags',
	published: 'date',
}
// 11ty uses the above named properties which are different from the
// standard mf2 names. Not sure if this is true for all static site
// generators but will leave this here to make it optional during the
// frontmatter creation process
export const translateProperties = (data, reverse) => {
	const dictionary = !reverse ? renameProperties : Object.fromEntries(Object.entries(renameProperties).map(([k, v]) => [v, k]))
	const properties = {}
	for (let [key, value] of Object.entries(data)) {
		properties[dictionary[key] || key] = value
	}
	return properties
}

const ignoreProperties = [ 'content', 'access_token' ]
export const toFrontmatter = (data, client_id) => {
	const properties = {
		...data,
		...(client_id && { client_id }),
	}
	for (let prop of ignoreProperties) {
		delete properties[prop]
	}
	return matter.stringify(data.content?.html || data.content || '', properties)
}

export const parseFrontmatter = data => {
	const fm = matter(data.toString())
	const properties = fm.data

	const type = properties['type'] || 'entry'
	properties['content'] = fm.content.trim()
	delete properties.type

	return { type, ...properties }
}

export const toMf2 = data => {
	const mf2 = {
		type: [`h-${data.type || 'entry'}`],
		properties: {},
	}
	delete data.type

	for (const [key, value] of Object.entries(data)) {
		if (typeof value === 'object' && value.type) {
			mf2.properties[key] = [ toMf2(value) ]
		} else {
			mf2.properties[key] = Array.isArray(value) ? value : [ value ]
		}
	}
	return mf2
}
