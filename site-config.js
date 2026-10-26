(function(){
  'use strict';
  var configScript = document.currentScript && document.currentScript.src;
  var configUrl = new URL('data/eco-site-config.json', configScript || window.location.href);
  configUrl.searchParams.set('v', '20261026-cream-sand-icons-v7');
  configUrl = configUrl.href;
  var SITE_HOST = 'martingfilippi-dotcom.github.io';
  var ALLOWED_LINK_HOSTS = new Set([
    SITE_HOST, 'music.apple.com', 'www.youtube.com', 'youtube.com', 'youtu.be',
    'soundcloud.com', 'www.soundcloud.com', 'instagram.com', 'www.instagram.com',
    'wa.me', 'open.spotify.com', 'spotify.com', 'www.tiktok.com', 'tiktok.com'
  ]);

  function safeHref(value, fallback){
    if(typeof value !== 'string' || !value.trim()) return fallback;
    var candidate=value.trim();
    if(/^#[A-Za-z][A-Za-z0-9_-]*$/.test(candidate)) return candidate;
    try {
      var u=new URL(candidate, window.location.href);
      var host=(u.hostname||'').toLowerCase();
      return u.protocol==='https:' && ALLOWED_LINK_HOSTS.has(host) &&
        !u.username && !u.password && !u.port ? u.href : fallback;
    } catch(e){ return fallback; }
  }

  function safeAsset(value){
    if(typeof value !== 'string' || !value.trim()) return '';
    try {
      var u=new URL(value.trim(), window.location.href);
      return u.protocol==='https:' && u.hostname===SITE_HOST &&
        !u.username && !u.password && !u.port ? u.href : '';
    } catch(e){ return ''; }
  }

  function safeColor(value){
    if(typeof value !== 'string') return null;
    var v=value.trim();
    if(/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
    if(/^rgba?\(\s*[0-9.,%\s]+\)$/.test(v)) return v;
    return null;
  }

  function setText(node, value){
    if(node && typeof value==='string' && value.trim()) node.textContent=value;
  }

  function setVisibility(selector, visible){
    var node=document.querySelector(selector);
    if(!node || typeof visible !== 'boolean') return;
    node.hidden=!visible;
    node.style.display=visible?'':'none';
  }

  function setHeading(node, first, second){
    if(!node) return;
    var line1=typeof first==='string'&&first.trim()?first:null;
    var line2=typeof second==='string'&&second.trim()?second:null;
    if(!line1 && !line2) return;
    node.replaceChildren();
    node.appendChild(document.createTextNode(line1||''));
    if(line2){
      node.appendChild(document.createElement('br'));
      var span=document.createElement('span');
      span.textContent=line2;
      node.appendChild(span);
    }
  }

  function setKicker(selector, cfg){
    var node=document.querySelector(selector);
    if(!node || !cfg) return;
    var parts=node.querySelectorAll(':scope > span');
    setText(parts[0],cfg.eyebrow);
    setText(parts[1],cfg.kicker);
  }

  function setDescriptionWithLink(selector, description, label, href, fallbackHref){
    var node=document.querySelector(selector);
    if(!node) return;
    var link=node.querySelector('a');
    if(!link){
      link=document.createElement('a');
      link.className='text-link';
    }
    node.replaceChildren(document.createTextNode(description||''));
    node.appendChild(document.createElement('br'));
    setText(link,label);
    link.href=safeHref(href,fallbackHref);
    node.appendChild(link);
  }

  function apply(cfg){
    if(!cfg || cfg.schemaVersion!==1) return;
    var root=document.documentElement.style;
    var colors=cfg.colors||{}, fonts=cfg.fonts||{}, brand=cfg.brand||{}, hero=cfg.hero||{};
    var nav=cfg.navigation||{}, visibility=cfg.visibility||{};

    [
      ['--bg',colors.bg],['--panel',colors.panel],['--panel-2',colors.panel2],
      ['--text',colors.text],['--muted',colors.muted],['--line',colors.line],
      ['--orange',colors.orange],['--orange-2',colors.orange2],
      ['--eco-earth',colors.earth],['--eco-sand',colors.sand],['--eco-grey',colors.grey],['--eco-red',colors.red]
    ].forEach(function(pair){
      var safe=safeColor(pair[1]);
      if(safe) root.setProperty(pair[0],safe);
    });

    function fontName(value){
      return ['DM Sans','Inter','Manrope','Space Grotesk'].indexOf(value)>=0?value:null;
    }
    var body=fontName(fonts.body), heading=fontName(fonts.heading);
    if(body) root.setProperty('--font-body','"'+body+'",Arial,sans-serif');
    if(heading) root.setProperty('--font-heading','"'+heading+'",Arial,sans-serif');
    if(body) document.body.style.fontFamily='var(--font-body)';
    if(heading) document.querySelectorAll('h1,h2,h3,h4,.brand-words,.brand-mark').forEach(function(n){n.style.fontFamily='var(--font-heading)';});
    if(body && heading){
      var families=Array.from(new Set([body,heading])).map(function(name){
        return 'family='+encodeURIComponent(name).replace(/%20/g,'+')+':wght@400;500;600;700';
      }).join('&');
      var fontLink=document.getElementById('eco-dynamic-fonts');
      if(!fontLink){fontLink=document.createElement('link');fontLink.id='eco-dynamic-fonts';fontLink.rel='stylesheet';document.head.appendChild(fontLink);}
      fontLink.href='https://fonts.googleapis.com/css2?'+families+'&display=swap';
    }

    setText(document.querySelector('.brand-words'),brand.name||'ECO');
    var brandWords=document.querySelector('.brand-words');
    if(brandWords){
      var sub=brandWords.querySelector('span');
      if(!sub){sub=document.createElement('span');brandWords.appendChild(sub);}
      setText(sub,brand.subtitle||'STUDIOS');
    }
    setText(document.querySelector('.brand-mark'),brand.mark||'E');
    var meta=document.querySelector('meta[name="description"]');
    if(meta&&brand.seoDescription) meta.setAttribute('content',brand.seoDescription);

    var eyebrow=document.querySelector('.hero-copy .eyebrow');
    if(eyebrow&&hero.eyebrow){
      var pulse=eyebrow.querySelector('.pulse');
      eyebrow.textContent=hero.eyebrow;
      if(pulse) eyebrow.prepend(pulse);
    }
    setHeading(document.querySelector('.hero-copy h1'),hero.titleLine1,hero.titleLine2);
    setText(document.querySelector('.hero-lede'),hero.description);

    var primary=document.querySelector('.hero-actions .button-orange');
    if(primary){
      primary.replaceChildren(document.createTextNode(hero.primaryLabel||'Conocé el colectivo '));
      var arrow=document.createElement('span');arrow.textContent='↘';primary.appendChild(arrow);
      primary.href=safeHref(hero.primaryUrl,'#artistas');
    }
    var secondary=document.querySelector('.hero-actions .text-link');
    if(secondary){
      secondary.replaceChildren(document.createTextNode(hero.secondaryLabel||'Escuchar música '));
      var arrow2=document.createElement('span');arrow2.textContent='↗';secondary.appendChild(arrow2);
      secondary.href=safeHref(hero.secondaryUrl,'#musica');
    }
    var heroImage=safeAsset(hero.imageUrl);
    var heroImg=document.querySelector('.hero-art > img');
    if(heroImage&&heroImg) heroImg.src=heroImage;

    var sectionMap=[
      ['history','#historia'],['artists','#artistas'],['music','#musica'],
      ['audiovisual','#audiovisual'],['news','#contenido-eco'],['team','#equipo'],['contact','#contacto']
    ];
    sectionMap.forEach(function(pair){setVisibility(pair[1],visibility[pair[0]]);});

    var navMap=[
      ['project','a[href="#historia"]','history'],
      ['artists','a[href="#artistas"]','artists'],
      ['music','a[href="#musica"]','music'],
      ['audiovisual','a[href="#audiovisual"]','audiovisual'],
      ['contact','a[href="#contacto"]','contact']
    ];
    navMap.forEach(function(pair){
      var node=document.querySelector('.main-nav '+pair[1]), item=nav[pair[0]];
      if(!node||!item) return;
      setText(node,item.label||node.textContent);
      node.href=safeHref(item.href,node.getAttribute('href'));
      var visible=item.visible!==false && visibility[pair[2]]!==false;
      node.hidden=!visible;
      node.style.display=visible?'':'none';
    });
    setText(document.querySelector('.menu-toggle b'),nav.mobileLabel||'Menú');

    var history=cfg.history||{};
    setKicker('#historia .section-kicker',history);
    setHeading(document.querySelector('#historia h2'),history.titleLine1,history.titleLine2);
    var historyParas=document.querySelectorAll('#historia .intro-body > p');
    setText(historyParas[0],history.body1);
    setText(historyParas[1],history.body2);
    setText(historyParas[2],history.origin);
    setText(document.querySelector('#historia .intro-body > a'),history.teamLink);
    setText(document.querySelectorAll('#historia .value-strip span')[0],history.values&&history.values[0]);
    setText(document.querySelectorAll('#historia .value-strip span')[1],history.values&&history.values[1]);
    setText(document.querySelectorAll('#historia .value-strip span')[2],history.values&&history.values[2]);
    setText(document.querySelectorAll('#historia .value-strip span')[3],history.values&&history.values[3]);

    var artists=cfg.artists||{};
    setKicker('#artistas .section-kicker',artists);
    setHeading(document.querySelector('#artistas .section-heading h2'),artists.titleLine1,artists.titleLine2);
    setDescriptionWithLink('#artistas .section-heading > p',artists.description,artists.directoryLabel,'artistas/','artistas/');

    var music=cfg.music||{};
    setKicker('#musica .section-kicker',music);
    setHeading(document.querySelector('#musica .section-heading h2'),music.titleLine1,music.titleLine2);
    setText(document.querySelector('#musica .section-heading > p'),music.description);
    setText(document.querySelector('.music-note p'),music.note);
    var noteLink=document.querySelector('.music-note .text-link');
    if(noteLink) noteLink.href=safeHref(music.noteUrl,'https://music.apple.com/us/album/eco-live-at-black-mango-live/1822286569');

    var audiovisual=cfg.audiovisual||{};
    setKicker('#audiovisual .section-kicker',audiovisual);
    setText(document.querySelector('.ov-intro .ov-eyebrow'),audiovisual.topline);
    setHeading(document.querySelector('.ov-intro h2'),audiovisual.titleLine1,audiovisual.titleLine2);
    setText(document.querySelector('.ov-intro p.large-copy'),audiovisual.lead);
    var avParas=document.querySelectorAll('.ov-intro > p:not(.ov-eyebrow)');
    if(avParas.length>1) setText(avParas[1],audiovisual.description);
    var avButton=document.querySelector('.ov-actions .ov-cta');
    if(avButton){
      var buttonArrow=avButton.querySelector('span[aria-hidden="true"]');
      var avButtonLabel=(audiovisual.buttonLabel||'Consultar un proyecto por WhatsApp').replace(/\s*[↗↘→]+$/u,'').trim();
      avButton.replaceChildren(document.createTextNode(avButtonLabel+' '));
      if(buttonArrow) avButton.appendChild(buttonArrow);
      else {var newArrow=document.createElement('span');newArrow.setAttribute('aria-hidden','true');newArrow.textContent='↗';avButton.appendChild(newArrow);}
      avButton.href=safeHref(audiovisual.buttonUrl,'https://wa.me/595972861717');
    }
    var instagramLink=document.querySelector('.ov-actions .ov-instagram');
    if(instagramLink){
      var icon=instagramLink.querySelector('svg');
      instagramLink.replaceChildren();
      if(icon) instagramLink.appendChild(icon);
      instagramLink.appendChild(document.createTextNode(audiovisual.instagramLabel||'Ver trabajos en Instagram '));
      instagramLink.href=safeHref(audiovisual.instagramUrl,'https://www.instagram.com/ov.audiovisual/');
    }
    var avImages=document.querySelectorAll('.ov-mosaic .ov-work img');
    var avImg1=safeAsset(audiovisual.image1Url), avImg2=safeAsset(audiovisual.image2Url);
    if(avImages[0]&&avImg1) avImages[0].src=avImg1;
    if(avImages[1]&&avImg2) avImages[1].src=avImg2;

    var news=cfg.news||{};
    setKicker('#contenido-eco .section-kicker',news);
    setHeading(document.querySelector('#contenido-eco .section-heading h2'),news.titleLine1,news.titleLine2);
    setText(document.querySelector('#contenido-eco .section-heading > p'),news.description);

    var team=cfg.team||{};
    setKicker('#equipo .section-kicker',team);
    setHeading(document.querySelector('#equipo .team-grid > div:first-child h2'),team.titleLine1,team.titleLine2);
    setText(document.querySelector('#equipo .team-grid > div:first-child p'),team.description);

    var contact=cfg.contact||{};
    setKicker('#contacto .section-kicker',contact);
    var emailLink=document.querySelector('.official-contact-list a[href^="mailto:"]');
    if(emailLink){
      var email=safeEmail(contact.email,'ecostudiosparaguay@gmail.com');
      var emailText=emailLink.querySelector('strong > span');
      setText(emailText,email);emailLink.href='mailto:'+email;
    }
    var whatsappLink=document.querySelector('.official-contact-list a[href*="wa.me"]');
    if(whatsappLink){
      var phone=safePhone(contact.phone,'595994562633');
      var phoneText=whatsappLink.querySelector('strong > span');
      setText(whatsappLink.querySelector('.contact-label'),contact.whatsappLabel||'WHATSAPP OFICIAL');
      setText(phoneText,'+'+phone);
      whatsappLink.href='https://wa.me/'+phone;
    }

    var footer=cfg.footer||{};
    setText(document.querySelector('.site-footer > p'),footer.tagline);
    setText(document.querySelector('.site-footer .copyright'),footer.copyright);
    setText(document.querySelector('.site-footer .back-top'),footer.backTop);
  }

  function safeEmail(value,fallback){
    if(typeof value!=='string') return fallback;
    var candidate=value.trim();
    return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(candidate)?candidate:fallback;
  }
  function safePhone(value,fallback){
    if(typeof value!=='string') return fallback;
    var digits=value.replace(/\D/g,'');
    return digits.length>=8&&digits.length<=15?digits:fallback;
  }

  fetch(configUrl,{cache:'no-store'})
    .then(function(response){if(!response.ok)throw new Error('Site config HTTP '+response.status);return response.json();})
    .then(apply)
    .catch(function(error){console.warn('ECO visual config unavailable; using built-in defaults.',error);});
})();