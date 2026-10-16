// Blog: server-rendered public pages + admin CMS actions in one function.
// (Kept to a single file so the blog adds one serverless function, not six.)
//
// Public (rewritten from /blog/* in vercel.json):
//   GET ?view=index[&category=<slug>][&q=][&page=]   /blog, /blog/category/<slug>
//   GET ?view=post&slug=<slug>                        /blog/<slug>
//   GET ?view=rss                                     /blog/rss.xml
//   GET ?view=sitemap                                 /blog/sitemap.xml
//
// Admin (requires the admin session cookie):
//   GET  ?admin=list | ?admin=get&id=
//   POST ?admin=save | ?admin=delete | ?admin=upload | ?admin=preview (form post, renders unsaved draft)
const crypto = require('crypto');
const { requireAdmin, unauthorized, readBody, json } = require('./_auth');
const { supabaseRequest, getSupabaseConfig } = require('./_supabase');
const md = require('../lib/markdown');
const blog = require('../lib/blog');

const LIST_FIELDS = 'id,slug,title,excerpt,cover_image_url,cover_image_alt,category,tags,author_name,author_role,status,featured,published_at,updated_at,reading_minutes';
const BUCKET = 'blog-images';
// Base64 inflates by a third; 3 MB keeps the JSON body under Vercel's 4.5 MB limit.
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const UPLOAD_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

function send(res, status, body, type, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', cache);
  res.end(body);
}

const PUBLIC_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';
const NO_CACHE = 'no-store';

// ── Public reads (anon key; RLS also hides drafts and future posts) ─────────

function publishedFilter() {
  return `status=eq.published&published_at=lte.${encodeURIComponent(new Date().toISOString())}`;
}

// PostgREST `or`/`ilike` filters treat , ( ) * and quotes specially.
function cleanQuery(q) {
  return String(q || '').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function listPublished({ category, q, limit, offset, exclude }) {
  let query = `select=${LIST_FIELDS}&${publishedFilter()}&order=published_at.desc&limit=${limit}&offset=${offset}`;
  if (category) query += `&category=eq.${encodeURIComponent(category)}`;
  if (exclude) query += `&id=neq.${encodeURIComponent(exclude)}`;
  if (q) {
    const term = encodeURIComponent(`"*${q}*"`);
    query += `&or=(title.ilike.${term},excerpt.ilike.${term},content_md.ilike.${term})`;
  }
  const { data, headers } = await supabaseRequest('blog_posts', { query, prefer: 'count=exact' });
  const range = headers.get('content-range') || '';
  const total = parseInt(range.split('/')[1], 10);
  return { posts: data || [], total: Number.isFinite(total) ? total : (data || []).length };
}

async function usedCategories() {
  const { data } = await supabaseRequest('blog_posts', { query: `select=category&${publishedFilter()}` });
  const used = new Set((data || []).map(r => r.category));
  return blog.CATEGORIES.filter(c => used.has(c));
}

async function handleIndex(req, res, url) {
  const catSlug = url.searchParams.get('category');
  const category = catSlug ? blog.categoryFromSlug(catSlug) : null;
  if (catSlug && !category) return send(res, 404, blog.renderNotFound(), 'text/html; charset=utf-8', PUBLIC_CACHE);

  const q = cleanQuery(url.searchParams.get('q'));
  const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);

  // Page 1 of the unfiltered blog leads with a featured post (the newest one
  // flagged featured, else the newest post); it is excluded from the grid.
  let featured = null;
  if (!category && !q && page === 1) {
    const { data } = await supabaseRequest('blog_posts', {
      query: `select=${LIST_FIELDS}&${publishedFilter()}&order=featured.desc,published_at.desc&limit=1`,
    });
    featured = (data && data[0]) || null;
  }

  const offset = (page - 1) * blog.PAGE_SIZE;
  const [{ posts, total }, categories] = await Promise.all([
    listPublished({ category, q, limit: blog.PAGE_SIZE, offset, exclude: featured && featured.id }),
    usedCategories(),
  ]);

  const html = blog.renderIndex({
    posts,
    featured,
    total: total + (featured ? 1 : 0),
    page,
    category,
    q,
    categories,
  });
  return send(res, 200, html, 'text/html; charset=utf-8', PUBLIC_CACHE);
}

async function relatedPosts(post) {
  const { posts } = await listPublished({ category: post.category, limit: 3, offset: 0, exclude: post.id });
  if (posts.length >= 3) return posts;
  const { posts: latest } = await listPublished({ limit: 6, offset: 0, exclude: post.id });
  const seen = new Set(posts.map(p => p.id));
  return posts.concat(latest.filter(p => !seen.has(p.id))).slice(0, 3);
}

