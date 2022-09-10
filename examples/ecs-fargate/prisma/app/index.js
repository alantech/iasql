const express = require('express')
const app = express()
const port = 8088

app.get('/health', (_req, res) => {
  res.send('I\'m alive!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})