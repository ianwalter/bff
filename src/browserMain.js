import workerpool from 'workerpool'
import pSettle from 'p-settle'

window.runTests = async function (context, fileContext) {
  // TODO:
  const pool = workerpool.pool(context.workerPath)

  // TODO:
  const tests = await import(file)

  // TODO:
  const toExecute = test => pool.execute('test', [context, fileContext, test])
  return pSettle(tests.map(toExecute))
}
