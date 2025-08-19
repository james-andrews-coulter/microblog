const HTTPResponse = (status, body, headers = {}) => {
	const isJson = typeof body === 'object'
	return new Response(isJson ? JSON.stringify(body) : body, {
		status,
		headers: {
			...(isJson && { 'Content-Type': 'application/json' }),
			...headers,
		},
	})
}

class HTTPError extends Error {
	constructor(status = 400, error, message) {
		super(message)
		this.status = status
		this.error = error
	}

	send(message = this.message) {
		return HTTPResponse(this.status, {
			error: this.error,
			...(message && { message }),
		})
	}
}

class HTTPStatus {
	constructor(status, body) {
		this.status = status
		this.body = body
	}

	send(body = this.body, headers = {}) {
		return HTTPResponse(this.status, body, headers)
	}

	throw(message, error = this.body) {
		console.log(this.status, error, message || '')
		throw new HTTPError(this.status, error, message)
	}
}

export default {
	OK: new HTTPStatus(200, 'ok'),
	CREATED: new HTTPStatus(201, 'created'),
	ACCEPTED: new HTTPStatus(202, 'accepted'),
	NO_CONTENT: new HTTPStatus(204),
	BAD_REQUEST: new HTTPStatus(400, 'bad request'),
	UNAUTHORIZED: new HTTPStatus(401, 'unauthorized'),
	FORBIDDEN: new HTTPStatus(403, 'forbidden'),
	NOT_FOUND: new HTTPStatus(404, 'not found'),
	METHOD_NOT_ALLOWED: new HTTPStatus(405, 'method not allowed'),
	INTERNAL_SERVER_ERROR: new HTTPStatus(500, 'internal server error'),
	fromError: (err) => {
		if (err instanceof HTTPError) return err.send()
		return HTTPResponse(err.status || 500, err.message || 'unexpected error')
	},
}
