const dbPromise = idb.open('restaurantReview', 1, upgradeDB => {
  let keyValStore = upgradeDB.createObjectStore('restaurants', {
    keyPath: 'id'
  });

  let reviewsKVS = upgradeDB.createObjectStore('reviews', {
    keyPath: 'id'
  });

  let pendingKVS = upgradeDB.createObjectStore('pending', {
    keyPath: 'id'
  });
});

/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Register the service worker.
   */
  static registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('Success! Service Worker registered.  Registration scope is:', registration.scope);
      })
      .catch(function(error) {
        console.log('Service Worker registration error:', error);
      });
    }
  }

  /**
   * Reviews URL.
   *
   */
  static get REVIEWS_URL() {
    return `${DBHelper.DATABASE_URL}/reviews/`;
  }

   /**
   * Restaurants URL.
   *
   */
  static get RESTAURANTS_URL() {
    return `${DBHelper.DATABASE_URL}/restaurants/`;
  }

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}`;
  }
  /**
   * Post a review
   */
  static postReview(event) {
    event.preventDefault();
    let formD = new FormData(event.currentTarget);
    let formObj = {};

    formD.forEach((value, key) => {
      formObj[key] = value;
    });

    this.updateReviewsData(formObj);
    this.updatePendingRequestData(DBHelper.REVIEWS_URL, 'POST', formObj);
    /*
    fetch(DBHelper.REVIEWS_URL, {
      method: 'POST',
      body: formD
    })
    .then(response => response.json())
    .catch(error => {
      console.error('Error:', error);
      window.alert('Not connected');
    })
    .then(response => console.log('Success:', JSON.stringify(response)));
    */
  }

  /**
   * Update saved reviews data
   */
  static updateReviewsData(review) {
    dbPromise.then((db) => {
      let trns = db.transaction('reviews', 'readwrite');
      let keyValStore = trns.objectStore('reviews');

      keyValStore.put(
        {
          id: Date.now(),
          restaurant_id : review.restaurant_id,
          data: review
        }
      )
      return trns.complete;
    });
  }

   /**
   * add pending requests to database
   */
  static updatePendingRequestData (url, type, body) {
    dbPromise.then((db) => {
      let trns = db.transaction('pending', 'readwrite');
      let keyValStore = trns.objectStore('pending');

      keyValStore.put({
          id: Date.now(),
          url: url,
          type: type,
          body: body
      });
    })
      .catch(error => {console.log(error);})
      .then(DBHelper.sendNextPendingRequest());
  }

  /**
   * attempt to send all pending requests
   */
  static sendNextPendingRequest() {
    DBHelper.attemptPendingSend(DBHelper.sendNextPendingRequest);
  }

  /**
   * send pending requests until failure
   */
  static attemptPendingSend(callback) {
    let url, type, body;

    dbPromise.then(db => {
      if (!db.objectStoreNames.length) { //check if we have object stores in the db
        db.close();
        return;
      }


      let trns = db.transaction('pending', 'readwrite');

      trns.objectStore('pending').openCursor()
        .then(cursor => {
            if(!cursor) {
              return;
            }
          let va = cursor.value;
          url = cursor.value.url;
          type = cursor.value.type;
          body = cursor.value.body;

          if ((type === 'POST' && !body) || (!url || !type)) {//check if record has necessary parts delete if no good
            cursor.delete().then(callback());
            return;
          }

          let props = {
            method: type,
            body: JSON.stringify(body),
          }

          fetch(url, props).then(response => {
            if(!response.ok && !response.redirected) { //check for failure
              return;
            }
          }).then((response) => {
              console.log('Success:', JSON.stringify('review posted'));
              const deleteTrans = db.transaction('pending', 'readwrite');
              deleteTrans.objectStore('pending')
              .openCursor()
              .then(cursor => {
                cursor.delete()
                .then(() => {
                  callback();//get the next one
                })
              });
          }).catch(error => {
            console.log(error);
            return;
          });
        });
    });
  }


   /**
   * Favorite a restaurant
   */
  static async toggleFavorite(restaurantID, isFavorite) {
    //update saved data first
    await this.updateRestaurantData(restaurantID, {'is_favorite' : isFavorite});

    fetch(`${DBHelper.RESTAURANTS_URL}${restaurantID}/?is_favorite=${isFavorite}`, {
      method: 'PUT'
    })
    .then(response => response.json())
    .catch(error => console.error('Error:', error))
    .then(response => console.log('Success:', JSON.stringify(response)));
  }

  /**
   * Update saved restaurant data
   */
  static updateRestaurantData(restaurantID, updateAttrs) {

      dbPromise.then((db) => {
        let trns = db.transaction('restaurants', 'readwrite');
        let keyValStore = trns.objectStore('restaurants');
        //check if we have saved data
        keyValStore.getAll().then(function(items) {
          console.log(items);
        });

        keyValStore.getAll().then(function(items) {
          if (!items) {
            //nothing found
            return;
          }
          const restrData = items;
          const IDnum = parseInt(restaurantID, 0);
          let restrToUpdate = restrData.filter(r => r.id == IDnum);
          if(!restrToUpdate[0]) {
            //return if restaurant not in saved data
            return;
          }
          Object.keys(updateAttrs).forEach( a => { restrToUpdate[0] [a] = updateAttrs[a]; })
          dbPromise.then((db) => {
            const tx = db.transaction('restaurants', 'readwrite');
            tx.objectStore('restaurants').put({id: IDnum, data: restrData});
            return tx.complete;
          });
        })
      });
  }



  /**
   * Fetch all restaurants.
   */
  static fetchReviews(restaurant_id, callback) {

    //TODO create reviews URL constant and use that
    fetch(`${DBHelper.REVIEWS_URL}?restaurant_id=${restaurant_id}`, {
      method: 'GET'
    })
    .then(response => response.json())
    .catch(error => console.error('Error:', error))
    .then(response => callback(response));
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', DBHelper.RESTAURANTS_URL);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.onload = () => {
      if (xhr.status === 200) { // Got a success response from server!
        const json = JSON.parse(xhr.responseText);
        const restaurants = json;
        callback(null, restaurants);
      } else { // Oops!. Got an error from server.
        const error = (`Request failed. Returned status of ${xhr.status}`);
        callback(error, null);
      }
    };
    xhr.send();
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (`/img/${restaurant.photograph}`);
  }

   /**
   * Restaurant image srcset.
   */
  static imageSrcSetForRestaurant(restaurant) {
    let id = restaurant.id;
    return (`img/${id}-320.jpg 320w,
    img/${id}-645.jpg 645w, img/${id}-800.jpg 800w`);
  }

  /**
   * Restaurant image alt tag.
   */
  static restaurantImageAlt(restaurant) {
    return `An image of ${restaurant.name} in ${restaurant.neighborhood}`;
  }

  /**
   * Map marker for a restaurant.
   */
   static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
      {title: restaurant.name,
      alt: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant)
      })
      marker.addTo(newMap);
    return marker;
  }

}

