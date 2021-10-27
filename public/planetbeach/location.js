let map, infoWindow, geocode;
let markers = [];
let entries = localStorage.getItem("entries")
  ? JSON.parse(localStorage.getItem("entries"))
  : [];
let bounds;
let cluster;
const mapLeftMargin = window.innerWidth > 991 ? 437 : 0;
let timerId;

const states = {
  AL: "Alabama",
  AK: "Alaska",
  AS: "American Samoa",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District Of Columbia",
  FM: "Federated States Of Micronesia",
  FL: "Florida",
  GA: "Georgia",
  GU: "Guam",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MH: "Marshall Islands",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  MP: "Northern Mariana Islands",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PW: "Palau",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VI: "Virgin Islands",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

function renderMarkers(data, map) {
  if (!data.length) {
    return false;
  }
  bounds = new google.maps.LatLngBounds();
  markers.forEach((m) => {
    m.setMap(null);
  });
  markers = [];

  data.forEach((item) => {
    if (item.latitude && item.longitude) {
      const marker = new google.maps.Marker({
        position: { lat: +item.latitude, lng: +item.longitude },
        map,
        title: item.name,
        icon: "https://global-uploads.webflow.com/60708843c173335270e52d28/6125aa7193fe65e85333c203_Pin%20(1).svg"
      });

      marker.addListener("click", () => {
        document.querySelector("#search_field input").value = item.name;
        search(item.name, ["name", "fromMarkerSelect"]);
      });

      markers.push(marker);
      bounds.extend(new google.maps.LatLng(+item.latitude, +item.longitude));
    }
  });

  map.fitBounds(bounds, { left: mapLeftMargin, bottom: 0, top: 0, right: 0 });

  if (cluster) {
    cluster.clearMarkers();
    cluster.setMap(null);
  }

  cluster = new MarkerClusterer(map, markers, {
    styles: [
      {
        textColor: "white",
        textSize: 18,
        anchorIcon: [40, 0],
        fontFamily: "Helvetica Neue, sans-serif",
        height: 64,
        fontWeight: "bold",
        anchorText: [19, 0],
        width: 63,
        url:
          "https://global-uploads.webflow.com/60708843c173335270e52d28/6125aa7193fe65e85333c203_Pin%20(1).svg",
      },
    ],
  });
}
// https://global-uploads.webflow.com/60708843c173335270e52d28/6125aa71a6110102a8859e94_Pin.svg
function getAllLocationData() {
  return new Promise((resolve, reject) => {
    $.ajax({
      async: true,
      crossDomain: true,
      cache: true,
      url: `https://scripts.cosmagency.com/beach/spas`,
      method: "GET",
      success: function (data) {
        resolve(data.data);
      },
      error: function (error) {
        reject(error);
      },
    });
  });
}

function geocodeAddress(address, locations) {
  infowindow = new google.maps.InfoWindow();
  if (address === "") {
    localStorage.setItem("searchedAddress", "");
    const resultsDiv = document.getElementsByClassName("results").item(0);
    resultsDiv.innerHTML = "";
    renderMarkers(entries, map);
    return;
  }
  geocoder.geocode({ address: address }, (results, status) => {
    if (status === "OK") {
      map.setCenter(results[0].geometry.location);

      const pos = {
        lat: results[0].geometry.location.lat(),
        lng: results[0].geometry.location.lng(),
      };
      calcDistances(pos, locations).then((res) => {
        renderClosestLocations(10);
      });
      place = results[0];
      if (place.geometry.viewport) {
        map.fitBounds(place.geometry.viewport);
      } else {
        map.setCenter(place.geometry.location);
        map.setZoom(17);
      }
      if (place.address_components) {
        address = [
          (place.address_components[0] &&
            place.address_components[0].short_name) ||
          "",
          (place.address_components[1] &&
            place.address_components[1].short_name) ||
          "",
          (place.address_components[2] &&
            place.address_components[2].short_name) ||
          "",
        ].join(" ");
      }
      const searchedAddress = document.querySelector("#search_field input")
        .value;
      localStorage.setItem("searchedAddress", searchedAddress);
    } else {
      localStorage.setItem("searchedAddress", "");
      renderSearchResults([]);
      renderMarkers(entries, map);
      console.log(
        "Geocode was not successful for the following reason: " + status
      );
    }
  });
}

function searchFun() {
  debounceFunction(debounceSearch, 200);
}

function debounceSearch() {
  const searchTerm = document.querySelector("#search_field input").value;
  const fieldNames = ["name", "zip-code-2", "state"];
  if (searchTerm === "") {
    localStorage.setItem("searchedAddress", "");
    const resultsDiv = document.getElementsByClassName("results").item(0);
    resultsDiv.innerHTML = "";
    renderMarkers(entries, map);
    return;
  }
  const filtered = entries
    .filter((entry) => {
      let match = false;
      fieldNames.forEach((field) => {
        if (
          entry[field] &&
          entry[field].toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          match = true;
        }
        if (
          field === "state" &&
          entry[field] &&
          states[entry[field]] &&
          states[entry[field]].toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          match = true;
        }
      });
      return match;
    })
    .sort(getComparatorByProp("name", "asc"));
  if (filtered.length < 11) {
    getAutocompleteQuery(searchTerm).then((res) => {
      res.predictions.map((item) => {
        filtered.push({ description: item.description, predictions: true });
      });
      renderSearchResults(filtered);
    });
  } else {
    renderSearchResults(filtered);
  }
}

function setAutoSearchLocaton(searchAddress) {
  document.querySelector("#search_field input").value = searchAddress;
  geocodeAddress(searchAddress, entries);
}

function getAutocompleteQuery(searchAddress) {
  const proxyurl = "https://cors-anywhere.herokuapp.com/";
  const apiKey = "AIzaSyD2KGsO4wsFky2IUU2eJQfvMY8l66J3USw";
  return new Promise((resolve, reject) => {
    $.ajax({
      async: true,
      crossDomain: true,
      cache: true,
      url: `${proxyurl}https://maps.googleapis.com/maps/api/place/queryautocomplete/json?key=${apiKey}&components=country:us|country:ie|country:au|country:at|country:pr&input=${searchAddress}`,
      method: "GET",
      success: function (data) {
        resolve(data);
      },
      error: function (error) {
        reject(error);
      },
    });
  });
}

const debounceFunction = function (func, delay) {
  clearTimeout(timerId);
  timerId = setTimeout(func, delay);
};

function search(searchTerm, fieldNames) {
  const checkFromMarker = fieldNames.filter((item) => {
    return item === "fromMarkerSelect";
  });
  if (checkFromMarker.length > 0) {
    const filtered = entries
      .filter((entry) => {
        let match = false;
        fieldNames.forEach((field) => {
          if (
            entry[field] &&
            entry[field].toLowerCase().includes(searchTerm.toLowerCase())
          ) {
            match = true;
          }
          if (
            field === "state" &&
            entry[field] &&
            states[entry[field]] &&
            states[entry[field]]
              .toLowerCase()
              .includes(searchTerm.toLowerCase())
          ) {
            match = true;
          }
        });
        return match;
      })
      .sort(getComparatorByProp("name", "asc"));
    renderSearchResults(filtered);
    renderMarkers(filtered, map);
    const currentSearchAddress = document.querySelector("#search_field input")
      .value;
    localStorage.setItem("searchedAddress", currentSearchAddress);
  } else {
    geocodeAddress(searchTerm, entries);
  }
}

function initMap() {
  localStorage.removeItem("searchedAddress");
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 37.09024, lng: -95.712891 },
    zoom: 3,
    maxZoom: 17,
    disableDefaultUI: true,
    styles: [
      {
        "featureType": "administrative",
        "elementType": "labels.text.fill",
        "stylers": [
          {
            "color": "#444444"
          }
        ]
      },
      {
        "featureType": "landscape",
        "elementType": "all",
        "stylers": [
          {
            "color": "#f2f2f2"
          }
        ]
      },
      {
        "featureType": "poi",
        "elementType": "all",
        "stylers": [
          {
            "visibility": "off"
          }
        ]
      },
      {
        "featureType": "road",
        "elementType": "all",
        "stylers": [
          {
            "saturation": -100
          },
          {
            "lightness": 45
          }
        ]
      },
      {
        "featureType": "road.highway",
        "elementType": "all",
        "stylers": [
          {
            "visibility": "simplified"
          }
        ]
      },
      {
        "featureType": "road.arterial",
        "elementType": "labels.icon",
        "stylers": [
          {
            "visibility": "off"
          }
        ]
      },
      {
        "featureType": "transit",
        "elementType": "all",
        "stylers": [
          {
            "visibility": "off"
          }
        ]
      },
      {
        "featureType": "water",
        "elementType": "all",
        "stylers": [
          {
            "color": "#c0e4f3"
          },
          {
            "visibility": "on"
          }
        ]
      }
    ],
  });
  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow();
  getAllLocationData()
    .then((res) => {
      showLoader(false);
      entries = res;
      groupbystate(res)
      renderMarkers(entries, map);
      renderSearchResults(entries);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          map.setCenter(pos);
          map.setZoom(14);
          if (entries) {
            geolocate(pos, entries);
          }
          initLocationRequest(pos, "allowed");
        });
      }
    })
    .catch((error) => {
      showLoader(false);
    });
}

