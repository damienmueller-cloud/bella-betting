/* Bella Betting – free membership form. No third-party scripts. Posts a simple form (no CORS preflight). */
(function () {
  var cfg = window.BB_MEMBERS || {};
  var form = document.getElementById("join-form");
  if (!form) return;
  var err = document.getElementById("join-error");
  var vform = document.getElementById("verify-form");
  var done = document.getElementById("join-done");
  var lastMobile = "";

  if (!cfg.LIVE) {
    var b = document.createElement("p");
    b.className = "preview-banner";
    b.innerHTML = "<strong>Preview only.</strong> Membership sign-ups are not open yet. This page is on a test branch and is not published.";
    form.parentNode.insertBefore(b, form.parentNode.querySelector(".card"));
    // Not live: only allow test submissions from a preview URL (?preview=1).
    if (!/[?&]preview=1/.test(location.search)) { var sb = document.getElementById("join-submit"); sb.disabled = true; sb.textContent = "Join free (opens soon)"; }
  }

  function normMobile(v) {
    var s = String(v || "").replace(/[\s\-().]/g, "");
    if (/^04\d{8}$/.test(s)) return "+61" + s.slice(1);
    if (/^614\d{8}$/.test(s)) return "+" + s;
    if (/^\+614\d{8}$/.test(s)) return s;
    return null;
  }
  function show(el, msg) { el.textContent = msg; el.hidden = !msg; if (msg) el.focus && el.setAttribute("tabindex", "-1"); }
  var LABELS = { first_name: "your first name", email: "a valid email address", mobile: "an Australian mobile number (04xx xxx xxx)",
    age18: "confirmation that you are 18 or over", consent_email: "consent to the daily tips email",
    consent_calls: "consent to use your mobile to recognise you on the tips line", terms: "agreement to the members terms" };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    show(err, "");
    var fd = new FormData(form), bad = [];
    ["first_name", "email", "mobile"].forEach(function (k) { form.elements[k].removeAttribute("aria-invalid"); });
    if (!(fd.get("first_name") || "").trim()) bad.push("first_name");
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test((fd.get("email") || "").trim())) bad.push("email");
    var m = normMobile(fd.get("mobile")); if (!m) bad.push("mobile");
    ["age18", "consent_email", "consent_calls", "terms"].forEach(function (k) { if (fd.get(k) !== "yes") bad.push(k); });
    if (bad.length) {
      bad.forEach(function (k) { if (form.elements[k] && form.elements[k].setAttribute) form.elements[k].setAttribute("aria-invalid", "true"); });
      show(err, "Please add " + bad.map(function (k) { return LABELS[k]; }).join(", ") + ".");
      return;
    }
    fd.set("mobile", m); lastMobile = m;
    var btn = document.getElementById("join-submit"); btn.disabled = true; btn.textContent = "Joining…";
    fetch(cfg.joinEndpoint, { method: "POST", body: new URLSearchParams(fd) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = "Join free";
        if (res.j.ok) {
          form.hidden = true;
          if (res.j.verify) { document.getElementById("verify-mobile").textContent = res.j.mobile_masked; vform.hidden = false; }
          else { done.hidden = false; if (res.j.status === "updated") document.getElementById("join-done-text").textContent = "You were already on the list, so we've updated your details."; }
          window.scrollTo(0, 0);
        } else if (res.j.error === "invalid") {
          show(err, "Please check: " + (res.j.fields || []).map(function (k) { return LABELS[k] || k; }).join(", ") + ".");
        } else if (res.j.error === "number_already_registered") {
          show(err, "That mobile is already linked to a membership. To change details, call the tips line or email us.");
        } else {
          show(err, "Sorry, something went wrong. Please try again later.");
        }
      })
      .catch(function () { btn.disabled = false; btn.textContent = "Join free"; show(err, "Sorry, we couldn't reach the members service. Please try again later."); });
  });

  if (vform) vform.addEventListener("submit", function (e) {
    e.preventDefault();
    var verr = document.getElementById("verify-error"); show(verr, "");
    var body = new URLSearchParams({ mobile: lastMobile, code: vform.elements.code.value.trim() });
    fetch(cfg.verifyEndpoint, { method: "POST", body: body }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.ok) { vform.hidden = true; done.hidden = false; document.getElementById("join-done-text").textContent = "Your mobile is confirmed and your free membership is active."; }
      else show(verr, j.error === "wrong_code" ? "That code didn't match. Please check the text message and try again." : "Sorry, we couldn't confirm the code. Please try again later.");
    }).catch(function () { show(verr, "Sorry, we couldn't reach the members service."); });
  });
})();
