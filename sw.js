importScripts('./idb.js');

let dbPromise = idb.open('restaurantReview', 1, upgradeDB => {
  let keyValStore = upgradeDB.createObjectStore('restaurants', {
    keyPath: 'id'
  });
});

const cacheList = [
    'css/styles.css',
    'js/dbhelper.js',
    'js/main.js',
    'js/restaurant_info.js',
    '/',
    'restaurant.html'
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
        const getCacheResponse = (request) => {
          return caches.match(request);
        }

        const addToCache = (url, response) => {
          return caches.open(staticCacheID).then(cache => {
            cache.put(url, response);
          });
        }

        const getNetworkOrDBResponse = async (request) => {
          if (event.request.headers.get('content-type') && event.request.headers.get('content-type').includes('application/json')){
            //check if restaurant data available
            //load from db if available
            const dbResponse = await dbPromise.then(db => {
              let tx = db.transaction('restaurants', 'readonly');
              let keyValStore = tx.objectStore('restaurants');
              return keyValStore.getAll().then(items => {
                if (items && items.length) {
                  return new Response(JSON.stringify(items));
                }
                else {
                  return null;
                }
              });
            });
            if (dbResponse) {
              return dbResponse;
            }
          }

          return fetch(event.request).then(networkResponse => {
            if (event.request.headers.get('content-type') && event.request.headers.get('content-type').includes('application/json')){

              dbPromise.then(function(db){
                let tx = db.transaction('restaurants', 'readwrite');
                let keyValStore = tx.objectStore('restaurants');

                networkResponse.clone().json().then(arr => {
                  arr.forEach(r => {
                    keyValStore.put(r);
                  });
                });
                return tx.complete;
              }).catch( error => {
                console.log(error);
              });

            } else { //cache non json responses
              addToCache(event.request.url, networkResponse.clone());
            }
            return networkResponse;
          });

        };

        const response = (request) => {
          return getCacheResponse(request)
          .then(cacheResponse => {
            if (cacheResponse) {
              return cacheResponse;
            }
            return getNetworkOrDBResponse(request);
          }).catch(error => {
            console.log(error);
            //handle error response
          })
      };

        event.respondWith(response(event.request));
  });

