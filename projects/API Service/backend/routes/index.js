var express = require('express');
var router = express.Router();
var axios = require('axios')

/* GET home page. */

router.get("/", (req,res) => {
  console.log(req.query)
  res.send("Server")
})
router.get('/api/weather/', async function(req, res, next) {
  const { lat, lon } = req.query;
  if (lat < -90 || lat > 90) {
    return res.status(400).json({ error: "Longitude must be between -180 and 180" });
  }
  if (lon < -180 || lon > 180) {
    return res.status(400).json({ error: "Longitude must be between -180 and 180" });
  
  }
  try {
    const val = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.API_KEY_WEATHER}&units=metric`
    );
    res.json(val.data);
  }
  catch (err) {
    console.log(err)
  }
});

router.get('/api/geo/cod/', async function(req, res, next) {
  const { city, state_code, country_code } = req.query;
  try {
    const val = await axios.get(
      `http://api.openweathermap.org/geo/1.0/direct?q=${city},${state_code},${country_code}&appid=${process.env.API_KEY_WEATHER}`
    );
    res.json(val.data);
  }
  catch (err) {
    console.log(err)
  }
});


module.exports = router;
