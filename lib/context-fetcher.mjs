import { request } from 'undici';
import microformats from 'microformat-node';
import metascraper from 'metascraper';
import metascraperAuthor from 'metascraper-author';
import metascraperDate from 'metascraper-date';
import metascraperDescription from 'metascraper-description';
import metascraperTitle from 'metascraper-title';
import metascraperUrl from 'metascraper-url';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { promises as fs } from 'fs';
import path from 'path';

// Helper: Convert a readable stream to string
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

// Stub for normalization (to be implemented in 2.2.7)
function normalizeData(rawData) {
  // TODO: Implement normalization logic in next step
  return {
    url: rawData.url,
    title: rawData.meta.title || '',
    content: rawData.content || '',
    author: { name: rawData.meta.author || '', url: '' },
    published: rawData.meta.date || '',
    type: rawData.meta.type || 'page'
  };
}

/**
 * Internal: Fetches and parses raw metadata from a URL.
 * Not exported.
 * @param {string} url
 * @param {object} headers
 * @returns {Promise<object>} Normalized data + etag/lastModified
 */
async function fetchRawMetadata(url, headers = {}) {
  // 2.2.1: HTTP Request
  const res = await request(url, { method: 'GET', headers });
  if (res.statusCode !== 200) {
    throw new Error(`Failed to fetch ${url}: ${res.statusCode}`);
  }

  // 2.2.3: Data Extraction
  const html = await streamToString(res.body);
  const etag = res.headers['etag'] || null;
  const lastModified = res.headers['last-modified'] || null;

  // 2.2.4: Microformats2 Parsing
  const mf2 = await microformats.get({ html, baseUrl: url });

  // 2.2.5: Metascraper Parsing
  const scraper = metascraper([
    metascraperAuthor(),
    metascraperDate(),
    metascraperDescription(),
    metascraperTitle(),
    metascraperUrl(),
  ]);
  const meta = await scraper({ html, url });

  // 2.2.6: Readability Fallback
  let content = meta.description || '';
  if (!content) {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      if (article && article.textContent) {
        // Use first paragraph if available
        const firstPara = article.textContent.split('\n').find(p => p.trim().length > 0);
        content = firstPara ? firstPara.trim() : '';
      }
    } catch (e) {
      // fallback fails silently
    }
  }

  // 2.2.7: Data Normalization (stub, to be implemented in next step)
  const normalized = normalizeData({
    url,
    mf2,
    meta,
    content,
    etag,
    lastModified,
    html
  });

  // 2.2.8: Final Return
  return {
    ...normalized,
    etag,
    lastModified
  };
}

// Helper: Base64 URL encode (filename safe, no padding)
function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Public: Get cached metadata for a URL, with revalidation.
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function getCachedMetadata(url) {
  const cacheDir = path.join('data', 'reply-context');
  const filename = base64UrlEncode(url) + '.json';
  const filePath = path.join(cacheDir, filename);

  console.log(`[getCachedMetadata] Called for URL: ${url}`);

  try {
    // Ensure cache directory exists
    await fs.mkdir(cacheDir, { recursive: true });

    // 2.3.3: Cache Check
    let cacheExists = false;
    try {
      await fs.access(filePath);
      cacheExists = true;
    } catch {
      cacheExists = false;
    }

    if (cacheExists) {
      // 2.3.4: Revalidation Logic
      const cachedRaw = await fs.readFile(filePath, 'utf8');
      const cached = JSON.parse(cachedRaw);
      const etag = cached.etag || '';
      const lastModified = cached.lastModified || '';
      const headers = {};
      if (etag) headers['If-None-Match'] = etag;
      if (lastModified) headers['If-Modified-Since'] = lastModified;

      try {
        const res = await request(url, { method: 'GET', headers });
        if (res.statusCode === 304) {
          // Not Modified, return cached data (normalized portion)
          return { ...cached };
        } else if (res.statusCode === 200) {
          // Modified, fetch new data and update cache
          const fresh = await fetchRawMetadata(url, headers);
          await fs.writeFile(filePath, JSON.stringify(fresh, null, 2), 'utf8');
          return { ...fresh };
        } else {
          // Unexpected status, fallback to cached
          return { ...cached };
        }
      } catch (err) {
        // Network error, fallback to cached
        return { ...cached };
      }
    } else {
      // 2.3.5: Cache Miss Logic
      const fresh = await fetchRawMetadata(url);
      await fs.writeFile(filePath, JSON.stringify(fresh, null, 2), 'utf8');
      return { ...fresh };
    }
  } catch (err) {
    // 2.3.6: Top-Level Error Handling
    console.error(`[getCachedMetadata] Error for ${url}:`, err);
    return { url, error: true };
  }
}
