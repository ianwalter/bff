const path = require('path')
const workerpool = require('workerpool')
const globby = require('globby')
const { print } = require('@ianwalter/print')

let pool = workerpool.pool(path.join(__dirname, 'worker.js'))

function toTests (acc, file) {
  file = path.resolve(file)
  return acc.concat(Object.keys(require(file)).map(name => ({ name, file })))
}

module.exports = function run () {
  return new Promise(async resolve => {
    const results = { pass: 0, fail: 0 }
    const files = await globby(['tests.js', 'tests/**/*.tests.js'])

    // Reduce all of the test files to individual tests and add them to the
    // worker pool to be executed.
    files.reduce(toTests, []).forEach(async ({ file, name }) => {
      try {
        await pool.exec('test', [file, name])
        results.pass++
        print.success(name)
      } catch (err) {
        results.fail++
        print.error(err)
      } finally {
        // Check the status of the worker pool and terminate it if all of the
        // tasks have completed.
        const stats = pool.stats()
        if (stats.activeTasks === 0 && stats.pendingTasks === 0) {
          pool.terminate()
          resolve(results)
        }
      }
    })
  })
}
