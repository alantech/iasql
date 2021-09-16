import * as http from 'http'

const server = http.createServer((req, res) => {
  res.end('Hello, World!')
});
server.listen(8088);
