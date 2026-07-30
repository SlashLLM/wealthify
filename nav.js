(function () {
  'use strict';

  function closest(el, sel) {
    return el && el.closest ? el.closest(sel) : null;
  }

  function openNav(nav) {
    var toggle = nav.querySelector('[data-nav-toggle]');
    var drawer = nav.querySelector('[data-nav-drawer]');
    if (!toggle || !drawer) return;
    nav.classList.add('is-open');
    drawer.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('nav-open');
  }

  function closeNav(nav) {
    var toggle = nav.querySelector('[data-nav-toggle]');
    var drawer = nav.querySelector('[data-nav-drawer]');
    if (!toggle || !drawer) return;
    nav.classList.remove('is-open');
    drawer.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('nav-open');
  }

  function openAdmin(shell) {
    var toggle = shell.querySelector('[data-admin-toggle]');
    shell.classList.add('sidebar-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-open');
  }

  function closeAdmin(shell) {
    var toggle = shell.querySelector('[data-admin-toggle]');
    shell.classList.remove('sidebar-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  }

  document.addEventListener('click', function (e) {
    var toggle = closest(e.target, '[data-nav-toggle]');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      var nav = closest(toggle, '.site-nav');
      if (!nav) return;
      if (nav.classList.contains('is-open')) closeNav(nav);
      else openNav(nav);
      return;
    }

    var drawer = closest(e.target, '[data-nav-drawer]');
    if (drawer && e.target === drawer) {
      closeNav(closest(drawer, '.site-nav'));
      return;
    }

    var drawerLink = closest(e.target, '[data-nav-drawer] a');
    if (drawerLink) {
      var navFromLink = closest(drawerLink, '.site-nav');
      if (navFromLink) closeNav(navFromLink);
      return;
    }

    var adminToggle = closest(e.target, '[data-admin-toggle]');
    if (adminToggle) {
      e.preventDefault();
      e.stopPropagation();
      var shell = closest(adminToggle, '.admin-shell');
      if (!shell) return;
      if (shell.classList.contains('sidebar-open')) closeAdmin(shell);
      else openAdmin(shell);
      return;
    }

    var backdrop = closest(e.target, '[data-admin-backdrop]');
    if (backdrop) {
      closeAdmin(closest(backdrop, '.admin-shell'));
      return;
    }

    var sidebarNav = closest(e.target, '.admin-sidebar [onclick], .admin-sidebar [onClick]');
    // DC uses onClick attribute; also catch clicks on sidebar nav rows
    if (!sidebarNav) {
      var sidebarItem = closest(e.target, '.admin-sidebar [style*="cursor:pointer"], .admin-sidebar button');
      if (sidebarItem && window.matchMedia('(max-width: 768px)').matches) {
        var shellFromSide = closest(sidebarItem, '.admin-shell');
        if (shellFromSide && shellFromSide.classList.contains('sidebar-open')) {
          // Delay slightly so DC click handlers run first
          setTimeout(function () { closeAdmin(shellFromSide); }, 0);
        }
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.site-nav.is-open').forEach(closeNav);
    document.querySelectorAll('.admin-shell.sidebar-open').forEach(closeAdmin);
  });
})();
