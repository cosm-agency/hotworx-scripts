const express = require("express");
const axios = require("axios").default;
const app = express();
const jsonfile = require("jsonfile");
const locationsFile = "./locations.json";
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

const jsonParser = bodyParser.json();
const path = require("path");

const fs = require("fs");
const request = require("request");
const cors = require("cors");
const { Client } = require("@googlemaps/google-maps-services-js");
parseString = require("xml2js").parseString;
xml2js = require("xml2js");

dotenv.config();

// app.use(cors({ origin: "*" }));
app.use(function (req, res, next) {
  res.setHeader(
    "Access-Control-Allow-Headers",
    "accept, authorization, content-type, x-requested-with"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE"
  );
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.use(express.static(path.resolve("./public")));

const apiRoutes = require('./app/routes');
app.use('/', apiRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: {
      info: "Cosm Dev Server",
    },
  });
});

app.get("/generate-raircode", (req, res) => {
  const zipSheet =
    "https://spreadsheets.google.com/feeds/cells/1p5oA_A7_jeVuCVh5-ovNEI1h0-BHrjI9JYjaRzhbLog/2/public/full?alt=json";

  getSheetData(zipSheet).then((response) => {
    const entries = response.data.feed.entry;
    const locationObject = getObjectField(entries);
    let previousRow = 2;
    let temp = {};
    let storeZipData = [];
    let newZipBoundary = {
      type: "FeatureCollection",
      features: [],
    };
    for (let index = 0; index < entries.length; index++) {
      const element = entries[index];
      const currentRow = parseInt(element.gs$cell.row);
      if (currentRow > 1) {
        if (currentRow === previousRow) {
          temp[locationObject[element.gs$cell.col]] = element.gs$cell.$t;
        }
        if (currentRow > previousRow) {
          storeZipData.push(temp);
          temp = {};
          temp[locationObject[element.gs$cell.col]] = element.gs$cell.$t;
          previousRow++;
        }
      }
    }
    storeZipData.push(temp);

    storeZipData.forEach((storeItem, index) => {
      const loadJson = `./assets/zip-code-geojson/${storeItem.State.toLowerCase()}_zip_codes_geo.min.json`;
      jsonReader(loadJson, (err, geoCodeItem) => {
        if (err) {
          console.log("Error reading file:", err);
          return res.status(500).json({
            success: false,
            error: err,
          });
        }
        // if (storeItem.Zip_Code === "49307") {
        //   console.log("49307-1", storeItem.Zip_Code);
        // }
        geoCodeItem.features.forEach((featureItem) => {
          // if (featureItem.properties.ZCTA5CE10 === "49307") {
          //   console.log("49307-2");
          // }
          if (storeItem.Zip_Code === featureItem.properties.ZCTA5CE10) {
            featureItem.properties["STORENAME"] = storeItem.Store;
            newZipBoundary.features.push(featureItem);
          }
        });
        if (index === storeZipData.length - 1) {
          // console.log("origin geocode", JSON.stringify(newZipBoundary));
          fs.writeFile(
            "./public/current-zip-boundary.json",
            JSON.stringify(newZipBoundary),
            (err) => {
              if (err) console.log("Error writing file:", err);
              console.log("file write successfully");
            }
          );
        }
      });
    });

    // console.log("response", response.data.feed);
    res.status(200).json({
      success: true,
      data: storeZipData,
    });
  });
});

app.get("/generate-all", jsonParser, (req, res) => {
  console.log("webhook triggered: ");
  try {
    let entries = [];
    requestLocationData(0).then((response) => {
      const locationData = response.data;
      entries = [...response.data.items];
      let promiseRequests = [];
      if (locationData.count < locationData.total) {
        for (
          let i = locationData.count;
          i < locationData.total;
          i = i + locationData.limit
        ) {
          promiseRequests.push(requestLocationData(i));
        }
        Promise.all(promiseRequests).then((result) => {
          result.forEach((item) => {
            entries = [...entries, ...item.data.items];
          });
          generateImages(entries);
          return res.status(200).json({
            data: entries.length,
          });
        });
      }
    });
  } catch (err) {
    console.log("error: ", err);
  }
  res.status(200).json({
    message: "triggered",
  });
});

