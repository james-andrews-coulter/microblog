export const postTypes = data => {
	if (typeof data !== 'object' || Object.keys(data).length == 0) return null
	if (data['rsvp'] && ['yes', 'no', 'maybe', 'interested'].includes(data['rsvp']) && data['in-reply-to']) return 'rsvp'
	if (data['in-reply-to']) return 'reply'
	if (data['repost-of']) return 'repost'
	if (data['like-of']) return 'like'
	if (data['bookmark-of']) return 'bookmark'
	if (data['photo']) return 'photo'
	if (data['name']) return 'article'
	if (data['watch-of']) return 'watch'
	if (data['read-of']) return 'read'
	if (data['listen-of']) return 'listen'
	if (data['play-of']) return 'play'
	return 'note'
}
