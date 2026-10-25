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
      socialStyle.textContent = ".socials a.social-instagram{display:inline-flex;align-items:center;gap:7px}.socials a.social-instagram svg{display:block;flex:none}.socials a.social-instagram:hover{color:#ff9bcb}";
      document.head.appendChild(socialStyle);
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
          if (entry.label === "Instagram") {
            a.classList.add("social-instagram");
            a.setAttribute("aria-label", "Instagram oficial de " + name);
            a.title = "Instagram oficial de " + name;
            a.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg><span>Instagram ↗</span>';
          } else {
            a.textContent = entry.label + " ↗";
            a.setAttribute("aria-label", entry.label + " oficial de " + name);
          }
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
