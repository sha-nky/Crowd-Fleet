const express = require("express")
const { getSample } = require('../controllers');

const router = new express.Router();

router.get('/', (req, res) => {
    res.send('Welcome to the Crowd-Fleet API!');
});

router.get('/api/sample', getSample);

module.exports = router;
