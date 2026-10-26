(function () {
  "use strict";
  var staticProfiles = new Set(["ascarza", "colki", "fedou", "ghb", "giobata", "lilmartincho", "lk", "stri"]);
  var socialFields = [
    ["youtubeUrl", "YouTube"], ["spotifyUrl", "Spotify"], ["appleMusicUrl", "Apple Music"],
    ["instagramUrl", "Instagram"], ["tiktokUrl", "TikTok"], ["soundcloudUrl", "SoundCloud"],
    ["soundCloudUrl", "SoundCloud"], ["facebookUrl", "Facebook"], ["bandcampUrl", "Bandcamp"],
    ["deezerUrl", "Deezer"], ["tidalUrl", "TIDAL"], ["amazonMusicUrl", "Amazon Music"],
    ["twitchUrl", "Twitch"], ["threadsUrl", "Threads"], ["xUrl", "X"], ["websiteUrl", "Sitio oficial"]
  ];
  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try { var u = new URL(value.trim()); return u.protocol === "https:" ? u.href : ""; }
    catch (_) { return ""; }
  }
  function loadSoundCloudThumbnail(img, item) {
    var url = safeUrl(item.soundCloudUrl || item.soundcloudUrl || item.externalUrl);
    if (!img || slugOf(item) !== "lk" || !url) return false;
    img.alt = "Miniatura de SoundCloud de LK · ECO Studios";
    img.decoding = "async";
    img.onerror = function () { this.remove(); };
    fetch("https://soundcloud.com/oembed?format=json&url=" + encodeURIComponent(url), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("SoundCloud oEmbed unavailable");
        return response.json();
      })
      .then(function (data) {
        var thumbnail = safeUrl(data && data.thumbnail_url);
        if (!thumbnail) throw new Error("SoundCloud did not return a valid thumbnail");
        if (img.isConnected) img.src = thumbnail;
      })
      .catch(function () {
        if (img && img.isConnected) img.remove();
      });
    return true;
  }
  function createArtistImage(item, imageUrl) {
    var img = document.createElement("img");
    img.alt = "Imagen de " + String(item.name || "artista") + " · ECO Studios";
    img.loading = "lazy";
    if (imageUrl) {
      img.onerror = function () { this.remove(); };
      img.src = imageUrl;
      return img;
    }
    return loadSoundCloudThumbnail(img, item) ? img : null;
  }
  function slugify(value) {
    return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function slugOf(item) { return slugify(item.slug || item.name); }
  function appendText(parent, tag, className, value) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null ? "" : String(value);
    parent.appendChild(node);
    return node;
  }
  function setMeta(selector, attribute, value) {
    var node = document.querySelector(selector);
    if (node && value) node.setAttribute(attribute, value);
  }
  function publishedArtists(payload) {
    return payload.items.filter(function (item) {
      return item && String(item.name || "").trim() && String(item.type || "").toLowerCase() === "artista" &&
        item.status === "Publicado" && item.permissionVerified === true;
    }).sort(function (a, b) { return (Number(a.order) || 9999) - (Number(b.order) || 9999); });
  }
  function platformIcon(label) {
    var common = {
      "YouTube": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M23.5 6.2a3.1 3.1 0 0 0-2.2-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.3.5A3.1 3.1 0 0 0 .5 6.2 32.7 32.7 0 0 0 0 12a32.7 32.7 0 0 0 .5 5.8 3.1 3.1 0 0 0 2.2 2.2c1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5a3.1 3.1 0 0 0 2.2-2.2A32.7 32.7 0 0 0 24 12a32.7 32.7 0 0 0-.5-5.8Z"/><path fill="#0b0b0b" d="m9.6 15.5 6.3-3.5-6.3-3.5v7Z"/></svg>',
      "Spotify": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M5.3 8.8c4.5-1.2 9.7-.7 13.5 1.7M6.2 12.2c3.8-1 8-.5 11.3 1.4m-10.2 2c3-.7 6-.3 8.5 1.1" fill="none" stroke="#0b0b0b" stroke-width="1.65" stroke-linecap="round"/></svg>',
      "Apple Music": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.1 20.2c-.9.9-1.9.8-3 .3-1.1-.5-2.1-.5-3.3 0-1.4.6-2.2.4-3.1-.4C2.7 15.7 3.3 8.6 8.7 8.3c1.3.1 2.2.8 3 .8 1.1-.2 2.2-.9 3.4-.8 1.5.1 2.6.7 3.3 1.7-3 1.8-2.3 5.7.5 6.8-.5 1.4-1.2 2.8-1.8 3.4ZM12 8.2c-.1-2.2 1.6-4 3.6-4.1.3 2.5-2.2 4.4-3.6 4.1Z"/></svg>',
      "Instagram": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.7" cy="6.7" r="1.15" fill="currentColor"/></svg>',
      "TikTok": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M19.6 7.1a6.5 6.5 0 0 1-4.2-1.5v8.1a6.2 6.2 0 1 1-5.4-6.1v3.3a2.9 2.9 0 1 0 2.1 2.8V2.5h3.3a6.2 6.2 0 0 0 4.2 4.6v0Z"/></svg>',
      "SoundCloud": '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M2.2 14.3a.9.9 0 0 1 0-1.8h.5a4.9 4.9 0 0 1 9.6-.7 4.7 4.7 0 0 1 7 3.8 3.5 3.5 0 0 1-.4 7H2.8a.9.9 0 0 1-.6-1.6l-.2-6.7Zm1.3 0v5.8m2-6.3v6.3m2-7.1v7.1m2-8v8m2-7.2v7.2"/></svg>'
    };
    return common[label] || '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 12h8M12 8v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function socialLinks(item, container) {
    var seen = new Set();
    socialFields.forEach(function (field) {
      var url = safeUrl(item[field[0]]);
      if (!url || seen.has(url)) return;
      seen.add(url);
      var a = document.createElement("a");
      a.className = "social";
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      var iconClass = "social-" + field[1].toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.classList.add(iconClass);
      a.setAttribute("aria-label", field[1] + " oficial de " + String(item.name || "artista"));
      a.title = field[1] + " oficial de " + String(item.name || "artista");
      a.innerHTML = platformIcon(field[1]) + "<span>" + field[1] + "</span>";
      container.appendChild(a);
    });
    var external = safeUrl(item.externalUrl);
    if (external && !seen.has(external)) {
      var a = document.createElement("a");
      a.className = "social social-website";
      a.href = external;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", "Enlace principal de " + String(item.name || "artista"));
      a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Enlace principal</span>';
      container.appendChild(a);
    }
  }
  function addStyles() {
    var style = document.createElement("style");
    style.textContent = [
      ".dynamic-artist-profile{margin-top:30px;border-top:1px solid var(--line,rgba(255,255,255,.15));padding-top:28px}",
      ".dynamic-artist-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,36%);gap:clamp(24px,5vw,60px);align-items:start}",
      ".dynamic-artist-hero img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px;background:#20201d}",
      ".dynamic-artist-copy h1{margin:12px 0 20px;font-size:clamp(40px,7vw,76px)}",
      ".dynamic-artist-copy p{max-width:680px;color:var(--muted,#aaa);line-height:1.85;white-space:pre-line}",
      ".dynamic-artist-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}",
      ".dynamic-artist-links .social-instagram{display:inline-flex;align-items:center;gap:7px}",
      ".dynamic-artist-links .social-instagram svg{display:block;flex:none}",
      ".dynamic-artist-links .social{display:inline-flex;align-items:center;gap:10px}",
      ".dynamic-artist-links .social svg{display:block;width:22px;height:22px;flex:none}",
      ".dynamic-artist-links .social-youtube svg{color:#ff4545}",
      ".dynamic-artist-links .social-spotify svg{color:#1ed760}",
      ".dynamic-artist-links .social-apple-music svg{color:#f5f2eb}",
      ".dynamic-artist-links .social-instagram svg{color:#d9c9b5}",
      ".dynamic-artist-player{margin-top:36px}",
      ".dynamic-artist-player iframe{width:100%;aspect-ratio:16/9;min-height:220px;border:0;border-radius:10px;background:#080808}",
      ".dynamic-artist-back{display:inline-block;margin-top:30px;color:var(--orange,#ff6a2b);text-decoration:none}",
      "@media(max-width:640px){.dynamic-artist-hero{grid-template-columns:1fr}.dynamic-artist-hero img{max-width:300px;aspect-ratio:1}.dynamic-artist-player iframe{min-height:190px}}"
    ].join("");
    document.head.appendChild(style);
  }
  function updateMetadata(item, canonical) {
    var name = String(item.name || "Artista ECO Studios");
    var description = String(item.description || "Perfil oficial de " + name + " en ECO Studios.").slice(0, 300);
    var image = safeUrl(item.imageUrl);
    document.title = name + " — ECO Studios";
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", name + " — ECO Studios");
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonical);
    setMeta('meta[property="og:image"]', "content", image);
    setMeta('meta[name="twitter:title"]', "content", name + " — ECO Studios");
    setMeta('meta[name="twitter:description"]', "content", description);
    setMeta('meta[name="twitter:image"]', "content", image);
    var canonicalTag = document.querySelector('link[rel="canonical"]');
    if (canonicalTag) canonicalTag.href = canonical;
  }
  function renderDetail(item) {
    var main = document.querySelector("main.artist-directory");
    if (!main) return;
    addStyles();
    var slug = slugOf(item);
    var canonical = window.location.origin + window.location.pathname + "?artist=" + encodeURIComponent(slug);
    main.replaceChildren();
    main.classList.add("dynamic-artist-profile");
    appendText(main, "div", "eyebrow", "ROSTER · ECO STUDIOS");
    var hero = document.createElement("section");
    hero.className = "dynamic-artist-hero";
    var copy = document.createElement("div");
    copy.className = "dynamic-artist-copy";
    appendText(copy, "div", "eyebrow", "ARTISTA · ECO STUDIOS");
    appendText(copy, "h1", "", item.name);
    appendText(copy, "p", "", item.description || "Perfil oficial de este artista de ECO Studios.");
    var links = document.createElement("div");
    links.className = "dynamic-artist-links";
    socialLinks(item, links);
    copy.appendChild(links);
    var imageUrl = safeUrl(item.imageUrl);
    var portrait = createArtistImage(item, imageUrl);
    if (portrait) {
      portrait.loading = "eager";
      hero.append(copy, portrait);
    } else hero.appendChild(copy);
    main.appendChild(hero);
    var playlist = String(item.youtubeUploadsPlaylistId || "");
    if (/^UU[A-Za-z0-9_-]{22}$/.test(playlist)) {
      var player = document.createElement("section");
      player.className = "dynamic-artist-player";
      appendText(player, "div", "eyebrow", "ESCUCHA A " + String(item.name).toUpperCase());
      var frame = document.createElement("iframe");
      frame.title = "Videos del canal oficial de " + item.name;
      frame.loading = "lazy";
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.src = "https://www.youtube-nocookie.com/embed/videoseries?list=" + encodeURIComponent(playlist) + "&rel=0&playsinline=1";
      player.appendChild(frame); main.appendChild(player);
    }
    var soundcloudUrl = safeUrl(item.soundCloudUrl || item.soundcloudUrl || (slug === "lk" ? item.externalUrl : ""));
    if (slug === "lk" && soundcloudUrl) {
      var parsedSoundCloud;
      try { parsedSoundCloud = new URL(soundcloudUrl); } catch (_) { parsedSoundCloud = null; }
      if (parsedSoundCloud && (parsedSoundCloud.hostname === "soundcloud.com" || parsedSoundCloud.hostname === "on.soundcloud.com" || parsedSoundCloud.hostname.endsWith(".soundcloud.com"))) {
        var soundcloudPlayer = document.createElement("section");
        soundcloudPlayer.className = "dynamic-artist-player";
        appendText(soundcloudPlayer, "div", "eyebrow", "ESCUCHÁ A LK EN SOUNDCLOUD");
        var soundcloudFrame = document.createElement("iframe");
        soundcloudFrame.title = "Reproductor oficial de SoundCloud de LK";
        soundcloudFrame.loading = "lazy";
        soundcloudFrame.allow = "autoplay";
        soundcloudFrame.scrolling = "no";
        soundcloudFrame.referrerPolicy = "strict-origin-when-cross-origin";
        soundcloudFrame.src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(soundcloudUrl) + "&color=%23ff6a2b&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=true&visual=true";
        soundcloudPlayer.appendChild(soundcloudFrame);
        main.appendChild(soundcloudPlayer);
      }
    }
    var back = document.createElement("a");
    back.className = "dynamic-artist-back"; back.href = "./"; back.textContent = "← Volver al directorio de artistas";
    main.appendChild(back);
    updateMetadata(item, canonical);
  }
  function renderDirectory(items) {
    var grid = document.querySelector(".directory-grid");
    if (!grid) return;
    grid.replaceChildren();
    items.forEach(function (item) {
      var slug = slugOf(item);
      var card = document.createElement("a");
      card.className = "directory-card";
      card.href = staticProfiles.has(slug) ? slug + "/" : "?artist=" + encodeURIComponent(slug);
      var imageUrl = safeUrl(item.imageUrl);
      var portrait = createArtistImage(item, imageUrl);
      if (portrait) {
        if (slug === "lk") portrait.id = "lk-directory-portrait";
        card.appendChild(portrait);
      } else appendText(card, "div", "directory-placeholder", slug === "lk" ? "LK · SOUNDCLOUD" : "");
      var copy = document.createElement("div"); copy.className = "copy";
      appendText(copy, "small", "", String(item.type || "ARTISTA").toUpperCase());
      var arrow = document.createElement("span"); arrow.className = "arrow"; arrow.setAttribute("aria-hidden", "true"); arrow.innerHTML = '<svg viewBox="0 0 24 24" fill="none" focusable="false"><path d="M7 17 17 7M8 7h9v9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'; copy.appendChild(arrow);
      appendText(copy, "h2", "", item.name);
      appendText(copy, "p", "", item.description || "");
      card.appendChild(copy); grid.appendChild(card);
    });
  }
  function showError() {
    var main = document.querySelector("main.artist-directory");
    if (!main) return;
    main.replaceChildren();
    appendText(main, "div", "eyebrow", "ECO STUDIOS");
    appendText(main, "h1", "", "Perfil no disponible");
    appendText(main, "p", "", "Este perfil no está publicado o no tiene permisos verificados.");
    var back = document.createElement("a");
    back.className = "dynamic-artist-back"; back.href = "./"; back.textContent = "← Volver al directorio de artistas";
    main.appendChild(back);
  }
  fetch("../data/eco-content.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("Editorial JSON unavailable (" + response.status + ")");
      return response.json();
    })
    .then(function (payload) {
      if (!payload || !Array.isArray(payload.items)) throw new Error("Invalid editorial JSON");
      var items = publishedArtists(payload);
      var requestedSlug = new URLSearchParams(window.location.search).get("artist");
      if (requestedSlug) {
        var item = items.find(function (candidate) { return slugOf(candidate) === slugify(requestedSlug); });
        if (item) renderDetail(item); else showError();
      } else renderDirectory(items);
    })
    .catch(function (error) {
      // Retain the last-known static directory if the data feed is temporarily unavailable.
      console.warn("ECO directory sync skipped; using static fallback.", error);
    });
})();
