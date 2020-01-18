module.exports = {
  title: '@ianwalter/bff',
  themeConfig: {
    repo: 'ianwalter/bff',
    nav: [
      {
        text: 'Guide',
        link: '/guide/'
      },
      {
        text: 'API Reference',
        items: [
          {
            text: 'createApp',
            link: '/api/createApp'
          },
          {
            text: 'Middleware',
            link: '/api/middleware'
          },
          {
            text: 'Errors',
            link: '/api/errors'
          },
          {
            text: 'Models',
            link: '/api/models'
          }
        ]
      },
      {
        text: 'Examples',
        link: '/examples'
      }
    ],
    sidebar: {
      '/guide/': [
        {
          title: 'Guide',
          collapsable: false,
          children: [
            'installation'
          ]
        }
      ]
    }
  }
}
