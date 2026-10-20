// Every upstream call goes through here: one argument (the URL), a global timeout, one error mapping.
const axios = require('axios');

if (axios.defaults) axios.defaults.timeout = Number(process.env.UPSTREAM_TIMEOUT_MS) || 8000;

const get = (url) => axios.get(url);

/** Turns an axios failure into { status, message } for the client. Never throws. */
function mapUpstreamError(err) {
  if (err && (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT')) {
    return { status: 504, message: 'The data provider took too long to answer.' };
  }
  const status = err && err.response && err.response.status;
  if (status === 401 || status === 403) return { status: 502, message: 'The data provider rejected our credentials.' };
  if (status === 404) return { status: 404, message: 'The data provider has nothing for that request.' };
  if (status === 429) return { status: 429, message: 'The data provider is rate limiting us. Try again shortly.' };
  return { status: 502, message: 'The data provider is unavailable.' };
}

function sendUpstreamError(res, err) {
  const { status, message } = mapUpstreamError(err);
  if (status >= 500) console.error('[upstream]', err && (err.message || err));
  if (!res.headersSent) res.status(status).json({ error: message });
}

module.exports = { get, mapUpstreamError, sendUpstreamError };
