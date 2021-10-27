let originData = [];
let locationData = [];
let filterBusinessNames = [];
let searchedResults = [];
let markers = [];
let map, geocoder;
let bounds;
let timerId;
let hoverdebound = -1;
let scopeDistance = 30;
let infowindow = null;
let originBoundryData;
let features;
let currentZipCode = "";
let currentShopName = "";
let storeZipData = [];
let filteredZipStores = [];

const locationSheet =
  "https://scripts.cosmagency.com/rairco/collect?range=Locations!A1:L500";
const zipSheet =
  "https://scripts.cosmagency.com/rairco/collect?range=Delivery_Zip_Codes!A1:D500";

function loadJSON(callback, state) {
  const xobj = new XMLHttpRequest();
  xobj.overrideMimeType("application/json");
  xobj.open(
    "GET",
    `https://scripts.cosmagency.com/rair/assets/current-zip-boundary.json`,
    true
  );
  xobj.onreadystatechange = function () {
    if (xobj.readyState == 4 && xobj.status == "200") {
      callback(xobj.responseText);
    }
  };
  xobj.send(null);
}

$(document).ready(function () {
  console.log("ready!");
  const searchForm = document.querySelector("#search-form");
  searchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    const business = document.querySelector("#rair-business-input").value;
    console.log("search location: ", business);
    return false;
  });
});

function getObjectField(entryData) {
  let temp = {};
  entryData.map((item) => {
    if (item.gs$cell.row === "1") {
      temp[item.gs$cell.col] = item.gs$cell.inputValue;
    }
  });
  return temp;
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 37.09024, lng: -95.712891 },
    zoom: 4,
    disableDefaultUI: true,
    styles: [
      {
        featureType: "all",
        elementType: "geometry.fill",
        stylers: [
          {
            weight: "2.00",
          },
        ],
      },
      {
        featureType: "all",
        elementType: "geometry.stroke",
        stylers: [
          {
            color: "#9c9c9c",
          },
        ],
      },
      {
        featureType: "all",
        elementType: "labels.text",
        stylers: [
          {
            visibility: "on",
          },
        ],
      },
      {
        featureType: "landscape",
        elementType: "all",
        stylers: [
          {
            color: "#f2f2f2",
          },
        ],
      },
      {
        featureType: "landscape",
        elementType: "geometry.fill",
        stylers: [
          {
            color: "#ffffff",
          },
        ],
      },
      {
        featureType: "landscape.man_made",
        elementType: "geometry.fill",
        stylers: [
          {
            color: "#ffffff",
          },
        ],
      },
      {
        featureType: "poi",
        elementType: "all",
        stylers: [
          {
            visibility: "off",
          },
        ],
      },
      {
        featureType: "road",
        elementType: "all",
        stylers: [
          {
            saturation: -100,
          },
          {
            lightness: 45,
          },
        ],
      },
      {
        featureType: "road",
        elementType: "geometry.fill",
        stylers: [
          {
            color: "#eeeeee",
          },
        ],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [
          {
            color: "#7b7b7b",
          },
        ],
      },
      {
        featureType: "road",
        elementType: "labels.text.stroke",
        stylers: [
          {
            color: "#ffffff",
          },
        ],
      },
      {
        featureType: "road.highway",
        elementType: "all",
        stylers: [
          {
            visibility: "simplified",
          },
        ],
      },
      {
        featureType: "road.arterial",
        elementType: "labels.icon",
        stylers: [
          {
            visibility: "off",
          },
        ],
      },
      {
        featureType: "transit",
        elementType: "all",
        stylers: [
          {
            visibility: "off",
          },
        ],
      },
      {
        featureType: "water",
        elementType: "all",
        stylers: [
          {
            color: "#46bcec",
          },
          {
            visibility: "on",
          },
        ],
      },
      {
        featureType: "water",
        elementType: "geometry.fill",
        stylers: [
          {
            color: "#dedede",
          },
        ],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [
          {
            color: "#070707",
          },
        ],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [
          {
            color: "#ffffff",
          },
        ],
      },
    ],
  });
  map.data.setStyle(function (params) {
    // console.log("getproperty: ", params.getProperty("ZCTA5CE10"));
    if (params.getProperty("STORENAME") === currentShopName) {
      return {
        fillColor: "#d4304f",
        fillOpacity: "0.3",
        strokeWeight: 1,
        strokeColor: "#d4304f",
      };
    } else {
      return {
        fillColor: "#262c6a",
        fillOpacity: "0.1",
        strokeWeight: 1,
        strokeColor: "#262c6a",
      };
    }
  });
  map.data.addListener("mouseover", function (event) {
    map.data.revertStyle();
    map.data.overrideStyle(event.feature, {
      fillColor: "#d4304f",
      fillOpacity: "0.3",
      strokeColor: "#d4304f",
    });
  });
  map.data.addListener("mouseout", function (event) {
    map.data.revertStyle();
  });
  setLocation();
}