function initLocationRequest(pos, permission) {
  if (permission === "allowed") {
    geolocate(pos, entries);
  }
}

function geolocate(currentPos, locations) {
  calcDistances(currentPos, locations).then((res) => {
    document.querySelector("#search_field input").value = "Current Location";
    localStorage.setItem("entries", JSON.stringify(entries));
    renderClosestLocations(10, "based on localstorage data");
  });
}

function handleLocationError(browserHasGeolocation, infoWindow, pos) {
  infoWindow.setPosition(pos);
  infoWindow.setContent(
    browserHasGeolocation
      ? "Error: The Geolocation service failed."
      : "Error: Your browser doesn't support geolocation."
  );
  infoWindow.open(map);
}

function calcDistances(currentPos, locations) {
  return new Promise((resolve, reject) => {
    n = locations.length;
    if (n !== 0) {
      for (let index = 0; index < n; index++) {
        const element = locations[index];
        locations[index][
          "distanceToCurrentPos"
        ] = google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(element.latitude, element.longitude),
          new google.maps.LatLng(currentPos.lat, currentPos.lng)
        );
        if (index === n - 1) {
          setTimeout(() => {
            localStorage.setItem("entries", JSON.stringify(locations));
            entries = locations;
            resolve();
          }, 500);
        }
      }
    } else {
      resolve();
    }
  });
}

