const { join, dirname, basename } = require('path')
const { SnapshotState } = require('jest-snapshot')

function getSnapshotState (file, updateSnapshot) {
  // Initialize the snapshot state with a path to the snapshot file and
  // the updateSnapshot setting.
  const snapshotsDir = join(dirname(file), 'snapshots')
  const snapshotFilename = basename(file).replace('.js', '.snap')
  const snapshotPath = join(snapshotsDir, snapshotFilename)
  return new SnapshotState(snapshotPath, { updateSnapshot })
}

const toHookExec = (hook, context) => f => async () => require(f)(hook, context)

module.exports = { getSnapshotState, toHookExec }