function renderMarkers(renderItems, specialOneIndex) {
  // console.log("render markers: ", renderItems);
  let filteredBoundaryData = {
    type: "FeatureCollection",
    features: [],
  };

  clearMarkers();
  if (renderItems.length > 0) {
    bounds = new google.maps.LatLngBounds();
    const markerCount = renderItems.length;
    for (let index = 0; index < markerCount; index++) {
      const element = renderItems[index];
      if (element.visiblity) {
        bounds.extend(
          new google.maps.LatLng(+element.latitude, +element.longitude)
        );
        if (index === specialOneIndex) {
          addMarkerWithTimeout(element, "one", 1);
        } else {
          addMarkerWithTimeout(element, "multi", index * 1);
        }
      }
    }

    originBoundryData.features.forEach((item) => {
      filteredZipStores.forEach((storeItem) => {
        if (item.properties.ZCTA5CE10 === storeItem.Zip_Code) {
          filteredBoundaryData.features.push(item);
          bounds.extend(
            new google.maps.LatLng(
              +item.properties.INTPTLAT10,
              +item.properties.INTPTLON10
            )
          );
        }
      });
    });

    // if (markerCount === 1 || specialOneIndex > -1) {
    //   console.log(
    //     "render items[0]",
    //     renderItems[0].longitude,
    //     renderItems[0].latitude
    //   );
    //   let centerPosition = {
    //     lat: 0,
    //     lng: 0,
    //   };
    //   if (markerCount === 1) {
    //     centerPosition.lat = parseFloat(renderItems[0].latitude);
    //     centerPosition.lng = parseFloat(renderItems[0].longitude);
    //   } else {
    //     centerPosition.lat = parseFloat(renderItems[specialOneIndex].latitude);
    //     centerPosition.lng = parseFloat(renderItems[specialOneIndex].longitude);
    //   }
    //   map.panTo(centerPosition);
    //   map.setZoom(10.5);
    // } else {
    map.fitBounds(bounds, { left: 0, bottom: 0, top: 0, right: 0 });
    // }
    // console.log("fitlered boundary data: ", filteredBoundaryData);
    features = map.data.addGeoJson(filteredBoundaryData);
  }
}

