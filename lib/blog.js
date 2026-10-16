// Blog data access + server-rendered page templates. Used by api/blog.js.
const md = require('./markdown');

const SITE = 'https://wealthify.co.nz';
const PAGE_SIZE = 9;
const GTM_ID = 'GTM-TC5X3F47';
// Must stay byte-identical to the snippet on every other page: its sha256 is
// allow-listed in the Content-Security-Policy (vercel.json, scripts/dev-server.js).
const GTM_SNIPPET = "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-TC5X3F47');";

const CATEGORIES = [
  'Mortgages',
  'First Home Buyers',
  'Refinancing',
  'Property Investment',
  'Insurance',
  'KiwiSaver',
  'Money Tips',
  'Market Updates',
];

const AUTHORS = {
  'Amol Prakash': { role: 'Director & Mortgage Adviser', image: '/assets/team/amol-prakash-portrait.webp', anchor: 'amol-prakash' },
  'Shweta Karne': { role: 'Director & Mortgage Adviser', image: '/assets/team/shweta-bhatia-portrait.webp', anchor: 'shweta-karne' },
  'Jeeson Joseph': { role: 'Director & Mortgage Adviser', image: '/assets/team/jeeson-joseph-portrait.webp', anchor: 'jeeson-joseph' },
  'Vinod Pudushery Anthony': { role: 'Mortgage Adviser', image: '/assets/team/vinod-anthony-portrait.webp', anchor: 'vinod-pudushery-anthony' },
  'Wealthify Team': { role: 'Licensed Financial Advice Provider', image: null, anchor: null },
};

const e = md.escapeHtml;

function categorySlug(name) {
  return md.slugify(name);
}

function categoryFromSlug(slug) {
  return CATEGORIES.find(c => categorySlug(c) === slug) || null;
}

function authorInfo(post) {
  const known = AUTHORS[post.author_name];
  return {
    name: post.author_name || 'Wealthify Team',
    role: post.author_role || (known && known.role) || '',
    image: known ? known.image : null,
    url: known && known.anchor ? `/Team.dc.html#${known.anchor}` : '/Team.dc.html',
  };
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Pacific/Auckland' });
}

function absUrl(u) {
  if (!u) return '';
  return /^https?:\/\//.test(u) ? u : SITE + (u.startsWith('/') ? u : '/' + u);
}

