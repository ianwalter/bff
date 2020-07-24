const { Print } = require('@ianwalter/print')

let print
let seleniumStandalone

const webdriverVersion = '3.141.59'
const hasBsl = cap => cap['bstack:options'] && cap['bstack:options'].local
const shouldUseBsl = ({ browserstackLocal, capabilities: cap }) =>
  browserstackLocal !== false &&
  (Array.isArray(cap) ? cap.some(hasBsl) : hasBsl(cap))

module.exports = {
  webdriverVersion,
  async before (context) {
    print = new Print(context.log)
    try {
      // Set the WebDriver version if not already configured.
      context.webdriver.version = context.webdriver.version || webdriverVersion
      print.debug('Using WebDriver version', context.webdriver.version)

      if (context.webdriver.standalone) {
        print.debug('Starting Selenium Standalone')
        return new Promise((resolve, reject) => {
          const standalone = require('selenium-standalone')
          const spawnOptions = { stdio: 'inherit' }
          const { version, drivers } = context.webdriver || {}

          // Start the Selenium Standalone server.
          standalone.start({ spawnOptions, version, drivers }, (err, child) => {
            if (err) {
              if (child) {
                // If there was an error but a child process was still created,
                // kill the child process.
                child.kill()
              }
              reject(err)
            } else {
              // Assign the child process to the seleniumStandalone variable so
              // that it can be killed later when the after hook runs.
              seleniumStandalone = child
              resolve()
            }
          })
        })
      } else if (shouldUseBsl(context.webdriver)) {
        print.debug('Starting BrowserStack Local')
        const { start } = require('@ianwalter/bsl')

        // Start the BrowserStack Local tunnel.
        await start(context.webdriver.browserstackLocal)
      }
    } catch (err) {
      print.error(err)
    }
  },
  registration (file, context) {
    print = new Print(context.log)
    try {
      // Extract the WebDriver capabilities from the test configuration.
      const capabilities = Array.isArray(context.webdriver.capabilities)
        ? context.webdriver.capabilities
        : [context.webdriver.capabilities]

      // Go through the browser tests and split them up by capability so that
      // they can be run individually/in parallel.
      context.augmentTests = tests => tests.reduce(
        (acc, test) => acc.concat(capabilities.map(capability => {
          let name = test.name
          if (capabilities.length > 1) {
            // Modify the test name to contain the name of the browser it's
            // being tested in.
            name = `${test.name} in ${capability.browserName}`

            // Modify the test name to contain the version of the browser it's
            // being tested in, if configured.
            if (capability.browserVersion) {
              name += ` ${capability.browserVersion}`
            }
          }

          // Return the test with it's modified name and capability
          // configuration.
          return { ...test, name, capability }
        })),
        []
      )
    } catch (err) {
      print.error(err)
    }
  },
  async beforeEach (file, context) {
    print = new Print(context.log)

    try {
      print.debug('Adding WebDriver integrations')
      const BrowserStackIntegration = require('./integrations/browserstack')
      const ZaleniumIntegration = require('./integrations/zalenium')
      const AppiumIntegration = require('./integrations/appium')

      // Add enabled integrations to the integrations array so they can be used
      // later.
      context.webdriver.integrations = context.webdriver.integrations || []
      BrowserStackIntegration.integrate(context)
      ZaleniumIntegration.integrate(context)
      AppiumIntegration.integrate(context)

      // Go through each enabled integration and allow it to enahance the
      // webdriver capability.
      const enhanceCapability = i => i.enhanceCapability(context.testContext)
      context.webdriver.integrations.forEach(enhanceCapability)
    } catch (err) {
      print.error(err)
    }

    try {
      print.debug('Creating WebdriverIO browser instance')

      // Set up the browser instance and add it to the test context.
      const { remote } = require('webdriverio')
      context.testContext.browser = await remote({
        path: '/wd/hub',
        ...context.webdriver,
        logLevel: context.webdriver.logLevel || context.log.level,
        capabilities: context.testContext.capability
      })

      // Add the expect instance to the browser instance so that the user can
      // more easily create commands that involve making assertions.
      context.testContext.browser.expect = (...args) => (
        context.testContext.expect(...args)
      )
    } catch (err) {
      print.error(err)
    }
  },
  async afterEach (file, context) {
    try {
      // Go through each enabled integration and report results to it, etc.
      print.debug('Running WebDriver integration reporting')
      const toReport = async integration => {
        if (integration.report) {
          integration.report(context)
        }
      }
      await Promise.all(context.webdriver.integrations.map(toReport))
    } catch (err) {
      print.error(err)
    }

    try {
      if (context.testContext.browser) {
        // Tell Selenium to delete the browser session once the test is over.
        print.debug('Terminating WebdriverIO browser instance')
        await context.testContext.browser.deleteSession()
      }
    } catch (err) {
      print.error(err)
    }
  },
  async after (context) {
    try {
      if (seleniumStandalone) {
        // Kill the Selenium Standalone child process.
        print.write('\n')
        print.log('👉', 'bff-webdriver: Stopping Selenium Standalone')
        seleniumStandalone.kill()

        // Run cleanup in case there are any orphaned processes hanging around.
        if (context.err) {
          print.write('\n')
          print.log('👉', 'bff-webdriver: Running manual cleanup')
          const cleanup = require('./cleanup')
          await cleanup()
        }
      } else if (shouldUseBsl(context.webdriver)) {
        // Stop the BrowserStack Local tunnel.
        print.write('\n')
        print.log('👉', 'bff-webdriver: Stopping BrowserStack Local')
        const { stop } = require('@ianwalter/bsl')
        await stop()
      }
    } catch (err) {
      print.error(err)
    }
  }
}
