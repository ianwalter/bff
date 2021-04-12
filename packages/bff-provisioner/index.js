import stream from 'stream'
import { createLogger, chalk } from '@generates/logger'
import Docker from 'dockerode'
import { merge } from '@generates/merger'
import { asleep } from '@ianwalter/sleep'

const logger = createLogger({ level: 'info', namespace: 'bff.provisioner' })
const virtualLogger = createLogger({
  level: 'info',
  namespace: 'bff.provisioner',
  io: false
})
const docker = new Docker()
const attachOpts = { stream: true, stdout: true, stderr: true }
// FIXME: add docker-compose with these images and have Renovate update it, then
// import and parse the yaml so it can be referenced here.
const defaultHubConfig = {
  Image: 'selenium/hub:4.0.0-beta-3-prerelease-20210402',
  Labels: { managedBy: 'bff' },
  PortBindings: {
    '4442/tcp': [{ HostPort: '4442' }],
    '4443/tcp': [{ HostPort: '4443' }],
    '4444/tcp': [{ HostPort: '4444' }]
  },
  Env: [
    'SE_OPTS=--log-level FINE'
  ],
  Healthcheck: {
    Test: ['CMD-SHELL', '/opt/bin/check-grid.sh --host 0.0.0.0 --port 4444'],
    Interval: 15 * 1000 * 1000000, // ARE YOU KIDDING ME, NANOSECONDS!?
    Timeout: 30 * 1000 * 1000000,
    Retries: 5
  }
}
const defaultDockerhostConfig = {
  Name: 'dockerhost',
  Image: 'qoomon/docker-host',
  Labels: { managedBy: 'bff' },
  CapAdd: ['NET_ADMIN', 'NET_RAW'],
  RestartPolicy: { Name: 'on-failure' }
}
const defaultChromeNodeConfig = {
  Image: 'selenium/node-chrome:4.0.0-beta-3-prerelease-20210402',
  Env: [
    'SE_EVENT_BUS_HOST=hub',
    'SE_EVENT_BUS_PUBLISH_PORT=4442',
    'SE_EVENT_BUS_SUBSCRIBE_PORT=4443',
    'JAVA_OPTS=-Djava.net.preferIPv4Stack=true -Dwebdriver.chrome.whitelistedIps=',
    'START_XVFB=false'
  ]
}
// const defaultFirefoxNodeConfig = {
// }

