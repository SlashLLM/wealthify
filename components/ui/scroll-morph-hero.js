/*
 * ScrollMorphHero — a deck of cards that scatters in, lines up, closes into a
 * ring around a headline, and then, as the reader scrolls, opens out into an
 * arch along the bottom of the screen and slides along it while the real copy
 * fades in above.
 *
 * Ported from the 21st.dev `scroll-morph-hero.tsx` (shadcn / Tailwind / TS /
 * framer-motion) to run on this site's no-build setup: plain JS against the
 * `window.React` that support.js loads, Tailwind utilities rewritten as scoped
 * `.smh-*` CSS, and framer-motion's springs replaced by a small spring
 * integrator that writes transforms straight to the DOM (no React render per
 * frame). Nothing here touches React at load time. Use it from a DC page's
 * renderVals():
 *
 *   window.React.createElement(window.ScrollMorphHero, { cards, introTitle }, copy)
 *
 * Props: cards        [{ src, label? }] — label is shown on the card's back
 *        introTitle   node shown inside the ring before the morph
 *        introAs      tag for introTitle (default "h1")
 *        introHint    small caps line under the title (default "Scroll to explore")
 *        scrollLength how far the page scrolls while the hero is pinned (default "140vh")
 *        label, className, style
 *        children     the copy that fades in once the arch has formed
 *
 * Two deliberate departures from the original. It does not hijack the wheel:
 * the section is pinned with position:sticky and the morph is driven by the
 * page's own scroll, so scrollbars, keyboards and touch all work and the page
 * carries on past the hero. And the copy is `inert` until it is visible, so
 * its buttons cannot take focus while they are transparent.
 *
 * Theming hooks (set on any ancestor): --smh-bg, --smh-fg, --smh-muted,
 * --smh-accent, --smh-card-bg, --smh-back-bg, --smh-back-border,
 * --smh-content-top.
 *
 * The stage publishes --smh-ring: the clear diameter inside the ring, in px.
 * The ring follows the stage's shorter side, not its width, so size the intro
 * title against --smh-ring rather than vw or it spills under the cards on a
 * wide, short window.
 */
