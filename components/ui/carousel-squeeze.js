/*
 * SqueezeCarousel — a carousel that gives one panel the room and squeezes the
 * rest into slats down the right-hand side. Opening a slat widens it and slides
 * the row along; the copy and the button underneath cross-fade to match.
 *
 * Ported from the 21st.dev `carousel-squeeze.tsx` (shadcn / Tailwind / TS) to
 * run on this site's no-build setup: plain JS against the `window.React` that
 * support.js loads, with the Tailwind utilities rewritten as scoped `.sq-*`
 * CSS. Nothing here touches React at load time, so the file can be included
 * before React has arrived. Use it from a DC page's renderVals():
 *
 *   window.React.createElement(window.SqueezeCarousel, { slides, label })
 *
 * Slide shape: { id?, title, description?, image?, imageAlt?, background?,
 *                overlay?, action?, href?, target?, onAction? }
 *
 * Autoplay: `autoplay` steps on every `interval` ms, counted from when a panel
 * lands. `progress` (default true) shows that countdown as a bar across the top
 * of the open panel. It pauses on hover, on keyboard focus and while the
 * carousel is mostly off screen, and is off for reduced-motion readers.
 *
 * Theming hooks (set on any ancestor): --sq-accent, --sq-accent-foreground,
 * --sq-fg, --sq-muted-fg, --sq-muted, --sq-offset (focus-ring gap colour).
 */