async function handlePost(req, res, url) {
  const slug = String(url.searchParams.get('slug') || '').toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return send(res, 404, blog.renderNotFound(), 'text/html; charset=utf-8', PUBLIC_CACHE);
  }
  const { data } = await supabaseRequest('blog_posts', {
    query: `select=*&slug=eq.${slug}&${publishedFilter()}&limit=1`,
  });
  const post = data && data[0];
  if (!post) return send(res, 404, blog.renderNotFound(), 'text/html; charset=utf-8', PUBLIC_CACHE);
  const related = await relatedPosts(post);
  return send(res, 200, blog.renderPost({ post, related }), 'text/html; charset=utf-8', PUBLIC_CACHE);
}

async function handleFeed(res, kind) {
  const { data } = await supabaseRequest('blog_posts', {
    query: `select=${LIST_FIELDS}&${publishedFilter()}&order=published_at.desc&limit=${kind === 'rss' ? 30 : 5000}`,
  });
  const posts = data || [];
  if (kind === 'rss') {
    return send(res, 200, blog.renderRss(posts), 'application/rss+xml; charset=utf-8', PUBLIC_CACHE);
  }
  const categories = blog.CATEGORIES.filter(c => posts.some(p => p.category === c));
  return send(res, 200, blog.renderSitemap(posts, categories), 'application/xml; charset=utf-8', PUBLIC_CACHE);
}

// ── Admin (service-role key) ────────────────────────────────────────────────