function initials(name) {
  return String(name || 'W').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function avatar(author, cls = 'avatar') {
  if (author.image) return `<img class="${cls}" src="${e(author.image)}" alt="" width="46" height="46" loading="lazy" decoding="async">`;
  return `<span class="${cls} avatar--initials" aria-hidden="true">${e(initials(author.name))}</span>`;
}

// ── Shared chrome ────────────────────────────────────────────────────────────

const ICON_FB = '<svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.6)" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.3c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.4H7.4V14h2.8v8h3.3z"></path></svg>';
const ICON_IG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="3" stroke="rgba(255,255,255,0.6)" stroke-width="1.2"></rect><circle cx="7" cy="7" r="2.5" stroke="rgba(255,255,255,0.6)" stroke-width="1.2"></circle><circle cx="10.5" cy="3.5" r="0.8" fill="rgba(255,255,255,0.6)"></circle></svg>';

function head({ title, description, canonical, image, imageAlt, type = 'website', jsonLd, noindex, extra = '' }) {
  const img = absUrl(image || '/assets/brand/og/home.jpg');
  return `<!DOCTYPE html>
<html lang="en-NZ">
<head>
<!-- Google Tag Manager -->
<script>${GTM_SNIPPET}</script>
<!-- End Google Tag Manager -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${e(canonical)}">`}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Wealthify">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${e(canonical)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:alt" content="${e(imageAlt || title)}">
<meta property="og:locale" content="en_NZ">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(description)}">
<meta name="twitter:image" content="${e(img)}">
${extra}
<link rel="alternate" type="application/rss+xml" title="Wealthify Blog" href="${SITE}/blog/rss.xml">
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin="anonymous">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" crossorigin="anonymous">
<link href="/typography.css?v=20260905" rel="stylesheet">
<link href="/responsive.css?v=20260905" rel="stylesheet">
<link href="/blog.css?v=20261016" rel="stylesheet">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
<a href="#main-content" class="sr-only">Skip to content</a>
${nav()}`;
}

function nav() {
  const link = (href, label, active) => `<a href="${href}" class="blog-nav__link${active ? ' is-active' : ''}">${label}</a>`;
  return `<nav class="site-nav blog-nav" data-blog-nav>
  <div class="site-nav__inner">
    <a href="/" class="site-nav__brand">
      <img src="/assets/brand/logo-green.svg" alt="Wealthify" class="brand-logo" width="148" height="34">
    </a>
    <div class="site-nav__links hide-mobile">
      ${link('/Mortgages.dc.html', 'Mortgages')}
      ${link('/Insurance.dc.html', 'Insurance')}
      ${link('/KiwiSaver.dc.html', 'KiwiSaver')}
      ${link('/Loans.dc.html', 'Loans')}
      <div class="site-nav__dropdown">
        <a href="/Tools.dc.html" class="site-nav__dropdown-trigger blog-nav__link" aria-haspopup="true">Tools
          <svg class="site-nav__chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        </a>
        <div class="site-nav__menu">
          <a href="/Tools.dc.html">
            <span class="site-nav__menu-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="2.5" stroke="#16C172" stroke-width="2"></rect><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" stroke="#16C172" stroke-width="2" stroke-linecap="round"></path></svg></span>
            <span class="site-nav__menu-text"><span class="site-nav__menu-title">Calculators</span><span class="site-nav__menu-sub">Refinance, repayments, KiwiSaver</span></span>
          </a>
          <a href="/PartnerCircle.dc.html">
            <span class="site-nav__menu-icon" style="background:rgba(15,181,186,0.12)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#0FB5BA" stroke-width="2"></circle><circle cx="12" cy="12" r="3.2" stroke="#0FB5BA" stroke-width="2"></circle></svg></span>
            <span class="site-nav__menu-text"><span class="site-nav__menu-title">Wealthify Partner Circle</span><span class="site-nav__menu-sub">Member benefits from verified providers</span></span>
          </a>
          <a href="/WealthifyScore.dc.html">
            <span class="site-nav__menu-icon" style="background:rgba(232,176,75,0.14)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3.5 18a9 9 0 1 1 17 0" stroke="#E8B04B" stroke-width="2" stroke-linecap="round"></path><path d="M12 18l4.2-5" stroke="#E8B04B" stroke-width="2" stroke-linecap="round"></path></svg></span>
            <span class="site-nav__menu-text"><span class="site-nav__menu-title">Wealthify Score</span><span class="site-nav__menu-sub">Your free 0-100 financial health check</span></span>
          </a>
        </div>
      </div>
      ${link('/blog', 'Blog', true)}
      ${link('/Team.dc.html', 'Our Team')}
      ${link('/Contact.dc.html', 'Contact')}
    </div>
    <div class="site-nav__actions">
      <a href="/Contact.dc.html" class="hide-mobile blog-nav__cta">Book a free call</a>
      <button type="button" class="show-mobile-only site-nav__toggle" data-nav-toggle aria-expanded="false" aria-label="Open menu"><span class="site-nav__toggle-icon" aria-hidden="true"></span></button>
    </div>
  </div>
  <div class="site-nav__drawer" data-nav-drawer hidden>
    <div class="site-nav__drawer-panel">
      <a href="/Mortgages.dc.html">Mortgages</a>
      <a href="/Insurance.dc.html">Insurance</a>
      <a href="/KiwiSaver.dc.html">KiwiSaver</a>
      <a href="/Loans.dc.html">Loans</a>
      <div class="site-nav__drawer-label">Tools</div>
      <a href="/Tools.dc.html" class="site-nav__drawer-sub">Calculators</a>
      <a href="/PartnerCircle.dc.html" class="site-nav__drawer-sub">Wealthify Partner Circle</a>
      <a href="/WealthifyScore.dc.html" class="site-nav__drawer-sub">Wealthify Score</a>
      <a href="/blog" class="is-active">Blog</a>
      <a href="/Team.dc.html">Our Team</a>
      <a href="/Contact.dc.html">Contact</a>
      <a href="/Contact.dc.html" class="site-nav__drawer-cta">Book a free call</a>
    </div>
  </div>