(function () {
  "use strict";

  /** Virtual scroll range, kept from the original so its breakpoints hold. */
  const MAX_SCROLL = 3000;
  /** Ring → arch happens over the first stretch; the arch slides after it. */
  const MORPH_END = 600;
  const CARD_W = 60;
  const CARD_H = 85;

  const CSS = `
.smh{position:relative;height:calc(100vh + var(--smh-scroll));height:calc(100svh + var(--smh-scroll))}
.smh-stage{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden;background:var(--smh-bg,#FAFAFA);color:var(--smh-fg,#1f2937)}
.smh-intro{position:absolute;inset:0;z-index:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px;text-align:center;pointer-events:none}
.smh-intro__title{margin:0;max-width:calc(var(--smh-ring,420px) * .78);font-size:min(clamp(24px,4vw,36px),calc(var(--smh-ring,420px) * .1));font-weight:500;letter-spacing:-.025em;color:inherit;opacity:0;filter:blur(10px);transform:translateY(20px);transition:opacity 1s,filter 1s,transform 1s}
.smh-intro__title.is-shown{filter:blur(0);transform:none}
.smh-intro__hint{margin:16px 0 0;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--smh-muted,#6b7280);opacity:0;transition:opacity 1s .2s}
.smh-content{position:absolute;left:0;right:0;top:var(--smh-content-top,10%);z-index:10;display:flex;flex-direction:column;align-items:center;padding:0 16px;text-align:center;opacity:0;visibility:hidden;pointer-events:none}
.smh-content a,.smh-content button{pointer-events:auto}
.smh-cards{position:absolute;inset:0;z-index:1;pointer-events:none}
.smh-card{position:absolute;left:50%;top:50%;width:${CARD_W}px;height:${CARD_H}px;margin:${-CARD_H / 2}px 0 0 ${-CARD_W / 2}px;perspective:1000px;opacity:0;cursor:pointer;pointer-events:auto;will-change:transform,opacity}
.smh-card__inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.34,1.45,.64,1)}
.smh-card:hover .smh-card__inner{transform:rotateY(180deg)}
.smh-face{position:absolute;inset:0;overflow:hidden;border-radius:12px;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 10px 15px -3px rgb(0 0 0 / .1),0 4px 6px -4px rgb(0 0 0 / .1)}
.smh-face--front{background:var(--smh-card-bg,#e5e7eb)}
.smh-face--front img{display:block;width:100%;height:100%;object-fit:cover;user-select:none}
.smh-face--front::after{content:"";position:absolute;inset:0;background:rgb(0 0 0 / .1);transition:background .15s}
.smh-card:hover .smh-face--front::after{background:transparent}
.smh-face--back{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;text-align:center;transform:rotateY(180deg);background:var(--smh-back-bg,#111827);border:1px solid var(--smh-back-border,#374151)}
.smh-back__eyebrow{margin-bottom:3px;font-size:5.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--smh-accent,#60a5fa)}
.smh-back__label{font-size:9px;font-weight:600;line-height:1.2;color:#fff}
@media (prefers-reduced-motion:reduce){.smh-card__inner,.smh-intro__title,.smh-intro__hint{transition:none}}
`;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const lerp = (a, b, t) => a * (1 - t) + b * t;
  /** Clamped linear map, the same as framer-motion's useTransform. */
  const progress = (value, from, to) => clamp((value - from) / (to - from), 0, 1);
  const cx = (...names) => names.filter(Boolean).join(" ");

  /** A mass-1 spring with framer-motion's stiffness/damping meaning. */
  const spring = (stiffness, damping, value, rest) => ({ k: stiffness, c: damping, x: value, v: 0, to: value, rest });

  /** Advances a spring by dt seconds; returns true while it is still moving. */
  function step(s, dt) {
    // Sub-stepped semi-implicit Euler stays stable through dropped frames.
    const n = Math.ceil(dt / 0.008);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      s.v += (-s.k * (s.x - s.to) - s.c * s.v) * h;
      s.x += s.v * h;
    }
    if (Math.abs(s.v) < s.rest && Math.abs(s.x - s.to) < s.rest) {
      s.x = s.to;
      s.v = 0;
      return false;
    }
    return true;
  }

  function snap(s) {
    s.x = s.to;
    s.v = 0;
    return false;
  }

  function ScrollMorphHero(props) {
    const React = window.React;
    const h = React.createElement;
    const {
      cards,
      introTitle,
      introAs = "h1",
      introHint = "Scroll to explore",
      scrollLength = "140vh",
      label,
      className,
      style,
      children,
    } = props;

    const count = cards.length;
    const rootRef = React.useRef(null);
    const stageRef = React.useRef(null);
    const titleRef = React.useRef(null);
    const hintRef = React.useRef(null);
    const contentRef = React.useRef(null);
    const cardRefs = React.useRef([]);

    React.useEffect(() => {
      const root = rootRef.current;
      const stage = stageRef.current;
      if (!root || !stage || !count) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let phase = reduced ? "circle" : "scatter";
      let width = stage.clientWidth;
      let height = stage.clientHeight;

      const morph = spring(40, 20, 0, 0.0005);
      const shuffle = spring(40, 20, 0, 0.0005);
      const parallax = spring(30, 20, 0, 0.1);

      const scatter = Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 1500,
        y: (Math.random() - 0.5) * 1000,
        r: (Math.random() - 0.5) * 180,
        s: 0.6,
        o: 0,
      }));
      const bodies = scatter.map((p) => ({
        x: spring(40, 15, p.x, 0.1),
        y: spring(40, 15, p.y, 0.1),
        r: spring(40, 15, p.r, 0.05),
        s: spring(40, 15, p.s, 0.001),
        o: spring(40, 15, p.o, 0.001),
      }));

      /** Ring radius and card scale; phones get a wider ring of smaller cards,
          since at 0.35 and full size twenty cards overlap into a solid band. */
      function ringGeometry() {
        const radius = Math.min(Math.min(width, height) * (width < 768 ? 0.42 : 0.35), 350);
        const scale = Math.min(1, ((2 * Math.PI * radius) / count) * 0.8 / CARD_W);
        return { radius, scale };
      }

      /** Tells the CSS how much clear space the ring leaves for the title. */
      function publishRing() {
        const { radius, scale } = ringGeometry();
        // A card on the ring reaches in by at most half its diagonal.
        const reach = (Math.hypot(CARD_W, CARD_H) / 2) * scale;
        stage.style.setProperty("--smh-ring", Math.max(0, 2 * (radius - reach)).toFixed(1) + "px");
      }

      /** Where card i wants to be, from the phase and the smoothed inputs. */
      function target(i, m, slide, px) {
        if (phase === "scatter") return scatter[i];

        if (phase === "line") {
          // The original's fixed 70px pitch runs off anything narrower than
          // 1400px, so it tightens to fit.
          const pitch = Math.min(70, (width * 0.92) / count);
          return { x: (i - (count - 1) / 2) * pitch, y: 0, r: 0, s: 1, o: 1 };
        }

        const mobile = width < 768;
        const { radius, scale: ringScale } = ringGeometry();
        const angle = (i / count) * 360;
        const rad = (angle * Math.PI) / 180;
        const ring = { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius, r: angle + 90, s: ringScale };

        // A rainbow arch whose apex sits below the centre of the stage.
        const arcRadius = Math.min(width, height * 1.5) * (mobile ? 1.4 : 1.1);
        const arcCenterY = height * (mobile ? 0.22 : 0.25) + arcRadius;
        const spread = mobile ? 100 : 130;
        const start = -90 - spread / 2;
        const pitch = spread / Math.max(count - 1, 1);
        // Slides left as the reader scrolls and stops with the last card at the
        // apex. (The original's 0.8 × spread carried every card off screen.)
        const arcAngle = start + i * pitch - (slide / 360) * spread * 0.5;
        const arcRad = (arcAngle * Math.PI) / 180;
        const arc = {
          x: Math.cos(arcRad) * arcRadius + px,
          y: Math.sin(arcRad) * arcRadius + arcCenterY,
          r: arcAngle + 90,
          s: mobile ? 1.4 : 1.8,
        };

        return {
          x: lerp(ring.x, arc.x, m),
          y: lerp(ring.y, arc.y, m),
          r: lerp(ring.r, arc.r, m),
          s: lerp(ring.s, arc.s, m),
          o: 1,
        };
      }

      function readScroll() {
        const rect = root.getBoundingClientRect();
        const travel = rect.height - stage.offsetHeight;
        const virtual = (travel > 0 ? clamp(-rect.top / travel, 0, 1) : 0) * MAX_SCROLL;
        morph.to = progress(virtual, 0, MORPH_END);
        shuffle.to = progress(virtual, MORPH_END, MAX_SCROLL) * 360;
      }

      let shownTitle = null;
      let titleOpacity = -1;
      let hintOpacity = -1;
      let contentOpacity = -1;

      function paintCopy(m) {
        const intro = phase === "circle" && m < 0.5;
        const title = titleRef.current;
        if (title) {
          if (intro !== shownTitle) {
            title.classList.toggle("is-shown", intro);
            shownTitle = intro;
          }
          const o = intro ? 1 - m * 2 : 0;
          if (Math.abs(o - titleOpacity) > 0.004) title.style.opacity = String((titleOpacity = o));
        }
        const hint = hintRef.current;
        if (hint) {
          const o = intro ? clamp(0.5 - m, 0, 1) : 0;
          if (Math.abs(o - hintOpacity) > 0.004) hint.style.opacity = String((hintOpacity = o));
        }
        const content = contentRef.current;
        if (content) {
          const o = progress(m, 0.8, 1);
          if (Math.abs(o - contentOpacity) > 0.002 || (o !== contentOpacity && (o === 0 || o === 1))) {
            contentOpacity = o;
            content.style.opacity = String(o);
            content.style.transform = "translateY(" + (20 * (1 - o)).toFixed(2) + "px)";
            content.style.visibility = o > 0 ? "visible" : "hidden";
            content.inert = o < 0.5;
          }
        }
      }

      let raf = 0;
      let last = 0;
      let inView = true;

      function frame(now) {
        raf = 0;
        const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
        last = now;
        const move = reduced ? snap : (s) => step(s, dt);

        let moving = false;
        moving = move(morph) || moving;
        moving = move(shuffle) || moving;
        moving = move(parallax) || moving;

        for (let i = 0; i < count; i++) {
          const el = cardRefs.current[i];
          const body = bodies[i];
          const t = target(i, morph.x, shuffle.x, parallax.x);
          body.x.to = t.x;
          body.y.to = t.y;
          body.r.to = t.r;
          body.s.to = t.s;
          body.o.to = t.o;
          moving = move(body.x) || moving;
          moving = move(body.y) || moving;
          moving = move(body.r) || moving;
          moving = move(body.s) || moving;
          moving = move(body.o) || moving;
          if (el) {
            el.style.transform =
              "translate3d(" + body.x.x.toFixed(2) + "px," + body.y.x.toFixed(2) + "px,0) rotate(" +
              body.r.x.toFixed(2) + "deg) scale(" + body.s.x.toFixed(4) + ")";
            el.style.opacity = clamp(body.o.x, 0, 1).toFixed(3);
          }
        }

        paintCopy(morph.x);

        if (moving && inView) raf = requestAnimationFrame(frame);
        else last = 0;
      }

      function wake() {
        if (!raf && inView) raf = requestAnimationFrame(frame);
      }

      const onScroll = () => {
        readScroll();
        wake();
      };
      const onMouseMove = (e) => {
        if (reduced) return;
        const rect = stage.getBoundingClientRect();
        parallax.to = (((e.clientX - rect.left) / rect.width) * 2 - 1) * 100;
        wake();
      };
      const resize = new ResizeObserver(() => {
        width = stage.clientWidth;
        height = stage.clientHeight;
        publishRing();
        readScroll();
        wake();
      });
      const visibility = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) wake();
      });

      const timers = reduced
        ? []
        : [
            setTimeout(() => ((phase = "line"), wake()), 500),
            setTimeout(() => ((phase = "circle"), wake()), 2500),
          ];

      window.addEventListener("scroll", onScroll, { passive: true });
      stage.addEventListener("mousemove", onMouseMove);
      resize.observe(stage);
      visibility.observe(root);
      publishRing();
      readScroll();
      wake();

      return () => {
        timers.forEach(clearTimeout);
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("scroll", onScroll);
        stage.removeEventListener("mousemove", onMouseMove);
        resize.disconnect();
        visibility.disconnect();
      };
    }, [count]);

    return h(
      "section",
      {
        ref: rootRef,
        className: cx("smh", className),
        style: Object.assign({ "--smh-scroll": scrollLength }, style),
        "aria-label": label,
      },
      h("style", null, CSS),
      h(
        "div",
        { ref: stageRef, className: "smh-stage" },
        h(
          "div",
          { className: "smh-intro" },
          h(introAs, { ref: titleRef, className: "smh-intro__title" }, introTitle),
          introHint ? h("p", { ref: hintRef, className: "smh-intro__hint", "aria-hidden": true }, introHint) : null,
        ),
        h(
          "div",
          { className: "smh-cards", "aria-hidden": true },
          cards.map((card, i) =>
            h(
              "div",
              { key: i, ref: (el) => (cardRefs.current[i] = el), className: "smh-card" },
              h(
                "div",
                { className: "smh-card__inner" },
                h(
                  "div",
                  { className: "smh-face smh-face--front" },
                  h("img", { src: card.src, alt: "", decoding: "async", draggable: false }),
                ),
                h(
                  "div",
                  { className: "smh-face smh-face--back" },
                  h("span", { className: "smh-back__eyebrow" }, card.eyebrow || "View"),
                  h("span", { className: "smh-back__label" }, card.label || "Details"),
                ),
              ),
            ),
          ),
        ),
        h("div", { ref: contentRef, className: "smh-content" }, children),
      ),
    );
  }

  window.ScrollMorphHero = ScrollMorphHero;
})();