function str(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function validatePost(body) {
  const errors = [];
  const title = str(body.title, 160);
  if (!title) errors.push('Title is required.');

  const slug = md.slugify(body.slug || title);
  if (!slug) errors.push('URL slug is required.');

  const category = blog.CATEGORIES.includes(body.category) ? body.category : null;
  if (!category) errors.push('Choose a category.');

  const status = body.status === 'published' ? 'published' : 'draft';
  const content = String(body.content_md || '').slice(0, 200000);
  const excerpt = str(body.excerpt, 320);
  if (status === 'published') {
    if (!excerpt) errors.push('Add a short summary (excerpt) before publishing.');
    if (md.plainText(content).length < 50) errors.push('The article body is too short to publish.');
  }

  const cover = str(body.cover_image_url, 1000);
  // Our own Storage URLs are allowed even over http (local Docker Supabase).
  const ownStorage = process.env.SUPABASE_URL && cover.startsWith(`${process.env.SUPABASE_URL}/storage/`);
  if (cover && !ownStorage && !/^https:\/\//.test(cover) && !cover.startsWith('/')) errors.push('Cover image must be an https:// URL.');

  let publishedAt = null;
  if (body.published_at) {
    const d = new Date(body.published_at);
    if (Number.isNaN(d.getTime())) errors.push('Publish date is invalid.');
    else publishedAt = d.toISOString();
  }
  if (status === 'published' && !publishedAt) publishedAt = new Date().toISOString();

  const tags = (Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(','))
    .map(t => str(t, 40).replace(/^#/, ''))
    .filter(Boolean)
    .slice(0, 10);

  const authorName = str(body.author_name, 80) || 'Wealthify Team';
  const known = blog.AUTHORS[authorName];

  return {
    errors,
    row: {
      title,
      slug,
      excerpt,
      content_md: content,
      cover_image_url: cover || null,
      cover_image_alt: str(body.cover_image_alt, 200) || null,
      category,
      tags,
      author_name: authorName,
      author_role: str(body.author_role, 80) || (known ? known.role : null),
      status,
      featured: !!body.featured,
      published_at: publishedAt,
      seo_title: str(body.seo_title, 120) || null,
      seo_description: str(body.seo_description, 300) || null,
      reading_minutes: md.readingMinutes(content),
    },
  };
}

async function adminSave(req, res) {
  const body = await readBody(req);
  const { errors, row } = validatePost(body);
  if (errors.length) return json(res, 400, { error: errors.join(' ') });

  const id = body.id ? String(body.id) : null;
  try {
    let data;
    if (id) {
      ({ data } = await supabaseRequest('blog_posts', {
        method: 'PATCH',
        query: `id=eq.${encodeURIComponent(id)}`,
        body: row,
        prefer: 'return=representation',
        service: true,
      }));
    } else {
      ({ data } = await supabaseRequest('blog_posts', {
        method: 'POST',
        body: row,
        prefer: 'return=representation',
        service: true,
      }));
    }
    const post = Array.isArray(data) ? data[0] : data;
    if (!post) return json(res, 404, { error: 'Post not found' });
    return json(res, 200, { post });
  } catch (err) {
    if (err.status === 409 || /duplicate key|blog_posts_slug_key/.test(err.message)) {
      return json(res, 409, { error: `The URL /blog/${row.slug} is already used by another post. Change the slug.` });
    }
    throw err;
  }
}

async function adminUpload(req, res) {
  const body = await readBody(req);
  const ext = UPLOAD_TYPES[body.contentType];
  if (!ext) return json(res, 400, { error: 'Upload a JPG, PNG, WebP or GIF image.' });
  const buf = Buffer.from(String(body.data || ''), 'base64');
  if (!buf.length) return json(res, 400, { error: 'Empty file.' });
  if (buf.length > MAX_UPLOAD_BYTES) return json(res, 413, { error: 'Image is larger than 3 MB.' });

  const base = md.slugify(String(body.filename || 'image').replace(/\.[a-z0-9]+$/i, '')) || 'image';
  const now = new Date();
  const objectPath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomBytes(5).toString('hex')}-${base.slice(0, 50)}.${ext}`;

  const { url, key } = getSupabaseConfig({ service: true });
  const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': body.contentType,
      'Cache-Control': '31536000',
      'x-upsert': 'false',
    },
    body: buf,
  });
  if (!up.ok) {
    const text = await up.text().catch(() => '');
    return json(res, 502, { error: 'Image upload failed: ' + (text.slice(0, 200) || up.status) });
  }
  return json(res, 200, { url: `${url}/storage/v1/object/public/${BUCKET}/${objectPath}` });
}

function readRaw(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > limit) reject(new Error('Request too large'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// The editor posts its unsaved state as a form (payload=<json>) into a new tab,
// so previewing never saves — a live post's edits stay private until Update.
async function adminPreview(req, res) {
  let body;
  try {
    body = JSON.parse(new URLSearchParams(await readRaw(req)).get('payload') || '{}');
  } catch {
    return send(res, 400, 'Invalid preview payload', 'text/plain; charset=utf-8', NO_CACHE);
  }
  const { row } = validatePost({ ...body, status: 'draft' });
  const post = {
    ...row,
    id: body.id || null,
    title: row.title || 'Untitled post',
    slug: row.slug || 'untitled',
    category: row.category || blog.CATEGORIES[0],
    published_at: row.published_at,
    updated_at: new Date().toISOString(),
  };
  const related = await relatedPosts(post).catch(() => []);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return send(res, 200, blog.renderPost({ post, related, preview: true }), 'text/html; charset=utf-8', NO_CACHE);
}

async function getById(id) {
  const { data } = await supabaseRequest('blog_posts', {
    query: `select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    service: true,
  });
  return data && data[0];
}

async function handleAdmin(req, res, url, action) {
  if (!requireAdmin(req)) return unauthorized(res);
  const id = url.searchParams.get('id');

  if (req.method === 'GET') {
    if (action === 'list') {
      const { data } = await supabaseRequest('blog_posts', {
        query: `select=${LIST_FIELDS},created_at&order=updated_at.desc`,
        service: true,
      });
      return json(res, 200, { posts: data || [], categories: blog.CATEGORIES, authors: Object.keys(blog.AUTHORS) });
    }
    if (action === 'get' && id) {
      const post = await getById(id);
      return post ? json(res, 200, { post }) : json(res, 404, { error: 'Post not found' });
    }
  }

  if (req.method === 'POST') {
    if (action === 'preview') return adminPreview(req, res);
    if (action === 'save') return adminSave(req, res);
    if (action === 'upload') return adminUpload(req, res);
    if (action === 'delete') {
      const body = await readBody(req);
      if (!body.id) return json(res, 400, { error: 'Missing id' });
      await supabaseRequest('blog_posts', {
        method: 'DELETE',
        query: `id=eq.${encodeURIComponent(String(body.id))}`,
        service: true,
      });
      return json(res, 200, { ok: true });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'Method not allowed' });
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('admin');

  try {
    if (action) return await handleAdmin(req, res, url, action);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET');
      return json(res, 405, { error: 'Method not allowed' });
    }
    const view = url.searchParams.get('view') || 'index';
    if (view === 'post') return await handlePost(req, res, url);
    if (view === 'rss' || view === 'sitemap') return await handleFeed(res, view);
    return await handleIndex(req, res, url);
  } catch (err) {
    console.error('blog error:', err);
    if (action) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      return json(res, status, { error: err.message || 'Server error' });
    }
    return send(res, 503, '<!doctype html><title>Blog unavailable</title><p style="font-family:sans-serif;padding:40px">The blog is temporarily unavailable. Please try again shortly. <a href="/">Back to Wealthify</a></p>', 'text/html; charset=utf-8', 'no-store');
  }
};
