(function () {
  "use strict";
  var socialFields = [
    ["youtubeUrl", "YouTube"], ["spotifyUrl", "Spotify"], ["appleMusicUrl", "Apple Music"],
    ["instagramUrl", "Instagram"], ["tiktokUrl", "TikTok"], ["soundcloudUrl", "SoundCloud"],
    ["soundCloudUrl", "SoundCloud"], ["facebookUrl", "Facebook"], ["bandcampUrl", "Bandcamp"],
    ["deezerUrl", "Deezer"], ["tidalUrl", "TIDAL"], ["amazonMusicUrl", "Amazon Music"],
    ["twitchUrl", "Twitch"], ["threadsUrl", "Threads"], ["xUrl", "X"], ["websiteUrl", "Sitio oficial"]
  ];
  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try { var url = new URL(value.trim()); return url.protocol === "https:" ? url.href : ""; }
    catch (_) { return ""; }
  }
  function setMeta(selector, attribute, value) {
    var node = document.querySelector(selector);
    if (node && value) node.setAttribute(attribute, value);
  }
  function slugFromPath() {
    var parts = window.location.pathname.split("/").filter(Boolean);
    return (parts[parts.length - 1] || "").toLowerCase();
  }
  function hideUnpublishedProfile() {
    var shell = document.querySelector("main");
    if (!shell) return;
    shell.replaceChildren();
    var notice = document.createElement("section");
    notice.className = "artist-shell";
    var h = document.createElement("h1");
    h.textContent = "Perfil no disponible";
    var p = document.createElement("p");
    p.textContent = "Este perfil no está publicado actualmente en ECO Studios.";
    var a = document.createElement("a");
    a.className = "social";
    a.href = "../../artistas/";
    a.textContent = "Volver al directorio de artistas";
    notice.append(h, p, a);
    shell.appendChild(notice);
  }
  function syncProfile(item) {
    var name = String(item.name || "");
    var heading = document.querySelector(".hero h1");
    if (heading && name) heading.textContent = name;
    var bio = document.querySelector(".hero .bio") || document.querySelector(".bio");
    if (bio && typeof item.description === "string") bio.textContent = item.description;
    var portrait = document.querySelector(".hero .portrait") || document.querySelector(".portrait");
    var imageUrl = safeUrl(item.imageUrl);
    if (portrait && imageUrl) {
      portrait.src = imageUrl;
      portrait.alt = "Imagen de " + name + " · ECO Studios";
    }
    var container = document.querySelector(".hero .socials") || document.querySelector(".socials");
    if (container) {
      var links = [];
      var seen = new Set();
      socialFields.forEach(function (field) {
        var url = safeUrl(item[field[0]]);
        if (!url || seen.has(url)) return;
        seen.add(url);
        links.push({ label: field[1], url: url });
      });
      var external = safeUrl(item.externalUrl);
      if (external && !seen.has(external)) {
        links.push({ label: "Enlace principal", url: external });
      }
      if (links.length) {
        container.replaceChildren();
        links.forEach(function (entry) {
          var a = document.createElement("a");
          a.className = "social";
          a.href = entry.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = entry.label + " ↗";
          a.setAttribute("aria-label", entry.label + " oficial de " + name);
          container.appendChild(a);
        });
      }
    }
    document.title = name + " — ECO Studios";
    var description = String(item.description || "Perfil oficial de " + name + " en ECO Studios.").slice(0, 300);
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", name + " — ECO Studios");
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:image"]', "content", imageUrl);
    setMeta('meta[name="twitter:title"]', "content", name + " — ECO Studios");
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta('meta[name="twitter:image"]', "content", imageUrl);
  }

  var slug = slugFromPath();
  fetch("../../data/eco-content.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Editorial JSON is unavailable (" + response.status + ")");
      return response.json();
    })
    .then(function (payload) {
      if (!payload || !Array.isArray(payload.items)) throw new Error("Invalid editorial JSON");
      var item = payload.items.find(function (record) {
        return record && String(record.slug || "").toLowerCase() === slug &&
          String(record.type || "").toLowerCase() === "artista" &&
          record.status === "Publicado" && record.permissionVerified === true;
      });
      if (item) syncProfile(item);
      else hideUnpublishedProfile();
    })
    .catch(function (error) {
      // If the feed is temporarily unavailable, keep the last known static page visible.
      console.warn("ECO profile sync skipped; using static fallback.", error);
    });
})();
