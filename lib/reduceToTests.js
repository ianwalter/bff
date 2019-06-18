const fn = undefined
const match = (context, tags) => {
  if (['some', 'every'].includes(context.match)) {
    return context.tags[context.match](tag => tags.includes(tag))
  } else {
    throw new Error(
      `--match value must be 'some' or 'every', not '${context.match}'`
    )
  }
}

module.exports = (ctx, hasTags, add = {}) => Object.entries(ctx.testMap).reduce(
  (acc, [name, test]) => !hasTags || (hasTags && match(ctx, test.tags))
    ? acc.concat([{ key: name, name, runTest: true, ...test, fn, ...add }])
    : acc,
  []
)
