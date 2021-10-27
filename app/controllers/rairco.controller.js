const axios = require("axios").default;
let {google} = require('googleapis');
let secretKey = require("./client_secret.json");
let jwtClient = new google.auth.JWT(
    secretKey.client_email,
    null,
    secretKey.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']);
//authenticate request
jwtClient.authorize(function (err, tokens) {
    if (err) {
        console.log(err);
        return;
    } else {
        console.log("Successfully connected!");
    }
});
let spreadsheetId = '1p5oA_A7_jeVuCVh5-ovNEI1h0-BHrjI9JYjaRzhbLog';
let sheets = google.sheets('v4');

module.exports = {
    getCollectionData: async (req, res) => {
        try {

            // let sheetRange = 'Locations!A1:L500'
            let sheetRange = req.query.range;
            // console.log('request: ', sheetRange)
            sheets.spreadsheets.values.get({
                auth: jwtClient,
                spreadsheetId: spreadsheetId,
                range: sheetRange
            }, function (err, response) {
                if (err) {
                    console.log('The API returned an error: ' + err);
                } else {
                    res.status(200).json({
                        status: "ok",
                        data: response.data
                    });
                }
            });
        } catch (err) {
            console.log("Error parsing JSON string:", err);
            res.status(400).json({
                status: "failed",
                error: err,
            });
        }
    }
}
