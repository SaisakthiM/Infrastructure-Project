var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var client = require('prom-client');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var weatherRouter = require('./routes/weather');
var geoRouter = require('./routes/geo');
var marketsRouter = require('./routes/markets');
var worldRouter = require('./routes/world');
var exchangeRouter = require('./routes/exchange');

var app = express();

// ── Prometheus metrics ─────────────────────────────────────
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'api_service_' });

const httpRequestDuration = new client.Histogram({
  name: 'api_service_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });
  });
  next();
});
// ──────────────────────────────────────────────────────────

// The browser app is served from the same origin in production; CORS only matters for local dev.
const cors = require('cors');
const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins }));
app.set('trust proxy', 1);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/geo', geoRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/world', worldRouter);
app.use('/api/exchange', exchangeRouter);

// ── /metrics endpoint ──────────────────────────────────────
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
// ──────────────────────────────────────────────────────────

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler: JSON for the API, the jade page for everything else
app.use(function(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: status >= 500 ? 'Something went wrong.' : err.message });
  }
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(status);
  res.render('error');
});

module.exports = app;
