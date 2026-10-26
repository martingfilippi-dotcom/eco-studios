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
    var soundcloudUrl = safeUrl(item.soundCloudUrl || item.soundcloudUrl || item.externalUrl);
    if (imageUrl) {
      if (!portrait) {
        var imageHero = document.querySelector(".hero");
        if (imageHero) {
          portrait = document.createElement("img");
          portrait.className = "portrait";
          imageHero.appendChild(portrait);
        }
      }
      if (portrait) {
        var originalPortraitSrc = portrait.getAttribute("src") || "";
        var fallbackPortraitUrl = "";
        try {
          var fallbackCandidate = new URL(originalPortraitSrc, window.location.href);
          if (fallbackCandidate.protocol === "https:" || fallbackCandidate.origin === window.location.origin) {
            fallbackPortraitUrl = fallbackCandidate.href;
          }
        } catch (_) {}
        portrait.alt = "Imagen de " + name + " · ECO Studios";
        portrait.onerror = function () {
          this.onerror = null;
          var fallback = fallbackPortraitUrl;
          if (fallback && fallback !== imageUrl) {
            this.src = fallback;
          } else {
            // Preserve the portrait frame and its layout when even the fallback is unavailable.
            this.removeAttribute("src");
            this.classList.add("portrait-unavailable");
          }
        };
        portrait.src = imageUrl;
      }
    } else if (String(item.slug || "").toLowerCase() === "lk" && soundcloudUrl) {
      var hero = document.querySelector(".hero");
      if (hero) {
        if (!portrait) {
          portrait = document.createElement("img");
          portrait.className = "portrait";
          hero.appendChild(portrait);
        }
        portrait.classList.add("soundcloud-portrait-loading");
        portrait.alt = "Miniatura oficial de SoundCloud de LK";
        portrait.loading = "eager";
        portrait.decoding = "async";
        portrait.onerror = function () { this.remove(); };
        fetch("https://soundcloud.com/oembed?format=json&url=" + encodeURIComponent(soundcloudUrl), { cache: "no-store" })
          .then(function (response) {
            if (!response.ok) throw new Error("SoundCloud oEmbed unavailable");
            return response.json();
          })
          .then(function (data) {
            var thumbnail = safeUrl(data && data.thumbnail_url);
            if (!thumbnail) throw new Error("SoundCloud did not return a valid thumbnail");
            if (portrait && portrait.isConnected) portrait.src = thumbnail;
          })
          .catch(function () { if (portrait && portrait.isConnected) portrait.remove(); });
      }
    } else if (portrait) {
      // Keep the curated static portrait when the approved Notion record has no valid image URL.
      // Missing editorial data must not erase a working page fallback.
    }
    var socialStyle = document.getElementById("eco-social-icon-style");
    if (!socialStyle) {
      socialStyle = document.createElement("style");
      socialStyle.id = "eco-social-icon-style";
      socialStyle.textContent = ".socials a.social{display:inline-flex;align-items:center;gap:10px}.socials a.social svg{display:block;width:22px;height:22px;flex:none}.socials a.social-youtube svg{color:#ff4545}.socials a.social-spotify svg{color:#1ed760}.socials a.social-apple-music svg{color:#f5f2eb}.socials a.social-instagram svg{color:#e7a4c3}.socials a.social-tiktok svg{color:#f5f2eb}.socials a.social-soundcloud svg{color:#D9C9B5}.socials a.social:hover{border-color:var(--eco-sand,#d9c9b5);background:rgba(217,201,181,.07)}";
      document.head.appendChild(socialStyle);
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
          var iconClass = "social-" + entry.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          a.classList.add(iconClass);
          a.setAttribute("aria-label", entry.label + " oficial de " + name);
          a.title = entry.label + " oficial de " + name;
          a.innerHTML = platformIcon(entry.label) + "<span>" + entry.label + "</span>";
          container.appendChild(a);
        });
      }
    }
    document.title = name + " — ECO Studios";
    var description = String(item.description || "Perfil oficial de " + name + " en ECO Studios.").slice(0, 300);
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:title"]', "content", name + " — ECO Studios");
    setMeta('meta[property="og:description"]', "content", description);
    if (imageUrl) {
      setMeta('meta[property="og:image"]', "content", imageUrl);
      setMeta('meta[name="twitter:image"]', "content", imageUrl);
    } else {
      var ogImage = document.querySelector('meta[property="og:image"]');
      var twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (ogImage) ogImage.remove();
      if (twitterImage) twitterImage.remove();
    }
    setMeta('meta[name="twitter:title"]', "content", name + " — ECO Studios");
    setMeta('meta[name="twitter:description"]', "content", description);
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