(function () {
  "use strict";

  /**
   * The row is four columns and a tail of slats, and it is a strip that slides
   * rather than a ring that turns.
   *
   * Four columns share out whatever is left once the open card, the slats and
   * the gaps are paid for. The open card starts from a 16:9 block and then
   * gives a little back — hence the negative first share. Column −1 and
   * anything past column 3 is a slat, so a card leaving the front simply
   * narrows to a slat and carries on out of the left edge.
   */
  const SHARES = [-0.06, 0.61, 0.3, 0.15];
  /** The hovered column takes more room. */
  const STRETCHED = [0, 0.71, 0.4, 0.25];
  /** Its neighbours give a little up to pay for it. */
  const SQUEEZED = [-0.12, 0.59, 0.28, 0.13];

  /** A number is read as pixels; a string goes through as written. */
  const size = (value) => (typeof value === "number" ? value + "px" : value);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const cx = (...names) => names.filter(Boolean).join(" ");

  /*
   * Geometry lives in custom properties so nothing needs measuring. The root
   * is the size container; `.sq-inner` derives the open card (`--sq-hero`) and
   * the room the other three columns share (`--sq-room`) from it. Below 560px
   * of carousel width a 16:9 hero would leave no room for the columns, so the
   * row turns square and the gaps tighten.
   */
  const CSS = `
.sq{width:100%;container-type:inline-size;color:var(--sq-fg,inherit)}
.sq-inner{display:flex;flex-direction:column;--sq-ratio:calc(16 / 9);
  --sq-hero:calc(var(--sq-h) * var(--sq-ratio));
  --sq-room:calc(100cqi - var(--sq-hero) - var(--sq-slats) * var(--sq-slat-gap) - 3 * var(--sq-gap) - var(--sq-slats) * var(--sq-slat))}
@container (max-width:559.98px){.sq-inner{--sq-h:var(--sq-compact-h,58cqi);--sq-ratio:1;--sq-gap:10px;--sq-slat-gap:6px;--sq-slat:6px}}
.sq-controls{display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px}
.sq-btn{display:grid;place-items:center;width:36px;height:36px;padding:0;border:0;border-radius:8px;cursor:pointer;font:inherit;background:var(--sq-fill);color:var(--sq-on-fill);transition:opacity .15s;outline:none}
.sq-btn:hover,.sq-action:hover{opacity:.85}
.sq-btn:focus-visible,.sq-action:focus-visible{box-shadow:0 0 0 2px var(--sq-offset,#fff),0 0 0 4px var(--sq-fill)}
.sq-viewport{width:100%;height:var(--sq-h);overflow:hidden}
.sq-strip{display:flex;height:100%;width:max-content}
.sq-tab{position:relative;isolation:isolate;flex-shrink:0;height:100%;padding:0;border:0;overflow:hidden;cursor:pointer;background:var(--sq-muted,rgba(127,127,127,.15));outline:none;-webkit-tap-highlight-color:transparent}
.sq-tab::after{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit;pointer-events:none}
.sq-tab:focus-visible::after{box-shadow:inset 0 0 0 2px var(--sq-fill),inset 0 0 0 4px var(--sq-offset,#fff)}
.sq-picture{position:absolute;top:0;left:50%;height:100%;width:var(--sq-hero);min-width:100%;max-width:none;transform:translateX(-50%);object-fit:cover;user-select:none}
.sq-overlay{position:absolute;left:0;right:0;bottom:0;z-index:1;display:flex;align-items:flex-end;padding:64px 16px 16px;pointer-events:none;background-image:linear-gradient(to top,rgb(0 0 0 / .55),transparent)}
.sq-progress{position:absolute;top:14px;left:16px;right:16px;z-index:1;height:3px;border-radius:3px;overflow:hidden;pointer-events:none;background:rgb(255 255 255 / .3);box-shadow:0 1px 6px rgb(0 0 0 / .25)}
.sq-progress__fill{display:block;height:100%;border-radius:inherit;background:var(--sq-fill);transform:scaleX(0);transform-origin:left;animation:sq-progress var(--sq-interval) linear var(--sq-ms) forwards}
@keyframes sq-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.sq-panel{display:grid;margin-top:24px}
.sq-slide{grid-column:1;grid-row:1;display:flex;flex-direction:column;align-items:flex-start;gap:16px}
.sq-copy{max-width:46rem;margin:0;font-size:15px;line-height:1.6;text-wrap:balance}
.sq-copy__title{color:var(--sq-fg,inherit)}
.sq-copy__desc{color:var(--sq-muted-fg,rgba(127,127,127,1))}
.sq-action{display:inline-flex;flex-shrink:0;align-items:center;gap:8px;padding:10px 16px;border:0;border-radius:8px;cursor:pointer;font:inherit;font-size:14px;font-weight:500;text-decoration:none;background:var(--sq-fill);color:var(--sq-on-fill);transition:opacity .15s;outline:none}
.sq-action svg{transition:transform .2s}
.sq-action:hover svg{transform:translateX(2px)}
@container (min-width:32rem){.sq-overlay{padding:80px 24px 24px}.sq-copy{font-size:17px}.sq-progress{top:18px;left:24px;right:24px}}
@container (min-width:36rem){.sq-panel{margin-top:28px}.sq-slide{flex-direction:row;justify-content:space-between;gap:40px}}
`;

  /** True while the reader asks for less movement. */
  function useReducedMotion() {
    const React = window.React;
    const [reduced, setReduced] = React.useState(false);

    React.useEffect(() => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const read = () => setReduced(query.matches);
      read();
      query.addEventListener("change", read);
      return () => query.removeEventListener("change", read);
    }, []);

    return reduced;
  }

  function SqueezeCarousel(props) {
    const React = window.React;
    const h = React.createElement;
    const {
      slides,
      defaultIndex = 0,
      onIndexChange,
      height = "clamp(180px, 32cqi, 340px)",
      slatWidth = 8,
      slatGap = 8,
      gap = 16,
      radius = 6,
      duration = 1000,
      hoverGrow = true,
      autoplay = false,
      interval = 6000,
      progress = true,
      controls = true,
      accent = "var(--sq-accent, currentColor)",
      accentForeground = "var(--sq-accent-foreground, white)",
      label = "Featured",
      panelClassName,
      className,
      style,
      ...rest
    } = props;

    const count = slides.length;
    const wrap = (i) => ((i % count) + count) % count;

    // Four columns plus a tail of slats. Fewer slides, shorter tail.
    const slats = clamp(count - 4, 1, 3);
    const visible = 4 + slats;

    const reduced = useReducedMotion();
    const ms = reduced ? 0 : duration;

    const ids = React.useId();
    const seed = React.useRef(0);
    const strip = React.useRef(null);
    const timers = React.useRef([]);
    const focusFront = React.useRef(false);

    /* --- the strip -------------------------------------------------------- */

    // Cards, the column offset and the "move without animating" flag change
    // together, so they share one piece of state and can never be painted half
    // applied.
    //
    // A card's column is its place in the strip plus `column`. Stepping on
    // pushes `column` down, so the card that was column 0 becomes column −1 —
    // a slat, on its way out of the left edge. The strip is translated by the
    // same count of slats, which keeps the open card pinned to the left.
    const [row, setRow] = React.useState(() => ({
      cards: Array.from({ length: count ? visible : 0 }, (_, place) => ({
        key: seed.current++,
        slide: wrap(defaultIndex + place),
      })),
      column: 0,
      still: false,
    }));
    const { cards, column, still } = row;

    // Where `column` is headed, read by timers that cannot trust a value
    // captured when they were scheduled.
    const columnRef = React.useRef(0);
    // Set while a step back waits one frame to start moving.
    const pending = React.useRef(null);

    const [hover, setHover] = React.useState(-1);
    const [paused, setPaused] = React.useState(false);

    const open = cards[-column] ? cards[-column].slide : defaultIndex;

    React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

    // A step leaves the strip longer than it needs to be. Once the movement has
    // finished, cut it back to the cards on show and put the offset back to
    // zero — the same picture, so nothing may animate on the way.
    const settle = React.useCallback(() => {
      const front = -columnRef.current;
      columnRef.current = 0;
      setRow((r) => ({
        cards: r.cards.slice(front, front + visible),
        column: 0,
        still: true,
      }));
    }, [visible]);

    // A still frame is committed with transitions off. Force a style flush so
    // the browser records it, then turn transitions back on next frame — and,
    // if a step back is waiting, let it move in that same update.
    React.useLayoutEffect(() => {
      if (!still) return;
      if (strip.current) strip.current.getBoundingClientRect();
      const id = requestAnimationFrame(() => {
        const target = pending.current;
        pending.current = null;
        setRow((r) => ({
          ...r,
          still: false,
          column: target === null ? r.column : target,
        }));
      });
      return () => cancelAnimationFrame(id);
      // `cards` too: a step back landing inside another still frame needs its
      // own flush before it moves.
    }, [still, cards]);

    const step = React.useCallback(
      (by) => {
        if (count < 2 || !by) return;

        timers.current.forEach(clearTimeout);
        timers.current = [];

        if (by > 0) {
          // A step back still waiting for its frame is taken as done.
          if (pending.current !== null) {
            columnRef.current = pending.current;
            pending.current = null;
          }
          // The incoming slats join the tail at full size before anything
          // moves, so the end of the row is never a slat short.
          const keys = Array.from({ length: by }, () => seed.current++);
          const target = (columnRef.current -= by);
          setRow((r) => {
            const last = r.cards[r.cards.length - 1].slide;
            return {
              cards: r.cards.concat(keys.map((key, k) => ({ key, slide: wrap(last + 1 + k) }))),
              column: target,
              still: false,
            };
          });
        } else {
          // Going back, the strip grows at the front, which shoves everything
          // right. Offset the column by the same amount so the picture does not
          // change, hold that for a frame, then ease to the new front.
          const n = -by;
          const keys = Array.from({ length: n }, () => seed.current++);
          const target = pending.current !== null ? pending.current : columnRef.current;
          pending.current = target;
          columnRef.current = target;
          setRow((r) => {
            const first = r.cards[0].slide;
            return {
              cards: keys.map((key, k) => ({ key, slide: wrap(first - (n - k)) })).concat(r.cards),
              column: r.column - n,
              still: true,
            };
          });
        }

        timers.current.push(window.setTimeout(settle, ms + 60));
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [count, ms, settle],
    );

    React.useEffect(() => {
      if (onIndexChange) onIndexChange(open);
      // Keyboard steps keep focus on the open card rather than on a card that
      // is about to leave the strip.
      if (focusFront.current && strip.current) {
        focusFront.current = false;
        const front = strip.current.querySelector('[aria-selected="true"]');
        if (front) front.focus({ preventScroll: true });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    /* --- autoplay --------------------------------------------------------- */

    // No timer: the progress bar on the open card *is* the clock. It starts
    // once the slide has landed, and its `animationend` steps the row on. Pausing
    // is `animation-play-state`, so the bar and the step can never disagree
    // about how much time is left.
    const playing = autoplay && !reduced && count > 1;

    // Off screen, nothing is being read, so nothing should advance.
    const root = React.useRef(null);
    const [inView, setInView] = React.useState(true);

    React.useEffect(() => {
      if (!playing || !root.current || !("IntersectionObserver" in window)) return;
      const observer = new IntersectionObserver(
        ([entry]) => setInView(entry.isIntersecting),
        { threshold: 0.35 },
      );
      observer.observe(root.current);
      return () => observer.disconnect();
    }, [playing]);

    const running = playing && !paused && inView;

    /* --- keyboard --------------------------------------------------------- */

    const onKeyDown = (event) => {
      const by = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (by === undefined) return;
      event.preventDefault();
      focusFront.current = true;
      step(by);
    };

    if (!count) return null;

    /* --- render ----------------------------------------------------------- */

    const hovering = hoverGrow && hover >= 0 && hover <= 3 && !reduced;

    /** The share a column takes, once the pointer has had its say. */
    const shareOf = (col) =>
      !hovering ? SHARES[col] : hover === col ? STRETCHED[col] : SQUEEZED[col];

    const widthOf = (col) => {
      if (col < 0 || col > 3) return "var(--sq-slat)";
      if (col === 0) return `calc(var(--sq-hero) + var(--sq-room) * ${shareOf(0)})`;
      return `calc(var(--sq-room) * ${shareOf(col)})`;
    };

    const vars = {
      "--sq-h": size(height),
      "--sq-gap": size(gap),
      "--sq-slat": size(slatWidth),
      "--sq-slat-gap": size(slatGap),
      "--sq-slats": String(slats),
      "--sq-radius": size(radius),
      "--sq-ms": ms + "ms",
      "--sq-interval": interval + "ms",
      // easeOutExpo, the curve the original slides on
      "--sq-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
      "--sq-fill": accent,
      "--sq-on-fill": accentForeground,
    };

    const fade = "opacity var(--sq-ms) var(--sq-ease)";

    return h(
      "div",
      {
        ref: root,
        className: cx("sq", className),
        style: { ...vars, ...style },
        onMouseEnter: () => setPaused(true),
        onMouseLeave: () => {
          setPaused(false);
          setHover(-1);
        },
        // Keyboard focus holds the row still; the focus a mouse click leaves on
        // an arrow button must not, or the carousel would never resume.
        onFocusCapture: (event) => {
          if (event.target.matches(":focus-visible")) setPaused(true);
        },
        onBlurCapture: () => setPaused(false),
        ...rest,
      },
      h("style", null, CSS),
      h(
        "div",
        { className: "sq-inner" },

        controls &&
          count > 1 &&
          h(
            "div",
            { className: "sq-controls" },
            h(Arrow, { back: true, label: "Previous", onClick: () => step(-1) }),
            h(Arrow, { label: "Next", onClick: () => step(1) }),
          ),

        h(
          "div",
          { className: "sq-viewport" },
          h(
            "div",
            {
              ref: strip,
              role: "tablist",
              "aria-label": label,
              "aria-orientation": "horizontal",
              onKeyDown,
              className: "sq-strip",
              style: {
                transform: `translateX(calc(${column} * (var(--sq-slat) + var(--sq-gap))))`,
                transition: still ? "none" : "transform var(--sq-ms) var(--sq-ease)",
              },
            },
            cards.map((card, place) => {
              const col = place + column;
              const slide = slides[card.slide];
              const front = col === 0;
              const width = widthOf(col);

              return h(
                "button",
                {
                  key: card.key,
                  type: "button",
                  role: "tab",
                  id: `${ids}-tab-${card.key}`,
                  "aria-selected": front,
                  "aria-controls": `${ids}-panel`,
                  "aria-label": slide.title,
                  tabIndex: front ? 0 : -1,
                  onMouseMove: () => hoverGrow && setHover(col),
                  onClick: () => col > 0 && step(col),
                  className: cx("sq-tab", panelClassName),
                  style: {
                    width,
                    marginLeft: place === 0 ? 0 : col < 4 ? "var(--sq-gap)" : "var(--sq-slat-gap)",
                    borderRadius: `min(var(--sq-radius), calc(${width} / 2))`,
                    transitionProperty: "width, margin-left",
                    transitionDuration: still ? "0s" : "var(--sq-ms)",
                    transitionTimingFunction: "var(--sq-ease)",
                  },
                },
                h(Picture, { slide }),
                // Keyed by card, so each newly opened card gets a fresh bar
                // starting from empty.
                playing &&
                  progress &&
                  front &&
                  h(
                    "span",
                    { "aria-hidden": "true", className: "sq-progress" },
                    h("span", {
                      className: "sq-progress__fill",
                      style: { animationPlayState: running ? "running" : "paused" },
                      onAnimationEnd: (event) => {
                        if (event.animationName === "sq-progress") step(1);
                      },
                    }),
                  ),
                slide.overlay &&
                  h(
                    "span",
                    {
                      "aria-hidden": "true",
                      className: "sq-overlay",
                      style: { opacity: front ? 1 : 0, transition: fade },
                    },
                    slide.overlay,
                  ),
              );
            }),
          ),
        ),

        h(
          "div",
          { id: `${ids}-panel`, role: "tabpanel", "aria-live": "polite", className: "sq-panel" },
          slides.map((slide, i) => {
            const shown = i === open;
            return h(
              "div",
              {
                key: slide.id != null ? slide.id : i,
                "aria-hidden": !shown,
                className: "sq-slide",
                style: {
                  opacity: shown ? 1 : 0,
                  visibility: shown ? "visible" : "hidden",
                  pointerEvents: shown ? "auto" : "none",
                  transition: `${fade}, visibility var(--sq-ms)`,
                },
              },
              h(
                "p",
                { className: "sq-copy" },
                h("span", { className: "sq-copy__title" }, slide.title),
                " ",
                slide.description && h("span", { className: "sq-copy__desc" }, slide.description),
              ),
              slide.action && h(Action, { slide, shown }),
            );
          }),
        ),
      ),
    );
  }

  /**
   * Drawn at a fixed 16:9 block and centred, never at the width of its card.
   * Left to itself `object-fit: cover` reads whichever edge binds — height
   * while the card is a slat, width once it opens — so the picture would
   * rescale mid-slide. One block means one scale: the card only ever changes
   * how much of it you can see.
   */
  function Picture({ slide }) {
    const h = window.React.createElement;

    if (slide.image) {
      return h("img", {
        src: slide.image,
        alt: slide.imageAlt || "",
        draggable: false,
        loading: "lazy",
        decoding: "async",
        className: "sq-picture",
      });
    }

    return h("span", {
      "aria-hidden": "true",
      className: "sq-picture",
      style: { background: slide.background },
    });
  }

  function Arrow({ back = false, label, onClick }) {
    const h = window.React.createElement;
    return h(
      "button",
      { type: "button", "aria-label": label, onClick, className: "sq-btn" },
      h(
        "svg",
        { width: 16, height: 16, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true" },
        h("path", {
          d: back
            ? "M9.6 2.6 5.1 7.1h9.1v1.8H5.1l4.5 4.5-1.2 1.2-6-6L1.8 8l.6-.6 6-6 1.2 1.2Z"
            : "M6.4 2.6l4.5 4.5H1.8v1.8h9.1l-4.5 4.5 1.2 1.2 6-6 .6-.6-.6-.6-6-6-1.2 1.2Z",
        }),
      ),
    );
  }

  /** The button under the copy. A link when it has an `href`, a button otherwise. */
  function Action({ slide, shown }) {
    const h = window.React.createElement;
    const inside = [
      slide.action,
      h(
        "svg",
        { key: "arrow", width: 6, height: 9, viewBox: "0 0 6 9", fill: "none", "aria-hidden": "true" },
        h("path", {
          d: "M1.2 1 4.7 4.5 1.2 8",
          stroke: "currentColor",
          strokeWidth: 1.6,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }),
      ),
    ];

    if (slide.href) {
      return h(
        "a",
        {
          href: slide.href,
          target: slide.target,
          rel: slide.target === "_blank" ? "noreferrer" : undefined,
          tabIndex: shown ? 0 : -1,
          onClick: slide.onAction,
          className: "sq-action",
        },
        ...inside,
      );
    }

    return h(
      "button",
      { type: "button", tabIndex: shown ? 0 : -1, onClick: slide.onAction, className: "sq-action" },
      ...inside,
    );
  }

  window.SqueezeCarousel = SqueezeCarousel;
})();