</nav>`;
}

function footer() {
  const links = (items) => items.map(([href, label, ext]) =>
    `<a href="${href}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`).join('\n          ');
  return `<footer class="site-footer">
  <div style="max-width:1200px;margin:0 auto">
    <div class="site-footer__grid footer-grid">
      <div>
        <div style="margin-bottom:16px">
          <img src="/assets/brand/logo-green.svg" alt="Wealthify" class="brand-logo brand-logo--sm" width="113" height="26" loading="lazy" decoding="async">
        </div>
        <p style="font-size:var(--text-compact);color:rgba(255,255,255,0.45);line-height:1.7;margin:0 0 20px;max-width:260px">Helping Kiwis get ahead with their finances. Independent advice </p>
        <div class="site-footer__social">
          <a href="https://www.facebook.com/profile.php?id=61593264113481" target="_blank" rel="noopener noreferrer" aria-label="Wealthify on Facebook">${ICON_FB}</a>
          <a href="https://www.instagram.com/wealthify.limited/" target="_blank" rel="noopener noreferrer" aria-label="Wealthify on Instagram">${ICON_IG}</a>
        </div>
      </div>
      <div>
        <div class="site-footer__label">Services</div>
        <div class="site-footer__links">
          ${links([['/Mortgages.dc.html', 'Mortgages'], ['/Insurance.dc.html', 'Insurance'], ['/KiwiSaver.dc.html', 'KiwiSaver'], ['/Loans.dc.html', 'Loans']])}
        </div>
      </div>
      <div>
        <div class="site-footer__label">Company</div>
        <div class="site-footer__links">
          ${links([['/Team.dc.html', 'Our Team'], ['/blog', 'Blog'], ['/Tools.dc.html', 'Calculators'], ['/PartnerCircle.dc.html', 'Partner Circle'], ['/WealthifyScore.dc.html', 'Wealthify Score'], ['/Contact.dc.html', 'Contact']])}
        </div>
      </div>
      <div>
        <div class="site-footer__label">Legal</div>
        <div class="site-footer__links">
          ${links([['/assets/legal/Wealthify-Privacy-Policy.pdf', 'Privacy Policy', true], ['/assets/legal/Wealthify-Terms-of-Use.pdf', 'Terms of Use', true], ['/assets/legal/Wealthify-Disclosure-Statement.pdf', 'Disclosure', true]])}
        </div>
      </div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <p style="font-size:var(--text-micro);color:rgba(255,255,255,0.35);margin:0;line-height:1.5;max-width:560px">Wealthify Limited (FSP1012489) holds a licence issued by the Financial Markets Authority to provide financial advice services. Our advice is limited to the products and providers described in our Disclosure Information. Insurance, KiwiSaver, and investment enquiries are referred to independent specialists — Wealthify does not provide advice in these areas directly.</p>
      <p style="font-size:var(--text-micro);color:rgba(255,255,255,0.35);margin:0">© ${new Date().getFullYear()} Wealthify Limited</p>
    </div>
  </div>
</footer>`;
}

function tail() {
  return `<script src="/nav.js" defer></script>
<script src="/blog.js" defer></script>
</body>
</html>`;
}

