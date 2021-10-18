const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

const baseConfig = {
  url: 'https://beta.iasql.com',
  backendUrl: 'http://localhost:8088',
  // TODO load regions at startup based on aws services and schema since not all regions support all services.
  // Currently manually listing ec2 regions that do not require opt-in status in alphabetical order
  // https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html
  awsRegions: [
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-northeast-3',
    'ap-south-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ca-central-1',
    'eu-central-1',
    'eu-north-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'sa-east-1',
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
  ],
  auth: {
    domain: 'auth.iasql.com',
    clientId: 'OLQAngfr1LnenTt6wmQOYKmzx1c1dSxg',
    redirectPath: 'dashboard',
    // https://auth0.com/docs/quickstart/backend/nodejs/01-authorization#configure-auth0-apis
    audience: 'https://api.iasql.com',
    scope: 'read:dbs, create:dbs, delete:dbs'
  },
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
  favicon: 'img/favicon.ico',
  organizationName: 'alantech', // Usually your GitHub org/user name.
  projectName: 'iasql', // Usually your repo name.

  customFields: config,

  presets: [
    [
      '@docusaurus/preset-classic',
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
        },
        blog: {
          showReadingTime: true,
        },
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
            type: 'doc',
            docId: 'intro',
            position: 'right',
            label: 'Docs',
          },
          {to: '/blog', label: 'Blog', position: 'right'},
          {to: '/schema', label: 'Schema', position: 'right'},
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial',
                to: '/docs/intro',
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
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'Schema',
                to: '/schema',
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
