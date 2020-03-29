"use strict";

const version = 5;
var isOnline = true;
var isLoggedIn = false;
var cacheName = `ramblins-${version}`;

var urlsToCache = {
  loggedOut: [
    "/",
    "/about",
    "/contact",
    "/404",
    "/login",
    "/offline",
    "/css/style.css",
    "/js/blog.js",
    "/js/home.js",
    "/js/login.js",
    "/js/add-post.js",
    "/images/logo.gif",
    "/images/offline.png"
  ]
};

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("message", onMessage);
self.addEventListener("fetch", onFetch);

main().catch(console.error);

async function main() {
  await cacheLoggedOutFiles();
  console.log(`Service Worker ${version} is starting`);
  await sendMessage({ requestStatusUpdate: true });
}

async function sendMessage(msg) {
  var allClients = await clients.matchAll({ includeUncontrolled: true });
  return Promise.all(
    allClients.map(function clientMsg(client) {
      var chan = new MessageChannel();
      chan.port1.onmessage = onMessage;
      return client.postMessage(msg, [chan.port2]);
    })
  );
}

function onMessage({ data }) {
  if (data.statusUpdate) {
    ({ isOnline, isLoggedIn } = data.statusUpdate);
    console.log(
      `Service Worker (v${version}) status update, isOnline:${isOnline}, isLoggedIn: ${isLoggedIn}`
    );
  }
}

function onFetch(evt) {
  evt.respondWith(router(evt.request));
}

async function router(req) {
  var url = new URL(req.url);
  var reqURL = url.pathname;
  var cache = await caches.open(cacheName);
  if (url.origin === location.origin) {
    let res;
    try {
      let fetchOptions = {
        method: "GET",
        credentials: "omit",
        cache: "no-store"
      };
      res = await fetch(req.url, fetchOptions);
      if (res && res.ok) {
        await cache.put(reqURL, res.clone());
        return res;
      }
    } catch (err) {}
    res = await cache.match(reqURL);
    if (res) {
      return res.clone();
    }
  }
}

async function onInstall(evt) {
  console.log(`Service Worker ${version} installed.`);
  self.skipWaiting();
}

async function onActivate(evt) {
  evt.waitUntil(handleActivation());
}

async function handleActivation() {
  await clearCaches();
  await cacheLoggedOutFiles(true);
  await clients.claim();
  console.log(`Service Worker ${version} activated.`);
}

async function clearCaches() {
  var cacheNames = await caches.keys();
  var oldCacheNames = cacheNames.filter(function matchOldCache(cacheName) {
    if (/^ramblins-\d+$/.test(cacheName)) {
      let [, cacheVersion] = cacheName.match(/^ramblins-(\d+)$/);
      cacheVersion =
        cacheVersion !== null ? Number(cacheVersion) : cacheVersion;
      return cacheVersion && cacheVersion !== version;
    }
  });
  return Promise.all(
    oldCacheNames.map(function deleteCache(cacheName) {
      return caches.delete(cacheName);
    })
  );
}

async function cacheLoggedOutFiles(forceReload = false) {
  var cache = await caches.open(cacheName);

  return Promise.all(
    urlsToCache.loggedOut.map(async function requestFile(url) {
      try {
        let res;
        if (!forceReload) {
          res = await cache.match(url);
          if (res) {
            return;
          }
        }
        let fetchOptions = {
          method: "GET",
          cache: "no-store",
          credentials: "omit"
        };
        res = await fetch(url, fetchOptions);
        if (res.ok) {
          return cache.put(url, res);
        }
      } catch (err) {}
    })
  );
}