function ctaBand() {
  return `<section class="cta-band">
  <div class="cta-band__inner">
    <h2>Talk it through with a Wealthify adviser</h2>
    <p>Every situation is different. Get free, no-obligation advice from a licensed mortgage adviser who compares 20+ NZ lenders for you.</p>
    <div class="btns">
      <a href="/Contact.dc.html" class="btn btn--green">Book a free call</a>
      <a href="/Tools.dc.html" class="btn btn--ghost">Try our calculators</a>
    </div>
  </div>
</section>`;
}

// ── Cards ────────────────────────────────────────────────────────────────────

function media(post) {
  if (post.cover_image_url) {
    return `<img src="${e(post.cover_image_url)}" alt="${e(post.cover_image_alt || '')}" loading="lazy" decoding="async">`;
  }
  return `<div class="ph" aria-hidden="true"><span>${e(post.category)}</span></div>`;
}

function metaRow(post) {
  return `<div class="meta"><span>${e(fmtDate(post.published_at))}</span><span class="meta__dot"></span><span>${post.reading_minutes || 1} min read</span></div>`;
}

function card(post) {
  return `<a class="card" href="/blog/${e(post.slug)}">
  <div class="card__media">${media(post)}</div>
  <div class="card__body">
    <div><span class="chip">${e(post.category)}</span></div>
    <h3>${e(post.title)}</h3>
    <p>${e(post.excerpt)}</p>
    ${metaRow(post)}
  </div>
</a>`;
}

function featuredCard(post) {
  return `<a class="featured" href="/blog/${e(post.slug)}">
  <div class="featured__media">${media(post)}</div>
  <div class="featured__body">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="featured__label">Featured</span><span class="chip">${e(post.category)}</span></div>
    <h3>${e(post.title)}</h3>
    <p>${e(post.excerpt)}</p>
    ${metaRow(post)}
  </div>
</a>`;
}

// ── Pages ────────────────────────────────────────────────────────────────────

function blogIndexUrl({ category, q, page } = {}) {
  let path = category ? `/blog/category/${categorySlug(category)}` : '/blog';
  const params = [];
  if (q) params.push('q=' + encodeURIComponent(q));
  if (page && page > 1) params.push('page=' + page);
  return path + (params.length ? '?' + params.join('&') : '');
}

