// Designmatazz — fetch live posts from Tumblr via JSONP
// No API key needed. Endpoint: /api/read/json returns a JSONP callback
// (tumblr_api_read) that populates window.tumblr_api_read.
//
// Falls back to a cached seed if the request fails (e.g. offline preview).

(function () {
  const BLOG = "designmatazz.tumblr.com";
  const BATCH = 20; // posts per request
  const MAX = 9999; // fetch everything — infinite scroll handles pacing

  // Minimal seed used as fallback so the page still renders something if
  // the Tumblr API is unreachable (CORS / offline / rate limit).
  window.DM_POSTS = window.DM_POSTS || [];
  window.DM_SEED = [
    { date: "17 December 2025", name: "Eddie Mandell", url: "https://eddiemandell.com/",
      images: [
        "https://64.media.tumblr.com/37253cb2ad1077dab6ca89fbfa103628/6b887a496ae24713-95/s500x750/069d10350210287d311601a7c0c5a0b70ac775c1.jpg",
        "https://64.media.tumblr.com/15788bba02cedb5aa7390d0e4dc78d7f/6b887a496ae24713-08/s500x750/38954338f9a53253c140ba073d7aacb36e669796.jpg",
        "https://64.media.tumblr.com/192c713d52a159846d81f6bd1e74ca58/6b887a496ae24713-1e/s500x750/55e145670604c380825802bd1f11729f6ec1b4d9.jpg",
        "https://64.media.tumblr.com/9285502e0aacf46d655db364bd124b1c/6b887a496ae24713-92/s500x750/4a3132b5a352f4a2d255cc9f442aea5519ced987.png",
      ]},
  ];

  // Parse Tumblr's JSONP response into our normalised post shape.
  function normalise(raw) {
    const out = [];
    for (const p of raw.posts || []) {
      // Only photo posts (the blog is a photo feed).
      if (p.type !== "photo") continue;

      // Gather every photo in the post.
      const images = [];
      if (p["photo-url-1280"] || p["photo-url-500"]) {
        // If it's a photoset, photos[] has each one; otherwise one photo.
        if (p.photos && p.photos.length) {
          for (const ph of p.photos) {
            images.push(ph["photo-url-1280"] || ph["photo-url-500"] || ph["photo-url-400"] || ph["photo-url-250"]);
          }
        } else {
          images.push(p["photo-url-1280"] || p["photo-url-500"]);
        }
      }
      if (!images.length) continue;

      // Pull a human title + outbound URL.
      // Designmatazz convention: caption is <p><a href="studio-url">Studio Name</a></p>
      const caption = p["photo-caption"] || "";
      const m = caption.match(/href=["']([^"']+)["'][^>]*>([^<]+)</i);
      const url  = m ? m[1] : p["url-with-slug"] || p.url;
      const name = m ? m[2].trim() : (p.slug || "Untitled").replace(/-/g, " ");

      // Format the date like "17 December 2025".
      const d = new Date(p["date-gmt"] || p.date);
      const date = isNaN(d) ? (p.date || "") :
        d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      out.push({ date, name, url, images });
    }
    return out;
  }

  // JSONP loader — Tumblr serves /api/read/json as JSONP (no CORS).
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      let done = false;
      const prev = window.tumblr_api_read;
      window.tumblr_api_read = function (data) {
        done = true;
        window.tumblr_api_read = prev;
        s.remove();
        resolve(data);
      };
      s.onerror = () => { if (!done) { s.remove(); reject(new Error("jsonp fail")); } };
      s.src = url;
      document.head.appendChild(s);
      setTimeout(() => { if (!done) { s.remove(); reject(new Error("jsonp timeout")); } }, 10000);
    });
  }

  async function fetchAll() {
    const all = [];
    for (let start = 0; start < MAX; start += BATCH) {
      const url = `https://${BLOG}/api/read/json?num=${BATCH}&start=${start}&type=photo`;
      let data;
      try { data = await jsonp(url); }
      catch { break; }
      const batch = normalise(data);
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < BATCH) break;
    }
    return all;
  }

  // Expose a promise that index.html awaits.
  window.DM_POSTS_READY = (async () => {
    try {
      const posts = await fetchAll();
      if (posts.length) { window.DM_POSTS = posts; return posts; }
    } catch (e) { /* fall through */ }
    window.DM_POSTS = window.DM_SEED;
    return window.DM_SEED;
  })();
})();
