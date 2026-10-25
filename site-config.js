(function(){
  'use strict';
  var configUrl = 'data/eco-site-config.json';
  function safeHref(value, fallback){
    if(typeof value !== 'string' || !value.trim()) return fallback;
    if(value.charAt(0)==='#') return value;
    try { var u=new URL(value, window.location.href); return u.protocol==='https:' ? u.href : fallback; }
    catch(e){ return fallback; }
  }
  function setText(node, value){
    if(node && typeof value==='string' && value.trim()) node.textContent=value;
  }
  function apply(cfg){
    if(!cfg || cfg.schemaVersion!==1) return;
    var root=document.documentElement.style;
    var colors=cfg.colors||{}, fonts=cfg.fonts||{}, brand=cfg.brand||{}, hero=cfg.hero||{}, nav=cfg.navigation||{}, ret=cfg.communityReturn||{};
    [['--bg',colors.bg],['--panel',colors.panel],['--panel-2',colors.panel2],['--text',colors.text],['--muted',colors.muted],['--line',colors.line],['--orange',colors.orange],['--orange-2',colors.orange2]].forEach(function(pair){if(typeof pair[1]==='string')root.setProperty(pair[0],pair[1]);});
    function fontName(v){return ['DM Sans','Inter','Manrope','Space Grotesk'].indexOf(v)>=0 ? v : null;}
    var body=fontName(fonts.body), heading=fontName(fonts.heading);
    if(body)root.setProperty('--font-body','"'+body+'",Arial,sans-serif');
    if(heading)root.setProperty('--font-heading','"'+heading+'",Arial,sans-serif');
    if(body)document.body.style.fontFamily='var(--font-body)';
    if(heading)document.querySelectorAll('h1,h2,h3,h4,.brand-words,.brand-mark').forEach(function(n){n.style.fontFamily='var(--font-heading)';});
    if(body && heading){
      var families=Array.from(new Set([body,heading])).map(function(name){return 'family='+encodeURIComponent(name).replace(/%20/g,'+')+':wght@400;500;600;700';}).join('&');
      var fontLink=document.getElementById('eco-dynamic-fonts');
      if(!fontLink){fontLink=document.createElement('link');fontLink.id='eco-dynamic-fonts';fontLink.rel='stylesheet';document.head.appendChild(fontLink);}
      fontLink.href='https://fonts.googleapis.com/css2?'+families+'&display=swap';
    }
    setText(document.querySelector('.brand-words'), brand.name||'ECO');
    var brandWords=document.querySelector('.brand-words');
    if(brandWords){
      var sub=brandWords.querySelector('span');
      if(!sub){sub=document.createElement('span');brandWords.appendChild(sub);}
      setText(sub,brand.subtitle||'STUDIOS');
    }
    setText(document.querySelector('.brand-mark'),brand.mark||'E');
    var meta=document.querySelector('meta[name="description"]'); if(meta&&brand.seoDescription)meta.setAttribute('content',brand.seoDescription);
    var eyebrow=document.querySelector('.hero-copy .eyebrow');
    if(eyebrow&&hero.eyebrow){
      var pulse=eyebrow.querySelector('.pulse');
      eyebrow.textContent=hero.eyebrow;
      if(pulse)eyebrow.prepend(pulse);
    }
    var title=document.querySelector('.hero-copy h1');
    if(title){
      title.replaceChildren(document.createTextNode(hero.titleLine1||'Una voz.'));
      title.appendChild(document.createElement('br'));
      var span=document.createElement('span');span.textContent=hero.titleLine2||'Muchos ecos.';title.appendChild(span);
    }
    setText(document.querySelector('.hero-lede'),hero.description||'');
    var primary=document.querySelector('.hero-actions .button-orange');
    if(primary){
      var label=hero.primaryLabel||'Conocé el colectivo';primary.textContent=label+' ';
      var arrow=document.createElement('span');arrow.textContent='↘';primary.appendChild(arrow);
      primary.href=safeHref(hero.primaryUrl,'#artistas');
    }
    var secondary=document.querySelector('.hero-actions .text-link');
    if(secondary){
      var label2=hero.secondaryLabel||'Escuchar música';secondary.textContent=label2+' ';
      var arrow2=document.createElement('span');arrow2.textContent='↗';secondary.appendChild(arrow2);
      secondary.href=safeHref(hero.secondaryUrl,'#musica');
    }
    var navMap=[['project','a[href="#historia"]'],['artists','a[href="#artistas"]'],['music','a[href="#musica"]'],['audiovisual','a[href="#audiovisual"]'],['contact','a[href="#contacto"]']];
    navMap.forEach(function(pair){
      var node=document.querySelector('.main-nav '+pair[1]), item=nav[pair[0]];
      if(!node||!item)return;
      setText(node,item.label||node.textContent);
      node.href=safeHref(item.href,node.getAttribute('href'));
      node.hidden=item.visible===false;
    });
    var mobile=document.querySelector('.menu-toggle b');setText(mobile,nav.mobileLabel||'Menú');
    var bar=document.querySelector('.community-return-bar'), link=bar&&bar.querySelector('a');
    if(bar&&link){
      bar.hidden=ret.visible===false;
      setText(link,ret.label||link.textContent.trim());
      link.href=safeHref(ret.url,'https://martingfilippi-dotcom.github.io/comunidad-artistas-paraguayos./');
    }
  }
  fetch(configUrl+'?v='+Date.now(),{cache:'no-store'})
    .then(function(response){if(!response.ok)throw new Error('Site config HTTP '+response.status);return response.json();})
    .then(apply).catch(function(error){console.warn('ECO visual config unavailable; using built-in defaults.',error);});
})();