function renderIndex({ posts, featured, total, page, category, q, categories }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const heading = q ? `Results for “${q}”` : category ? category : 'Latest articles';
  const title = q
    ? `Search: ${q} | Wealthify Blog`
    : category
      ? `${category} articles & guides | Wealthify Blog`
      : page > 1 ? `Wealthify Blog — Page ${page}` : 'Wealthify Blog — Mortgage, property & money guides for Kiwis';
  const description = category
    ? `Practical ${category.toLowerCase()} guides and insights for New Zealanders from Wealthify's licensed mortgage advisers.`
    : 'Practical guides on mortgages, refinancing, first homes, property investment and money — written by Wealthify\'s licensed NZ mortgage advisers.';
  const canonical = SITE + blogIndexUrl({ category, page });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${SITE}/blog#blog`,
        url: `${SITE}/blog`,
        name: 'Wealthify Blog',
        description,
        inLanguage: 'en-NZ',
        publisher: { '@id': `${SITE}/#organization` },
        blogPost: posts.concat(featured ? [featured] : []).map(p => ({
          '@type': 'BlogPosting',
          headline: p.title,
          url: `${SITE}/blog/${p.slug}`,
          datePublished: p.published_at,
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
        ].concat(category ? [{ '@type': 'ListItem', position: 3, name: category, item: canonical }] : []),
      },
    ],
  };

  const pills = [`<a class="pill${!category ? ' is-active' : ''}" href="/blog">All articles</a>`]
    .concat(categories.map(c => `<a class="pill${c === category ? ' is-active' : ''}" href="${blogIndexUrl({ category: c })}">${e(c)}</a>`))
    .join('');

  let pager = '';
  if (pages > 1) {
    const prev = page > 1
      ? `<a href="${blogIndexUrl({ category, q, page: page - 1 })}" rel="prev" aria-label="Previous page">←</a>`
      : '<span class="is-disabled" aria-hidden="true">←</span>';
    const next = page < pages
      ? `<a href="${blogIndexUrl({ category, q, page: page + 1 })}" rel="next" aria-label="Next page">→</a>`
      : '<span class="is-disabled" aria-hidden="true">→</span>';
    const nums = [];
    for (let n = 1; n <= pages; n++) {
      if (n === 1 || n === pages || Math.abs(n - page) <= 1) {
        nums.push(n === page
          ? `<span class="is-current" aria-current="page">${n}</span>`
          : `<a href="${blogIndexUrl({ category, q, page: n })}">${n}</a>`);
      } else if (nums[nums.length - 1] !== '…') {
        nums.push('…');
      }
    }
    pager = `<nav class="pager" aria-label="Pagination">${prev}${nums.map(n => (n === '…' ? '<span aria-hidden="true">…</span>' : n)).join('')}${next}</nav>`;
  }

  const empty = !posts.length && !featured
    ? `<div class="empty"><h3>${q ? 'No articles match your search' : 'No articles here yet'}</h3><p>${q ? 'Try a different word, or browse all articles.' : 'New guides are on the way — check back soon.'}</p>${q || category ? '<p style="margin-top:16px"><a href="/blog" style="color:#0E9E5C;font-weight:700">View all articles →</a></p>' : ''}</div>`
    : '';

  const extra = (page > 1 ? `<link rel="prev" href="${SITE + blogIndexUrl({ category, page: page - 1 })}">` : '')
    + (page < pages ? `<link rel="next" href="${SITE + blogIndexUrl({ category, page: page + 1 })}">` : '');

  return head({ title, description, canonical, jsonLd, noindex: !!q, extra }) + `
<main id="main-content">
<section class="blog-hero">
  <div class="blog-hero__glow"></div>
  <div class="blog-hero__inner">
    <div class="eyebrow">Wealthify Blog</div>
    <h1 class="hero-title">${category ? e(category) : 'Insights to help you get ahead'}</h1>
    <p>Straight-talking guides on mortgages, refinancing, property and money — from New Zealand's licensed mortgage advisers.</p>
    <form class="blog-search" action="/blog" method="get" role="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line></svg>
      <label for="blog-q" class="sr-only">Search articles</label>
      <input id="blog-q" type="search" name="q" value="${e(q || '')}" placeholder="Search articles…" maxlength="80">
      <button type="submit">Search</button>
    </form>
  </div>
</section>
${categories.length ? `<div class="cat-bar"><nav class="cat-bar__inner" aria-label="Categories">${pills}</nav></div>` : ''}
<section class="listing">
  <div class="wrap">
    ${featured ? featuredCard(featured) : ''}
    <div class="listing__head"><h2>${e(heading)}</h2><p>${total} article${total === 1 ? '' : 's'}</p></div>
    ${empty}
    ${posts.length ? `<div class="grid">${posts.map(card).join('\n')}</div>` : ''}
    ${pager}
  </div>
</section>
${ctaBand()}
</main>
${footer()}
${tail()}`;
}

