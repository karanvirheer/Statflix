import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "./StatsPage.css";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";

function tmdbPosterUrl(posterPath) {
  if (!posterPath) return null;
  // posterPath already includes leading "/"
  return `https://image.tmdb.org/t/p/original${posterPath}`;
}

function minsToHrs(mins) {
  const h = mins / 60;
  return `${h.toFixed(1)} hrs`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function StatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(0);

  // ✅ Trackpad / wheel handling (one swipe -> one slide)
  const rootRef = useRef(null);
  const wheelAccum = useRef(0);
  const wheelCooldown = useRef(false);

  // ✅ Stop the browser from scrolling the page while you're in this full-screen experience
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        const resp = await fetch(`${API_BASE_URL}/api/stats-json`, {
          cache: "no-store",
        });
        if (!resp.ok) throw new Error(`Failed to load stats (${resp.status})`);
        const data = await resp.json();
        if (!alive) return;
        setStats(data);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load stats.");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const slides = useMemo(() => {
    if (!stats) return [];

    const topGenres = (stats.topGenres || [])
      .slice(0, 5)
      .map(([g, c]) => ({ g, c }));

    const unique = stats.numUniqueTitlesWatched || {
      total: 0,
      tvShows: 0,
      movies: 0,
    };

    const totalMins = Number(stats.totalWatchTime || 0);

    const top5 = (stats.topWatchedTitles || [])
      .slice(0, 5)
      .map(([title, info]) => ({
        title,
        minutes: Number(info?.minutes || 0),
        poster: info?.posterUrl || tmdbPosterUrl(info?.posterPath),
      }));

    const most = stats.mostWatchedTitle
      ? {
          title: stats.mostWatchedTitle.title,
          minutes: Number(stats.mostWatchedTitle.minutes || 0),
          poster:
            stats.mostWatchedTitle.posterUrl ||
            tmdbPosterUrl(stats.mostWatchedTitle.posterPath),
        }
      : null;

    const binged = stats.mostBingedShow || null;
    const bingedPoster =
      binged?.posterUrl ||
      (binged?.posterPath ? tmdbPosterUrl(binged.posterPath) : null);

    const bingedDates = Array.isArray(binged?.dates_binged)
      ? binged.dates_binged
      : [];
    const bingeStart = bingedDates.length ? bingedDates[0] : null;
    const bingeEnd = bingedDates.length
      ? bingedDates[bingedDates.length - 1]
      : null;

    const completedRaw = Array.isArray(stats.showsCompleted)
      ? stats.showsCompleted
      : [];
    const completedCount = Number(completedRaw[0] || 0);
    const completedTitles = completedRaw.slice(1);

    const oldestShow = stats.oldestWatchedShow
      ? {
          title: stats.oldestWatchedShow.title,
          date: stats.oldestWatchedShow.date,
          poster:
            stats.oldestWatchedShow.posterUrl ||
            tmdbPosterUrl(stats.oldestWatchedShow.posterPath),
        }
      : null;

    const oldestMovie = stats.oldestWatchedMovie
      ? {
          title: stats.oldestWatchedMovie.title,
          date: stats.oldestWatchedMovie.date,
          poster:
            stats.oldestWatchedMovie.posterUrl ||
            tmdbPosterUrl(stats.oldestWatchedMovie.posterPath),
        }
      : null;

    return [
      {
        id: "genres",
        title: "Top Genres",
        subtitle: "What you gravitated toward most",
        render: () => (
          <div className="stats-list">
            {topGenres.map((x) => (
              <div key={x.g} className="stats-row">
                <div className="stats-row-left">{x.g}</div>
                <div className="stats-row-right">{x.c}</div>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: "unique",
        title: "Unique Titles Watched",
        subtitle: "Your year in variety",
        render: () => (
          <div className="stats-kpis">
            <div className="kpi">
              <div className="kpi-value">{unique.total}</div>
              <div className="kpi-label">Total</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{unique.tvShows}</div>
              <div className="kpi-label">TV Shows</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{unique.movies}</div>
              <div className="kpi-label">Movies</div>
            </div>
          </div>
        ),
      },
      {
        id: "watchtime",
        title: "Total Watch Time",
        subtitle: "You really put in the hours",
        render: () => (
          <div className="big-metric">
            <div className="big-metric-main">
              {totalMins.toLocaleString()} mins
            </div>
            <div className="big-metric-sub">≈ {minsToHrs(totalMins)}</div>
          </div>
        ),
      },
      {
        id: "top5",
        title: "Top 5 Titles",
        subtitle: "By total watch time",
        render: () => (
          <div className="top5-grid">
            {top5.map((t, i) => (
              <motion.div
                key={t.title}
                className="poster-card"
                style={
                  t.poster ? { backgroundImage: `url(${t.poster})` } : undefined
                }
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, duration: 0.45 }}
              >
                <div className="poster-overlay" />
                <div className="poster-meta">
                  <div className="poster-rank">#{i + 1}</div>
                  <div className="poster-title">{t.title}</div>
                  <div className="poster-sub">
                    {t.minutes.toLocaleString()} mins • {minsToHrs(t.minutes)}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ),
      },
      {
        id: "most",
        title: "You Spent The Most Time Watching",
        subtitle: most ? "Your #1 comfort pick" : "",
        render: () =>
          most ? (
            <div
              className="hero-poster"
              style={
                most.poster
                  ? { backgroundImage: `url(${most.poster})` }
                  : undefined
              }
            >
              <div className="hero-poster-overlay" />
              <div className="hero-poster-meta">
                <div className="hero-poster-title">{most.title}</div>
                <div className="hero-poster-sub">
                  {most.minutes.toLocaleString()} mins •{" "}
                  {minsToHrs(most.minutes)}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-note">No “most watched” title found.</div>
          ),
      },
      {
        id: "binged",
        title: "Most Binged Show",
        subtitle: "A true marathon",
        render: () =>
          binged ? (
            <div className="binged-wrap">
              <div
                className="binged-poster"
                style={
                  bingedPoster
                    ? { backgroundImage: `url(${bingedPoster})` }
                    : undefined
                }
              >
                <div className="poster-overlay" />
              </div>

              <div className="binged-card">
                <div className="binged-title">{binged.title}</div>
                <div className="binged-sub">
                  {Number(binged.eps_binged || 0).toLocaleString()} episodes
                  back-to-back
                </div>
                <div className="binged-sub2">
                  {formatDate(bingeStart)} → {formatDate(bingeEnd)}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-note">No binge streak found.</div>
          ),
      },
      {
        id: "oldest",
        title: "Oldest Watched",
        subtitle: "Throwback picks",
        render: () => (
          <div className="two-col">
            <div
              className="small-poster"
              style={
                oldestShow?.poster
                  ? { backgroundImage: `url(${oldestShow.poster})` }
                  : undefined
              }
            >
              <div className="poster-overlay" />
              <div className="poster-meta">
                <div className="poster-rank">Show</div>
                <div className="poster-title">{oldestShow?.title || "—"}</div>
                <div className="poster-sub">{oldestShow?.date || ""}</div>
              </div>
            </div>

            <div
              className="small-poster"
              style={
                oldestMovie?.poster
                  ? { backgroundImage: `url(${oldestMovie.poster})` }
                  : undefined
              }
            >
              <div className="poster-overlay" />
              <div className="poster-meta">
                <div className="poster-rank">Movie</div>
                <div className="poster-title">{oldestMovie?.title || "—"}</div>
                <div className="poster-sub">{oldestMovie?.date || ""}</div>
              </div>
            </div>

            <div className="completed">
              <div className="completed-head">
                <span className="completed-count">{completedCount}</span>{" "}
                completed
              </div>
              <div className="chips">
                {completedTitles.slice(0, 10).map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ),
      },
    ];
  }, [stats]);

  const total = slides.length;

  const go = (idx) => setPage((p) => clamp(idx, 0, Math.max(0, total - 1)));
  const next = () => setPage((p) => clamp(p + 1, 0, Math.max(0, total - 1)));
  const prev = () => setPage((p) => clamp(p - 1, 0, Math.max(0, total - 1)));

  // ✅ Keyboard nav
  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowRight" ||
        e.key === "PageDown" ||
        e.key === " "
      ) {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      }
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, total]);

  // ✅ Wheel / trackpad: one swipe => one slide
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const THRESH = 140; // increase if still too sensitive
    const COOLDOWN = 650;

    const handler = (e) => {
      if (!total) return;
      e.preventDefault();

      if (wheelCooldown.current) return;

      const delta =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
          ? e.deltaY * window.innerHeight
          : e.deltaY;

      wheelAccum.current += delta;

      if (Math.abs(wheelAccum.current) < THRESH) return;

      if (wheelAccum.current > 0) next();
      else prev();

      wheelAccum.current = 0;
      wheelCooldown.current = true;
      setTimeout(() => {
        wheelCooldown.current = false;
      }, COOLDOWN);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [total]);

  const slide = slides[page];

  return (
    <div className="stats-root" ref={rootRef}>
      <button className="stats-home" onClick={() => navigate("/")}>
        Home
      </button>

      <div className="stats-dots" aria-label="Slide progress">
        {slides.map((s, i) => (
          <button
            key={s.id}
            className={`dot ${i === page ? "dot--active" : ""}`}
            onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      <div className="stats-counter">
        {total ? `${page + 1} / ${total}` : ""}
      </div>

      <div className="stats-stage">
        <AnimatePresence mode="wait">
          {!stats ? (
            <motion.div
              key="loading"
              className="stats-loading"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.35 }}
            >
              {err ? (
                <>
                  <div className="stats-title">Couldn’t load stats</div>
                  <div className="stats-subtitle">{err}</div>
                </>
              ) : (
                <>
                  <div className="stats-title">Building your stats…</div>
                  <div className="stats-subtitle">One second.</div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.section
              key={slide?.id}
              className="stats-slide"
              initial={{ opacity: 0, y: 26, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -26, scale: 0.985 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="stats-head">
                <div className="stats-title">{slide.title}</div>
                {slide.subtitle ? (
                  <div className="stats-subtitle">{slide.subtitle}</div>
                ) : null}
              </div>

              <div className="stats-body">{slide.render()}</div>

              <div className="stats-hint">Scroll / Arrow keys</div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