function renderClosestLocations(n, step = "none") {
  const closestLocations = entries
    .filter((item) => !isNaN(item.distanceToCurrentPos))
    .sort(getComparatorByProp("distanceToCurrentPos", "asc"))
    .slice(0, n);
  renderSearchResults(closestLocations);
  renderMarkers(closestLocations, map);
}

function renderSearchResults(results) {
  const resultsDiv = document.getElementsByClassName("results").item(0);
  resultsDiv.innerHTML = "";
  results.forEach((result, index) => {
    if (result.predictions) {
      resultsDiv.innerHTML += `
        <li onclick="setAutoSearchLocaton('${result["description"]}')" role="button">
          <div class="subtitle-part" style="display: flex; flex-direction: row; justify-content: space-between;">
            <div class="subtitle">
              ${result["description"]}
            </div>
          </div>
        </li>
      `;
    } else {
      const mapLink = `/spa/${result.slug}`;

      resultsDiv.innerHTML += `
        <li onclick="movePage('${mapLink}')" role="link">
        <div class="live-item">
          <div style="margin-top: 4px; margin-bottom: 3px; display: flex; flex-direction: row; justify-content: space-between;">
            <div class="title"><b>${result["name"]}${result["location-tag"] ? " " + result["location-tag"] + "" : ""
        }</b></div>
            
          </div>
          <div class="subtitle-part" style="display: flex; flex-direction: row; justify-content: space-between;">
            <div class="subtitle">
              ${result["address-1"]} ${result["address-2"] || " "}<br />
              ${result["name"]} ${result["zip-code-2"]}
            </div>
            <span class="icon icon-right-arrow"></span>
          </div>
        </div>
        </li>
      `;
    }
  });

  if (results.length === 0) {
    resultsDiv.innerHTML += `
      <div style="padding: 24px">
        <p style="object-fit: contain; font-family: Helvetica Neue, sans-serif; font-size: 20px; font-weight: 500; font-stretch: normal; margin: 0 0 8px 0;font-style: normal; line-height: 0.9; letter-spacing: normal; color: #282828;">Sorry, we couldn't find any results.</p>
        <p style="margin: 0; object-fit: contain; font-family: Helvetica Neue, sans-serif; font-size: 14px; font-weight: normal; font-stretch: normal; font-style: normal; line-height: 1.43; letter-spacing: normal; color: #131313;">Check your spelling and try again.</p>
      </div>
    `;
  }
}

