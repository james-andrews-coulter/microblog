# micropub

This project allows you to create a serverless [Micropub](https://indieweb.org/Micropub)
and [media endpoint](https://www.w3.org/TR/micropub/#media-endpoint) which can add
files to your static sites' repository. After setup, you can use any [Micropub Client](https://indieweb.org/Micropub/Clients)
to add posts to your site. Tested with [Eleventy](https://www.11ty.dev/) and [Hugo](https://gohugo.io/).

To run this, checkout the [serverless-micropub](https://github.com/benjifs/serverless-micropub)
repository which provides a basic working example to get micropub setup using [Netlify functions](https://docs.netlify.com/build/functions/overview/).

## Install

`npm install @benjifs/micropub`

## Usage

```js
import MicropubEndpoint from '@benjifs/micropub'
import GitHubStore from '@benjifs/github-store'

const {
	ME, TOKEN_ENDPOINT,
	GITHUB_TOKEN, GITHUB_USER, GITHUB_REPO,
} = process.env

export const micropub = new MicropubEndpoint({
	store: new GitHubStore({
		token: GITHUB_TOKEN,
		user: GITHUB_USER,
		repo: GITHUB_REPO,
	}),
	me: ME,
	tokenEndpoint: TOKEN_ENDPOINT,
})

export default async (req) => micropub.micropubHandler(req)
```

## Configuration

The following options can be added when initializing this project:

### `me` (Required)
URL for your site with trailing slash

```js
me: 'https://example.com/'
```

### `tokenEndpoint` (Required)
[Token endpoint](https://indieauth.spec.indieweb.org/#token-endpoint) to verify the access token submitted.

```js
tokenEndpoint: 'https://auth.example.com/token'
```

### `contentDir`
The main directory where your posts will be added to.

```js
contentDir: 'src' // Default value
```

### `mediaDir`
The directory where your media endpoint will add files to.

```js
mediaDir: 'uploads' // Default value
```

### `translateProps`
[11ty](https://11ty.dev) uses different naming for properties (eg. name -> title,
category -> tags). Settings this value to `true` (default) makes sure that these
properties are translated between what 11ty and the expected valid microformats.

```js
translateProps: true // Default value
```

### `formatSlug`
You can configure if you want your posts of a specific type to go into a different
directory. For example, you can configure all posts regardless of type to go into
the same directory or all posts of type `note` and `reply` to go into a `notes`
directory.

```js
formatSlug: (type, slug) => `${type}/${slug}` // Default value
```

### `formatFilename`
Use if you do not use markdown as your file types.

```js
formatFilename: (dir, slug) => `${dir}/${slug}.md` // Default value
```

### `mediaFilename`
File name for uploaded files. Can be useful if you want the filenames to share
a common prefix, or to use a date format other than milliseconds.

```js
mediaFilename: (mediaDir, filename) => `${mediaDir}/${timestamp}_${filename}` // Default value
```

### `config.media-endpoint`
URL for your media endpoint. If not configured, Micropub clients will not know the
endpoint exists.

See [3.6.1 Discovery](https://micropub.spec.indieweb.org/#discovery).

```js
config: {
	...
	'media-endpoint': 'https://micropub.example.com/media',
	...
}
```

### `config.syndicate-to`
Syndicate target options.

See [3.7.3 Syndication Targets](https://micropub.spec.indieweb.org/#syndication-targets).

```js
config: {
	...
	'syndicate-to': [
		{ uid: 'https://fed.brid.gy/', name: 'w/ Bridgy Fed', checked: true },
	],
	...
}
```

### `config.post-types`
Define supported post types for a micropub client to show.

See [discussion about proposed extension](https://indieweb.org/Micropub-extensions#Query_for_Supported_Vocabulary).

```js
config: {
	...
	'post-types': [ // Default values
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
	...
}
```

## Post Types

The current supported post types are:
* [article](https://indieweb.org/article)
* [bookmark](https://indieweb.org/bookmark)
* [like](https://indieweb.org/like)
* [listen](https://indieweb.org/listen)
* [note](https://indieweb.org/note)
* [photo](https://indieweb.org/photo)
* [play](https://indieweb.org/play)
* [read](https://indieweb.org/read)
* [repost](https://indieweb.org/repost)
* [rsvp](https://indieweb.org/rsvp)
* [watch](https://indieweb.org/watch)
* [reply](https://indieweb.org/reply)

> **Note:** If a post does not fit under a specific type, it will default to be
of type `note`.

## Scopes
* create - allows the client to create posts on behalf of the user
* update - allows the client to edit existing posts
* delete - allows the client to delete posts
* undelete - allows the client to undelete posts
* media - allows the client to upload files to the media endpoint

## Troubleshooting
* `ME` should have a trailing slash

## References
* [Micropub spec](https://www.w3.org/TR/micropub)
* [Micropub media endpoint](https://www.w3.org/TR/micropub/#media-endpoint)
* [Handling a micropub request](https://indieweb.org/Micropub#Handling_a_micropub_request)
* [Micropub extensions](https://indieweb.org/Micropub-extensions)
