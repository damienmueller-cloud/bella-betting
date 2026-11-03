/* Bella Betting – members-only tips (via the members service /member with a 30-day session), public teaser + results. No dependencies. */
(function () {
  "use strict";

  // Six DSS taglines permitted for website advertising (exact wording, DSS factsheet).
  // Rotated by day so each is used about equally; the HTML default is shown without JS.
  var TAGLINES = [
    "Chances are you’re about to lose.",
    "Think. Is this a bet you really want to place?",
    "What’s gambling really costing you?",
    "What are you prepared to lose today? Set a deposit limit.",
    "Imagine what you could be buying instead.",
    "What are you really gambling with?"
  ];

  function sydneyToday() {
    // en-CA gives YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }
  function rotateTagline() {
    var el = document.getElementById("rg-tagline");
    if (!el) return;
    var d = sydneyToday().split("-").map(Number);
    var dayNum = Math.floor(Date.UTC(d[0], d[1] - 1, d[2]) / 86400000);
    el.textContent = TAGLINES[dayNum % TAGLINES.length];
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " returned " + r.status);
      return r.json();
    });
  }
  function fmtDate(iso) {
    var p = iso.split("-").map(Number);
    var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12));
    return new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(dt);
  }
  function fmt12(hhmm) {
    var m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
    if (!m) return esc(hhmm);
    var h = +m[1], ap = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return h + ":" + m[2] + ap;
  }
  function fmtChecked(s) {
    // e.g. "2026-10-10T13:55+11:00 (approx.)"
    var m = /T(\d{2}:\d{2})(?::\d{2})?([+-]\d{2}:?\d{2}|Z)?(.*)$/.exec(s || "");
    if (!m) return esc(s);
    var zone = m[2] === "+11:00" || m[2] === "+1100" ? "AEDT" : (m[2] === "+10:00" || m[2] === "+1000" ? "AEST" : (m[2] || ""));
    return fmt12(m[1]) + " " + zone + (m[3] ? " " + esc(m[3].trim()) : "");
  }
  /* Race/game status for members: recorded result, run (result pending), or upcoming (Sydney time). */
  function sydneyNowHM() {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  }
  function itemStatus(item, date) {
    var r = item && item.result;
    if (r && r.outcome) {
      var o = String(r.outcome).toLowerCase();
      var label = o === "won" ? "Won" + (r.settled_odds ? " at $" + Number(r.settled_odds).toFixed(2) : "") : o === "placed" ? "Placed" : o === "scratched" ? "Scratched" : o === "lost" ? "Lost" : esc(r.outcome);
      return { key: o === "won" ? "won" : "done", label: label };
    }
    var today = sydneyToday(), m = /^(\d{1,2}):(\d{2})/.exec(item.start_time_aedt || "");
    var hm = m ? (m[1].length === 1 ? "0" + m[1] : m[1]) + ":" + m[2] : null;
    var run = date < today || (date === today && hm && hm <= sydneyNowHM());
    return run ? { key: "pending", label: "Run, result pending" } : { key: "upcoming", label: "Upcoming" };
  }
  function statusCell(item, date) {
    var st = itemStatus(item, date);
    return '<td data-label="Status"><span class="status status-' + st.key + '">' + st.label + "</span></td>";
  }
  function isTopUp(day, s) {
    var mt = (day.top_up && day.top_up.meetings) || [];
    return mt.some(function (m) { return String(s.event || "").indexOf(m) === 0; });
  }
  // Drop footer duplicates (taglines, helpline, BetStop) from per-card RG notes
  function cardNotes(list) {
    return (list || []).filter(function (t) {
      return TAGLINES.indexOf(t.replace(/'/g, "’")) === -1 && !/1800 858 858|betstop/i.test(t);
    });
  }
  function qsDate() {
    var m = /[?&]date=(\d{4}-\d{2}-\d{2})/.exec(location.search);
    return m ? m[1] : null;
  }

  /* ---------- Today / single day ---------- */
  function renderDay(manifest, dayData) {
    var root = document.getElementById("tips-root");
    var meta = document.getElementById("tips-meta");
    var heading = document.getElementById("tips-heading");
    var dates = manifest.dates || [];
    if (!dates.length) { meta.textContent = "No tips have been published yet."; return; }
    var wanted = qsDate();
    var date = wanted && dates.indexOf(wanted) !== -1 ? wanted : dates[0];
    var today = sydneyToday();

    return Promise.resolve(dayData).then(function (day) {
      if (wanted) heading.textContent = "Tips for " + fmtDate(date);
      else if (date === today) heading.textContent = "Today’s tips";
      else heading.textContent = "Latest tips";
      document.title = heading.textContent + " | Bella Betting";

      var gen = day.generated_at ? " Published " + fmtChecked(day.generated_at).replace(/ \(.*$/, "") + "." : "";
      meta.innerHTML = esc(fmtDate(date)) + ". All times are Sydney time (AEDT)." + esc(gen) +
        (date !== today && !wanted ? " <strong>No tips have been published for today yet; this is the most recent card.</strong>" : "") +
        (date < today ? " <strong>These races have already been run.</strong>" : "");

      var html = simpleHtml(day, date) + '<details class="more-detail"><summary>More detail (horse numbers, jockeys, prices, reasons)</summary>' + cardHtml(day, date) + "</details>";
      if (dates.length > 1) html += '<p><a href="archive.html">See past tips in the archive</a></p>';
      root.innerHTML = html;
      if (token()) bindBacked(date);
    });
  }


  /* Tiers (from 23 Oct 2026): Top Rated passes every method rule; Best of the Day is lower confidence. */
  function tierRank(x) { return x && x.tier === "Best of the Day" ? 1 : 0; }
  function tierTag(x) {
    if (!x || !x.tier) return "";
    var bod = x.tier === "Best of the Day";
    return '<br><span class="tag-tier ' + (bod ? "tier-bod" : "tier-top") + '">' + (bod ? "Best of the Day · lower confidence" : "Top Rated") + "</span>";
  }
  function tierNotice(list) {
    var nTop = list.filter(function (x) { return x.tier === "Top Rated"; }).length;
    var nBod = list.filter(function (x) { return x.tier === "Best of the Day"; }).length;
    if (!nBod && !nTop) return "";
    return '<div class="notice" role="note"><p><strong>Top Rated:</strong> ' + (nTop ? nTop + " pick" + (nTop === 1 ? "" : "s") + " that pass every rule in our method." : "none today; nothing passed every rule in our method.") +
      "</p>" + (nBod ? "<p><strong>Best of the Day:</strong> " + nBod + " lower-confidence pick" + (nBod === 1 ? "" : "s") + ". These are the best value we could find, but the edge is small and they did not pass every rule. Treat them as lower confidence; most bets lose.</p>" : "") + "</div>";
  }


  /* ---------- Simple view (3 Nov 2026): one plain line per bet, best pick first. Spec: ../FORMAT.md ---------- */
  function confNum(x) {
    var m = /\((\d)\s*\/\s*5\)/.exec(x.confidence || "");
    if (m) return +m[1];
    var c = String(x.confidence || "").toLowerCase();
    return /high/.test(c) ? 4 : /medium/.test(c) ? 3 : /low/.test(c) ? 1 : 2;
  }
  function simpleConf(x, kind) {
    if (x.simple_confidence) return x.simple_confidence;
    if (kind === "roughie") return "Long shot";
    var n = confNum(x), w = n >= 4 ? "Strong" : n >= 2 ? "Fair" : "Long shot";
    if (x.tier === "Best of the Day" && w === "Strong") w = "Fair";
    return w;
  }
  function betWord(x, kind) {
    var b = String(x.bet_type || x.market || (kind === "roughie" ? "win" : "")).toLowerCase();
    if (/trifecta/.test(b)) return "TRIFECTA BOX";
    if (/multi/.test(b)) return "MULTI";
    if (/each/.test(b)) return "EACH-WAY";
    if (/place/.test(b)) return "PLACE";
    if (/win/.test(b) || kind !== "sport") return "WIN";
    return esc(x.market || "").toUpperCase();
  }
  function raceLabel(x) {
    var meet = x.meeting || String(x.event || "").split(/ \(| –/)[0];
    var m = /Race (\d+)/i.exec(x.event || "");
    return '<b class="s-track">' + esc(meet.toUpperCase()) + "</b>" + (m ? ' <b class="s-race">Race ' + m[1] + "</b>" : "");
  }
  function simpleRank(it) {
    var x = it.x;
    return (it.kind === "roughie" ? 20 : 0) + (x.tier === "Best of the Day" ? 10 : 0) + (5 - confNum(x));
  }
  function tipId(it) {
    var x = it.x;
    return (it.kind + "-" + (x.event || x.track || "") + "-" + (x.race_no || x.race || "") + "-" + (x.horse || x.selection || "")).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  }
  function bindBacked(date) {
    var boxes = document.querySelectorAll(".backed input");
    if (!boxes.length) return;
    var msg = document.getElementById("backed-msg");
    member({ action: "backed_get", token: token(), date: date }).then(function (j) {
      if (!j.ok) return;
      boxes.forEach(function (b) { b.checked = (j.tids || []).indexOf(b.getAttribute("data-tid")) !== -1; });
    }).catch(function () {});
    boxes.forEach(function (b) {
      b.addEventListener("change", function () {
        member({ action: "backed_set", token: token(), date: date, tid: b.getAttribute("data-tid"), label: b.getAttribute("data-label"), on: b.checked ? "1" : "0" }).then(function (j) {
          if (msg) msg.textContent = j.ok ? "Saved, thanks." : "Sorry, that didn\u2019t save. Please try again later.";
          if (!j.ok) b.checked = !b.checked;
        }).catch(function () { b.checked = !b.checked; if (msg) msg.textContent = "Sorry, that didn\u2019t save. Please try again later."; });
      });
    });
  }
  function simpleHtml(day, date) {
    var items = [];
    (day.selections || []).forEach(function (x) { items.push({ x: x, kind: "race" }); });
    (day.sports || []).forEach(function (x) { items.push({ x: x, kind: "sport" }); });
    (day.roughies || []).forEach(function (x) { items.push({ x: x, kind: "roughie" }); });
    if (!items.length) return '<section class="simple"><h2>Today’s bets</h2><p class="simple-none">No bets from us today. That’s OK – sometimes nothing is good enough.</p></section>';
    items.sort(function (a, b) {
      return simpleRank(a) - simpleRank(b) || (parseFloat(b.x.edge_pct) || 0) - (parseFloat(a.x.edge_pct) || 0) || (a.x.start_time_aedt || "").localeCompare(b.x.start_time_aedt || "");
    });
    var ew = false, pl = false, h = '<section class="simple" aria-labelledby="simple-h"><h2 id="simple-h">Today’s bets</h2><p class="simple-intro">Best pick first. Times are Sydney time.</p><ol class="simple-list">';
    items.forEach(function (it, i) {
      var x = it.x, bw = betWord(x, it.kind);
      if (bw === "EACH-WAY") ew = true; if (bw === "PLACE") pl = true;
      var where = it.kind === "sport" ? '<b class="s-track">' + esc(x.event) + "</b>" : raceLabel(x);
      var name = it.kind === "roughie" ? x.horse : (x.horse || String(x.selection || "").replace(/ \(.*$/, ""));
      var no = x.saddlecloth != null ? x.saddlecloth : x.tab_no;
      var st = itemStatus(x, date);
      var conf = simpleConf(x, it.kind);
      h += '<li class="simple-item' + (i === 0 ? " simple-best" : "") + '">' + (i === 0 ? '<span class="simple-tag">Best pick</span>' : "") +
        '<span class="simple-line">' + where + ' <span class="s-time">· ' + fmt12(x.start_time_aedt) + '</span> <span class="s-dash">—</span><b class="s-horse">' + (no != null && no !== "" ? "#" + esc(no) + " " : "") + esc(String(name).toUpperCase()) + '</b> <span class="s-dash">—</span> <b class="s-bet">' + bw + "</b></span>" +
        '<span class="simple-sub">' + esc(conf) + (x.tier === "Best of the Day" ? " (lower confidence)" : "") + (it.kind === "roughie" ? " (higher risk)" : "") +
        (st.key !== "upcoming" ? " · " + st.label : "") + "</span>" +
        (token() ? '<label class="backed"><input type="checkbox" data-tid="' + esc(tipId(it)) + '" data-label="' + esc(it.kind + ": " + String(x.event || (x.track ? x.track + " R" + (x.race_no || x.race || "") : "")) + " " + name) + '"> I backed this</label>' : "") + "</li>";
    });
    h += "</ol>";
    if (token()) h += '<p class="small muted backed-note">Optional: tick the tips you backed so we can see which ones members follow. Only Bella Betting sees this. <span id="backed-msg" role="status" aria-live="polite"></span></p>';
    h += '<p class="simple-key"><strong>Win</strong> = your pick must come first.' + (pl || ew ? " <strong>Place</strong> = your horse must finish in the top 3 (top 2 in small fields)." : "") + (ew ? " <strong>Each-way</strong> = a win bet and a place bet together (two bets)." : "") + "</p>";
    h += '<p class="simple-key"><strong>Strong</strong>, <strong>Fair</strong> and <strong>Long shot</strong> are our opinion only. Most bets lose. Prices change, so check before you bet.</p></section>';
    return h;
  }

  function cardHtml(day, date) {
    var sels = (day.selections || []).slice().sort(function (a, b) {
      return tierRank(a) - tierRank(b) || (a.start_time_aedt || "").localeCompare(b.start_time_aedt || "");
    });

    var html = "";
    var all = (day.selections || []).concat(day.roughies || [], day.sports || []);
    var nRun = all.filter(function (x) { return itemStatus(x, date).key !== "upcoming"; }).length;
    if (all.length) html += '<p class="run-summary"><strong>' + (all.length - nRun) + " upcoming</strong> · " + nRun + " already run (results shown where recorded)</p>";
    if (day.notes) html += '<p class="small">' + esc(day.notes) + "</p>";
    if (day.top_up) html += '<div class="notice" role="note"><p><strong>' + esc(day.top_up.label || "Top-up") + "</strong>" + (day.top_up.added_at ? " (added " + fmtChecked(day.top_up.added_at) + ")" : "") + ": " + esc((day.top_up.meetings || []).join(", ")) + ".</p>" + (day.top_up.notes ? "<p class=\"small\">" + esc(day.top_up.notes) + "</p>" : "") + "</div>";
    if (day.track_conditions) {
      html += '<p class="small"><strong>Track conditions:</strong> ' + Object.keys(day.track_conditions).map(function (k) {
        return esc(k) + " – " + esc(day.track_conditions[k]);
      }).join("; ") + ".</p>";
    }
    html += tierNotice((day.selections || []).concat(day.roughies || [], day.sports || []));
    var nTop = sels.filter(function (x) { return isTopUp(day, x); }).length;
    html += '<table class="tips"><caption>' + sels.length + " selection" + (sels.length === 1 ? "" : "s") + (nTop ? " (" + (sels.length - nTop) + " morning, " + nTop + " " + esc((day.top_up.label || "top-up").toLowerCase()) + ")" : "") + ", " + (sels.some(function (x) { return x.tier; }) ? "Top Rated first, then race order" : "in race order") + "</caption>" +
      '<thead><tr><th scope="col">Time (AEDT)</th><th scope="col">Race</th><th scope="col">Selection</th><th scope="col">Reasoning</th><th scope="col">Confidence</th><th scope="col">Odds (at time checked)</th><th scope="col">Status</th></tr></thead><tbody>';
    sels.forEach(function (s) {
      html += "<tr>" +
        '<td data-label="Time (AEDT)" class="time">' + fmt12(s.start_time_aedt) + "</td>" +
        '<td data-label="Race">' + esc(s.event) + (s.market ? '<br><span class="muted small">Market: ' + esc(s.market) + "</span>" : "") + (isTopUp(day, s) ? '<br><span class="tag-topup">' + esc(day.top_up.label || "Top-up") + "</span>" : "") + tierTag(s) + "</td>" +
        '<td data-label="Selection" class="sel">' + esc(s.selection) + "</td>" +
        '<td data-label="Reasoning" class="reason">' + esc(s.reasoning) + "</td>" +
        '<td data-label="Confidence"><span class="badge">' + esc(s.confidence) + "</span></td>" +
        '<td data-label="Odds (at time checked)" class="odds">' + esc(s.best_odds) +
          '<span class="odds-src">Source: ' + esc(s.odds_source) + "</span>" +
          '<span class="odds-src">Checked: ' + fmtChecked(s.odds_checked_at) + "</span></td>" +
        statusCell(s, date) + "</tr>";
    });
    html += "</tbody></table>";
    html += '<p class="small muted">Odds change. Prices are from a single bookmaker at the time shown, are not a recommendation of that bookmaker, and may no longer be available.</p>';

    html += renderRoughies(day, date);
    html += renderSports(day, date);
    var notes = cardNotes(day.responsible_gambling);
    if (notes.length) html += '<div class="notice" role="note">' + notes.map(function (n) { return "<p>" + esc(n) + "</p>"; }).join("") + "</div>";
    return html;
  }

  /* ---------- Sport (pre-match only) ---------- */
  function renderSports(day, date) {
    var list = (day.sports || []).slice();
    var note = day.sports_notes || day.sport_notes;  // sport_notes: older cards
    if (!list.length && !note) return "";
    list.sort(function (a, b) { return (a.start_time_aedt || "").localeCompare(b.start_time_aedt || ""); });
    var h = '<section aria-labelledby="sport-h-' + date + '"><h2 id="sport-h-' + date + '">Sport</h2>' +
      '<div class="notice" role="note"><p><strong>Pre-match only.</strong> These are tips for markets before the game starts. We never tip in-play or live markets, and we don’t update prices once a game has started. ' +
      "Online in-play betting on sport is illegal in Australia.</p></div>";
    if (list.length) {
      h += '<table class="tips sports"><caption>' + list.length + " sport selection" + (list.length === 1 ? "" : "s") +
        (day.sports_generated_at ? ", checked " + fmtChecked(day.sports_generated_at) : "") + ", in start-time order</caption>" +
        '<thead><tr><th scope="col">Start (AEDT)</th><th scope="col">Event</th><th scope="col">Selection</th><th scope="col">Reasoning</th><th scope="col">Confidence</th><th scope="col">Odds (at time checked)</th><th scope="col">Status</th></tr></thead><tbody>';
      list.forEach(function (s) {
        h += "<tr>" +
          '<td data-label="Start (AEDT)" class="time">' + fmt12(s.start_time_aedt) + "</td>" +
          '<td data-label="Event">' + esc(s.event) + '<br><span class="muted small">' + esc([s.sport, s.competition].filter(Boolean).join(" · ")) + "</span>" +
            (s.market ? '<br><span class="muted small">Market: ' + esc(s.market) + "</span>" : "") + tierTag(s) + "</td>" +
          '<td data-label="Selection" class="sel">' + esc(s.selection) + "</td>" +
          '<td data-label="Reasoning" class="reason">' + esc(s.reasoning) + (s.note ? '<br><span class="muted small">Note: ' + esc(s.note) + "</span>" : "") + "</td>" +
          '<td data-label="Confidence"><span class="badge">' + esc(s.confidence) + "</span></td>" +
          '<td data-label="Odds (at time checked)" class="odds">' + esc(s.best_odds) +
            '<span class="odds-src">Source: ' + esc(s.odds_source) + "</span>" +
            '<span class="odds-src">Checked: ' + fmtChecked(s.odds_checked_at) + "</span></td>" +
          statusCell(s, date) + "</tr>";
      });
      h += "</tbody></table>";
    }
    if (note) h += '<p class="small">' + esc(note) + "</p>";
    h += '<p class="small muted">Odds change. Sport prices are pre-match, from an Australian-licensed bookmaker at the time shown, and are not a recommendation of that bookmaker. Check team news before the start.</p></section>';
    return h;
  }

  /* ---------- Roughies (longer-priced, higher-risk runners) ---------- */
  function pct(n) {
    var v = parseFloat(n);
    return isNaN(v) ? "" : (Math.round(v * 10) / 10).toFixed(1) + "%";
  }
  function money(n) {
    var v = parseFloat(n);
    return isNaN(v) ? esc(n) : "$" + v.toFixed(2);
  }
  function renderRoughies(day, date) {
    var list = (day.roughies || []).slice();
    if (!list.length) return "";
    list.sort(function (a, b) {
      return (a.start_time_aedt || "").localeCompare(b.start_time_aedt || "") || (a.rank || 0) - (b.rank || 0);
    });
    var h = '<section aria-labelledby="roughies-h-' + date + '"><h2 id="roughies-h-' + date + '">Roughies</h2>' +
      '<div class="notice notice-risk" role="note"><p><strong>Higher risk: most roughies lose.</strong> These are longer-priced runners (about $8 or more). ' +
      "Longer odds mean a lower chance of winning, so expect most of them to lose, sometimes for weeks at a time.</p>" +
      "<p><strong>Implied chance</strong> is simply 1 ÷ the win odds shown (before the bookmaker’s margin). <strong>Our estimate</strong> is a rough personal judgement, not a model, " +
      "and is often wrong. A higher estimate than the implied chance is our opinion only; it does not mean a bet will pay off.</p>" +
      (day.roughies_notes ? '<p class="small">' + esc(day.roughies_notes) + "</p>" : "") + "</div>";
    h += '<table class="tips roughies"><caption>' + list.length + " roughie" + (list.length === 1 ? "" : "s") +
      (day.roughies_generated_at ? ", prices checked " + fmtChecked(day.roughies_generated_at) : "") + ", in race order</caption>" +
      '<thead><tr><th scope="col">Time (AEDT)</th><th scope="col">Race</th><th scope="col">Selection</th><th scope="col">Reasoning</th><th scope="col">Confidence</th><th scope="col">Odds (at time checked)</th><th scope="col">Implied vs our estimate</th><th scope="col">Status</th></tr></thead><tbody>';
    list.forEach(function (r) {
      var implied = r.implied_prob_pct != null ? pct(r.implied_prob_pct) : (parseFloat(r.win_odds) > 1 ? pct(100 / parseFloat(r.win_odds)) : "");
      var est = r.est_chance_pct != null ? String(r.est_chance_pct).replace("-", "–") + "%" : "–";
      var who = [r.barrier != null ? "barrier " + r.barrier : "", r.jockey || ""].filter(Boolean).join(", ");
      h += "<tr>" +
        '<td data-label="Time (AEDT)" class="time">' + fmt12(r.start_time_aedt) + "</td>" +
        '<td data-label="Race">' + esc(r.event) + tierTag(r) + "</td>" +
        '<td data-label="Selection" class="sel">' + esc(r.horse) + (who ? '<br><span class="muted small">' + esc(who) + "</span>" : "") + "</td>" +
        '<td data-label="Reasoning" class="reason">' + esc(r.reasoning) + (r.note ? '<br><span class="muted small">Note: ' + esc(r.note) + "</span>" : "") + "</td>" +
        '<td data-label="Confidence"><span class="badge">' + esc(r.confidence) + "</span></td>" +
        '<td data-label="Odds (at time checked)" class="odds">' + money(r.win_odds) + " win" + (r.place_odds != null ? " / " + money(r.place_odds) + " place" : "") + " (fixed)" +
          '<span class="odds-src">Source: ' + esc(r.odds_source) + "</span>" +
          '<span class="odds-src">Checked: ' + fmtChecked(r.odds_checked_at) + "</span></td>" +
        '<td data-label="Implied vs our estimate" class="chance">Implied ' + esc(implied) + '<br><span class="muted small">Our estimate ' + esc(est) + "</span></td>" +
        statusCell(r, date) + "</tr>";
    });
    h += '</tbody></table><p class="small muted">Odds change. Roughie prices move a lot and may no longer be available. Only bet what you can afford to lose.</p></section>';
    return h;
  }

  /* ---------- Archive ---------- */
  function renderArchive(manifest) {
    var root = document.getElementById("archive-root");
    var days = manifest.days || (manifest.dates || []).map(function (d) { return { date: d }; });
    if (!days.length) { root.innerHTML = "<p>No tips published yet.</p>"; return; }
    var html = '<div class="table-scroll"><table class="data"><caption class="muted small" style="text-align:left;padding:.4rem 0">' + days.length + " card" + (days.length === 1 ? "" : "s") + '</caption><thead><tr><th scope="col">Date</th><th scope="col">Selections</th><th scope="col">Results recorded</th></tr></thead><tbody>';
    days.forEach(function (d) {
      html += '<tr><td><a href="index.html?date=' + esc(d.date) + '">' + esc(fmtDate(d.date)) + "</a></td><td>" +
        (d.selections != null ? esc(d.selections) : "–") + "</td><td>" +
        (d.results_recorded ? esc(d.results_recorded) + " of " + esc(d.selections) : "Not yet") + "</td></tr>";
    });
    root.innerHTML = html + "</tbody></table></div>";
  }

  /* Members' archive: index table plus every day's full card (fetched one at a time from the members service). */
  function renderMemberArchive(manifest) {
    renderArchive(manifest);
    var root = document.getElementById("archive-root");
    var dates = manifest.dates || [];
    var box = document.createElement("div"); box.id = "archive-cards"; root.appendChild(box);
    return dates.reduce(function (p, d) {
      return p.then(function () {
        return member({ action: "tips", token: token(), date: d }).then(function (j) {
          if (!j.ok || !j.card) return;
          var sec = document.createElement("section");
          sec.className = "archive-day"; sec.id = "day-" + d;
          sec.innerHTML = '<h2 class="archive-date">' + esc(fmtDate(d)) + "</h2>" + cardHtml(j.card, d);
          box.appendChild(sec);
        });
      });
    }, Promise.resolve());
  }

  /* ---------- Results / ROI ---------- */
  // A selection's result is recorded as: "result": {"outcome": "won"|"lost"|"placed"|"scratched", "settled_odds": 2.15}
  // "placed" counts as a loss for the win-only, level-stake tracker.
  function renderResults(pub) {
    var root = document.getElementById("results-root");
    Promise.resolve(pub.days || [])
      .then(function (daysData) {
        var rows = [], staked = 0, wins = 0, pl = 0, byTier = {};
        daysData.forEach(function (day) {
          if (!day) return;
          (day.selections || []).forEach(function (s) {
            var r = s.result;
            if (!r || !r.outcome) return;
            var o = String(r.outcome).toLowerCase();
            var odds = parseFloat(r.settled_odds);
            var rowPL = null;
            if (o === "scratched") rowPL = null;
            else if (o === "won" && odds > 1) { staked += 1; wins += 1; rowPL = odds - 1; }
            else if (o === "won") { return; } // no valid odds recorded: skip rather than guess
            else { staked += 1; rowPL = -1; }
            if (rowPL !== null) pl += rowPL;
            var tier = s.tier || "Top Rated";
            var bt = byTier[tier] = byTier[tier] || { n: 0, w: 0, pl: 0 };
            if (rowPL !== null) { bt.n += 1; bt.pl += rowPL; if (o === "won") bt.w += 1; }
            rows.push({ tier: tier, date: day.date, time: s.start_time_aedt, sel: String(s.selection).replace(/\s*\(.*\)\s*$/, ""), ev: String(s.event).replace(/\s*\(G\d.*$|\s*\((?!VIC|NSW|QLD|SA|WA|TAS|ACT|NT)[^)]*\)\s*$/, ""), outcome: o, odds: isNaN(odds) ? "" : odds.toFixed(2), pl: rowPL });
          });
        });
        if (!staked) {
          root.innerHTML = '<div class="notice"><p><strong>No results recorded yet.</strong> Strike rate and ROI will appear here once results for published selections have been recorded. We don’t show estimates or projections.</p></div>';
          return;
        }
        var sr = (wins / staked) * 100, roi = (pl / staked) * 100;
        var sign = function (n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n).toFixed(2); };
        var html = '<div class="stats">' +
          '<div class="stat"><span class="muted small">Settled selections</span><b>' + staked + "</b></div>" +
          '<div class="stat"><span class="muted small">Winners</span><b>' + wins + "</b></div>" +
          '<div class="stat"><span class="muted small">Strike rate</span><b>' + sr.toFixed(1) + "%</b></div>" +
          '<div class="stat"><span class="muted small">Profit/loss (units)</span><b>' + sign(pl) + "</b></div>" +
          '<div class="stat"><span class="muted small">ROI</span><b>' + sign(roi) + "%</b></div></div>";
        html += '<div class="table-scroll"><table class="data"><caption class="muted small" style="text-align:left;padding:.4rem 0">By tier, tracked separately (cards before 23 Oct 2026 count as Top Rated)</caption><thead><tr><th scope="col">Tier</th><th scope="col">Settled</th><th scope="col">Winners</th><th scope="col">P/L (units)</th><th scope="col">ROI</th></tr></thead><tbody>';
        ["Top Rated", "Best of the Day"].forEach(function (t) {
          var b = byTier[t] || { n: 0, w: 0, pl: 0 };
          html += "<tr><td>" + esc(t) + "</td><td>" + b.n + "</td><td>" + b.w + "</td><td>" + (b.n ? sign(b.pl) : "–") + "</td><td>" + (b.n ? sign(b.pl / b.n * 100) + "%" : "–") + "</td></tr>";
        });
        html += "</tbody></table></div>";
        html += '<div class="table-scroll"><table class="data"><caption class="muted small" style="text-align:left;padding:.4rem 0">Recorded results (1 unit win stake each)</caption><thead><tr><th scope="col">Date</th><th scope="col">Tier</th><th scope="col">Selection</th><th scope="col">Race</th><th scope="col">Outcome</th><th scope="col">Odds</th><th scope="col">P/L (units)</th></tr></thead><tbody>';
        rows.forEach(function (r) {
          html += "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.tier) + "</td><td>" + esc(r.sel) + "</td><td>" + esc(r.ev) + "</td><td>" + esc(r.outcome) +
            "</td><td>" + esc(r.odds) + "</td><td>" + (r.pl === null ? "Excluded" : sign(r.pl)) + "</td></tr>";
        });
        root.innerHTML = html + "</tbody></table></div>";
      });
  }


  /* ---------- Members: session, login, teaser ---------- */
  var CFG = window.BB_MEMBERS || {};
  var TOKEN_KEY = "bb_member_session";
  function token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function member(params, endpoint) {
    var body = new URLSearchParams(params);
    if (CFG.testToken) body.set("test", CFG.testToken);
    return fetch(endpoint || CFG.memberEndpoint, { method: "POST", body: body }).then(function (r) {
      return r.json().then(function (j) { j._status = r.status; return j; });
    });
  }
  function loadMemberTips(date) {
    if (!token() || !CFG.memberEndpoint) return Promise.resolve(null);
    return member({ action: "tips", token: token(), date: date || "" }).then(function (j) {
      if (j.ok) return j;
      if (j._status === 401) setToken("");
      return null;
    });
  }
  // Interim login (AU SMS blocked): mobile + the email you joined with. SMS-code login returns when CFG.loginMode = "sms".
  var EMAIL_LOGIN = CFG.loginMode === "email";
  function emailLoginForm() {
    return '<form id="login-form" class="login" novalidate>' +
      '<label for="login-mobile">Your mobile number</label><input id="login-mobile" name="mobile" type="tel" inputmode="tel" autocomplete="tel" placeholder="04xx xxx xxx" required>' +
      '<label for="login-email">The email you joined with</label><input id="login-email" name="email" type="email" autocomplete="email" required>' +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">' +
      '<p><button class="btn" type="submit" id="login-btn">Log in</button></p>' +
      '<p id="login-msg" class="small" role="status" aria-live="polite"></p></form>' +
      '<p class="small muted">You stay logged in on this device for 30 days. Logging in with a code texted to your mobile is coming soon.</p>';
  }
  function bindEmailLogin() {
    var form = document.getElementById("login-form"), msg = document.getElementById("login-msg"), btn = document.getElementById("login-btn");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      btn.disabled = true; msg.textContent = "Please wait…";
      member({ action: "login_email", mobile: form.mobile.value, email: form.email.value, website: form.website.value }).then(function (j) {
        btn.disabled = false;
        if (j.ok && j.token) { setToken(j.token); location.reload(); }
        else if (j.error === "rate_limited") msg.textContent = "Too many attempts. Please wait an hour and try again, or call 0495 040 400 to hear today\u2019s tips.";
        else msg.innerHTML = 'That mobile and email don’t match a membership. Check both, or <a href="join.html">join free</a>.';
      }).catch(function () { btn.disabled = false; msg.textContent = "Sorry, we couldn\u2019t connect just now. Please try again in a minute, or call 0495 040 400 to hear today\u2019s tips."; });
    });
  }
  function memberBar(name) {
    var el = document.getElementById("member-bar");
    if (!el) return;
    el.hidden = false;
    document.body.classList.add("is-member");
    el.innerHTML = "Logged in as a member" + (name ? ", " + esc(name) : "") + '. <a href="#" id="logout">Log out</a><span id="admin-link"></span>';
    if (CFG.adminEndpoint) member({ token: token(), check: "1" }, CFG.adminEndpoint).then(function (j) {
      if (j && j.ok) document.getElementById("admin-link").innerHTML = ' · <a href="admin/">Members dashboard</a>';
    }).catch(function () {});
    document.getElementById("logout").addEventListener("click", function (e) { e.preventDefault(); setToken(""); location.reload(); });
  }
  function renderGate(rootId, teaser) {
    var root = document.getElementById(rootId);
    var meta = document.getElementById("tips-meta");
    var t = teaser && teaser.days && teaser.days[0];
    var today = sydneyToday();
    var h = '<section class="card gate" aria-labelledby="gate-h"><h2 id="gate-h">Tips are for members</h2>';
    if (t) {
      h += "<p><strong>" + (t.date === today ? "Today" : esc(fmtDate(t.date))) + ":</strong> " + esc(t.racing_selections) + " racing selection" + (t.racing_selections === 1 ? "" : "s") +
        (t.meetings && t.meetings.length ? " at " + esc(t.meetings.join(", ")) : "") +
        (t.roughies ? ", " + esc(t.roughies) + " roughie" + (t.roughies === 1 ? "" : "s") : "") +
        (t.sport_selections ? " and " + esc(t.sport_selections) + " pre-match sport tip" + (t.sport_selections === 1 ? "" : "s") : "") + ".</p>";
    }
    h += '<p class="phone-members">Members can also hear today’s tips by phone: call <a href="tel:+61495040400"><strong>0495 040 400</strong></a>. Not a member? Bella can sign you up free on the call.</p>';
    h += "<p>Membership is free. No card details. 18+ only. Our full record, wins and losses, is public on the <a href=\"results.html\">Results</a> page.</p>" +
      '<p><a class="btn" href="join.html">Join free</a></p>' +
      '<h3>Already a member? Log in</h3>' + (EMAIL_LOGIN ? emailLoginForm() :
      '<form id="login-form" class="login" novalidate>' +
      '<label for="login-mobile">Your mobile number</label><input id="login-mobile" name="mobile" type="tel" inputmode="tel" autocomplete="tel" placeholder="04xx xxx xxx" required>' +
      '<input type="text" name="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">' +
      '<div id="login-code-row" hidden><label for="login-code">6-digit code we texted you</label><input id="login-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></div>' +
      '<p><button class="btn" type="submit" id="login-btn">Text me a code</button></p>' +
      '<p id="login-msg" class="small" role="status" aria-live="polite"></p></form>' +
      '<p class="small muted">We text a one-time code to your member mobile. You stay logged in on this device for 30 days. <a href="#" id="use-email">Log in with your email instead</a>.</p>') + '</section>';
    root.innerHTML = h;
    if (meta) meta.textContent = t ? fmtDate(t.date) + ". Log in to see the selections." : "";
    if (EMAIL_LOGIN) return bindEmailLogin();
    function toEmail(note) {
      var sec = root.querySelector(".gate"), f = document.getElementById("login-form");
      var wrap = document.createElement("div"); wrap.innerHTML = emailLoginForm();
      f.nextElementSibling && f.nextElementSibling.remove(); f.replaceWith.apply(f, Array.prototype.slice.call(wrap.childNodes));
      bindEmailLogin(); if (note) document.getElementById("login-msg").textContent = note;
    }
    document.getElementById("use-email").addEventListener("click", function (e) { e.preventDefault(); toEmail(""); });
    var form = document.getElementById("login-form"), msg = document.getElementById("login-msg"), btn = document.getElementById("login-btn");
    var stage = "start";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var mobile = form.mobile.value;
      btn.disabled = true; msg.textContent = "Please wait…";
      var p = stage === "start" ? member({ action: "login_start", mobile: mobile, website: form.website.value })
                                : member({ action: "login_check", mobile: mobile, code: form.code.value });
      p.then(function (j) {
        btn.disabled = false;
        if (stage === "start") {
          if (j.ok && j.sent) { stage = "check"; document.getElementById("login-code-row").hidden = false; btn.textContent = "Log in"; msg.textContent = "Code sent. Enter it above."; form.code.focus(); }
          else if (j.not_member) msg.innerHTML = 'We couldn’t find a membership for that number. <a href="join.html">Join free</a>.';
          else if (j.error === "rate_limited") msg.textContent = "Too many codes requested. Please try again later.";
          else if (j.error === "sms_unavailable" || j.error === "sms_login_disabled") toEmail("We couldn\u2019t send a text just now, so please log in with your mobile and the email you joined with.");
          else msg.textContent = "Please check the mobile number (Australian mobile, e.g. 0412 345 678).";
        } else {
          if (j.ok && j.token) { setToken(j.token); location.reload(); }
          else msg.textContent = "That code didn’t work or has expired (codes last 10 minutes). Check it, or tap Log in with your email instead.";
        }
      }).catch(function () { btn.disabled = false; msg.textContent = "Sorry, something went wrong. Please try again."; });
    });
  }

  function fail(rootId, err) {
    var el = document.getElementById(rootId);
    if (el) el.innerHTML = '<div class="notice"><p>Sorry, the tips didn\u2019t load just now. Please refresh the page in a minute, or call <a href="tel:+61495040400">0495 040 400</a> to hear them.</p></div>';
    var meta = document.getElementById("tips-meta");
    if (meta) meta.textContent = "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    rotateTagline();
    var page = document.body.getAttribute("data-page");
    if (page === "results") {
      getJSON("data/results.json").then(renderResults).catch(function (e) { fail("results-root", e); });
      return;
    }
    if (page !== "index" && page !== "archive") return;
    var rootId = page === "index" ? "tips-root" : "archive-root";
    loadMemberTips(page === "index" ? qsDate() : "").then(function (j) {
      if (j && j.card) {
        memberBar(j.first_name);
        return page === "index" ? renderDay(j.index, j.card) : renderMemberArchive(j.index);
      }
      return getJSON("data/teaser.json").catch(function () { return null; }).then(function (t) { renderGate(rootId, t); });
    }).catch(function (e) { fail(rootId, e); });
  });
})();
