/* ==========================================================================
   ComeYa — widget de chat IA para páginas estáticas.
   No abre el panel automáticamente: muestra un aviso discreto y espera clic.
   ========================================================================== */

(function () {
  "use strict";

  if (window.__comeyaChatMounted) return;
  window.__comeyaChatMounted = true;

  var API = "https://comeya-backend.onrender.com/api/support/chat-public";
  var TEASER_KEY = "comeya_ai_teaser_seen";
  var TEASER_DELAY = 6000;

  var ICONS = {
    close:
      '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    send:
      '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    chat:
      '<svg aria-hidden="true" focusable="false" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    teaserClose:
      '<svg aria-hidden="true" focusable="false" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  };

  function mount() {
    if (document.getElementById("cy-ai")) return;

    var root = document.createElement("div");
    root.id = "cy-ai";
    root.innerHTML =
      '<div class="cy-teaser" id="cy-ai-teaser" role="note">' +
        '<button class="cy-teaser__open" type="button" id="cy-ai-teaser-open" aria-label="Abrir el asistente ComeYa">' +
          '<span class="cy-teaser__label">Asistente ComeYa</span>' +
          '<span class="cy-teaser__text">¿Puedo ayudarte en algo?</span>' +
        '</button>' +
        '<button class="cy-teaser__close" type="button" id="cy-ai-teaser-close" aria-label="Cerrar aviso del asistente">' +
          ICONS.teaserClose +
        "</button>" +
      "</div>" +
      '<div class="cy-panel" id="cy-ai-panel" role="dialog" aria-label="Asistente ComeYa" aria-hidden="true">' +
        '<div class="cy-head">' +
          '<div class="cy-logo"><img src="/logo-round.png" alt="ComeYa" width="42" height="42"/></div>' +
          '<div class="cy-head-txt">' +
            '<span class="cy-title">Asistente ComeYa</span>' +
            '<div class="cy-status"><i></i><span>En línea</span></div>' +
          "</div>" +
          '<button class="cy-x" type="button" id="cy-ai-close" aria-label="Cerrar chat">' +
            ICONS.close +
          "</button>" +
        "</div>" +
        '<div class="cy-msgs" id="cy-ai-msgs" aria-live="polite">' +
          '<div class="cy-msg bot">¡Hola! Soy el asistente de ComeYa. ¿Puedo ayudarte en algo?</div>' +
          '<div class="cy-sugs" id="cy-ai-sugs">' +
            '<button class="cy-sug" type="button">¿Dónde está mi pedido?</button>' +
            '<button class="cy-sug" type="button">¿Cómo puedo pagar?</button>' +
            '<button class="cy-sug" type="button">¿Qué incluye ComeYaPass?</button>' +
          "</div>" +
        "</div>" +
        '<form class="cy-form" id="cy-ai-form">' +
          '<textarea class="cy-input" id="cy-ai-input" rows="1" maxlength="500" placeholder="Escribe tu pregunta…" aria-label="Escribe tu pregunta"></textarea>' +
          '<button class="cy-send" id="cy-ai-send" type="submit" aria-label="Enviar mensaje">' +
            ICONS.send +
          "</button>" +
        "</form>" +
      "</div>" +
      '<button class="cy-fab" type="button" id="cy-ai-fab" aria-label="Abrir chat de ayuda" aria-expanded="false" aria-controls="cy-ai-panel">' +
        '<img src="/logo-round.png" alt="ComeYa" width="62" height="62"/>' +
        '<span class="cy-badge" aria-hidden="true">' +
          ICONS.chat +
        "</span>" +
      "</button>";

    document.body.appendChild(root);
  }

  function init() {
    mount();

    var root = document.getElementById("cy-ai");
    if (!root) return;

    var panel = document.getElementById("cy-ai-panel");
    var fab = document.getElementById("cy-ai-fab");
    var closeBtn = document.getElementById("cy-ai-close");
    var teaser = document.getElementById("cy-ai-teaser");
    var teaserOpen = document.getElementById("cy-ai-teaser-open");
    var teaserClose = document.getElementById("cy-ai-teaser-close");
    var msgs = document.getElementById("cy-ai-msgs");
    var sugs = document.getElementById("cy-ai-sugs");
    var form = document.getElementById("cy-ai-form");
    var input = document.getElementById("cy-ai-input");
    var sendBtn = document.getElementById("cy-ai-send");

    if (!panel || !fab || !form || !input || !sendBtn) return;

    var history = [];
    var loading = false;
    var teaserDismissed = false;
    var teaserTimer = null;
    var footerVisible = false;
    var accessVisible = false;

    try {
      teaserDismissed = window.sessionStorage.getItem(TEASER_KEY) === "1";
    } catch (error) {
      teaserDismissed = false;
    }

    function rememberTeaser() {
      teaserDismissed = true;
      try {
        window.sessionStorage.setItem(TEASER_KEY, "1");
      } catch (error) {
        /* almacenamiento no disponible */
      }
    }

    function hideTeaser() {
      root.classList.remove("cy-ai--teaser");
    }

    function showTeaser() {
      if (teaserDismissed || footerVisible || accessVisible) return;
      if (root.classList.contains("cy-ai--open")) return;
      // No tapar el menú móvil.
      if (document.body.classList.contains("menu-open")) return;
      root.classList.add("cy-ai--teaser");
    }

    function scheduleTeaser() {
      if (teaserDismissed) return;
      teaserTimer = window.setTimeout(function () {
        // En móvil esperamos a que el usuario empiece a explorar para no
        // tapar las estadísticas del hero recién entrando.
        if (window.innerWidth >= 768 || window.scrollY > 220) {
          showTeaser();
        }
      }, TEASER_DELAY);
    }

    function updateFabVisibility() {
      if (window.innerWidth < 768) {
        if (root.classList.contains("cy-ai--open")) {
          root.classList.remove("cy-ai--top");
          return;
        }
        root.classList.toggle("cy-ai--top", window.scrollY < 120);
      } else {
        root.classList.remove("cy-ai--top");
      }
    }

    function openChat() {
      rememberTeaser();
      hideTeaser();
      root.classList.add("cy-ai--open");
      panel.setAttribute("aria-hidden", "false");
      fab.setAttribute("aria-expanded", "true");
      window.setTimeout(function () {
        input.focus();
      }, 160);
    }

    function closeChat() {
      root.classList.remove("cy-ai--open");
      panel.setAttribute("aria-hidden", "true");
      fab.setAttribute("aria-expanded", "false");
      rememberTeaser();
      hideTeaser();
      fab.focus();
      updateChatVisibility();
      updateFabVisibility();
    }

    function scrollDown() {
      msgs.scrollTop = msgs.scrollHeight;
    }

    function addMsg(text, role) {
      var el = document.createElement("div");
      el.className = "cy-msg " + role;
      el.textContent = text;
      msgs.appendChild(el);
      scrollDown();
    }

    function showTyping(show) {
      var typing = document.getElementById("cy-ai-typing");
      if (show && !typing) {
        typing = document.createElement("div");
        typing.id = "cy-ai-typing";
        typing.className = "cy-typing";
        typing.innerHTML = "<b></b><b></b><b></b> Escribiendo…";
        msgs.appendChild(typing);
        scrollDown();
      } else if (!show && typing) {
        typing.remove();
      }
    }

    function busy(state) {
      loading = state;
      sendBtn.disabled = state;
      input.disabled = state;
    }

    function send(text) {
      var clean = String(text || "").trim();
      if (!clean || loading) return;

      if (sugs && sugs.parentNode) sugs.parentNode.removeChild(sugs);

      addMsg(clean, "user");
      history.push({ role: "user", content: clean });
      busy(true);
      showTyping(true);

      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, history: history.slice(-8) }),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return null;
            })
            .then(function (data) {
              return { ok: res.ok, data: data };
            });
        })
        .then(function (result) {
          var data = result.data || {};
          if (!result.ok || !data.response) {
            var code = data.code || "";
            var message =
              code === "AI_TIMEOUT"
                ? "El asistente tardó demasiado. Intenta de nuevo en unos segundos."
                : code === "AI_NOT_CONFIGURED"
                  ? "El asistente de IA todavía no está activado. Escríbenos a support@comeya.es mientras tanto."
                  : "No pude responder en este momento. Intenta de nuevo o escríbenos a support@comeya.es.";
            throw new Error(message);
          }
          addMsg(data.response, "bot");
          history.push({ role: "assistant", content: data.response });
        })
        .catch(function (error) {
          var raw = error && error.message ? error.message : "";
          var message = /failed to fetch|load failed|networkerror/i.test(raw)
            ? "No pude conectar con el asistente. Revisa tu conexión e inténtalo de nuevo."
            : raw || "No pude responder en este momento. Inténtalo de nuevo.";
          addMsg(message, "bot");
        })
        .then(function () {
          showTyping(false);
          busy(false);
          input.focus();
        });
    }

    fab.addEventListener("click", function () {
      if (root.classList.contains("cy-ai--open")) closeChat();
      else openChat();
    });

    closeBtn.addEventListener("click", closeChat);

    teaserOpen.addEventListener("click", openChat);

    teaserClose.addEventListener("click", function (event) {
      event.stopPropagation();
      rememberTeaser();
      hideTeaser();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && root.classList.contains("cy-ai--open")) {
        closeChat();
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value;
      input.value = "";
      send(value);
    });

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        var value = input.value;
        input.value = "";
        send(value);
      }
    });

    if (sugs) {
      sugs.addEventListener("click", function (event) {
        var button = event.target.closest(".cy-sug");
        if (!button) return;
        send(button.textContent);
      });
    }

    // El aviso aparece una sola vez por sesión, tras empezar a explorar.
    if (!teaserDismissed) {
      scheduleTeaser();
      window.addEventListener(
        "scroll",
        function () {
          if (teaserDismissed || root.classList.contains("cy-ai--teaser")) return;
          if (window.scrollY > 220) {
            if (teaserTimer) window.clearTimeout(teaserTimer);
            showTeaser();
          }
        },
        { passive: true }
      );
    }

    updateFabVisibility();
    window.addEventListener("scroll", updateFabVisibility, { passive: true });
    window.addEventListener("resize", updateFabVisibility);

    // No tapar el footer ni sus enlaces de contacto.
    var footer = document.getElementById("contacto") || document.querySelector("footer");
    var accessSection = document.getElementById("acceso");

    function updateChatVisibility() {
      if (root.classList.contains("cy-ai--open")) return;
      var hidden = footerVisible || accessVisible;
      root.classList.toggle("cy-ai--hidden", hidden);
      if (hidden) hideTeaser();
    }

    if (footer && "IntersectionObserver" in window) {
      var footerObserver = new IntersectionObserver(
        function (entries) {
          footerVisible = entries.some(function (entry) {
            return entry.isIntersecting;
          });
          updateChatVisibility();
        },
        { threshold: 0.04 }
      );
      footerObserver.observe(footer);
    }

    if (accessSection && "IntersectionObserver" in window) {
      var accessObserver = new IntersectionObserver(
        function (entries) {
          accessVisible = entries.some(function (entry) {
            return entry.isIntersecting;
          });
          updateChatVisibility();
        },
        { threshold: 0.06 }
      );
      accessObserver.observe(accessSection);
    }

    document.addEventListener("comeya:menu-open", function () {
      hideTeaser();
      root.classList.add("cy-ai--menu-open");
    });

    document.addEventListener("comeya:menu-close", function () {
      root.classList.remove("cy-ai--menu-open");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