function renderPost({ post, related, preview = false }) {
  const { html, headings } = md.render(post.content_md);
  const author = authorInfo(post);
  const url = `${SITE}/blog/${post.slug}`;
  const title = post.seo_title || `${post.title} | Wealthify`;
  const description = post.seo_description || post.excerpt || '';
  const toc = headings.filter(h => h.level <= 3);
  const catUrl = blogIndexUrl({ category: post.category });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        mainEntityOfPage: url,
        headline: post.title,
        description,
        image: post.cover_image_url ? [absUrl(post.cover_image_url)] : [`${SITE}/assets/brand/og/home.jpg`],
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        articleSection: post.category,
        keywords: (post.tags || []).join(', ') || undefined,
        wordCount: md.plainText(post.content_md).split(' ').filter(Boolean).length,
        inLanguage: 'en-NZ',
        author: { '@type': author.name === 'Wealthify Team' ? 'Organization' : 'Person', name: author.name, url: absUrl(author.url) },
        publisher: {
          '@type': 'Organization',
          '@id': `${SITE}/#organization`,
          name: 'Wealthify',
          logo: { '@type': 'ImageObject', url: `${SITE}/assets/brand/logo-green.svg` },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: post.category, item: SITE + catUrl },
          { '@type': 'ListItem', position: 4, name: post.title, item: url },
        ],
      },
    ],
  };

  const articleMeta = `<meta property="article:published_time" content="${e(post.published_at || '')}">
<meta property="article:modified_time" content="${e(post.updated_at || post.published_at || '')}">
<meta property="article:section" content="${e(post.category)}">
${(post.tags || []).map(t => `<meta property="article:tag" content="${e(t)}">`).join('\n')}`;

  const shareText = encodeURIComponent(post.title);
  const shareUrl = encodeURIComponent(url);

  return head({
    title,
    description,
    canonical: url,
    image: post.cover_image_url,
    imageAlt: post.cover_image_alt,
    type: 'article',
    jsonLd,
    noindex: preview,
    extra: articleMeta,
  }) + `
<div class="read-progress" data-read-progress></div>
<main id="main-content">
<article>
  <header class="article-head">
    <div class="article-head__inner">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog">Blog</a><span aria-hidden="true">/</span><a href="${catUrl}">${e(post.category)}</a>
      </nav>
      <a href="${catUrl}" class="chip">${e(post.category)}</a>
      <h1>${e(post.title)}</h1>
      ${post.excerpt ? `<p class="lead">${e(post.excerpt)}</p>` : ''}
      <div class="byline">
        ${avatar(author)}
        <div>
          <div class="byline__name">${e(author.name)}${author.role ? ` <span style="font-weight:500;color:#8B9AAD">· ${e(author.role)}</span>` : ''}</div>
          <div class="meta" style="margin-top:3px">${post.published_at ? `<time datetime="${e(post.published_at)}">${e(fmtDate(post.published_at))}</time>` : '<span>Not yet published</span>'}<span class="meta__dot"></span><span>${post.reading_minutes || 1} min read</span></div>
        </div>
      </div>
    </div>
  </header>
  ${post.cover_image_url ? `<div class="cover"><img src="${e(post.cover_image_url)}" alt="${e(post.cover_image_alt || '')}" fetchpriority="high" decoding="async"></div>` : ''}
  <div class="article-layout">
    <div>
      <div class="prose" data-prose>
${html}
      </div>
      ${(post.tags || []).length ? `<div class="tags">${post.tags.map(t => `<span>#${e(t)}</span>`).join('')}</div>` : ''}
      <div class="disclaimer"><strong>General information only.</strong> This article is general in nature and isn't personalised financial advice. It doesn't take your objectives, financial situation or needs into account. Rates, rules and lender policies change — talk to a Wealthify adviser before making a financial decision.</div>
      <div class="author-box">
        ${avatar(author)}
        <div>
          <h4>${e(author.name)}</h4>
          ${author.role ? `<div class="byline__role">${e(author.role)}</div>` : ''}
          <p>${author.name === 'Wealthify Team'
            ? 'Wealthify is a licensed Financial Advice Provider helping Kiwis buy, refinance and invest with confidence.'
            : `${e(author.name.split(' ')[0])} is part of the Wealthify team, helping Kiwis compare 20+ lenders to find the right home loan.`}</p>
          <a href="${e(author.url)}">Meet the team →</a>
        </div>
      </div>
    </div>
    <aside class="article-aside">
      ${toc.length >= 2 ? `<div class="toc-block"><p class="aside-title">On this page</p><ol class="toc" data-toc>${toc.map(h => `<li class="toc--h${h.level}"><a href="#${e(h.id)}">${h.text}</a></li>`).join('')}</ol></div>` : ''}
      <div>
        <p class="aside-title">Share</p>
        <div class="share">
          <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.3c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.4H7.4V14h2.8v8h3.3z"></path></svg></a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.9 8.6H3.6V20h3.3V8.6zM5.2 3.5a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zM20.4 13.3c0-3-1.6-4.9-4.2-4.9-1.5 0-2.5.8-2.9 1.6V8.6h-3.2V20h3.3v-5.6c0-1.5.3-2.9 2.1-2.9 1.8 0 1.8 1.7 1.8 3V20h3.3l-.2-6.7z"></path></svg></a>
          <a href="https://x.com/intent/post?text=${shareText}&amp;url=${shareUrl}" target="_blank" rel="noopener noreferrer" aria-label="Share on X"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"></path></svg></a>
          <a href="mailto:?subject=${shareText}&amp;body=${shareUrl}" aria-label="Share by email"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path></svg></a>
          <button type="button" data-copy-link="${e(url)}" aria-label="Copy link"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"></path><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"></path></svg></button>
        </div>
      </div>
      <div class="aside-cta">
        <h4>Want advice for your situation?</h4>
        <p>Free, no-obligation chat with a licensed mortgage adviser.</p>
        <a href="/Contact.dc.html">Book a free call</a>
      </div>
    </aside>
  </div>
</article>
${related.length ? `<section class="related"><div class="wrap"><h2>Keep reading</h2><div class="grid">${related.map(card).join('\n')}</div></div></section>` : ''}
${ctaBand()}
</main>
${preview ? '<div class="preview-banner">Preview — this post is not live</div>' : ''}
${footer()}
${tail()}`;
}