export default {
  async before (context) {
    const { selenium, platform, ...options } = context.provisioner
    if (selenium && platform === 'docker') {
      logger.info('Provisioning Selenium on Docker...')

      // Create the Docker network for the test run.
      const Name = options.network || 'bff'
      const network = await docker.createNetwork({ Name })
      context.provisioner.state = { network: network.id }
      logger.debug('Created Docker network:', Name)

      // Create the Selenium Hub container and connect it to the network.
      const NetworkingConfig = {
        EndpointsConfig: {
          [Name]: { Aliases: ['hub'] }
        }
      }
      const config = merge(defaultHubConfig, { NetworkingConfig }, selenium.hub)
      const container = await docker.createContainer(config)
      context.provisioner.state.hub = container.id
      logger.debug('Created Selenium Hub container:', container.id)

      // Start the Selenium Hub container.
      await container.start()
      logger.debug('Started Selenium Hub container:', container.id)

      // Format the container logs and pipe them to stdout.
      const hubTransform = new stream.Transform({
        transform (chunk, encoding, callback) {
          const content = `${chalk.green.bold('Hub')} • ` + chunk.toString()
          process.stdout.write(virtualLogger.log(content.trim()), callback)
        }
      })
      container.attach(attachOpts, (err, stream) => {
        if (err) {
          logger.warn('Failed to attach to Hub:', err)
        } else {
          stream.pipe(hubTransform).pipe(process.stdout)
        }
      })

      // If specified, create the Dockerhost container that allows the
      // browser node containers to reach servers running locally on the
      // host and connect it to the network.
      if (options.dockerhost) {
        const config = merge(defaultDockerhostConfig, options.dockerhost)
        const container = await docker.createContainer(config)
        context.provisioner.state.dockerhost = container.id
        const EndpointConfig = { Aliases: ['dockerhost'] }
        await network.connect({ Container: container.id, EndpointConfig })
        logger.debug('Created Dockerhost container:', container.id)

        await container.start()
        logger.debug('Started Dockerhost container:', container.id)
      }

      //
      await asleep(9999)
    }
  },
  async beforeEach (_, context) {
    const { selenium, platform } = context.provisioner
    if (selenium && platform === 'docker') {
      // Create the browser node container and connect it to the network.
      const networkOpts = {
        NetworkingConfig: {
          EndpointsConfig: { [context.provisioner.state.network]: {} }
        }
      }
      const config = merge(defaultChromeNodeConfig, networkOpts, selenium.hub)
      const container = await docker.createContainer(config)
      context.provisioner.state.node = container.id
      logger.debug('Created browser node container:', container.id)

      // Start the browser node container.
      await container.start()
      logger.debug('Started browser node container:', container.id)

      // Format the container logs and pipe them to stdout.
      const nodeTransform = new stream.Transform({
        transform (chunk, encoding, callback) {
          const content = `${chalk.red.bold('Chrome')} • ` + chunk.toString()
          process.stdout.write(virtualLogger.log(content.trim()), callback)
        }
      })
      container.attach(attachOpts, (err, stream) => {
        if (err) {
          logger.warn('Failed to attach to Chrome:', err)
        } else {
          stream.pipe(nodeTransform).pipe(process.stdout)
        }
      })
    }

    // const { selenium } = context.provisioner
    // if (selenium && platform === 'docker') {
    //   for (const config of containers) {
    //     logger.debug('Provisioning container', config)

    //     //
    //     // if (config.Labels) {
    //     //   config.Labels.bff = true
    //     // } else {
    //     //   config.Labels = { bff: true }
    //     // }

    //     config.AutoRemove = true

    //     try {
    //       const container = await docker.createContainer(config)
    //       logger.debug('Created container:', container.id)

    //       context.containers.push(container.id)

    //       await container.start()
    //       logger.debug('Started container:', container.id)

    //       container.attach({ stream: true, stdout: true, stderr: true }, function (err, stream) {
    //         stream.pipe(process.stdout)
    //       })

    //       if (config.Network) {
    //         const network = docker.getNetwork(config.Network)
    //         await network.connect({ Container: container.id })
    //       }
    //     } catch (err) {
    //       logger.error(err)
    //     }
    //   }

    //   await asleep(9999)
    // }
  },
  async afterEach (_, context) {
    const { selenium, platform } = context.provisioner
    if (selenium && platform === 'docker') {
      // Kill and remove the browser node container.
      const node = docker.getContainer(context.provisioner.state.node)
      try {
        await node.kill()
        await node.wait()
        logger.debug('Killed browser node container:', node.id)
      } catch (err) {
        logger.warn('Failed to kill the browser node container:', err)
      }
      try {
        await node.remove()
        logger.debug('Removed browser node container:', node.id)
      } catch (err) {
        logger.warn('Failed to remove the browser node container:', err)
      }
    }

    // if (!context.testContext.result.failed) {
    //   logger.debug('Deprovisioning containers', context.containers)
    //   for (const id of context.containers || []) {
    //     logger.debug('Deprovisioning container:', id)

    //     try {
    //       const container = docker.getContainer(id)
    //       await container.stop()
    //       logger.debug('Stopped container:', id)

    //       await container.remove()
    //       logger.debug('Removed container:', id)
    //     } catch (err) {
    //       logger.error(err)
    //     }
    //   }
    // }
  },
  async after (context) {
    const { selenium, platform, ...options } = context.provisioner
    try {
      if (selenium && platform === 'docker') {
        logger.info('Deprovisioning Selenium on Docker...')

        // Kill and remove the Selenium Hub container.
        const hub = docker.getContainer(context.provisioner.state.hub)
        try {
          await hub.kill()
          await hub.wait()
          logger.debug('Killed Selenium Hub container:', hub.id)
        } catch (err) {
          logger.warn('Failed to kill the Selenium Hub container:', err)
        }
        try {
          await hub.remove()
          logger.debug('Removed Selenium Hub container:', hub.id)
        } catch (err) {
          logger.warn('Failed to remove the Selenium Hub container:', err)
        }

        // Kill and remove the Dockerhost container if configured.
        if (options.dockerhost) {
          const dh = docker.getContainer(context.provisioner.state.dockerhost)
          try {
            await dh.kill()
            await dh.wait()
            logger.debug('Killed Dockerhost container:', dh.id)
          } catch (err) {
            logger.warn('Failed to kill the Dockerhost container:', err)
          }
          try {
            await dh.remove()
            logger.debug('Removed Dockerhost container:', dh.id)
          } catch (err) {
            logger.warn('Failed to remove the Dockerhost container:', err)
          }
        }

        // Delete the Docker network created for the test run.
        const network = docker.getNetwork(context.provisioner.state.network)
        try {
          await network.remove()
          logger.debug('Removed Docker network:', network.id)
        } catch (err) {
          logger.warn('Failed to remove Docker network:', err)
        }
      }
    } catch (err) {
      logger.error('Failure during Selenium deprovisioning:', err)
    }
  }
}
