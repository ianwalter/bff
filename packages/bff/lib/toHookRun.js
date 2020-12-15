import path from 'path'

export default function toHookRun (hookName, ...args) {
  return file => async () => {
    let plugin
    try {
      plugin = (await import(file)).default
    } catch (err) {
      // Don't need to handle this error.
    }
    plugin = plugin || (await import(path.resolve(file))).default
    const hook = plugin[hookName]
    if (hook) await hook(...args)
  }
}
