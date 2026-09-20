/* ------------------------------------------------------------------
   Shuttle — site behaviour
   Everything here is progressive enhancement. With JS disabled or
   reduced motion requested, the page renders in a static, complete
   state.
   ------------------------------------------------------------------ */
(() => {
  "use strict";

  document.documentElement.classList.remove("no-js");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Formatting (mirrors what the app shows) ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const fmtTime = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };
  const fmtGB = (gb) => `${gb.toFixed(1)} GB`;
  const fmtSpeed = (mbps) => mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} GB/s` : `${Math.round(mbps)} MB/s`;
  const fmtPct = (p) => `${Math.floor(clamp(p, 0, 1) * 100)}%`;

  /* Smooth, bounded jitter so readouts look measured rather than random */
  const makeJitter = (base, spread, rate = 0.12) => {
    let cur = base, target = base;
    return () => {
      if (Math.abs(cur - target) < 0.5) target = base + (Math.random() * 2 - 1) * spread;
      cur = lerp(cur, target, rate);
      return cur;
    };
  };

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const onScrollNav = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  onScrollNav();
  window.addEventListener("scroll", onScrollNav, { passive: true });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  }

  /* Run `fn` once when `el` is sufficiently visible */
  const once = (el, fn, threshold = 0.4) => {
    if (!el) return;
    if (reduceMotion || !("IntersectionObserver" in window)) return; // static state stays
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { io.disconnect(); fn(el); }
      });
    }, { threshold });
    io.observe(el);
  };

  /* ================================================================
     Hero — the transfer window
     One source read fans out to three destinations. Copy → verify →
     complete. The clock advances with the bytes, so the numbers agree.
     ================================================================ */
  const hero = $("#hero-app");
  if (hero) {
    const TOTAL_GB = 342.6;
    const FILES = "1,284";
    const START_P = 0.62;           // source read progress at load
    const START_ELAPSED = 4 * 60 + 21;
    const WRITE_MBPS = 812;
    const COPY_REAL_MS = 12000;     // real time for the remaining copy
    const LAGS = [0, 0.003, 0.011]; // destination buffer lag behind the read
    const VERIFY_MBPS = [1650, 1620, 940];
    const VERIFY_REAL_MS = [6500, 6800, 9000];

    const el = {
      state: $('[data-role="state"]', hero),
      stateLabel: $('[data-role="state-label"]', hero),
      titleSub: $('[data-role="title-sub"]', hero),
      copied: $('[data-role="copied"]', hero),
      speedK: $('[data-role="speed-k"]', hero),
      speed: $('[data-role="speed"]', hero),
      elapsed: $('[data-role="elapsed"]', hero),
      remaining: $('[data-role="remaining"]', hero),
      overallBar: $('[data-role="overall-bar"]', hero),
      overallPct: $('[data-role="overall-pct"]', hero),
      checkpoint: $('[data-role="checkpoint"]', hero),
      statusL: $('[data-role="status-left"]', hero),
      statusR: $('[data-role="status-right"]', hero),
      sbDot: $('[data-role="sb-dot"]', hero),
      dests: $$(".dest", hero).map((d) => ({
        root: d,
        bar: $('[data-role="bar"]', d),
        pct: $('[data-role="pct"]', d),
        speed: $('[data-role="speed"]', d),
        state: $('[data-role="state"]', d),
      })),
    };

    const readJitter = makeJitter(WRITE_MBPS, 16);
    const verifyJitter = VERIFY_MBPS.map((v) => makeJitter(v, v * 0.02));
    const maxLag = Math.max(...LAGS);
    const copyWallSec = ((1 - START_P) * TOTAL_GB * 1000) / WRITE_MBPS;             // transfer-time seconds left in copy
    const verifyWallSec = VERIFY_MBPS.map((v) => (TOTAL_GB * 1000) / v);           // per destination
    const copyEndElapsed = START_ELAPSED + copyWallSec;

    let phase = "copying";
    let t0 = null, tVerify0 = null, done = false;
    let lastCheckpoint = 4;
    let lastReadout = 0;
    const readouts = { read: WRITE_MBPS, verify: VERIFY_MBPS.slice() };

    const setState = (s, label) => {
      el.state.dataset.state = s;
      el.stateLabel.textContent = label;
    };

    const frame = (now) => {
      if (t0 === null) t0 = now;
      const dt = now - t0;

      // Refresh jittered readouts a few times a second, not every frame
      if (now - lastReadout > 420) {
        lastReadout = now;
        readouts.read = readJitter();
        readouts.verify = verifyJitter.map((j) => j());
      }

      // Checkpoint cadence
      const cpAge = Math.floor((dt / 1000) + 4) % 7;
      if (cpAge !== lastCheckpoint) { lastCheckpoint = cpAge; el.checkpoint.textContent = cpAge === 0 ? "Saving…" : `Saved ${cpAge} s ago`; }

      if (phase === "copying") {
        // master read progress runs slightly past 1 so lagging destinations flush
        const m = START_P + ((1 - START_P + maxLag) * dt) / COPY_REAL_MS;
        const p = clamp(m, 0, 1);
        const elapsed = START_ELAPSED + ((p - START_P) / (1 - START_P)) * copyWallSec;
        const remaining = ((1 - p) * TOTAL_GB * 1000) / WRITE_MBPS;

        el.copied.textContent = fmtGB(p * TOTAL_GB);
        el.speed.textContent = fmtSpeed(p < 1 ? readouts.read : 0);
        el.elapsed.textContent = fmtTime(elapsed);
        el.remaining.textContent = fmtTime(remaining);
        el.overallBar.style.width = `${p * 100}%`;
        el.overallPct.textContent = fmtPct(p);

        el.dests.forEach((d, i) => {
          const c = clamp(m - LAGS[i], 0, 1);
          d.bar.style.width = `${c * 100}%`;
          d.pct.textContent = fmtPct(c);
          if (c < 1) {
            d.speed.textContent = fmtSpeed(readouts.read - i * 3.2);
            d.state.textContent = "Copying";
          } else if (!d.root.classList.contains("is-verifying")) {
            d.root.classList.add("is-verifying");
            d.state.textContent = "Verifying";
            d.bar.style.width = "0%";
            d.pct.textContent = "0%";
            d.speed.textContent = fmtSpeed(VERIFY_MBPS[i]);
            d.vStart = now;
          }
        });

        if (m >= 1 + maxLag) {
          phase = "verifying";
          tVerify0 = now;
          setState("verifying", "Verifying");
          el.titleSub.textContent = "Verifying 3 destinations";
          el.speedK.textContent = "Verify read";
          el.statusL.textContent = "Reading back every file · comparing to source hashes";
          el.copied.textContent = fmtGB(TOTAL_GB);
        }
      }

      if (phase === "verifying") {
        let allDone = true, sumV = 0, remaining = 0, aggregate = 0;
        el.dests.forEach((d, i) => {
          const start = d.vStart || tVerify0;
          const v = clamp((now - start) / VERIFY_REAL_MS[i], 0, 1);
          sumV += v;
          d.bar.style.width = `${v * 100}%`;
          d.pct.textContent = fmtPct(v);
          if (v < 1) {
            allDone = false;
            aggregate += readouts.verify[i];
            remaining = Math.max(remaining, (1 - v) * verifyWallSec[i]);
            d.speed.textContent = fmtSpeed(readouts.verify[i]);
            d.state.textContent = "Verifying";
          } else if (!d.root.classList.contains("is-verified")) {
            d.root.classList.add("is-verified");
            d.bar.classList.add("is-ok");
            d.bar.firstElementChild && d.bar.firstElementChild.classList.add("is-ok");
            d.bar.style.width = "100%";
            d.pct.textContent = "100%";
            d.speed.textContent = "";
            d.state.textContent = "Verified";
          }
        });
        // The clock follows the slowest destination's read-back
        const slow = 2;
        const vSlow = clamp((now - (el.dests[slow].vStart || tVerify0)) / VERIFY_REAL_MS[slow], 0, 1);
        el.elapsed.textContent = fmtTime(copyEndElapsed + vSlow * verifyWallSec[slow]);
        el.remaining.textContent = fmtTime(remaining);
        el.speed.textContent = fmtSpeed(aggregate);
        const overall = sumV / el.dests.length;
        el.overallBar.style.width = `${overall * 100}%`;
        el.overallPct.textContent = fmtPct(overall);

        if (allDone) {
          phase = "complete";
          done = true;
          setState("complete", "Complete");
          el.titleSub.textContent = "Complete · 3 destinations verified";
          el.speedK.textContent = "Average write";
          el.speed.textContent = fmtSpeed(WRITE_MBPS);
          el.remaining.textContent = "00:00:00";
          el.overallBar.classList.add("is-ok");
          el.overallPct.textContent = "100%";
          el.checkpoint.textContent = "Final";
          el.statusL.textContent = `${FILES} files verified on 3 destinations · 0 mismatches`;
          el.statusR.textContent = "Report ready";
          el.sbDot.classList.add("is-ok");
        }
      }

      if (!done) requestAnimationFrame(frame);
    };

    // The bars use CSS transitions for their static state; during the
    // simulation we drive them per-frame, so shorten the transition.
    once(hero, () => {
      $$(".bar i", hero).forEach((b) => (b.style.transitionDuration = "0.12s"));
      setTimeout(() => requestAnimationFrame(frame), 1600);
    }, 0.35);
  }

  /* ================================================================
     Story 1 — read once, write everywhere
     ================================================================ */
  once($("#fanout"), (el) => el.classList.add("is-live"), 0.45);

  /* ================================================================
     Story 2 — verify everything
     ================================================================ */
  const verify = $("#verify");
  if (verify) {
    const rows = $$("[data-vrow]", verify);
    const count = $('[data-role="vcount"]', verify);
    const base = 1276;
    if (!reduceMotion && count) count.textContent = base.toLocaleString("en-US");
    once(verify, () => {
      rows.forEach((row, i) => {
        setTimeout(() => {
          row.classList.add("is-verified");
          if (count) count.textContent = (base + i + 1).toLocaleString("en-US");
        }, 500 + i * 260);
      });
    }, 0.45);
  }

  /* ================================================================
     Story 3 — resume from checkpoint
     ================================================================ */
  const resume = $("#resume");
  if (resume) {
    const fill = $('[data-role="rfill"]', resume);
    const mark = $('[data-role="rmark"]', resume);
    const cp = $('[data-role="rcp"]', resume);
    const state = $('[data-role="rstate"]', resume);
    const label = $('[data-role="rstate-label"]', resume);
    const logRows = $$('[data-role="rlog"] li', resume);
    const setState = (s, text) => { state.dataset.state = s; label.textContent = text; };

    if (!reduceMotion) {
      // Rewind to the beginning of the story; it plays when scrolled into view.
      resume.classList.remove("has-mark");
      fill.classList.remove("is-ok");
      fill.style.width = "40%";
      mark.style.left = "58%";
      cp.style.left = "58%";
      setState("copying", "Copying");
    }

    once(resume, () => {
      const at = (ms, fn) => setTimeout(fn, ms);
      fill.style.transition = "width 1.6s linear, background-color 0.4s";
      requestAnimationFrame(() => (fill.style.width = "58%"));
      at(1600, () => { resume.classList.add("has-mark"); logRows[0].classList.add("is-shown"); });
      at(2500, () => { setState("waiting", "Waiting for volume"); logRows[1].classList.add("is-shown"); });
      at(4600, () => { setState("copying", "Resuming"); logRows[2].classList.add("is-shown"); });
      at(5400, () => {
        logRows[3].classList.add("is-shown");
        setState("copying", "Copying");
        fill.style.transition = "width 3.4s linear, background-color 0.4s";
        fill.style.width = "100%";
      });
      at(9000, () => { setState("verified", "Verified"); fill.classList.add("is-ok"); });
    }, 0.5);
  }

  /* ================================================================
     Reliability — one destination fails, the others continue
     ================================================================ */
  const iso = $("#isolate");
  if (iso) {
    const rows = $$(".dest", iso).map((d) => ({
      root: d, bar: $('[data-role="bar"]', d), pct: $('[data-role="pct"]', d), state: $('[data-role="state"]', d),
    }));
    const start = [0.71, 0.706, 0.44];
    if (!reduceMotion) {
      // Rewind: everything copying, the failure happens once the panel is in view.
      iso.classList.remove("is-warn");
      rows[2].root.classList.remove("is-waiting");
      rows[2].state.textContent = "Copying";
      rows[2].bar.style.width = "44%";
      rows[2].pct.textContent = "44%";
    }
    once(iso, () => {
      let t0 = null;
      const DUR = 11000;
      const frame = (now) => {
        if (t0 === null) t0 = now;
        const t = (now - t0) / 1000;
        rows.forEach((r, i) => {
          let p;
          if (i < 2) p = clamp(start[i] + t * 0.021, 0, 0.97);
          else p = clamp(start[i] + Math.min(t, 1.5) * 0.02, 0, 1);
          r.bar.style.width = `${p * 100}%`;
          r.pct.textContent = fmtPct(p);
        });
        if (t >= 1.5 && !iso.classList.contains("is-warn")) {
          iso.classList.add("is-warn");
          rows[2].root.classList.add("is-waiting");
          rows[2].state.textContent = "Waiting";
        }
        if (now - t0 < DUR) requestAnimationFrame(frame);
      };
      $$(".bar i", iso).forEach((b) => (b.style.transitionDuration = "0.12s"));
      requestAnimationFrame(frame);
    }, 0.5);
  }

  /* ================================================================
     Workflow — a line that advances as the steps enter view
     ================================================================ */
  const wfFill = $("#wf-fill");
  const wfSteps = $$("#wf-steps .wf-step");
  if (wfFill && wfSteps.length) {
    const track = wfFill.parentElement;
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const top = track.getBoundingClientRect().top;
      // Fill from the moment the line enters the lower part of the viewport
      // until it reaches the upper third.
      const p = clamp((vh * 0.86 - top) / (vh * 0.52), 0, 1);
      wfFill.style.width = `${p * 100}%`;
      wfSteps.forEach((s, i) => s.classList.toggle("is-on", p >= i / wfSteps.length + 0.02));
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    if (reduceMotion) {
      wfFill.style.width = "100%";
      wfSteps.forEach((s) => s.classList.add("is-on"));
    } else {
      update();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }
  }
})();
