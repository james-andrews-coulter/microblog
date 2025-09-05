Of course. Here is a detailed, step-by-step task list based on the PRD, designed for an AI coding agent to implement.

***

### **Project: IndieWeb Context Implementation**

**Objective:** Implement the feature as defined in the PRD (`prd-indieweb-context-v1.md`). The following tasks should be executed sequentially.

---

### **Phase 1: Setup and Core Utility Development**

#### **Task 1: Project Setup & Dependency Installation**
-   [x] **1.1:** Navigate to the project's root directory.
-   [x] **1.2:** Install the required npm packages by running the following command:
    ```bash
    npm install metascraper microformats-parser @mozilla/readability jsdom
    ```
    *Note: `undici` is a built-in Node.js module in recent versions and may not require installation.*

#### **Task 2: Create the Core Metadata Fetching & Caching Utility**
-   [x] **2.1: File Creation:**
    -   [x] Create a new file at the path `lib/context-fetcher.mjs`.

-   [x] **2.2: Implement the Raw Data Fetcher (`fetchRawMetadata`)**
    -   [x] Inside `lib/context-fetcher.mjs`, create an internal, un-exported `async function fetchRawMetadata(url, headers = {})`. This function will perform the actual network request and parsing.
    -   [x] **2.2.1: HTTP Request:** Use `undici` to perform a `GET` request to the given `url`. Pass the `headers` object (which will be used for caching later).
    -   [x] **2.2.2: Error Handling:** If the response status is not 200, throw an error.
    -   [x] **2.2.3: Data Extraction:** On a successful response, extract the HTML content, the `ETag` header, and the `Last-Modified` header.
    -   [x] **2.2.4: Microformats2 Parsing:** Use `microformats-parser` on the HTML to find `h-entry` and `h-card` items. Store the result.
    -   [x] **2.2.5: Metascraper Parsing:** Use `metascraper` on the HTML to get Open Graph, Twitter Card, and other metadata.
    -   [x] **2.2.6: Readability Fallback:** If the data from the previous steps lacks a `description` or `content` field, use `@mozilla/readability` and `jsdom` to parse the HTML and extract the `textContent` of the first paragraph of the main content.
    -   [x] **2.2.7: Data Normalization:** Create a new function `normalizeData(rawData)` that takes the outputs from the parsers and maps them to the required PRD JSON structure:
        -   `url`
        -   `type` (Implement heuristics: if URL is YouTube/Vimeo, set to `video`; if `og:type` is `article`, set to `article`; if content is short, set to `note`; else `page`).
        -   `title`
        -   `content` (Ensure this is plain text and trimmed to ~300 characters with an ellipsis if longer).
        -   `author` (an object with `name` and `url`).
        -   `published` (in ISO 8601 format).
    -   [x] **2.2.8: Final Return:** The `fetchRawMetadata` function should return an object containing the normalized data, plus the fetched `etag` and `lastModified` headers for caching.

-   [x] **2.3: Implement the Public Caching Layer (`getCachedMetadata`)**
    -   [x] **2.3.1: Function Signature:** Export an `async function getCachedMetadata(url)`. This will be the main function used by Eleventy.
    -   [x] **2.3.2: File Path Generation:**
        -   Define the cache directory path: `data/reply-context/`.
        -   Create a helper function to convert the `url` into a filesystem-safe filename using Base64 URL encoding.
    -   [x] **2.3.3: Cache Check:** Check if a cache file for the generated filename exists.
    -   [x] **2.3.4: Revalidation Logic (If Cache Exists):**
        -   Read the cached JSON file.
        -   Extract the stored `etag` and `lastModified` values.
        -   Construct a `headers` object for the request: `{'If-None-Match': etag, 'If-Modified-Since': lastModified}`.
        -   Make a `GET` request to the URL with these headers.
        -   **If the server responds with `304 Not Modified`**, return the data from the cached JSON file immediately.
        -   **If the server responds with `200 OK`**, proceed to call `fetchRawMetadata`, then overwrite the cache file with the new data, and return it.
    -   [x] **2.3.5: Cache Miss Logic (If No Cache Exists):**
        -   Call `fetchRawMetadata(url)` with no headers.
        -   Save the complete returned object (normalized data + headers) as a new JSON file in the cache directory.
        -   Return the normalized data portion of the object.
    -   [x] **2.3.6: Top-Level Error Handling:** Wrap the function's logic in a `try/catch` block. If any step fails, log the error to the console and return a minimal object: `{ url: url, error: true }`.

