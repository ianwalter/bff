const { join } = require('path')
const workerpool = require('workerpool')
const test = require('./tests/fail.test.js')

let pool = workerpool.pool(join(__dirname, 'worker.js'))

module.exports = function run () {
  return new Promise(async resolve => {
    const results = []
    Object.keys(test).forEach(async name => {
      try {
        await pool.exec('test', [join(__dirname, 'tests/fail.test.js'), name])
        results.push({ status: 'success', name })
      } catch (error) {
        results.push({ status: 'error', error })
      }
    })

    const interval = setInterval(() => {
      const stats = pool.stats()
      if (stats.activeTasks === 0 && stats.pendingTasks === 0) {
        clearInterval(interval)
        pool.terminate()
        resolve(results)
      }
    }, 1)
  })
}