function renderNotFound() {
  return head({ title: 'Article not found | Wealthify Blog', description: 'This article could not be found.', canonical: `${SITE}/blog`, noindex: true }) + `
<main id="main-content">
<section class="blog-hero" style="padding-bottom:96px">
  <div class="blog-hero__glow"></div>
  <div class="blog-hero__inner">
    <div class="eyebrow">404</div>
    <h1 class="hero-title">We couldn't find that article</h1>
    <p>It may have moved or been unpublished. Browse our latest guides instead.</p>
    <p style="margin-top:28px"><a href="/blog" class="btn btn--green">Go to the blog</a></p>
  </div>
</section>
</main>
${footer()}
${tail()}`;
}

function renderRss(posts) {
  const items = posts.map(p => `    <item>
      <title>${e(p.title)}</title>
      <link>${SITE}/blog/${e(p.slug)}</link>
      <guid isPermaLink="true">${SITE}/blog/${e(p.slug)}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      <category>${e(p.category)}</category>
      <dc:creator>${e(p.author_name)}</dc:creator>
      <description>${e(p.excerpt)}</description>
    </item>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Wealthify Blog</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Mortgage, property and money guides for New Zealanders from Wealthify.</description>
    <language>en-nz</language>
${items}
  </channel>
</rss>`;
}

function renderSitemap(posts, categories) {
  const latest = posts.reduce((m, p) => (p.updated_at > m ? p.updated_at : m), '');
  const urls = [
    { loc: `${SITE}/blog`, lastmod: latest, priority: '0.8', freq: 'daily' },
    ...categories.map(c => ({ loc: SITE + blogIndexUrl({ category: c }), priority: '0.5', freq: 'weekly' })),
    ...posts.map(p => ({ loc: `${SITE}/blog/${p.slug}`, lastmod: p.updated_at, priority: '0.7', freq: 'monthly' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${e(u.loc)}</loc>${u.lastmod ? `
    <lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
}

module.exports = {
  SITE,
  PAGE_SIZE,
  CATEGORIES,
  AUTHORS,
  categorySlug,
  categoryFromSlug,
  renderIndex,
  renderPost,
  renderNotFound,
  renderRss,
  renderSitemap,
};
