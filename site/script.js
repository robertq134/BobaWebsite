(function() {
  var WEBHOOK = 'https://web-production-10533.up.railway.app/messages/';
  var RIVE_FILE = 'bestie-cat.riv';
  var RIVE_SM   = 'CatStateMachine';
  var IN_OPEN   = 'isOpen';
  var IN_SLEEP  = 'isSleeping';
  var touchStartY = 0;

  var S = { PEEP:'peep', SPRING:'spring', IDLE:'idle', SLEEP:'sleep' };
  var state = S.PEEP, sleepTimer = null, busy = false;
  var stage    = document.getElementById('bb-cat-stage');
  var chat     = document.getElementById('bb-chat');
  var statusEl = document.getElementById('bb-status');
  var msgs     = document.getElementById('bb-msgs');
  var input    = document.getElementById('bb-input');
  var sendBtn  = document.getElementById('bb-send');
  var meowBubble = document.getElementById('bb-meow-bubble');

  var statusText = { peep:'Click me!', spring:"We're online!", idle:"We're online!", sleep:'Tap to wake me up! /ᐠ - ˕-マ｡˚' };

  var ri = null, rIn = {};
  var meowIntervalId = null;

  var sessionId = sessionStorage.getItem('bb_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('bb_session_id', sessionId);
  }

  function initRive() {
    ri = new rive.Rive({
      src: RIVE_FILE,
      canvas: document.getElementById('bb-rive'),
      autoplay: true,
      stateMachines: RIVE_SM,
      onLoad: function() {
        var inputs = ri.stateMachineInputs(RIVE_SM);
        rIn.open  = inputs.find(function(i){ return i.name===IN_OPEN; });
        rIn.sleep = inputs.find(function(i){ return i.name===IN_SLEEP; });
        syncRive();
      }
    });
    var hitzone = document.getElementById('bb-cat-hitzone');
    hitzone.addEventListener('click', bbCatClick);
    hitzone.addEventListener('touchstart', function(e){
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    hitzone.addEventListener('touchend', function(e){
      var touchEndY = e.changedTouches[0].clientY;
      if (Math.abs(touchEndY - touchStartY) < 10) bbCatClick();
    });
  }

  function syncRive() {
    if (!ri || !rIn.open) return;
    rIn.open.value  = (state===S.SPRING||state===S.IDLE||state===S.SLEEP);
    rIn.sleep.value = (state===S.SLEEP);
  }

  function setState(next) {
    state = next;

    if (state === S.PEEP) {
      if (!meowIntervalId) {
        meowIntervalId = setInterval(function() {
          meowBubble.style.opacity = (meowBubble.style.opacity === "0") ? "1" : "0";
        }, 1000);
      }
    } else {
      clearInterval(meowIntervalId);
      meowIntervalId = null;
      meowBubble.style.opacity = "0";
    }

    stage.className = 'bb-s-' + next;
    statusEl.textContent = statusText[next] || '';
    var open = (next===S.SPRING||next===S.IDLE||next===S.SLEEP);
    open ? chat.classList.add('open') : chat.classList.remove('open');
    syncRive();
  }

  function springUp() {
    setState(S.SPRING);
    document.getElementById('bb-cat-wrap').addEventListener('animationend', function() {
      if (state===S.SPRING) setState(S.IDLE);
    }, { once:true });
    resetSleep();
  }

  function resetSleep() {
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(function() {
      if (state===S.IDLE) setState(S.SLEEP);
    }, 2000);
  }

  function bbCatClick() {
    if (state===S.PEEP||state===S.SLEEP) {
      springUp();
      setTimeout(function(){ input.focus(); }, 900);
    }
  }

  window.bbClose = function() { clearTimeout(sleepTimer); setState(S.PEEP); };
  window.bbChip = function(btn) {
    if (state === S.SLEEP) springUp();
    bbSend(btn.textContent);
  };

  input.addEventListener('input', function() {
    if (state===S.SLEEP) { clearTimeout(sleepTimer); setState(S.IDLE); }
    resetSleep();
  });
  input.addEventListener('keydown', function(e) {
    if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); bbSend(); }
  });

  function addMsg(role, text) {
    var row = document.createElement('div');
    row.className = 'bb-row' + (role==='user'?' usr':'');
    if (role !== 'user') {
      var av = document.createElement('div');
      av.className = 'bb-avatar';
      av.textContent = '🐱';
      row.appendChild(av);
    }
    var b = document.createElement('div');
    b.className = 'bb-bubble ' + (role==='user'?'usr':'bot');
    b.textContent = text;
    row.appendChild(b); msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showDots() {
    var row = document.createElement('div');
    row.id='bb-dots'; row.className='bb-row';
    row.innerHTML='<div class="bb-dots"><span></span><span></span><span></span></div>';
    msgs.appendChild(row); msgs.scrollTop=msgs.scrollHeight;
  }
  function hideDots() { var d=document.getElementById('bb-dots'); if(d) d.remove(); }

  window.bbSend = async function(text) {
    var msg = (text||input.value).trim();
    if (!msg||busy) return;
    input.value=''; busy=true; sendBtn.disabled=true;
    clearTimeout(sleepTimer);
    addMsg('user', msg); showDots();
    try {
      var res = await fetch(WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json', 'X-Site-Key':'YOUR_SITE_KEY_HERE'}, body: JSON.stringify({message: msg, session_id: sessionId}) });
      var data = await res.json();
      var reply = data.reply || "Hmm, I didn't catch that — try again?";
      hideDots(); addMsg('bot', reply);
    } catch(e) {
      hideDots(); addMsg('bot','Oops — try again in a sec!');
    }
    busy=false; sendBtn.disabled=false; resetSleep();
  };

  function setupFadeIn() {
    var fadeEls = document.querySelectorAll('.fade-in-scroll, .fade-in-scroll-two');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        entry.target.classList.toggle('visible', entry.isIntersecting);
      });
    }, { threshold: 0.15 });
    fadeEls.forEach(function(el) { observer.observe(el); });
  }

  function setupNavScrollSpy() {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
    var sections = navLinks.map(function(link) {
      var id = link.getAttribute('href').replace('#', '');
      return { link: link, section: document.getElementById(id) };
    }).filter(function(s) { return s.section; });

    if (!sections.length) return;

    function updateActive() {
      var triggerPoint = window.scrollY + window.innerHeight * 0.3;
      var current = sections[0];
      sections.forEach(function(s) {
        if (s.section.offsetTop <= triggerPoint) current = s;
      });
      sections.forEach(function(s) {
        s.link.classList.toggle('active', s === current);
      });
    }

    window.addEventListener('scroll', updateActive, { passive: true });
    window.addEventListener('resize', updateActive);
    updateActive();
  }

  function setupHeroFlowerParallax() {
    // Each entry: element id, how fast it drifts relative to scroll (bigger = more movement)
    var flowers = [
      { id: 'hero-flower-corner', speed: 0.15 },
      { id: 'hero-flower-bottom', speed: 0.25 }
    ];

    var targets = flowers.map(function(f) {
      var el = document.getElementById(f.id);
      if (!el) return null;
      return { el: el, speed: f.speed, base: el.getAttribute('data-base-transform') || '' };
    }).filter(Boolean);

    if (!targets.length) return;

    function onScroll() {
      var scrollY = window.scrollY;
      targets.forEach(function(t) {
        var offset = scrollY * t.speed;
        t.el.style.transform = (t.base ? t.base + ' ' : '') + 'translateY(' + offset + 'px)';
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function setupFlavorCarousel() {
    var carouselEl = document.getElementById('flavor-carousel');
    if (!carouselEl) return;
    var items = Array.prototype.slice.call(document.querySelectorAll('#carousel-track .carousel-item'));
    var n = items.length;
    var activeIndex = 0;

    function getVar(name, fallback) {
      var v = parseFloat(getComputedStyle(carouselEl).getPropertyValue(name));
      return isNaN(v) ? fallback : v;
    }

    function layout() {
      var spacing = getVar('--card-spacing', 130);
      items.forEach(function(item, i) {
        var d = i - activeIndex;
        if (d > n / 2) d -= n;
        if (d < -n / 2) d += n;
        var absD = Math.abs(d);
        var visible = absD <= 3;
        var translateX = d * spacing;
        var rotateY = d * -28;
        var scale = Math.max(1 - absD * 0.16, 0.4);
        var opacity = visible ? Math.max(1 - absD * 0.28, 0) : 0;
        item.style.transform = 'translateX(' + translateX + 'px) rotateY(' + rotateY + 'deg) scale(' + scale + ')';
        item.style.opacity = opacity;
        item.style.zIndex = 100 - absD;
        item.style.pointerEvents = visible ? 'auto' : 'none';
        item.classList.toggle('is-active', d === 0);
      });
    }

    function setActive(index) {
      activeIndex = ((index % n) + n) % n;
      layout();
      var targetSrc = items[activeIndex].querySelector('img').getAttribute('src');
      document.querySelectorAll('.flavor-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-img') === targetSrc);
      });
    }

    items.forEach(function(item, i) {
      item.addEventListener('click', function() { setActive(i); });
    });

    document.querySelectorAll('.flavor-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetSrc = btn.getAttribute('data-img');
        var idx = items.findIndex(function(it) {
          return it.querySelector('img').getAttribute('src') === targetSrc;
        });
        if (idx !== -1) setActive(idx);
      });
    });

    var prevBtn = document.getElementById('carousel-prev');
    var nextBtn = document.getElementById('carousel-next');
    if (prevBtn) prevBtn.addEventListener('click', function() { setActive(activeIndex - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function() { setActive(activeIndex + 1); });

    window.addEventListener('resize', layout);
    setActive(0);
  }

  window.onload = function() {
    setState(S.PEEP);
    if (typeof rive !== 'undefined') initRive();
    setupFadeIn();
    setupFlavorCarousel();
    setupNavScrollSpy();
    setupHeroFlowerParallax();
  };
})();

// Nav starts transparent (blended into the hero) and solidifies once the user scrolls down
(function() {
  var navEl = document.querySelector('nav');
  function onScroll() {
    navEl.classList.toggle('scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// Mobile nav toggle: opens/closes the dropdown, closes automatically once a link is tapped
(function() {
  var toggleBtn = document.getElementById('nav-toggle');
  var navLinks = document.querySelector('.nav-links');
  if (!toggleBtn || !navLinks) return;

  toggleBtn.addEventListener('click', function() {
    navLinks.classList.toggle('mobile-open');
  });

  navLinks.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', function() {
      navLinks.classList.remove('mobile-open');
    });
  });
})();
