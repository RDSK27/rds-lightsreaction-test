/* RDS Lights Speed Test - Service Worker
   Prefijo de cache: lst (coincide con localStorage rds_lst_).
   Sube SOLO el numero de version (lst-vN) en cada despliegue:
   el index.html llama a reg.update() al abrir el home y, al detectar
   esta version nueva, recarga para coger lo ultimo.

   Reparto de responsabilidades:
   - Este SW solo hace que la app SE ABRA sin red (cachea el shell).
   - El ranking offline (ver resultados y encolar nuevos hasta tener red)
     lo gestionan localStorage + la persistencia de Firestore en index.html.
     Por eso este SW NO intercepta las peticiones a Firebase/gstatic. */

var CACHE = 'lst-v1';

/* App shell: como todo el CSS/JS/logo va incrustado en index.html,
   basta con cachear ese archivo, el manifest y los iconos. */
var SHELL = [
  './',
  'index.html',
  'manifest.json',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', function(event){
  /* Precache tolerante: si un asset faltara, no rompe el resto. */
  event.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(SHELL.map(function(u){
        return c.add(u).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(event){
  /* Borra caches lst- antiguas para que el bump de version surta efecto. */
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k.indexOf('lst-') === 0 && k !== CACHE){ return caches.delete(k); }
        return null;
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;                 /* solo GET */
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return;  /* no tocar Firebase/gstatic/externos */

  event.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(res){
        /* cachea solo respuestas validas del mismo origen */
        if(res && res.status === 200 && res.type === 'basic'){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        /* offline y no cacheado: para navegaciones, devuelve el shell */
        if(req.mode === 'navigate'){ return caches.match('index.html'); }
        return Response.error();
      });
    })
  );
});

self.addEventListener('message', function(event){
  /* el index.html envia esto al detectar una version nueva */
  if(event.data && event.data.action === 'skipWaiting'){ self.skipWaiting(); }
});
