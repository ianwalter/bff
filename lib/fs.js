const createClient = require('fs-remote/createClient')

module.exports = createClient(`http://localhost:${FILE_SERVER_PORT}`)
