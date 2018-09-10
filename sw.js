const cacheList = [
    'css/styles.css',
    'js/dbhelper.js',
    'js/main.js',
    'js/restaurant_info.js',
    '/',
    'restaurant.html',
    'data/restaurants.json'
  ];

  const staticCacheID = 'pages-cache-v1';

  self.addEventListener('install', event => {
    event.waitUntil(
      caches.open(staticCacheID)
      .then(cache => {
        return cache.addAll(cacheList);
      })
    );
  });

  self.addEventListener('fetch', event => {
    event.respondWith(
      caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        console.log('Could not find', event.request, ' in cache' );
        return fetch(event.request).then(response => {
            return caches.open(staticCacheID).then(cache => {
              cache.put(event.request.url, response.clone());
              return response;
            });
          });
      }).catch(error => {
        console.log(error);
      })
    );
  });