// Blog page enhancements (pages work without it): nav shadow on scroll,
// reading progress bar, table-of-contents highlighting, copy-link button.
(function () {
  'use strict';

  var nav = document.querySelector('[data-blog-nav]');
  var progress = document.querySelector('[data-read-progress]');
  var prose = document.querySelector('[data-prose]');
  var ticking = false;

  function onScroll() {
    ticking = false;
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 10);
    if (progress && prose) {
      var rect = prose.getBoundingClientRect();
      var total = rect.height - window.innerHeight * 0.6;
      var done = Math.min(1, Math.max(0, -rect.top / (total > 0 ? total : 1)));
      progress.style.transform = 'scaleX(' + done + ')';
    }
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  var toc = document.querySelector('[data-toc]');
  if (toc && 'IntersectionObserver' in window) {
    var links = {};
    toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      links[decodeURIComponent(a.getAttribute('href').slice(1))] = a;
    });
    var current = null;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = links[entry.target.id];
        if (!link) return;
        if (current) current.classList.remove('is-active');
        link.classList.add('is-active');
        current = link;
      });
    }, { rootMargin: '-90px 0px -70% 0px' });
    Object.keys(links).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-copy-link]');
    if (!btn) return;
    var url = btn.getAttribute('data-copy-link');
    var done = function () {
      btn.classList.add('is-copied');
      setTimeout(function () { btn.classList.remove('is-copied'); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
    } else {
      window.prompt('Copy this link:', url);
    }
  });
})();
