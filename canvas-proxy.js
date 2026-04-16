const http = require('http');

const server = http.createServer((req, res) => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxy.on('error', () => {
    res.writeHead(502);
    res.end('Backend not ready');
  });

  req.pipe(proxy, { end: true });
});

server.on('upgrade', (req, socket, head) => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(options);
  proxy.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    proxySocket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxy.on('error', () => socket.end());
  proxy.end();
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Canvas proxy listening on port 3000 → forwarding to port 5000');
});
