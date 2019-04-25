const { join, dirname, basename, resolve } = require('path')
const { SnapshotState } = require('jest-snapshot')

function getSnapshotState (file, updateSnapshot) {
  // Initialize the snapshot state with a path to the snapshot file and
  // the updateSnapshot setting.
  const snapshotsDir = join(dirname(file), 'snapshots')
  const snapshotFilename = basename(file).replace('.js', '.snap')
  const snapshotPath = join(snapshotsDir, snapshotFilename)
  return new SnapshotState(snapshotPath, { updateSnapshot })
}

function toHookExec (hookName, context) {
  return file => async () => {
    let plugin
    try {
      plugin = require(file)
    } catch (err) {
      // Don't need to handle this error.
    }
    plugin = plugin || require(resolve(file))
    const hook = plugin[hookName]
    if (hook) {
      await hook(context)
    }
  }
}

module.exports = { getSnapshotState, toHookExec }