app.post("/generate", jsonParser, async (req, res) => {
  try {
    let locationData = [];
    const collectionData = req.body;
    console.log("collection Data: ");

    if (collectionData["latitude"] && collectionData["longitude"]) {
      locationData.push(collectionData);
      generateImages(locationData);
      // updateLocationJsonFile(collectionData);
    } else {
      let address = "";
      if (collectionData["location-address"]) {
        address = collectionData["location-address"];
      } else {
        address =
          collectionData["address-1"] + " " + collectionData["address-2"];
      }
      const geoData = await getCodeAddress(address);
      console.log("geoData: ");
      collectionData["latitude"] = geoData.lat.toString();
      collectionData["longitude"] = geoData.lng.toString();
      locationData.push(collectionData);
      generateImages(locationData);
      // updateLocationJsonFile(collectionData);
    }
    updateJsonData();
    res.status(200).json({
      message: "image is generated",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error,
    });
  }
});

app.get("/generate-image", async (req, res) => {
  res.status(200).json({
    data: "generate-image",
  });
});

app.get("/studios", async (req, res) => {
  fs.readFile("./locations.json", "utf8", (err, jsonString) => {
    if (err) {
      console.log("Error reading file from disk:", err);
      return;
    }
    try {
      const locationsData = JSON.parse(jsonString);
      // console.log("calling location Data"); // => "Customer address is: Infinity Loop Drive"
      res.status(200).json({
        status: "ok",
        data: locationsData,
        counter: locationsData.length,
      });
    } catch (err) {
      console.log("Error parsing JSON string:", err);
      res.status(400).json({
        status: "failed",
        error: err,
      });
    }
  });
});

app.post("/generateBlog", async (req, res) => {
  console.log("here is generateBlog");
  try {
    const responseXML = await getOriginXML(
      "https://www.hotworx.net/blog/rss.xml"
    );
    const originXML = responseXML.data;
    parseString(originXML, (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({
          status: "failed",
          error: error,
        });
      }
      let json = result;
      let medias = json.rss.channel[0].item;
      medias = medias.map((item) => {
        if (item["media:content"]) {
          delete item["media:content"][0]["$"]["medium"];
          item["media:content"][0]["$"]["type"] = "image/*";
        }
        return item;
      });
      json.rss.channel[0].item = medias;
      const builder = new xml2js.Builder();
      const xml = builder.buildObject(json);

      fs.writeFile("public/hotworx/blog.xml", xml, function (error, data) {
        if (error) {
          console.log(error);
          return res.status(500).json({
            status: "failed",
            error: error,
          });
        }
        res.status(200).json({
          status: "ok",
          message: "updated xml file",
        });
      });
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      error: error,
    });
  }
});

app.post("/generateNewBlog", async (req, res) => {
  try {
    const responseXML = await getOriginXML(
      "https://www.hotworx.net/blog/rss.xml"
    );
    const originXML = responseXML.data;
    parseString(originXML, (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({
          status: "failed",
          error: error,
        });
      }
      let json = result;
      let medias = json.rss.channel[0].item;
      medias = medias.map((item) => {
        if (item["media:content"]) {
          delete item["media:content"][0]["$"]["medium"];
          item["media:content"][0]["$"]["type"] = "image/*";
        }
        return item;
      });
      json.rss.channel[0].item = medias;
      const builder = new xml2js.Builder();
      const xml = builder.buildObject(json);

      fs.writeFile("public/hotworx/newblog.xml", xml, function (error, data) {
        if (error) {
          console.log(error);
          return res.status(500).json({
            status: "failed",
            error: error,
          });
        }
        res.status(200).json({
          status: "ok",
          message: "updated xml file",
        });
      });
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      error: error,
    });
  }
});

app.post("/generateNews", async (req, res) => {
  try {
    const responseXML = await getOriginXML(
      "https://www.hotworx.net/news/rss.xml"
    );
    const originXML = responseXML.data;
    parseString(originXML, (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).json({
          status: "failed",
          error: error,
        });
      }
      let json = result;
      let medias = json.rss.channel[0].item;
      medias = medias.map((item) => {
        if (item["media:content"]) {
          delete item["media:content"][0]["$"]["medium"];
          item["media:content"][0]["$"]["type"] = "image/*";
        }
        return item;
      });
      json.rss.channel[0].item = medias;
      const builder = new xml2js.Builder();
      const xml = builder.buildObject(json);
      console.log("here is generateNews");

      fs.writeFile("public/hotworx/news.xml", xml, function (error, data) {
        if (error) {
          console.log(error);
          return res.status(500).json({
            status: "failed",
            error: error,
          });
        }
        res.status(200).json({
          status: "ok",
          message: "updated xml file",
        });
      });
    });
  } catch (error) {
    res.status(500).json({
      status: "failed",
      error: error,
    });
  }
});

