# GitHub Store

This project was designed to work with [@benjifs/micropub](https://github.com/benjifs/micropub) but it should be usable with other projects that need to interact with the [GitHub Contents API](https://docs.github.com/en/rest/repos/contents).

There is also a compatible version to work with a GitLab repository: [@benjifs/gitlab-store](https://github.com/benjifs/gitlab-store).

## Install

`npm install @benjifs/github-store`

## Setup

You need one of the following tokens to work with the contents API:
- [Personal access token (classic)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic) with the `repo` scope selected.
- [Fine-grained personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) for the repository you want access
to with `Read and write` access to **Contents** and `Read` access to **Metadata**.

## Usage

```js
import GitHubStore from '@benjifs/github-store'

const {
	GITHUB_TOKEN,
	GITHUB_USER,
	GITHUB_REPO,
} = process.env

const store = new GitHubStore({
	token: GITHUB_TOKEN,                    // required
	user: GITHUB_USER,                      // required
	repo: GITHUB_REPO,                      // required
	// branch: 'main',                      // default: default branch for repo
	// committer: {                         // default: the authenticated user
	// 	name: 'committer name',
	// 	email: 'committer@example.com'
	// },
})

// ...

const uploaded = await store.createFile('src/example.txt', 'this is a test')
```
