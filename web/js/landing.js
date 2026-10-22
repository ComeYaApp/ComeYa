/* ==========================================================================
   ComeYa — interacciones de la landing
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer =
    window.matchMedia &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  var body = document.body;
  var header = document.getElementById("site-header");
  var progressBar = document.getElementById("scroll-progress-bar");
  var hero = document.getElementById("inicio");
  var heroVisual = document.querySelector(".hero__visual");
  var hero3d = document.querySelector(".hero-3d");
  var sceneSections = Array.prototype.slice.call(
    document.querySelectorAll("[data-scene]")
  );
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll('.main-nav a[href^="#"]')
  );

  // Los iconos son decorativos: el texto del enlace o del botón ya describe
  // la acción para lectores de pantalla.
  Array.prototype.forEach.call(
    document.querySelectorAll("svg.icon, svg.store-icon"),
    function (icon) {
      icon.setAttribute("aria-hidden", "true");
      icon.setAttribute("focusable", "false");
    }
  );

  /* ── Cabecera, progreso y escenas ─────────────────────────────────────── */

  function updateHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);

    if (progressBar) {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var percent = max > 0 ? (window.scrollY / max) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, percent)) + "%";
    }
  }

  function updateScene() {
    if (!sceneSections.length) return;

    var midpoint = window.innerHeight * 0.42;
    var current = sceneSections[0];

    for (var i = 0; i < sceneSections.length; i += 1) {
      var rect = sceneSections[i].getBoundingClientRect();
      if (rect.top <= midpoint) current = sceneSections[i];
    }

    var scene = current.getAttribute("data-scene");
    if (scene && body.getAttribute("data-scene") !== scene) {
      body.setAttribute("data-scene", scene);
    }

    var currentId = current.id;
    navLinks.forEach(function (link) {
      var isCurrent =
        !!currentId && link.getAttribute("href") === "#" + currentId;
      link.classList.toggle("is-active", isCurrent);
      if (isCurrent) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function updateParallax() {
    if (!heroVisual || !hero) return;

    if (reduceMotion || window.innerWidth < 768) {
      heroVisual.style.transform = "";
      return;
    }

    var rect = hero.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;

    var progress = Math.min(
      1,
      Math.max(0, -rect.top / Math.max(1, rect.height))
    );
    heroVisual.style.transform =
      "translate3d(0," + (progress * 32).toFixed(2) + "px,0)";
  }

  function updateAll() {
    updateHeader();
    updateScene();
    updateParallax();
  }

  var ticking = false;
  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      updateAll();
      ticking = false;
    });
  }

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  updateAll();

  /* ── Menú móvil ───────────────────────────────────────────────────────── */

  var menuToggle = document.getElementById("menu-toggle");
  var mobileMenu = document.getElementById("mobile-menu");
  var mobilePanel = mobileMenu
    ? mobileMenu.querySelector(".mobile-menu__panel")
    : null;
  var lastFocusedElement = null;

  function focusableInMenu() {
    if (!mobilePanel) return [];
    return Array.prototype.slice.call(
      mobilePanel.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function openMenu() {
    if (!mobileMenu || !menuToggle) return;
    lastFocusedElement = document.activeElement;
    mobileMenu.classList.add("is-open");
    mobileMenu.setAttribute("aria-hidden", "false");
    menuToggle.classList.add("is-open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Cerrar menú");
    body.classList.add("menu-open");
    var focusable = focusableInMenu();
    if (focusable.length) focusable[0].focus();
    document.dispatchEvent(new CustomEvent("comeya:menu-open"));
  }

  function closeMenu() {
    if (!mobileMenu || !menuToggle) return;
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
    menuToggle.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menú");
    body.classList.remove("menu-open");
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
    document.dispatchEvent(new CustomEvent("comeya:menu-close"));
  }

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", function () {
      if (mobileMenu.classList.contains("is-open")) closeMenu();
      else openMenu();
    });

    mobileMenu.addEventListener("click", function (event) {
      if (event.target === mobileMenu) closeMenu();
    });

    Array.prototype.forEach.call(
      mobileMenu.querySelectorAll("a"),
      function (link) {
        link.addEventListener("click", closeMenu);
      }
    );

    document.addEventListener("keydown", function (event) {
      if (!mobileMenu.classList.contains("is-open")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (event.key === "Tab") {
        var focusable = focusableInMenu();
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1100 && mobileMenu.classList.contains("is-open")) {
        closeMenu();
      }
    });
  }

  /* ── Apariciones al hacer scroll ──────────────────────────────────────── */

  Array.prototype.forEach.call(
    document.querySelectorAll("[data-reveal-group]"),
    function (group) {
      Array.prototype.forEach.call(group.children, function (child, index) {
        if (child.hasAttribute("data-reveal")) {
          child.style.setProperty(
            "--reveal-delay",
            Math.min(index, 8) * 70 + "ms"
          );
        }
      });
    }
  );

  var revealElements = Array.prototype.slice.call(
    document.querySelectorAll("[data-reveal]")
  );

  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" }
    );

    revealElements.forEach(function (element) {
      revealObserver.observe(element);
    });
  } else {
    revealElements.forEach(function (element) {
      element.classList.add("is-visible");
    });
  }

  /* ── Contadores ───────────────────────────────────────────────────────── */

  function animateCounter(element) {
    var target = parseFloat(element.getAttribute("data-count-to"));
    var decimals = parseInt(
      element.getAttribute("data-count-decimals") || "0",
      10
    );
    var suffix = element.getAttribute("data-count-suffix") || "";
    var duration = 1300;
    var start = null;

    if (!isFinite(target)) return;
    if (reduceMotion) {
      element.textContent =
        (decimals ? target.toFixed(decimals) : String(Math.round(target))) +
        suffix;
      return;
    }

    function frame(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min(1, (timestamp - start) / duration);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = target * eased;
      element.textContent =
        (decimals ? value.toFixed(decimals) : String(Math.round(value))) +
        suffix;
      if (progress < 1) window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
  }

  var counters = Array.prototype.slice.call(
    document.querySelectorAll("[data-count-to]")
  );

  if ("IntersectionObserver" in window && counters.length) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach(function (counter) {
      counterObserver.observe(counter);
    });
  }

  /* ── Tilt 3D suave (solo ratón) ───────────────────────────────────────── */

  function bindTilt(area, target, intensity) {
    if (!area || !target) return;

    area.addEventListener("pointermove", function (event) {
      var rect = area.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = (event.clientX - rect.left) / rect.width - 0.5;
      var y = (event.clientY - rect.top) / rect.height - 0.5;
      target.style.setProperty("--tilt-x", (x * intensity * 2).toFixed(2) + "deg");
      target.style.setProperty("--tilt-y", (-y * intensity * 2).toFixed(2) + "deg");
    });

    area.addEventListener("pointerleave", function () {
      target.style.setProperty("--tilt-x", "0deg");
      target.style.setProperty("--tilt-y", "0deg");
    });
  }

  if (!reduceMotion && finePointer) {
    bindTilt(heroVisual, hero3d, 5);
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-tilt]"),
      function (element) {
        bindTilt(element, element, 4);
      }
    );
  }

  /* ── Halo que sigue al puntero en el hero ─────────────────────────────── */

  if (hero && !reduceMotion && finePointer) {
    hero.addEventListener("pointermove", function (event) {
      var rect = hero.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = ((event.clientX - rect.left) / rect.width) * 100;
      var y = ((event.clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty("--mx", x.toFixed(1) + "%");
      hero.style.setProperty("--my", y.toFixed(1) + "%");
    });
  }

  /* ── Detección de tienda recomendada ──────────────────────────────────── */

  var ua = navigator.userAgent || "";
  var isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);

  if (isIOS) {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-store="ios"]'),
      function (element) {
        element.classList.add("is-recommended");
      }
    );
  } else if (isAndroid) {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-store="android"]'),
      function (element) {
        element.classList.add("is-recommended");
      }
    );
  }

  /* ── Acordeón: solo una respuesta abierta ─────────────────────────────── */

  var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-item"));
  faqItems.forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (!item.open) return;
      faqItems.forEach(function (other) {
        if (other !== item) other.open = false;
      });
    });
  });
})();
