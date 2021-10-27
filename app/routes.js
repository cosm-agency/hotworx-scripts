const express = require('express');
const router = express.Router();

const beach = require('./controllers/beach.controller');
const rair = require('./controllers/rairco.controller');

router.post('/planetbeach/generate', beach.generateDB);
router.get('/beach/spas', beach.getCollectionData);
router.get('/rairco/collect', rair.getCollectionData);

module.exports = router;