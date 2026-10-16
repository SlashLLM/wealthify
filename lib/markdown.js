// Small, safe Markdown renderer for blog posts.
// Shared by api/blog.js (server-rendered pages) and admin/index.html.
// Posts are written in the admin's rich-text editor (TOAST UI), which stores
// Markdown in its own dialect: one line per paragraph, backslash escapes
// (\*, \_, \<) and <br> for empty lines. This renderer follows that dialect.
//
// Safety: all source text is HTML-escaped first; only the tags generated here
// reach the output, and link/image URLs are limited to http(s), mailto, tel
// and site-relative paths. Raw HTML in the source is shown as text.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.WealthifyMarkdown = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/&[a-z#0-9]+;/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  // `url` arrives already HTML-escaped.
  function safeUrl(url) {
    const raw = String(url || '').trim().replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:)/i.test(raw) || /^(\/|#|\.\/|\.\.\/)/.test(raw)) {
      return escapeHtml(raw);
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) return escapeHtml('https://' + raw);
    return null;
  }

  function isExternal(url) {
    return /^https?:\/\//i.test(url) && !/^https?:\/\/(www\.)?wealthify\.co\.nz/i.test(url);
  }

  // Inline formatting on already-escaped text.
  function emphasis(s) {
    return s
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  }

  // Generated tags are parked as placeholders so the emphasis pass can't
  // rewrite underscores or asterisks inside their URLs.
  function inline(text) {
    const parked = [];
    const park = html => {
      parked.push(html);
      return '\u0000' + (parked.length - 1) + '\u0000';
    };

    let s = text.replace(/`([^`]+)`/g, (_, c) => park('<code>' + c + '</code>'));

    // Backslash escapes (\* \_ \# \< …) — the editor writes these for literal characters.
    s = s.replace(/\\(&lt;|&gt;|&amp;|&quot;|&#39;|[\\`*_{}[\]()#+\-.!|~])/g, (_, c) => park(c));
    s = s.replace(/&lt;br\s*\/?&gt;/gi, () => park('<br>'));

    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (m, alt, url, title) => {
      const u = safeUrl(url);
      if (!u) return m;
      return park('<img src="' + u + '" alt="' + alt + '" loading="lazy" decoding="async"' + (title ? ' title="' + title + '"' : '') + '>');
    });

    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const u = safeUrl(url);
      if (!u) return label;
      const ext = isExternal(u) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return park('<a href="' + u + '"' + ext + '>' + emphasis(label) + '</a>');
    });

    s = emphasis(s);

    // Placeholders can nest (a parked link label may hold parked code).
    let prev;
    do {
      prev = s;
      s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => parked[Number(i)]);
    } while (s !== prev);
    return s;
  }

  function splitRow(line) {
    // Escaped pipes (\|) belong to the cell text.
    return line.trim().replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim());
  }

  /**
   * Render Markdown to HTML.
   * Returns { html, headings: [{ level, text, id }] } — headings feed the
   * article's table of contents.
   */
  function render(src) {
    const lines = escapeHtml(String(src || '').replace(/\r\n?/g, '\n')).split('\n');
    const out = [];
    const headings = [];
    const usedIds = {};
    let i = 0;

    const isBlank = l => /^\s*$/.test(l);
    const isFence = l => /^\s*```/.test(l);
    const isHeading = l => /^#{1,6}\s+/.test(l);
    const isHr = l => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l);
    const isQuote = l => /^\s*&gt;\s?/.test(l);
    const isUl = l => /^\s*[-*+]\s+/.test(l);
    const isOl = l => /^\s*\d+[.)]\s+/.test(l);
    const isTableSep = l => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
    const isTableStart = idx => /\|/.test(lines[idx]) && idx + 1 < lines.length && isTableSep(lines[idx + 1]);
    const startsBlock = idx => {
      const l = lines[idx];
      return isBlank(l) || isFence(l) || isHeading(l) || isHr(l) || isQuote(l) || isUl(l) || isOl(l) || isTableStart(idx);
    };

    while (i < lines.length) {
      const line = lines[i];

      if (isBlank(line)) { i++; continue; }

      if (isFence(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !isFence(lines[i])) buf.push(lines[i++]);
        i++;
        out.push('<pre><code>' + buf.join('\n') + '</code></pre>');
        continue;
      }

      if (isHeading(line)) {
        const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
        // The page title is the only <h1>, and the article styles stop at h4.
        const level = Math.min(4, Math.max(2, m[1].length));
        const text = inline(m[2]);
        let id = slugify(m[2]) || 'section';
        if (usedIds[id]) id += '-' + (++usedIds[id]);
        else usedIds[id] = 1;
        headings.push({ level, text: text.replace(/<[^>]+>/g, ''), id });
        out.push('<h' + level + ' id="' + id + '">' + text + '</h' + level + '>');
        i++;
        continue;
      }

      if (isHr(line)) { out.push('<hr>'); i++; continue; }

      if (isQuote(line)) {
        const buf = [];
        while (i < lines.length && isQuote(lines[i])) buf.push(lines[i++].replace(/^\s*&gt;\s?/, ''));
        out.push('<blockquote>' + render.__blocks(buf.join('\n')) + '</blockquote>');
        continue;
      }

      if (isUl(line) || isOl(line)) {
        const ordered = isOl(line);
        const test = ordered ? isOl : isUl;
        const indentOf = l => /^\s*/.exec(l)[0].length;
        const base = indentOf(line);
        const items = [];
        while (i < lines.length) {
          const l = lines[i];
          if (isBlank(l)) {
            // A blank line only continues the list if more of it follows.
            let j = i + 1;
            while (j < lines.length && isBlank(lines[j])) j++;
            const more = j < lines.length && items.length &&
              (indentOf(lines[j]) > base || (test(lines[j]) && indentOf(lines[j]) === base));
            if (!more) break;
            i = j;
            continue;
          }
          if (indentOf(l) === base && test(l)) {
            items.push({ text: l.replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, ''), children: [] });
          } else if (indentOf(l) > base && items.length) {
            // Indented lines (Tab in the editor) form a nested list or block.
            items[items.length - 1].children.push(l);
          } else {
            break;
          }
          i++;
        }
        const tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + '>' + items.map(item => {
          let nested = '';
          if (item.children.length) {
            const cut = Math.min(...item.children.map(indentOf));
            nested = render.__blocks(item.children.map(c => c.slice(cut)).join('\n'));
          }
          return '<li>' + inline(item.text) + nested + '</li>';
        }).join('') + '</' + tag + '>');
        continue;
      }

      if (isTableStart(i)) {
        const head = splitRow(lines[i]);
        const aligns = splitRow(lines[i + 1]).map(c => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : ''));
        i += 2;
        const rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && !isBlank(lines[i])) rows.push(splitRow(lines[i++]));
        const cell = (tag, c, idx) => '<' + tag + (aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : '') + '>' + inline(c) + '</' + tag + '>';
        out.push(
          '<div class="table-wrap"><table><thead><tr>' + head.map((c, idx) => cell('th', c, idx)).join('') + '</tr></thead><tbody>' +
          rows.map(r => '<tr>' + head.map((_, idx) => cell('td', r[idx] || '', idx)).join('') + '</tr>').join('') +
          '</tbody></table></div>'
        );
        continue;
      }

      // Paragraphs — one per line, as the editor writes them (Enter starts a
      // new paragraph; a bare <br> line is an empty spacer). A line holding
      // only an image becomes a captioned figure.
      const buf = [line];
      i++;
      while (i < lines.length && !startsBlock(i)) buf.push(lines[i++]);
      for (const raw of buf) {
        const para = raw.trim();
        if (!para || /^&lt;br\s*\/?&gt;$/i.test(para)) continue;
        const img = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)$/.exec(para);
        if (img && safeUrl(img[2])) {
          const caption = img[3] || '';
          out.push('<figure>' + inline(para) + (caption ? '<figcaption>' + caption + '</figcaption>' : '') + '</figure>');
        } else {
          out.push('<p>' + inline(para) + '</p>');
        }
      }
    }

    return { html: out.join('\n'), headings };
  }

  // Blockquote bodies are already escaped; render their blocks without
  // escaping twice.
  render.__blocks = function (escaped) {
    const unescaped = escaped
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    return render(unescaped).html;
  };

  function toHtml(src) {
    return render(src).html;
  }

  function plainText(src) {
    return String(src || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/\\(.)/g, '$1')
      .replace(/[#>*_`~|-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readingMinutes(src) {
    const words = plainText(src).split(' ').filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  }

  return { render, toHtml, escapeHtml, slugify, plainText, readingMinutes };
});
