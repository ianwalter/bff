# @ianwalter/bff
> Your friendly test runner/framework

[![npm page][npmImage]][npmUrl]

## Installation

```console
yarn add @ianwalter/bff --dev
```

## CLI Usage

## Configuration

## Writing tests

Declare a test by calling the test function with a name and a function:

```js
const { test } = require('@ianwalter/bff')
const someFunctionality = require('./someFunctionality')

test('some functionality', ({ expect }) => {
  expect(someFunctionality()).toBeTruthy()
})
```

If the test name/description is really long, you can also pass the test function
in a second call:

```js
test(`
  some functionality when some environment variable is set, the user has some
  localStorage value, and some query parameter has a certain value
`)(({ expect }) => {
  expect(scenario).toMatchSnapshot()
})
```

You can skip individual tests by adding the `.skip` modifier:

```js
test.skip('something', ({ expect }) => {
  expect(something).toBe(somethingElse)
})
```

You can also have only designated tests in a test file executed with the
`.only` modifier:

```js
test.only('focus', ({ expect }) => {
  expect({}).toEqual({})
})
```

## Related

* [`@ianwalter/bff-webdriver`][bffWebdriverUrl] - A bff plugin to enable WebDriver-based testing

## License

Apache 2.0 with Commons Clause - See [LICENSE][licenseUrl]

&nbsp;

Created by [Ian Walter](https://iankwalter.com)

[npmImage]: https://img.shields.io/npm/v/@ianwalter/bff.svg
[npmUrl]: https://www.npmjs.com/package/@ianwalter/bff
[bffWebdriverUrl]: https://github.com/ianwalter/bff-webdriver
[licenseUrl]: https://github.com/ianwalter/bff/blob/master/LICENSE
