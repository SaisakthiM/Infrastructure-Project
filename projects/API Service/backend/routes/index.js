var express = require('express');
var router = express.Router();

/* GET home page — also the health probe the frontend uses ("is the API up?"). */
router.get('/', (req, res) => {
  res.send('Server');
});

module.exports = router;
