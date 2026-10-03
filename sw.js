const CACHE = "passgen-v1";
const FILES = ["./index.html", "./manifest.json", "./sw.js", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
      return resp;
    }).catch(() => caches.match("./index.html")))
  );
});