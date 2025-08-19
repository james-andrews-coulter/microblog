import HTTP from './HTTPResponse.js'

export const validateToken = async (tokenEndpoint, token) => {
	try {
		const res = await fetch(tokenEndpoint, {
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${token}`,
			},
		})
		const json = await res.json()
		return json
	} catch (err) {
		console.error(err)
	}
}

export const parseToken = (headers, body) => {
	const bearerToken = headers?.get('authorization')?.split(' ')[1]
	const accessToken = body?.access_token
	// https://tools.ietf.org/html/rfc6750#section-3.1
	if (bearerToken && accessToken) HTTP.BAD_REQUEST.throw('access token is present in the header and POST body')
	return bearerToken || accessToken
}

export const isAuthorized = async (req, body, tokenEndpoint, me) => {
	const token = parseToken(req.headers, body)
	if (!token) HTTP.UNAUTHORIZED.throw()
	const auth = await validateToken(tokenEndpoint, token)
	if (!auth || auth.me != me) HTTP.FORBIDDEN.throw()
	return auth
}

export const isValidScope = (scope, requiredScopes) => {
	const validScopes = scope.split(' ')
	// Checks if at least one of the values in `requiredScopes` is in `validScopes`
	return requiredScopes.split(' ').some(sc => validScopes.includes(sc))
}