const updateLocationJsonFile = (locationData) => {
  jsonReader("./locations.json", (err, locations) => {
    if (err) {
      console.log("Error reading file:", err);
      return;
    }
    let newCollectionFlag = false;

    let updateLocation = locations.map((element) => {
      if (element.slug == locationData.slug) {
        element = locationData;
        newCollectionFlag = true;
      }
      return element;
    });

    if (newCollectionFlag === false) {
      updateLocation.push(locationData);
    }

    fs.writeFile("./locations.json", JSON.stringify(updateLocation), (err) => {
      if (err) console.log("Error writing file:", err);
    });
  });
};

function jsonReader(filePath, cb) {
  fs.readFile(filePath, (err, fileData) => {
    if (err) {
      return cb && cb(err);
    }
    try {
      const object = JSON.parse(fileData);
      return cb && cb(null, object);
    } catch (err) {
      return cb && cb(err);
    }
  });
}

const requestLocationData = (offset) => {
  const url = `https://api.webflow.com/collections/5fb1c7dafe82bc064dd10ee3/items?offset=${offset}`;
  const headers = {
    Authorization:
      "Bearer bdb47ad338896ff91f7d7a64236a91640ecf45826e9cb24f604d69b11ed9eb87",
    "accept-version": "1.0.0",
    "cache-control": "public",
    "X-Requested-With": "x-requested-with, x-requested-by",
  };
  return axios.get(url, {
    headers: headers,
  });
};

const getSheetData = (url) => {
  return axios.get(url);
};

const getOriginXML = (url) => {
  return axios.get(url);
};

const generateImages = (locationData) => {
  locationData.forEach((item) => {
    if (item.latitude && item.longitude) {
      downloadImage(
        `http://maps.googleapis.com/maps/api/staticmap?size=500x456&center=${item.latitude},${item.longitude}&zoom=16&style=visibility:on&style=feature:water%7Celement:geometry%7Cvisibility:on&style=feature:landscape%7Celement:geometry%7Cvisibility:on&style=feature:landscape%7Celement:all%7Ccolor:0xf2f2f2&style=feature:poi|visibility:off&style=feature:administrative%7Celement:labels.text.fill%7Ccolor:0x444444&style=feature:road.highway%7Celement:all%7Cvisibility:simplified&style=feature:road%7Celement:all%7Csaturation:-100&style=feature:road%7Celement:all%7Clightness:45&style=feature:road.arterial%7Celement:labels.icon%7Cvisibility:off&style=feature:water%7Celement:geometry%7Ccolor:0xc0e4f3&markers=icon:https://uploads-ssl.webflow.com/5ea4822fd3a80f6c9cc4fdd9/5f87fae52f748c7c5ad55614_5f81e4e7374a417200dc2551_Geo_Tag.png%7Clabel:S%7C${item.latitude},${item.longitude}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
        `public/studio-images/hotworx-map-${item.slug}.png`,
        () => {}
      );
    }
  });
};

const downloadImage = (url, fileName, callback) => {
  request.head(url, function (err, res, body) {
    request(url).pipe(fs.createWriteStream(fileName)).on("close", callback);
  });
};

function getCodeAddress(address) {
  return new Promise((resolve, reject) => {
    const client = new Client({});
    client
      .geocode({
        params: {
          key: process.env.GOOGLE_MAPS_API_KEY,
          address: address,
        },
      })
      .then((geoCodeRes) => {
        // console.log("getcoderes: ", );
        const geoData = geoCodeRes.data.results[0].geometry.location;
        resolve(geoData);
      })
      .catch((e) => {
        console.log(e);
        reject(e);
      });
  });
}

function getObjectField(entryData) {
  let temp = {};
  entryData.map((item) => {
    if (item.gs$cell.row === "1") {
      temp[item.gs$cell.col] = item.gs$cell.inputValue;
    }
  });
  return temp;
}

function updateJsonData() {
  let entries = [];
  requestLocationData(0).then((response) => {
    const locationData = response.data;
    entries = [...response.data.items];
    let promiseRequests = [];
    if (locationData.count < locationData.total) {
      for (
        let i = locationData.count;
        i < locationData.total;
        i = i + locationData.limit
      ) {
        promiseRequests.push(requestLocationData(i));
      }
      Promise.all(promiseRequests).then((result) => {
        result.forEach((item) => {
          entries = [...entries, ...item.data.items];
        });

        // generateImages(entries);
        // return res.status(200).json({
        //   data: entries.length,
        // });
        fs.writeFile("./locations.json", JSON.stringify(entries), (err) => {
          if (err) console.log("Error writing file:", err);
        });
      });
    }
  });
}

app.listen(3000, () => console.log("Gator app listening on port 3000!"));
