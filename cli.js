// const meow = require('meow')
const { print } = require('@ianwalter/print')
const bff = require('.')

async function run () {
  // const cli = meow(
  //   `
  //   `,
  //   {

  //   }
  // )

  const results = await bff()
  results.forEach(result => {
    if (result.status === 'success') {
      print.success(result.name)
    } else {
      print.error(result.error)
    }
  })
}

run()
