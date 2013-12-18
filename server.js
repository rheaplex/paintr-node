#!/bin/env node

var http = require('http');

var host = process.env.OPENSHIFT_NODEJS_IP;
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080


http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('paintr. See http://robmyers.org/paintr for details.\n');
}).listen(port, host);

console.log('Server running at http://' + host + ":" + port + "/");
