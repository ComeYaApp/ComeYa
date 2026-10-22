/* ==========================================================================
   ComeYa — acceso desde la landing (SMS + correo/contraseña)
   Mantiene el flujo existente; solo se limpia la interacción y se hace
   accesible. El backend no cambia.
   ========================================================================== */

(function () {
  "use strict";

  var BACKEND = "https://comeya-backend.onrender.com";
  var APP_URL = "https://app.comeya.es";

  var authMode = "sms";
  var loading = false;
  var otpPhone = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function setMode(mode) {
    authMode = mode;
    otpPhone = null;

    var modeSms = qs("mode-sms");
    var modePass = qs("mode-pass");
    var fieldSms = qs("field-sms");
    var fieldOtp = qs("field-otp");
    var fieldPassword = qs("field-password");
    var submitBtn = qs("submit-btn");

    if (modeSms) {
      modeSms.classList.toggle("is-active", mode === "sms");
      modeSms.setAttribute("aria-selected", mode === "sms" ? "true" : "false");
    }
    if (modePass) {
      modePass.classList.toggle("is-active", mode === "password");
      modePass.setAttribute(
        "aria-selected",
        mode === "password" ? "true" : "false"
      );
    }
    if (fieldSms) fieldSms.hidden = mode !== "sms";
    if (fieldOtp) fieldOtp.hidden = true;
    if (fieldPassword) fieldPassword.hidden = mode !== "password";
    if (submitBtn) {
      submitBtn.textContent =
        mode === "sms" ? "Enviar código" : "Iniciar sesión";
    }

    showError("");
    showSuccess("");
  }

  function setLoading(state) {
    loading = state;
    var submitBtn = qs("submit-btn");
    if (!submitBtn) return;

    submitBtn.disabled = state;
    submitBtn.setAttribute("aria-busy", state ? "true" : "false");

    if (state) {
      submitBtn.textContent =
        authMode === "sms" && !otpPhone
          ? "Enviando…"
          : authMode === "sms"
            ? "Verificando…"
            : "Entrando…";
      return;
    }

    submitBtn.textContent =
      authMode === "sms"
        ? otpPhone
          ? "Verificar código"
          : "Enviar código"
        : "Iniciar sesión";
  }

  function showError(message) {
    var element = qs("auth-error");
    if (!element) return;
    element.textContent = message || "";
    element.hidden = !message;
  }

  function showSuccess(message) {
    var element = qs("auth-success");
    if (!element) return;
    element.textContent = message || "";
    element.hidden = !message;
  }

  function formatPhone(raw) {
    var digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("34")) return "+" + digits;
    if (digits.length === 9) return "+34" + digits;
    return "+" + digits;
  }

  function redirectToApp(token, refreshToken, role, name) {
    var params = new URLSearchParams({
      token: token,
      refresh: refreshToken || "",
      role: role || "",
      name: name || "",
    });
    window.location.href = APP_URL + "/?" + params.toString();
  }

  function readJson(response) {
    return response
      .json()
      .catch(function () {
        return null;
      });
  }

  function handleSMS() {
    var phoneInput = qs("input-phone");
    if (!phoneInput) return;

    var raw = phoneInput.value.trim();
    if (!raw || raw.replace(/\D/g, "").length < 7) {
      showError("Introduce un número de teléfono válido.");
      phoneInput.focus();
      return;
    }

    var phone = formatPhone(raw);
    setLoading(true);
    showError("");
    showSuccess("");

    fetch(BACKEND + "/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone }),
    })
      .then(function (response) {
        return readJson(response).then(function (data) {
          return { ok: response.ok, data: data || {} };
        });
      })
      .then(function (result) {
        var data = result.data;

        if (data.userNotFound) {
          showError("No encontramos esa cuenta. Te llevamos al registro.");
          window.setTimeout(function () {
            window.location.href =
              APP_URL + "/Signup?phone=" + encodeURIComponent(phone);
          }, 1400);
          return;
        }

        if (!result.ok || data.success === false || data.error) {
          showError(
            data.error ||
              "No pudimos enviar el código. Revisa el número e inténtalo de nuevo."
          );
          return;
        }

        otpPhone = phone;
        var fieldSms = qs("field-sms");
        var fieldOtp = qs("field-otp");
        if (fieldSms) fieldSms.hidden = true;
        if (fieldOtp) fieldOtp.hidden = false;
        var submitBtn = qs("submit-btn");
        if (submitBtn) submitBtn.textContent = "Verificar código";

        showSuccess("Código enviado a " + phone + ".");
        var otpInput = qs("input-otp");
        if (otpInput) otpInput.focus();
      })
      .catch(function () {
        showError("Error de conexión. Inténtalo de nuevo.");
      })
      .then(function () {
        setLoading(false);
      });
  }

  function handleOTP() {
    var otpInput = qs("input-otp");
    if (!otpInput) return;

    var code = otpInput.value.trim();
    if (!code || code.length < 4) {
      showError("Introduce el código que has recibido.");
      otpInput.focus();
      return;
    }

    setLoading(true);
    showError("");
    showSuccess("");

    fetch(BACKEND + "/api/auth/phone-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: otpPhone, code: code }),
    })
      .then(function (response) {
        return readJson(response).then(function (data) {
          return { ok: response.ok, data: data || {} };
        });
      })
      .then(function (result) {
        var data = result.data;
        if (!data.token) {
          showError(data.error || "Código incorrecto o caducado.");
          return;
        }
        redirectToApp(
          data.token,
          data.refreshToken,
          data.user && data.user.role,
          data.user && data.user.name
        );
      })
      .catch(function () {
        showError("Error de conexión. Inténtalo de nuevo.");
      })
      .then(function () {
        setLoading(false);
      });
  }

  function handlePassword() {
    var identifierInput = qs("input-identifier");
    var passwordInput = qs("input-password");
    if (!identifierInput || !passwordInput) return;

    var identifier = identifierInput.value.trim();
    var password = passwordInput.value;

    if (!identifier || !password) {
      showError("Completa el correo y la contraseña.");
      (identifier ? passwordInput : identifierInput).focus();
      return;
    }

    setLoading(true);
    showError("");

    fetch(BACKEND + "/api/auth/dev-email-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: identifier, password: password }),
    })
      .then(function (response) {
        return readJson(response).then(function (data) {
          return { ok: response.ok, data: data || {} };
        });
      })
      .then(function (result) {
        var data = result.data;
        if (!result.ok || !data.success || !data.token) {
          showError(data.error || "Correo o contraseña incorrectos.");
          return;
        }
        redirectToApp(
          data.token,
          data.refreshToken,
          data.user && data.user.role,
          data.user && data.user.name
        );
      })
      .catch(function () {
        showError("Error de conexión. Inténtalo de nuevo.");
      })
      .then(function () {
        setLoading(false);
      });
  }

  function handleSubmit(event) {
    if (event) event.preventDefault();
    if (loading) return;

    var fieldOtp = qs("field-otp");
    var otpVisible = fieldOtp && !fieldOtp.hidden;

    if (otpVisible) handleOTP();
    else if (authMode === "sms") handleSMS();
    else handlePassword();
  }

  function togglePassword() {
    var passwordInput = qs("input-password");
    var button = qs("toggle-pass");
    if (!passwordInput || !button) return;

    var visible = passwordInput.type === "text";
    passwordInput.type = visible ? "password" : "text";
    button.textContent = visible ? "Ver" : "Ocultar";
    button.setAttribute(
      "aria-label",
      visible ? "Mostrar contraseña" : "Ocultar contraseña"
    );
  }

  function init() {
    var form = qs("login-form");
    if (!form) return;

    var modeSms = qs("mode-sms");
    var modePass = qs("mode-pass");
    var toggleButton = qs("toggle-pass");

    if (modeSms) {
      modeSms.addEventListener("click", function () {
        setMode("sms");
      });
    }
    if (modePass) {
      modePass.addEventListener("click", function () {
        setMode("password");
      });
    }
    if (toggleButton) {
      toggleButton.addEventListener("click", togglePassword);
    }

    form.addEventListener("submit", handleSubmit);
    setMode("sms");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
