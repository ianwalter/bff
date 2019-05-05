import workerpool from 'workerpool'
import pSettle from 'p-settle'

window.run = async function (file, context) {
  // TODO:
  const pool = workerpool.pool(context.workerPath)

  // TODO:
  const tests = await import(file)

  // TODO:
  return pSettle(tests.map(test => pool.execute('test', [test, file, context])))
}
