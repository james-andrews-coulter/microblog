# TODO: IndieWeb Reply-Context Implementation

This task list outlines the necessary steps to fix the IndieWeb reply-context feature. Execute these tasks in order.

## 1. Resolve Production Build and Environment Inconsistencies

These tasks fix the difference in behavior between the local development server and the deployed production site.

- [x] **Add `undici` to dependencies**
  - **Action:** Run the following command in the terminal to add the missing dependency to `package.json`.
    ```bash
    npm install undici
    ```

- [ ] **Correct frontmatter variable access in layout templates**
  - **File:** `src/_includes/layouts/reply.njk`
  - **Action:** Find the line that sets the `targetUrl` variable.
  - **Replace this:**
    ```njk
    {% set targetUrl = inReplyTo or bookmarkOf or likeOf or repostOf %}
    ```
  - **With this:**
    ```njk
    {% set targetUrl = data['in-reply-to'] or data['bookmark-of'] or data['like-of'] or data['repost-of'] %}
    ```
  - **Note:** Apply the same fix to `bookmark.njk`, `like.njk`, and `repost.njk` layouts if they use the same camelCase variable pattern.

- [ ] **Fix Luxon import order in Eleventy config**
  - **File:** `eleventy.config.cjs`
  - **Action:** Locate the line `const { DateTime } = require("luxon");`.
  - **Instruction:** Move this line to the top of the file, immediately after the other `require` statements, to ensure it is available for all filters that depend on it.

## 2. Implement Robust Data Normalization

This task fixes the incorrect data (`type: 'page'`, wrong author) in the cached JSON files.

- [ ] **Replace the `normalizeData` function**
  - **File:** `lib/context-fetcher.mjs`
  - **Action:** Locate the existing `normalizeData` function and replace it entirely with the following implementation.
  - **New Code:**
    ```javascript
    function normalizeData(rawData) {
      const { url, mf2, meta } = rawData;
      const entry = mf2?.items?.find(item => item.type?.includes('h-entry'));

      let title = meta.title || '';
      let content = rawData.content || '';
      let author = { name: meta.author || '', url: '' };
      let published = meta.date || '';
      let type = 'page';

      if (entry) {
        const props = entry.properties;

        // Determine Type
        const name = props.name?. || '';
        const entryContent = props.content?.?.html || props.content?.?.value || props.content?. || '';

        if (name && name.trim() !== '' && name !== entryContent) {
          title = name;
          type = 'article';
        } else {
          type = 'note';
        }

        content = entryContent || props.summary?. || '';

        // Get Author from h-card
        const authorProp = props.author?.;
        if (typeof authorProp === 'object' && authorProp.type?.includes('h-card')) {
          author.name = authorProp.properties.name?. || meta.author || '';
          author.url = authorProp.properties.url?. || '';
        } else if (typeof authorProp === 'string') {
          author.name = authorProp;
        }

        published = props.published?. || published;
      }

      return {
        url,
        title,
        content: content.trim(),
        author,
        published,
        type,
      };
    }
    ```

## 3. Ensure Citations Render on All Relevant Pages

This task ensures that the fetched context is displayed on index/list pages, not just on the individual post pages.

- [ ] **Add context rendering to card components**
  - **Action:** For each relevant card component in `src/_includes/components/` (e.g., `card-reply.njk`, `card-bookmark.njk`, etc.), you need to fetch the context and include the citation partial.
  - **Example Instruction for a generic card:**
    1.  At the top of the card file, add a variable to hold the target URL.
        ```njk
        {% set targetUrl = post.data['in-reply-to'] or post.data['bookmark-of'] or post.data['like-of'] or post.data['repost-of'] %}
        ```
    2.  Inside the main body of the card, where you want the citation to appear, add the following block. This fetches the data and includes the citation component.
        ```njk
        {% if targetUrl %}
          {% set context = targetUrl | fetchContext %}
          {% include "components/context-cite.njk", ctx: context %}
        {% endif %}
        ```

- [ ] **Clear the existing cache**
  - **Action:** To ensure all new changes take effect and old, incorrect data is purged, delete all JSON files inside the `data/reply-context/` directory.
  - **Command:**
    ```bash
    rm data/reply-context/*.json
    ```
  - **Note:** The cache will be rebuilt automatically the next time you run the Eleventy build.
