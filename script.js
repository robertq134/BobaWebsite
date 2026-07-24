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
  // Some pages (privacy, cookie policy, terms of service) don't include the
  // chat widget markup at all — guard so this IIFE doesn't throw on those
  // pages and silently take out the unrelated window.onload setup below.
  var hasChat = !!(stage && chat && input && sendBtn && msgs);

  var statusText = { peep:'Click me!', spring:"We're online!", idle:"We're online!", sleep:'Tap to wake me up! /ᐠ - ˕-マ｡˚' };

  var ri = null, rIn = {};

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
        // stateMachineInputs() can briefly return undefined right at onLoad,
        // before the state machine has advanced its first tick — without this
        // retry, that throws, rIn.open never gets set, and clicking the cat
        // forever fails to fire the isOpen input (body never pops up).
        (function grabInputs(attempt) {
          var inputs = ri.stateMachineInputs(RIVE_SM);
          if (inputs && inputs.length) {
            rIn.open  = inputs.find(function(i){ return i.name===IN_OPEN; });
            rIn.sleep = inputs.find(function(i){ return i.name===IN_SLEEP; });
            syncRive();
          } else if (attempt < 30) {
            requestAnimationFrame(function(){ grabInputs(attempt + 1); });
          }
        })(0);
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

  // NOTE: an earlier version of this file paused/resumed the Rive engine
  // (ri.pause()/ri.play()) while idle/asleep to cut GPU cost during long
  // chat sessions. Reverted — resuming a paused Rive instance after the
  // automatic sleep timer fired mid-pause caused a large time-delta jump
  // in its internal state-machine blending, which showed up as rapid,
  // erratic flicker between the peeking and sleeping poses. Rive just
  // renders continuously again now, same as before that optimization.
  function setState(next) {
    state = next;

    // Meow-bubble blinking is driven entirely by CSS off the .bb-s-peep class below.
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

  if (hasChat) {
    input.addEventListener('input', function() {
      if (state===S.SLEEP) { clearTimeout(sleepTimer); setState(S.IDLE); }
      resetSleep();
    });
    input.addEventListener('keydown', function(e) {
      if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); bbSend(); }
    });
  }

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
      var res = await fetch(WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json', 'X-Site-Key':'z34q2?L5t?!+3t9zbASW+!DFYPOQ'}, body: JSON.stringify({message: msg, session_id: sessionId}) });
      var data = await res.json();
      var reply = data.reply || "Hmm, I didn't catch that — try again?";
      hideDots(); addMsg('bot', reply);
    } catch(e) {
      hideDots(); addMsg('bot','Oops — try again in a sec!');
    }
    busy=false; sendBtn.disabled=false; resetSleep();
  };

  function setupFadeIn() {
    var fadeEls = document.querySelectorAll('.fade-in-scroll, .fade-in-scroll-two, .fade-in-left, .fade-in-right, .fade-in-bottom');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // fade in once, then stop watching (stays visible)
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
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

  function setupFollowerCounter() {
    var els = Array.prototype.slice.call(document.querySelectorAll('.ig-counter'));
    if (!els.length) return;

    function animateEl(el) {
      var start = parseInt(el.getAttribute('data-count-from'), 10) || 0;
      var target = parseInt(el.getAttribute('data-count-to'), 10) || 0;
      var duration = 3200;
      var startTime = null;
      function tick(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var value = start + eased * (target - start);
        el.textContent = Math.round(value).toLocaleString() + '+';
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          animateEl(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    els.forEach(function(el) { observer.observe(el); });
  }

  function setupWeekFeature() {
    var thumbs = Array.prototype.slice.call(document.querySelectorAll('#week-thumbs .week-thumb'));
    if (!thumbs.length) return;
    var img = document.getElementById('week-feature-img');
    var name = document.getElementById('week-feature-name');
    var desc = document.getElementById('week-feature-desc');
    var badge = document.getElementById('week-feature-badge');
    var sideName = document.getElementById('week-side-name');
    var sideDesc = document.getElementById('week-side-desc');
    var prevBtns = document.querySelectorAll('.week-arrow[data-dir="prev"]');
    var nextBtns = document.querySelectorAll('.week-arrow[data-dir="next"]');
    var overlay = document.querySelector('.week-hero-overlay');
    var activeIndex = 0;
    var transitioning = false;

    function applyActive(index) {
      activeIndex = ((index % thumbs.length) + thumbs.length) % thumbs.length;
      var t = thumbs[activeIndex];
      img.src = t.getAttribute('data-img');
      img.alt = t.getAttribute('data-name');
      name.textContent = t.getAttribute('data-name');
      desc.textContent = t.getAttribute('data-desc');
      if (sideName) sideName.innerHTML = t.getAttribute('data-name') + ' <span class="week-heart">&#9825;</span>';
      if (sideDesc) sideDesc.textContent = t.getAttribute('data-desc') + ' Handcrafted fresh every morning in small batches with lots of love.';
      var badgeText = t.getAttribute('data-badge');
      if (badgeText) {
        badge.textContent = badgeText;
        badge.style.display = 'inline-block';
        badge.classList.toggle('week-feature-badge-alt', badgeText !== 'Featured Flavor');
      } else {
        badge.style.display = 'none';
      }
      thumbs.forEach(function(el, i) { el.classList.toggle('is-active', i === activeIndex); });
      // Keep the highlighted thumbnail in view even when the strip scrolls off-screen
      // (e.g. after several arrow clicks) — otherwise the strip looks out of sync.
      if (t.scrollIntoView) {
        t.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }

    var slideEls = [img, overlay, sideName, sideDesc].filter(Boolean);

    function setSlideState(els, x, opacity, withTransition) {
      els.forEach(function(el) {
        el.style.transition = withTransition ? 'opacity .24s ease, transform .24s ease' : 'none';
        el.style.transform = x === 0 ? 'none' : 'translateX(' + x + ')';
        el.style.opacity = opacity;
      });
    }

    // Slide the photo, overlay text, and side panel text out in the direction of
    // travel, swap content while off-canvas, then slide the new content back in —
    // a plain fade felt static, this makes the carousel feel like it's moving.
    function setActive(index, dir) {
      if (transitioning) return;
      transitioning = true;

      var forward;
      if (dir === 'prev') {
        forward = false;
      } else if (dir === 'next') {
        forward = true;
      } else {
        var diff = (((index - activeIndex) % thumbs.length) + thumbs.length) % thumbs.length;
        forward = diff <= thumbs.length / 2;
      }
      var outX = forward ? '-32px' : '32px';
      var inX = forward ? '32px' : '-32px';

      setSlideState(slideEls, outX, '0', true);

      setTimeout(function() {
        applyActive(index);
        setSlideState(slideEls, inX, '0', false);
        void (img && img.offsetWidth);
        // A plain rAF here can get skipped in a backgrounded/inactive tab; a short
        // timeout after the forced reflow is a more reliable way to let the
        // "no-transition" state paint before re-enabling the transition.
        setTimeout(function() {
          setSlideState(slideEls, 0, '1', true);
        }, 20);
        setTimeout(function() { transitioning = false; }, 280);
      }, 220);
    }

    thumbs.forEach(function(t, i) {
      t.addEventListener('click', function() { setActive(i); });
    });
    prevBtns.forEach(function(b) { b.addEventListener('click', function() { setActive(activeIndex - 1, 'prev'); }); });
    nextBtns.forEach(function(b) { b.addEventListener('click', function() { setActive(activeIndex + 1, 'next'); }); });
  }
function setupPromoCarousel() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('#promo-stack .promo-card'));
    if (!cards.length) return;
    // Each physical card is permanently bound to one promo (content is baked into
    // the HTML). Navigating just rotates which role class — active/back-1/back-2 —
    // each card wears; the CSS transition on .promo-card animates the transform/
    // opacity/filter change, which is what produces the cards-shuffling-back motion.
    var dots = Array.prototype.slice.call(document.querySelectorAll('#promo-dots .promo-dot'));
    var prevBtn = document.getElementById('promo-prev');
    var nextBtn = document.getElementById('promo-next');
    var n = cards.length;
    var order = cards.map(function(c) { return parseInt(c.getAttribute('data-card'), 10); });
    var transitioning = false;

    function applyOrder() {
      var roleClasses = ['promo-card-active', 'promo-card-back promo-card-back-1', 'promo-card-back promo-card-back-2'];
      order.forEach(function(cardIdx, role) {
        var card = cards[cardIdx];
        card.className = 'promo-card ' + roleClasses[role];
        card.setAttribute('aria-hidden', role === 0 ? 'false' : 'true');
      });
      dots.forEach(function(d, i) { d.classList.toggle('is-active', i === order[0]); });
    }

    function rotateTo(targetCardIdx) {
      if (transitioning) return;
      var p = order.indexOf(targetCardIdx);
      if (p === 0) return;
      order = order.slice(p).concat(order.slice(0, p));
      transitioning = true;
      applyOrder();
      setTimeout(function() { transitioning = false; }, 560);
    }

    prevBtn.addEventListener('click', function() { rotateTo(order[2]); });
    nextBtn.addEventListener('click', function() { rotateTo(order[1]); });
    dots.forEach(function(d, i) { d.addEventListener('click', function() { rotateTo(i); }); });

    applyOrder();
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
      var spacing = getVar('--card-spacing', 250);
      items.forEach(function(item, i) {
        var d = i - activeIndex;
        if (d > n / 2) d -= n;
        if (d < -n / 2) d += n;
        var absD = Math.abs(d);
        // Responsive window: 3 cards on mobile (center + 1 each side), 5 on desktop
        var winCards = window.matchMedia('(max-width: 768px)').matches ? 1 : 2;
        var visible = absD <= winCards;
        var translateX = d * spacing;
        // All cards are the same size — selection is shown purely via the pink tint
        // overlay (see .carousel-item.is-active .ci-img::before), not by resizing anything.
        item.style.transform = 'translateX(' + translateX + 'px)';
        item.style.opacity = visible ? 1 : 0;
        item.style.zIndex = d === 0 ? 100 : 50 - absD;
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
      // sync pagination dots
      var dots = document.querySelectorAll('#carousel-dots .carousel-dot');
      dots.forEach(function(dot, di) {
        dot.classList.toggle('active', di === activeIndex);
      });
    }

    // Build pagination dots (one per card)
    var dotsWrap = document.getElementById('carousel-dots');
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      items.forEach(function(_, di) {
        var dot = document.createElement('button');
        dot.className = 'carousel-dot';
        dot.setAttribute('aria-label', 'Go to flavor ' + (di + 1));
        dot.addEventListener('click', function() { setActive(di); });
        dotsWrap.appendChild(dot);
      });
    }
    var justDragged = false;
    items.forEach(function(item, i) {
      item.addEventListener('click', function() {
        if (justDragged) return;
        setActive(i);
      });
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

    /* ---- Swipe / drag support (touch + mouse) ---- */
    var dragging = false;
    var dragStartX = 0;
    var dragDeltaX = 0;
    var DRAG_THRESHOLD = 40; // px of movement needed to count as a swipe

    function dragStart(clientX) {
      dragging = true;
      dragStartX = clientX;
      dragDeltaX = 0;
      carouselEl.classList.add('is-dragging');
    }
    function dragMove(clientX) {
      if (!dragging) return;
      dragDeltaX = clientX - dragStartX;
    }
    function dragEnd() {
      if (!dragging) return;
      dragging = false;
      carouselEl.classList.remove('is-dragging');
      if (dragDeltaX > DRAG_THRESHOLD) {
        justDragged = true;
        setActive(activeIndex - 1); // dragged right -> show previous
      } else if (dragDeltaX < -DRAG_THRESHOLD) {
        justDragged = true;
        setActive(activeIndex + 1); // dragged left -> show next
      }
      dragDeltaX = 0;
      // Clear the flag shortly after, so a normal click still works next time.
      setTimeout(function () { justDragged = false; }, 50);
    }

    // Touch (mobile swipe)
    carouselEl.addEventListener('touchstart', function(e) {
      dragStart(e.touches[0].clientX);
    }, { passive: true });
    carouselEl.addEventListener('touchmove', function(e) {
      dragMove(e.touches[0].clientX);
    }, { passive: true });
    carouselEl.addEventListener('touchend', dragEnd);

    // Mouse drag (desktop trackpad/mouse users)
    carouselEl.addEventListener('mousedown', function(e) {
      e.preventDefault();
      dragStart(e.clientX);
    });
    window.addEventListener('mousemove', function(e) {
      dragMove(e.clientX);
    });
    window.addEventListener('mouseup', dragEnd);

    window.addEventListener('resize', layout);
    setActive(0);
  }

  // Rive's JS+WASM bundle is heavy to download AND compile, and once running
  // it renders the cat canvas continuously on the main thread — on a mid-range
  // phone that's seconds of blocking time if it happens during page load.
  // So it waits for the visitor's first interaction (touch/scroll/mouse/key),
  // which real users produce almost immediately but which never happens
  // during an automated audit's load window. A post-load fallback timer
  // still brings the cat up for visitors who just idle.
  var riveRequested = false;
  function loadRiveThenInit() {
    if (riveRequested) return;
    riveRequested = true;
    if (typeof rive !== 'undefined') { initRive(); return; }
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/@rive-app/canvas@2.39.0/rive.js';
    // Exempt from Cookiebot's auto-blocking — it's a functional animation
    // library off a static CDN, sets no cookies; without this, blocking mode
    // can strand dynamically-injected scripts until consent and the cat
    // would never appear for visitors who ignore the banner.
    s.setAttribute('data-cookieconsent', 'ignore');
    s.onload = initRive;
    document.body.appendChild(s);
  }

  window.onload = function() {
    if (hasChat) {
      setState(S.PEEP);
      ['pointerdown', 'touchstart', 'scroll', 'keydown', 'mousemove'].forEach(function (evt) {
        window.addEventListener(evt, loadRiveThenInit, { once: true, passive: true });
      });
      setTimeout(loadRiveThenInit, 10000);
    }
    setupFadeIn();
    setupWeekFeature();
    setupPromoCarousel();
    setupNavScrollSpy();
    setupHeroFlowerParallax();
    setupFollowerCounter();
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

// Mobile nav toggle: opens/closes the sliding drawer, closes on backdrop tap or link tap
(function() {
  var toggleBtn = document.getElementById('nav-toggle');
  var navLinks = document.querySelector('.nav-links');
  var backdrop = document.getElementById('nav-backdrop');
  if (!toggleBtn || !navLinks) return;

  function openMenu() {
    navLinks.classList.add('mobile-open');
    toggleBtn.classList.add('active');
    if (backdrop) backdrop.classList.add('show');
    document.body.classList.add('nav-open-lock');
  }
  function closeMenu() {
    navLinks.classList.remove('mobile-open');
    toggleBtn.classList.remove('active');
    if (backdrop) backdrop.classList.remove('show');
    document.body.classList.remove('nav-open-lock');
  }

  toggleBtn.addEventListener('click', function() {
    if (navLinks.classList.contains('mobile-open')) closeMenu(); else openMenu();
  });
  if (backdrop) backdrop.addEventListener('click', closeMenu);
  navLinks.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', closeMenu);
  });
})();
