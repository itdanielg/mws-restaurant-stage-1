let restaurant;
var newMap;

DBHelper.registerServiceWorker();

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  initMap();
  DBHelper.sendNextPendingRequest();
});

/**
 * Catch form submit event for reviews
 */
document.forms['review-form'].addEventListener('submit', (event) => {
  //TODO add validation
  DBHelper.postReview(event);
});

/**
 * Handle favorite restaurant checkbox events
 */
document.getElementById('favorite').addEventListener('click', (event) => {
  //determine if checking or unchecking and call toggle
    let isFavorite;
    if(event.target.checked) {
        // Checkbox is checked..
        isFavorite = true;
    } else {
      isFavorite = false;
    }
    DBHelper.toggleFavorite(event.target.value, isFavorite);
});

/**
 * Initialize leaflet map
 */
initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.newMap = L.map('map', {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
        scrollWheelZoom: false
      });
      L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
        mapboxToken: 'pk.eyJ1IjoiZGFuaWVsLWdlb3JnZSIsImEiOiJjamtnYTR3b2kwaTA2M2twYnEwNmN4eXZ4In0.DBS1p1kO4vJvk1717bxxig',
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
          '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
          'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox.streets'
      }).addTo(newMap);

      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
      DBHelper.fetchReviews(self.restaurant.id, fillReviewsHTML);
    }
  });
}
/**
 * Add restaurant ID to element values
 */
addRestaurantIdToPage = (id) => {
  document.getElementById('restaurant_id').setAttribute('value', id);
  document.getElementById('favorite').setAttribute('value', id);
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      addRestaurantIdToPage(id);
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img';
  image.srcset = DBHelper.imageSrcSetForRestaurant(restaurant);
  image.sizes = '(max-width: 833px) 95vw, (min-width: 834px) 46vw';
  image.src = DBHelper.imageUrlForRestaurant(restaurant);
  image.alt = DBHelper.restaurantImageAlt(restaurant);

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  const fav = document.getElementById('favorite');

  if (restaurant.is_favorite === 'true') {
    if (!fav.checked) {
      fav.setAttribute('checked', 'checked');
    }
  } else {
    if (fav.checked) {
      fav.removeAttribute('checked');
    }
  }
  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const headingbar = document.createElement('div');
  const name = document.createElement('span');
  headingbar.className = 'review-banner';
  name.innerHTML = review.name;
  name.className = 'review-name';
  headingbar.appendChild(name);

  const date = document.createElement('span');
  date.innerHTML = formatDate(review.createdAt);
  date.className = 'review-date';
  headingbar.appendChild(date);

  li.appendChild(headingbar);

  const rating = document.createElement('div');
  rating.innerHTML = `Rating: ${review.rating}`;
  rating.className = 'review-rating';
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Format created date
 */
function formatDate(date) {
  const monthNames = [
    "January", "February", "March",
    "April", "May", "June", "July",
    "August", "September", "October",
    "November", "December"
  ];
  const dateObj = new Date(date);
  const day = dateObj.getDate();
  const monthIndex = dateObj.getMonth();
  const year = dateObj.getFullYear();

  return `${monthNames[monthIndex]} ${day}, ${year}`;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  li.setAttribute('aria-current', 'page');
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
