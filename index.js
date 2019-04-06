const { join } = require('path')
const workerpool = require('workerpool')
const test = require('./test')
const { oneLine } = require('common-tags')
const signale = require('signale')

const pool = workerpool.pool(join(__dirname, 'worker.js'))

async function run () {
  Object.keys(test).forEach(async name => {
    try {
      console.log(pool.stats())
      await pool.exec('test', [join(__dirname, 'test.js'), name])
      signale.success(oneLine(name))
      console.log(pool.stats())
    } catch (err) {
      console.error('error', err)
    }
  })
  pool.terminate()
}

run()
