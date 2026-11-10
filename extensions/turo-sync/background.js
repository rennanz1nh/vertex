// Vertex · Sync Turo — reads the host's Turo data with the session already logged in on this
// Chrome and sends it to the Vertex admin (the same /api/admin/turo/browser-sync endpoint the
// old console script used). Read-only on Turo: it only GETs, nothing is ever written there.

const DEFAULT_SITE = "https://vertexrentalcar.com";
const ALARM = "turo-sync";
const EVERY_MINUTES = 180;
const RECEIPT_BATCH = 25;
const TURO_HOST_PAGE = "https://turo.com/us/en/host";

chrome.runtime.onInstalled.addListener(() => schedule());
chrome.runtime.onStartup.addListener(() => {
  schedule();
  runSync("startup");
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) runSync("alarm");
});
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "sync-now") {
    runSync("manual").then(reply);
    return true; // async reply
  }
});

function schedule() {
  chrome.alarms.create(ALARM, { periodInMinutes: EVERY_MINUTES, delayInMinutes: 1 });
}

/**
 * Runs inside a turo.com tab (MAIN world), so the requests are first-party with the user's
 * cookies and pass Cloudflare exactly like the page itself. Must stay self-contained.
 */
async function collectFromTuroPage(withProfiles) {
  const gj = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include", headers: { Accept: "application/json" } });
      return r.ok ? await r.json() : { _status: r.status };
    } catch (e) {
      return { _error: String(e) };
    }
  };
  const u = await gj("/api/v2/feeds/upcoming-trips?appMode=HOST");
  const h = await gj("/api/v2/feeds/trip-history?driverRoles=HOST");
  if (u._status || h._status || u._error || h._error) {
    return { error: u._status || h._status || u._error || h._error };
  }

  let hid = null;
  try {
    const ff = (h.tripHistoryFeeds && (h.tripHistoryFeeds.list || h.tripHistoryFeeds)) || [];
    for (const m of ff) {
      if (m.trips && m.trips[0]) { hid = m.trips[0].owner && m.trips[0].owner.id; break; }
    }
  } catch { /* no history yet */ }

  const yr = new Date().getFullYear();
  const earnings = { hostId: hid, years: {} };
  earnings.years[yr] = await gj("/api/me/earnings/summaries/list?year=" + yr);
  earnings.years[yr - 1] = await gj("/api/me/earnings/summaries/list?year=" + (yr - 1));
  if (hid) earnings.scorecard = await gj("/api/drivers/" + hid + "/owner-scorecard/earnings");
  const payout = await gj("/api/me/payout/method");
  const reviews = hid ? await gj("/api/drivers/" + hid + "/host-feedback?days=365&itemsPerPage=50&page=1&sortOrder=MOST_RECENT") : null;
  const feedback = hid ? await gj("/api/drivers/" + hid + "/host-scorecard/structured-feedback?days=365&sortOrder=MOST_RECENT") : null;

  const ids = [];
  const seen = {};
  for (const k in earnings.years) {
    const list = (earnings.years[k] && earnings.years[k].ownerEarningsList) || [];
    for (const x of list) {
      const rv = x.reservation;
      if (rv && rv.reservationId && rv.reservationReceiptIsAvailable && !seen[rv.reservationId]) {
        seen[rv.reservationId] = 1;
        ids.push(rv.reservationId);
      }
    }
  }
  const receipts = [];
  let qi = 0;
  const worker = async () => {
    while (qi < ids.length) {
      const id = ids[qi++];
      const rr = await gj("/api/reservation/" + id + "/receipt");
      if (rr && !rr._status && !rr._error) receipts.push({ id: String(id), data: rr });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);

  // Public Turo profile of each guest. The endpoint isn't documented, so try the likely
  // ones on the first guest and use whichever answers; if none does, skip the rest.
  const guestProfiles = [];
  if (withProfiles) {
    const renterIds = new Set();
    for (const it of (u.upcomingTripItems || [])) { const a = it.actor || it.renter; if (a && a.id) renterIds.add(String(a.id)); }
    const feeds = (h.tripHistoryFeeds && (h.tripHistoryFeeds.list || h.tripHistoryFeeds)) || [];
    for (const m of feeds) for (const t of (m.trips || [])) { const r = t.renter || t.driver; if (r && r.id) renterIds.add(String(r.id)); }
    const ids = [...renterIds];
    const candidates = (id) => ["/api/drivers/" + id, "/api/v2/drivers/" + id, "/api/drivers/" + id + "/profile"];
    let endpoint = null;
    if (ids.length) {
      for (const make of [0, 1, 2]) {
        const url = candidates(ids[0])[make];
        const res = await gj(url);
        if (res && !res._status && !res._error) { endpoint = make; guestProfiles.push({ renterId: ids[0], data: res }); break; }
      }
    }
    if (endpoint !== null) {
      let pi = 1;
      const pworker = async () => {
        while (pi < ids.length) {
          const id = ids[pi++];
          const res = await gj(candidates(id)[endpoint]);
          if (res && !res._status && !res._error) guestProfiles.push({ renterId: id, data: res });
        }
      };
      await Promise.all([pworker(), pworker(), pworker()]);
    }
  }

  return { upcomingData: u, historyData: h, earnings, reviews, feedback, payout, receipts, guestProfiles };
}