function addMarkerWithTimeout(element, renderType, timeout) {
  const position = {
    lat: +element.latitude,
    lng: +element.longitude,
  };
  infowindow = new google.maps.InfoWindow({
    content: `
    <a style="display: inline; margin-right: 24px;" class="shop-button-active" href="tel:${element.phone}">CALL</a>
    <button style="display: inline;" class="shop-button-active" onclick="location.href='${element.shop_now_link}'" >SHOP</button>
    `,
    pixelOffset: new google.maps.Size(0, 180),
  });
  // https://stackoverflow.com/questions/31064916/how-to-change-position-of-google-maps-infowindow/31068910
  window.setTimeout(() => {
    const newMarker = new google.maps.Marker({
      position: position,
      map,
      title: element.store_name,
      icon:
        renderType == "one"
          ? "https://scripts.cosmagency.com/rair/assets/pin_icon_active.svg"
          : "https://scripts.cosmagency.com/rair/assets/pin_icon.svg",
    });
    // if (renderType == "one") {
    //   if (infowindow) {
    //     infowindow.close();
    //   }
    //   infowindow.open(map, newMarker);
    // } else {
    newMarker.addListener("mouseover", () => {
      if (infowindow) {
        infowindow.close();
      }
      infowindow.open(map, newMarker);
    });
    newMarker.addListener("click", () => {
      if (infowindow) {
        infowindow.close();
      }
      infowindow.open(map, newMarker);
    });

    // newMarker.addListener("mouseout", function () {
    //   infowindow.close();
    // });
    // }
    markers.push(newMarker);
  }, timeout);
}

function clearMarkers() {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
  markers = [];
  if (features) {
    for (var i = 0; i < features.length; i++) map.data.remove(features[i]);
  }
}

function addLists(searchedResults) {
  const resultsDiv = document.getElementById("search-result-list");
  resultsDiv.innerHTML = "";
  if (searchedResults.length > 0) {
    searchedResults.forEach((element, index) => {
      if (element.visiblity) {
        const listItem = `
         <div class="search-result-item" onmouseover="renderHoverMark(${index})" onmouseout="clearHoverMark()">
            <div
              class="search-result-item-header d-flex justify-space-between"
            >
              <div class="search-item-name">${element.store_name}</div>
              <div>
                <button
                  class="shop-button"
                  onclick="location.href='${element.shop_now_link}'"
                >
                  SHOP NOW
                </button>
              </div>
            </div>
            <div class="search-result-item-body d-flex">
              <div
                class="search-item-description w-100"
                style="--bg-image: url('${element.image
            ? element.image
            : "https://uploads-ssl.webflow.com/5f2faf77f273cf1e579ec599/60a6479056db29675be9cf55_blank-shop.jpg"
          }')"
              >
                <div class="search-result-item-footer d-md-flex w-md-100 h-100">
                  <div class="search-item-location w-md-50 d-flex">
                            ${element.address_1}, ${element.address_2 ? element.address_2 + ", " : ""
          }<br/>${element.city}, ${element.state}, ${element.zip}
                  </div>
                  <a
                    class="search-item-phone w-md-50 d-flex"
                    href="tel:${element.phone}"
                  >
                    ${element.phone ? element.phone : ""}
                  </a>
                </div>
              </div>
            </div>
          </div>
        `;
        resultsDiv.innerHTML += listItem;
      }
    });
  } else {
    const noResultItem = `
      <div class="no-result">
        <div class="search-item-name">NO RESULTS FIND</div>
        <div class="no-result-description">
          We don't yet serve this area, please sign up to be notified
          when we do.
        </div>
        <div class="d-block signup-form-box">
          <input class="w-100 no-result-input" type="text" placeholder="Your Email Address..." />
          <button class="sign-button w-100">SIGN UP</button>
        </div>
      </div>
    `;
    resultsDiv.innerHTML += noResultItem;
  }
}

