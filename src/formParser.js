const qs = require('querystring');

function parseFormEncoded(formString) {
  if (typeof formString !== 'string') {
    throw new TypeError('Expected formString to be a string');
  }

  return qs.parse(formString);
}

module.exports = { parseFormEncoded };

