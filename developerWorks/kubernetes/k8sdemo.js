var http = require('http');

var handleRequest = function(request, response) {
  console.log('Received request for URL: ' + request.url);
  response.writeHead(200);
  response.write('****************************\n');
  response.write('* Greetings from the DEMO! *\n');
  response.end(  '****************************\n');
};
var www = http.createServer(handleRequest);
www.listen(8080);
