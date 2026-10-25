const CACHE_NAME = 'nove1-cache-v4'; // Subi pra v4 pra forçar a atualização
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './image_2.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Obriga o navegador a usar essa versão nova NA HORA
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Esse bloco aqui varre e deleta os caches antigos (v1, v2, v3...)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
