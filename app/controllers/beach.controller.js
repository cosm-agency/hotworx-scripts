const axios = require("axios").default;
const fs = require("fs");
const request = require("request");

module.exports = {
    getCollectionData: async (req, res) => {
        fs.readFile("./beachLocation.json", "utf8", (err, jsonString) => {
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
    },
    generateDB: async (req, res) => {
        try {
            let entries = [];
            requestLocationData(0).then((response) => {
                const locationData = response.data;
                entries = [...response.data.items];
                let promiseRequests = [];
                console.log('response, ', locationData.total, locationData.count)
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
                        fs.writeFile("./beachLocation.json", JSON.stringify(entries), (err) => {
                            if (err) console.log("Error writing file:", err);
                        });
                        return res.status(200).json({
                            data: entries.length,
                        });
                    });
                } else {
                    fs.writeFile("./beachLocation.json", JSON.stringify(entries), (err) => {
                        if (err) console.log("Error writing file:", err);
                    });
                    generateImages(entries);
                    return res.status(200).json({
                        data: entries.length,
                    });
                }
            })
                .catch((error) => {
                    console.error('collection error', error);
                    res.status(500).json({
                        success: false,
                        error
                    })
                });
        } catch (error) {
            console.log('generate json error', error)
        }
    }
}

const requestLocationData = (offset) => {
    const url = `https://api.webflow.com/collections/607c40f8158ffffa70f003fe/items?offset=${offset}`;
    const headers = {
        Authorization:
            "Bearer f6a0713d6785dbc595c16460d16f81a0a34c74f33fbe5e369cc0c77885ff151e",
        "accept-version": "1.0.0",
        "cache-control": "public",
        "X-Requested-With": "x-requested-with, x-requested-by",
    };
    return axios.get(url, {
        headers: headers,
    });
};

const generateImages = (locationData) => {
    locationData.forEach((item) => {
        console.log('image generate: ', item.slug)
        if (item.latitude && item.longitude) {
            downloadImage(
                `http://maps.googleapis.com/maps/api/staticmap?size=500x456&center=${item.latitude},${item.longitude}&zoom=16&style=visibility:on&style=feature:water%7Celement:geometry%7Cvisibility:on&style=feature:landscape%7Celement:geometry%7Cvisibility:on&style=feature:landscape%7Celement:all%7Ccolor:0xf2f2f2&style=feature:poi|visibility:off&style=feature:administrative%7Celement:labels.text.fill%7Ccolor:0x444444&style=feature:road.highway%7Celement:all%7Cvisibility:simplified&style=feature:road%7Celement:all%7Csaturation:-100&style=feature:road%7Celement:all%7Clightness:45&style=feature:road.arterial%7Celement:labels.icon%7Cvisibility:off&style=feature:water%7Celement:geometry%7Ccolor:0xc0e4f3&markers=icon:https://uploads-ssl.webflow.com/5ea4822fd3a80f6c9cc4fdd9/5f87fae52f748c7c5ad55614_5f81e4e7374a417200dc2551_Geo_Tag.png%7Clabel:S%7C${item.latitude},${item.longitude}&key=AIzaSyBI1TN8xKeSM3HX6C40vNoy4xnTZxUU0uo`,
                `public/planetbeach/images/${item.slug}.png`,
                () => { }
            );
        }
    });
};

const downloadImage = (url, fileName, callback) => {
    request.head(url, function (err, res, body) {
        request(url).pipe(fs.createWriteStream(fileName)).on("close", callback);
    });
};