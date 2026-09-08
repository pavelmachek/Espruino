#!bin/espruino
eval(require("fs").readFile("sdl.js"));

// v ~/g/tui/bwatch/ je funkcni verse

// curl -s "ntfy.sh/bangle/json?poll=1&since=latest"

/*
curl \
  -H "Title: Unauthorized access detected" \
  -H "Priority: urgent" \
  -H "Tags: warning,skull" \
  -d "Remote access to phils-laptop detected. Act right away." \
  ntfy.sh/phil_alerts

fetch('https://ntfy.sh/phil_alerts', {
    method: 'POST', // PUT works too
    body: 'Remote access to phils-laptop detected. Act right away.',
    headers: {
        'Title': 'Unauthorized access detected',
        'Priority': 'urgent',
        'Tags': 'warning,skull'
    }
})
*/

const http = require("http");

const data = 'Remote access to phils-laptop detected. Act right away.';

const options = {
  hostname: 'ntfy.sh',
  path: '/bangle',
  method: 'POST',
  headers: {
    'Title': 'Unauthorized access detected',
    'Priority': 'urgent',
    'Tags': 'warning,skull',
    'Content-Type': 'text/plain',
    'Content-Length': data.length,
  },
};

const req = http.request(options, (res) => {
  let responseBody = '';

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', responseBody);
  });
});

req.on('error', (err) => {
  console.error('Request error:', err);
});

req.write(data);
req.end();
