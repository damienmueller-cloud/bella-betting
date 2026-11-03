/* Owner-only members dashboard. All data comes live from the members service, which checks the session server-side. */
(function () {
  "use strict";
  var CFG = window.BB_MEMBERS || {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function aest(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Brisbane", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }
  function tok() { try { return localStorage.getItem("bb_member_session") || ""; } catch (e) { return ""; } }
  function load() {
    var meta = document.getElementById("adm-meta"), root = document.getElementById("adm-root");
    if (!tok()) { meta.textContent = ""; root.innerHTML = '<div class="notice"><p>Please <a href="../index.html">log in</a> first.</p></div>'; return; }
    fetch(CFG.adminEndpoint, { method: "POST", body: new URLSearchParams({ token: tok() }) })
      .then(function (r) { return r.json().then(function (j) { j._s = r.status; return j; }); })
      .then(function (j) {
        if (!j.ok) { meta.textContent = ""; root.innerHTML = '<div class="notice"><p>' + (j._s === 403 ? "This page is private." : "Sorry, the dashboard didn’t load. It will try again in an hour, or refresh the page.") + "</p></div>"; return; }
        meta.textContent = "Updated " + aest(j.generated) + " AEST. Refreshes every hour while open.";
        var h = '<div class="adm-totals"><div class="card"><b>' + j.real + '</b>Real people</div><div class="card"><b>' + j.new_today + '</b>New today</div><div class="card"><b>' + j.total + "</b>Total entries</div></div>";
        h += '<h2>Members, newest first</h2><div class="adm-scroll"><table class="adm"><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Signed up (AEST)</th><th>Joined by</th><th>Last login (AEST)</th><th>Flag</th></tr>';
        j.members.forEach(function (m) {
          h += "<tr><td>" + esc(m.name) + "</td><td>" + esc(m.mobile) + "</td><td>" + esc(m.email) + "</td><td>" + esc(aest(m.joined)) + "</td><td>" + esc(m.how) + "</td><td>" + esc(aest(m.last_login)) + '</td><td class="flag">' + esc(m.flags.join(", ")) + "</td></tr>";
        });
        h += "</table></div>";
        h += "<h2>Tips members backed</h2>";
        if (j.backed.length) {
          h += '<div class="adm-scroll"><table class="adm"><tr><th>Date</th><th>Tip</th><th>Members</th></tr>';
          j.backed.forEach(function (b) { h += "<tr><td>" + esc(b.date) + "</td><td>" + esc(b.tip) + "</td><td>" + b.members + "</td></tr>"; });
          h += "</table></div>";
        } else h += '<p class="small">Nobody has ticked “I backed this” yet.</p>';
        root.innerHTML = h;
      })
      .catch(function () { meta.textContent = ""; root.innerHTML = '<div class="notice"><p>Sorry, the dashboard didn’t load. It will try again in an hour, or refresh the page.</p></div>'; });
  }
  document.addEventListener("DOMContentLoaded", function () { load(); setInterval(load, 3600 * 1000); });
})();
