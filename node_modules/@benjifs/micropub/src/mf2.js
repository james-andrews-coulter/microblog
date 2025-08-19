// Should work for this use case but could actually do a better
// deepEqual check if necessary
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const deepClone = a => JSON.parse(JSON.stringify(a))

export const addProperties = (mf2, properties) => {
	if (!mf2 || !mf2.properties || !properties) return
	const og = deepClone(mf2)
	for (const [key, value] of Object.entries(properties)) {
		const original = mf2.properties[key] || []
		const add = value.filter(item => !original.includes(item))
		mf2.properties[key] = [ ...original, ...add ]
	}
	return deepEqual(og, mf2) ? false : mf2
}

export const deleteProperties = (mf2, properties) => {
	if (!mf2 || !mf2.properties || !properties) return
	const og = deepClone(mf2)
	if (Array.isArray(properties)) {
		for (const prop of properties) {
			delete mf2.properties[prop]
		}
	} else if (typeof properties === 'object') {
		for (const [key, value] of Object.entries(properties)) {
			mf2.properties[key] = (mf2.properties[key] || []).filter(item => !value.includes(item))
			if (mf2.properties[key]?.length === 0) {
				delete mf2.properties[key]
			}
		}
	}
	return deepEqual(og, mf2) ? false : mf2
}

export const updateProperties = (mf2, properties) => {
	if (!mf2 || !mf2.properties || !properties) return
	const og = deepClone(mf2)
	for (const [key, value] of Object.entries(properties)) {
		if (!Array.isArray(value)) continue
		mf2.properties[key] = value
	}
	return deepEqual(og, mf2) ? false : mf2
}
