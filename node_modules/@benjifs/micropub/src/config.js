export default {
	me: '',
	tokenEndpoint: '',
	contentDir: 'src',
	mediaDir: 'uploads',
	// See `frontmatter.js`
	// 11ty uses different naming for properties (eg. name -> title, category -> tags)
	// This translates properties to expected values but it can be turned
	// off if a different static site generator does not need that
	translateProps: true,
	// https://micropub.spec.indieweb.org/#configuration
	config: {
		'media-endpoint': '',
		'syndicate-to': [],
		// https://indieweb.org/Micropub-extensions#Query_for_Supported_Vocabulary
		// https://github.com/indieweb/micropub-extensions/issues/1
		'post-types': [
			{ type: 'note', name: 'Note' },
			{ type: 'photo', name: 'Photo' },
			{ type: 'reply', name: 'Reply' },
			{ type: 'bookmark', name: 'Bookmark' },
			{ type: 'like', name: 'Like' },
			{ type: 'article', name: 'Article' },
			{ type: 'rsvp', name: 'RSVP' },
			{ type: 'repost', name: 'Repost' },
			{ type: 'watch', name: 'Watch' },
			{ type: 'read', name: 'Read' },
			{ type: 'listen', name: 'Listen' },
			{ type: 'game', name: 'Game' },
		],
	},
	formatSlug: (type = 'note', slug) => `${type}/${slug}`,
	formatFilename: (dir = 'src', slug) => `${dir.replace(/\/$/, '')}/${slug}.md`,
	mediaFilename: (dir = 'uploads', filename) => !filename ? null : `${dir.replace(/\/$/, '')}/${Math.round(new Date() / 1000)}_${filename}`,
}