---

### **Phase 2: Eleventy Integration and Frontend Implementation**

#### **Task 3: Integrate Utility into Eleventy**
-   [x] **3.1: Modify Config File:** Open `eleventy.config.cjs`.
-   [x] **3.2: Import Utility:** At the top of the file, import the `getCachedMetadata` function:
    ```javascript
    const { getCachedMetadata } = require("./lib/context-fetcher.mjs");
    ```
-   [x] **3.3: Register Async Filter:** Inside the main `module.exports` function, add a Nunjucks async filter named `fetchContext`.
    ```javascript
    eleventyConfig.addNunjucksAsyncFilter(
      "fetchContext",
      async function (url, callback) {
        if (!url) {
          return callback(null, null);
        }
        try {
          const context = await getCachedMetadata(url);
          callback(null, context);
        } catch (error) {
          console.error(`[Context Fetcher] Error for ${url}:`, error);
          callback(null, { url: url, error: true }); // Graceful fallback
        }
      }
    );
    ```

#### **Task 4: Create the Reusable Frontend Partial**
-   [x] **4.1: File Creation:**
    -   [x] Create a new file at `src/_includes/components/context-cite.njk`.
-   [x] **4.2: Implement HTML and Microformats Structure:**
    -   [x] Use the HTML structure specified in the PRD (`aside.h-cite`, `a.u-url`, `cite.p-name`, `blockquote.p-content`, `footer`, `p-author.h-card`, `time.dt-published`).
-   [x] **4.3: Implement Conditional Logic:**
    -   [x] The entire partial should be wrapped in an `{% if ctx and ctx.url and not ctx.error %}` block.
    -   [x] Use `{% if ctx.type == 'note' and ctx.content %}` to render the `<blockquote>` for notes.
    -   [x] Use `{% elif ctx.title %}` to render the `<cite>` for articles and other types.
    -   [x] Provide a final `{% else %}` to render just the URL as a fallback if no title or content exists.
    -   [x] Use `{% if ctx.author and ctx.author.name %}` and `{% if ctx.published %}` to conditionally render the author and date lines in the footer.

#### **Task 5: Update Post Templates**
-   [x] **5.1: Identify Target Templates:** Locate the primary templates responsible for rendering single posts for replies, bookmarks, likes, and reposts (e.g., `src/_includes/layouts/reply.njk`, `src/_includes/layouts/bookmark.njk`, etc.).
-   [ ] **5.2: Add Data Fetching Logic:** In each relevant template, add the following Nunjucks logic near the top of the file.
    ```nunjucks
    {# Define the target URL based on frontmatter #}
    {% set targetUrl = data['in-reply-to'] or data['bookmark-of'] or data['like-of'] or data['repost-of'] %}

    {# Asynchronously fetch the context data #}
    {% set context = targetUrl | fetchContext %}
    ```
-   [ ] **5.3: Render the Partial:** In the desired location within the template's `<article>` tag, include the partial and the fallback.
    ```nunjucks
    {# Render the context block if fetch was successful #}
    {% if context and not context.error %}
      {% include "components/context-cite.njk" with { ctx: context } %}
    {% elif targetUrl %}
      {# Render a simple fallback link if fetch failed or was disabled #}
      <p class="reply-context-fallback">
        In reply to <a href="{{ targetUrl }}">{{ targetUrl }}</a>
      </p>
    {% endif %}
    ```
-   [ ] **5.4: Repeat for all Context Types:** Apply steps 5.2 and 5.3 to all relevant post type layouts.

---

### **Phase 3: Verification**

#### **Task 6: Test and Verify Implementation**
-   [ ] **6.1: Run a Clean Build:** Delete the `data/reply-context/` directory and run the Eleventy build command.
-   [ ] **6.2: Verify Cache Creation:** Confirm that the `data/reply-context/` directory is created and populated with JSON files.
-   [ ] **6.3: Verify Rendered Output:** Inspect the generated HTML for a reply post and confirm the context block is rendered correctly with all Microformats2 classes.
-   [ ] **6.4: Run a Second Build:** Run the build command again immediately.
-   [ ] **6.5: Verify Cache Hits:** Check the build log for any error messages. The build should be faster, and you should not see console logs indicating repeated fetches for the same URLs.
-   [ ] **6.6: Test Fallbacks:** Manually create a post with a fake/broken `in-reply-to` URL. Build the site and verify that the graceful fallback link is rendered instead of the full context block.
