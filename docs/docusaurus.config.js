const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

const baseConfig = {
  url: 'https://docs.iasql.com',
};
const localConfig = {
  url: 'http://localhost:3000'
};
const config = process.env.IASQL_ENV === 'local' ? Object.assign(baseConfig, localConfig) : baseConfig;

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
(module.exports = {
  title: 'IaSQL',
  tagline: 'AWS Infrastructure as SQL',
  url: config.url,
  baseUrl: '/',
  trailingSlash: true,
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.png',
  organizationName: 'alantech', // Usually your GitHub org/user name.
  projectName: 'iasql', // Usually your repo name.

  customFields: config,

  presets: [
    [
      '@docusaurus/preset-classic',
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'IaSQL',
        logo: {
          alt: 'logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            to: 'https://iasql.com',
            target: '_self',
            label: 'Home',
            position: 'right'
          },
          {
            to: 'https://blog.iasql.com',
            target: '_self',
            label: 'Blog',
            position: 'right'
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Product',
            items: [
              {
                label: 'Home',
                to: 'https://iasql.com',
                target: '_self',
              },
              {
                label: 'Blog',
                to: 'https://blog.iasql.com',
                target: '_self',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Reddit',
                href: 'https://reddit.com/r/iasql',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/sqlcloudinfra',
              },
            ],
          },
        ],
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
});