function waitForLoad(tabId, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(onUpd); reject(new Error("A Turo demorou demais para abrir")); }, timeoutMs);
    function onUpd(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpd);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpd);
  });
}

/** Uses an open turo.com tab if there is one, otherwise opens one in the background and closes it after. */
async function collect(withProfiles) {
  const open = await chrome.tabs.query({ url: "https://turo.com/*" });
  let tab = open.find((t) => t.status === "complete") || null;
  let created = false;
  if (!tab) {
    tab = await chrome.tabs.create({ url: TURO_HOST_PAGE, active: false, pinned: true });
    created = true;
    await waitForLoad(tab.id);
  }
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "MAIN", func: collectFromTuroPage, args: [withProfiles] });
    return res?.result ?? { error: "sem resposta da página da Turo" };
  } catch (e) {
    if (/error page/i.test(String(e))) return { error: "não consegui abrir o turo.com (sem internet?)" };
    throw e;
  } finally {
    if (created) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function post(site, key, body) {
  const r = await fetch(site.replace(/\/$/, "") + "/api/admin/turo/browser-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Sync-Key": key, "X-Sync-Client": "extension" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Vertex respondeu " + r.status);
  return data;
}

let running = null;
function runSync(reason) {
  if (!running) running = doSync(reason).finally(() => { running = null; });
  return running;
}

async function doSync(reason) {
  const { syncKey, siteUrl } = await chrome.storage.local.get(["syncKey", "siteUrl"]);
  if (!syncKey) return finish(false, "Cole a chave de sincronização (admin → Turo → Sincronização).", reason);
  const site = siteUrl || DEFAULT_SITE;
  try {
    // Guest profiles change rarely: fetch them at most once a day (and on manual sync).
    const { lastProfilesAt } = await chrome.storage.local.get("lastProfilesAt");
    const withProfiles = reason === "manual" || !lastProfilesAt || Date.now() - lastProfilesAt > 20 * 3600 * 1000;
    const data = await collect(withProfiles);
    if (data.error) {
      const loggedOut = data.error === 401 || data.error === 403;
      return finish(false, loggedOut ? "Você não está logado na Turo neste Chrome. Entre no turo.com e tente de novo." : "Erro ao ler a Turo: " + data.error, reason);
    }
    const { receipts, guestProfiles = [], ...main } = data;
    const r = await post(site, syncKey, main);
    let saved = 0;
    for (let o = 0; o < receipts.length; o += RECEIPT_BATCH) {
      const rr = await post(site, syncKey, { receipts: receipts.slice(o, o + RECEIPT_BATCH) });
      saved += rr.receiptsSaved || 0;
    }
    let lastGuests = r.guests;
    for (let o = 0; o < guestProfiles.length; o += RECEIPT_BATCH) {
      const rr = await post(site, syncKey, { guestProfiles: guestProfiles.slice(o, o + RECEIPT_BATCH) });
      lastGuests = rr.guests || lastGuests;
    }
    if (withProfiles) await chrome.storage.local.set({ lastProfilesAt: Date.now() });
    const g = lastGuests ? `, ${lastGuests.guests} hóspedes` : "";
    return finish(true, `${r.synced ?? 0} viagens, ${saved} recibos${g} enviados.`, reason);
  } catch (e) {
    return finish(false, String(e.message || e), reason);
  }
}

async function finish(ok, message, reason) {
  const result = { ok, message, at: new Date().toISOString(), reason };
  await chrome.storage.local.set({ lastResult: result });
  chrome.action.setBadgeText({ text: ok ? "" : "!" });
  chrome.action.setBadgeBackgroundColor({ color: "#d97706" });
  // Speak up only when an automatic run fails; a manual run shows its result in the popup.
  if (!ok && reason !== "manual") {
    chrome.notifications.create("turo-sync-failed", { type: "basic", iconUrl: "icon.png", title: "Sync Turo falhou", message });
  }
  return result;
}