function setLocation() {
  getLocationData(locationSheet)
    .then((res) => {
      const sheetData = res.data.values;
      sheetData.forEach((item, index) => {
        let temp = {}
        if (index !== 0) {
          sheetData[0].forEach((ele, index) => {
            temp[sheetData[0][index]] = item[index];
          })
          temp["visiblity"] = true;

          locationData.push(temp)
        }
      })
      filterBusinessNames = locationData;
      addLists(locationData);
      // extendBound(locationData);

      // get geo location data
      loadJSON(function (response) {
        originBoundryData = JSON.parse(response);
        // console.log("boundary data: ", originBoundryData);
        renderMarkers(locationData, -1);
        // map.data.addGeoJson(actual_JSON);
      }, "");

      // console.log("location data: ", locationData);
    })
    .catch((error) => {
      console.log("get location error: ", error);
    });

  getLocationData(zipSheet)
    .then((res) => {
      const sheet2Data = res.data.values;
      sheet2Data.forEach((item, index) => {
        let temp = {}
        if (index !== 0) {
          sheet2Data[0].forEach((ele, index) => {
            temp[sheet2Data[0][index]] = item[index];
          })
          storeZipData.push(temp);
        }
      })

      filteredZipStores = storeZipData;
      // console.log("store zip data: ", storeZipData);
    })
    .catch((error) => {
      console.log("get store zip area data error: ", error);
    });
}

function extendBound(extendItems) {
  bounds = new google.maps.LatLngBounds();
  extendItems.forEach((element) => {
    bounds.extend(
      new google.maps.LatLng(+element.latitude, +element.longitude)
    );
  });
  map.fitBounds(bounds, { left: 0, bottom: 0, top: 0, right: 0 });
}

function getLocationData(url) {
  return new Promise((resolve, reject) => {
    $.ajax({
      async: true,
      crossDomain: true,
      cache: true,
      url,
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

function searchBusinessNames() {
  debounceFunction(searchBusinessNamesDebounce, 200);
}

const debounceFunction = function (func, delay) {
  clearTimeout(timerId);
  timerId = setTimeout(func, delay);
};

function searchBusinessNamesDebounce() {
  const business = document.querySelector("#rair-business-input").value;
  if (business === "") {
    locationData.forEach((item) => {
      item.visiblity = true;
    });
    filterBusinessNames = locationData;
    filteredZipStores = storeZipData;
    addLists(locationData);
    renderMarkers(locationData, -1);
    return;
  }
  filterBusinessNames = [];
  // filterBusinessNames = locationData.filter((el) => {
  //   return (
  //     el.store_name.toLowerCase().includes(business.toLowerCase()) ||
  //     el.address_1.toLowerCase().includes(business.toLowerCase()) ||
  //     el.city.toLowerCase().includes(business.toLowerCase()) ||
  //     el.state.toLowerCase().includes(business.toLowerCase()) ||
  //     el.zip.toLowerCase().includes(business.toLowerCase())
  //   );
  // });
  filteredZipStores = [];
  filteredZipStores = storeZipData.filter((el) => {
    return (
      el.Zip_Code.toLowerCase().includes(business.toLowerCase()) ||
      el.Store.toLowerCase().includes(business.toLowerCase()) ||
      el.City_Name.toLowerCase().includes(business.toLowerCase())
    );
  });

  filterBusinessNames = locationData.map((locItem) => {
    locItem["visiblity"] = false;
    filteredZipStores.map((zipStoreItem) => {
      if (zipStoreItem.Store === locItem.store_name) {
        locItem["visiblity"] = true;
      }
    });
    return locItem;
  });

  addLists(filterBusinessNames);
  if (business === "") {
    renderMarkers([], -1);
    filterBusinessNames = [];
    extendBound(locationData);
  } else {
    renderMarkers(filterBusinessNames, -1);
  }
  hoverdebound = -1;
  currentZipCode = "";
}

function renderHoverMark(indexNum) {
  // console.log("index: ", indexNum);
  if (filterBusinessNames.length > 0) {
    currentZipCode = filterBusinessNames[indexNum].zip;
    currentShopName = filterBusinessNames[indexNum].store_name;
    // console.log("currentZipCode: ", currentZipCode);
  }
  if (hoverdebound != indexNum) {
    renderMarkers(filterBusinessNames, indexNum);
  }
  hoverdebound = indexNum;
}

function clearHoverMark() {
  currentShopName = "";
  if (hoverdebound != -1) {
    renderMarkers(filterBusinessNames, -1);
  }
  hoverdebound = -1;
}
