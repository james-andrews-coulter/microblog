import { mf2tojf2 } from '@paulrobertlloyd/mf2tojf2'

export const jsonToJf2 = (body) => mf2tojf2({ items: [body] })

export const formToJf2 = (form) => {
	if (!form) return
	const jf2 = {
		type: form.h || 'entry',
	}
	delete form.h
	for (const [key, value] of Object.entries(form)) {
		jf2[key] = value
	}
	return jf2
}

export const toJf2 = (contentType, body) =>
	contentType?.includes('application/json') ? jsonToJf2(body) : formToJf2(body)
