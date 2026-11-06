const $ = (id) => document.getElementById(id);

function show(result) {
  const el = $("status");
  if (!result) { el.textContent = "Ainda não sincronizou."; el.className = ""; return; }
  const when = new Date(result.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  el.textContent = `${result.ok ? "✓" : "!"} ${when}: ${result.message}`;
  el.className = result.ok ? "ok" : "bad";
}

chrome.storage.local.get(["syncKey", "siteUrl", "lastResult"]).then(({ syncKey, siteUrl, lastResult }) => {
  $("key").value = syncKey || "";
  $("site").value = siteUrl || "";
  show(lastResult);
});

$("save").addEventListener("click", async () => {
  await chrome.storage.local.set({ syncKey: $("key").value.trim(), siteUrl: $("site").value.trim() });
  $("save").textContent = "Salvo ✓";
  setTimeout(() => { $("save").textContent = "Salvar"; }, 1500);
});

$("sync").addEventListener("click", async () => {
  const btn = $("sync");
  btn.disabled = true;
  btn.textContent = "Sincronizando…";
  // Save first so a key just pasted is used right away.
  await chrome.storage.local.set({ syncKey: $("key").value.trim(), siteUrl: $("site").value.trim() });
  const result = await chrome.runtime.sendMessage({ type: "sync-now" });
  show(result);
  btn.disabled = false;
  btn.textContent = "Sincronizar agora";
});