function getComparatorByProp(propName, order) {
  const i = order === "asc" ? 1 : order === "desc" ? -1 : 1;

  return function (a, b) {
    if (a[propName] < b[propName]) {
      return -1 * i;
    } else if (a[propName] > b[propName]) {
      return i;
    } else {
      return 0;
    }
  };
}

function nFormatter(num, digits) {
  const si = [
    { value: 1, symbol: "" },
    { value: 1e3, symbol: "k" },
    { value: 1e6, symbol: "M" },
    { value: 1e9, symbol: "G" },
    { value: 1e12, symbol: "T" },
    { value: 1e15, symbol: "P" },
    { value: 1e18, symbol: "E" },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  let i;
  for (i = si.length - 1; i > 0; i--) {
    if (num >= si[i].value) {
      break;
    }
  }
  return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
}

function autoComplete() {
  const input = document.getElementById("pac-input");
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.setComponentRestrictions({
    country: ["us", "ie", "au", "at", "pr", "vi", "gu", "mp"],
  });
  autocomplete.bindTo("bounds", map);
  autocomplete.setFields(["address_components", "geometry", "icon", "name"]);
}

function showLoader(flag) {
  if (flag === true) {
    document.getElementById("loader").style.visibility = "visible";
  } else {
    document.getElementById("loader").style.visibility = "hidden";
  }
}

function groupbystate(collections) {
  collections.map((item) => {
    item.state = states[item["state-abbreviated"]]
  })
  collections.sort(function (a, b) {
    if (a.state < b.state) { return -1; }
    if (a.state > b.state) { return 1; }
    return 0;
  })
  let group = collections.reduce((r, a) => {
    r[a['state-abbreviated']] = [...r[a['state-abbreviated']] || [], a];
    return r;
  }, {});

  const firstDiv = document.getElementById("accordionList1");
  firstDiv.innerHTML = "";

  const secondDiv = document.getElementById("accordionList2");
  secondDiv.innerHTML = "";

  const thirdDiv = document.getElementById("accordionList3");
  thirdDiv.innerHTML = "";


  for (const [index, [property, value]] of Object.entries(Object.entries(group))) {

    console.log(`${index % 3}: ${property}`);
    let initialContent = `<div class="accordion-item" style="border: none;">
      <div class="accordion-header" id="headingOne${index}" style="border-bottom: 1px solid #e6e6e6;">
        <button style="font-size: 18px; color: #303030; font-weight: 700;" class="accordion-button collapsed" type="button"
          data-bs-toggle="collapse" data-bs-target="#collapseOne${index}" aria-expanded="false" aria-controls="collapseOne${index}">
          ${states[property] ? states[property] : property}
        </button>
      </div>
      <div id="collapseOne${index}" class="accordion-collapse collapse" aria-labelledby="'headingOne'${index}"
        data-bs-parent="#accordionExample">
        <div class="accordion-body">
          <ul>`
    let licontent = ``
    value.forEach((element) => {
      const mapLink = `/spa/${element.slug}`;
      licontent += `<li onclick="movePage('${mapLink}')">${element.name} ${element["location-tag"] ? element["location-tag"] : ""}</li>`;
      // console.log(`${index}: ${element.name}`);
    });

    switch (index % 3) {
      case 0:
        firstDiv.innerHTML += initialContent + licontent + `</ul></div></div></div></div>`
        break;
      case 1:
        secondDiv.innerHTML += initialContent + licontent + `</ul></div></div></div></div>`
        break;
      case 2:
        thirdDiv.innerHTML += initialContent + licontent + `</ul></div></div></div></div>`
        break;

      default:
        break;
    }

  }


}

function movePage(movelink) {
  window.location.href = movelink
}
