// Designmatazz — fetch live posts from Tumblr via v2 API
// Uses an OAuth consumer key (public, safe to expose in frontend).
// Get yours free at https://www.tumblr.com/oauth/apps
// Docs: https://www.tumblr.com/docs/en/api/v2

(function () {
  const BLOG = "designmatazz.tumblr.com";
  const API_KEY = "FeqLJGRSAnSWxvyhyLYX3JDW3hJPwRdLucaHVHJ2e8X8Syxg7s"; // public key, replace with your own
  const BATCH = 20;        // posts per request (max 20 for v2)
  const MAX_POSTS = 500;   // hard cap

  window.DM_POSTS = window.DM_POSTS || [];
  window.DM_SEED = [
    { date: "17 December 2025", name: "Eddie Mandell", url: "https://eddiemandell.com/",
      images: [
        "https://64.media.tumblr.com/37253cb2ad1077dab6ca89fbfa103628/6b887a496ae24713-95/s500x750/069d10350210287d311601a7c0c5a0b70ac775c1.jpg"
      ]},
  ];

  // Parse Tumblr v2 post into our shape.
  function normaliseV2(p) {
    if (p.type !== "photo") return null;
    const images = (p.photos || []).map(ph => {
      const alts = ph.alt_sizes || [];
      // Pick the first size >= 1280 if available, else the largest.
      const big = alts.find(s => s.width >= 1280) || alts[0];
      return big ? big.url : ph.original_size?.url;
    }).filter(Boolean);
    if (!images.length) return null;

    const caption = p.caption || "";
    const m = caption.match(/href=["']([^"']+)["'][^>]*>([^<]+)</i);
    const url  = m ? m[1] : p.post_url;
    const name = m ? m[2].trim() : (p.slug || "Untitled").replace(/-/g, " ");

    const d = new Date(p.date || p.timestamp * 1000);
    const date = isNaN(d) ? "" :
      d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const year = isNaN(d) ? null : d.getFullYear();

    return { date, year, name, url, images };
  }

  async function fetchBatch(offset) {
    const url = `https://api.tumblr.com/v2/blog/${BLOG}/posts/photo?api_key=${API_KEY}&limit=${BATCH}&offset=${offset}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data?.response?.posts || [];
  }

  async function fetchAll() {
    const all = [];
    for (let offset = 0; offset < MAX_POSTS; offset += BATCH) {
      let raw;
      try { raw = await fetchBatch(offset); }
      catch (e) { console.warn("Tumblr batch failed at", offset, e); break; }
      if (!raw.length) break;
      for (const p of raw) {
        const n = normaliseV2(p);
        if (n) all.push(n);
      }
      if (raw.length < BATCH) break;
    }
    return all;
  }

  // Expose a promise that index.html awaits.
  window.DM_POSTS_READY = (async () => {
    try {
      const posts = await fetchAll();
      if (posts.length) { window.DM_POSTS = posts; return posts; }
    } catch (e) { console.warn("Tumblr API failed:", e); }
    window.DM_POSTS = window.DM_SEED;
    return window.DM_SEED;
  })();
})();
