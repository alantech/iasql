const lightCodeTheme = require('prism-react-renderer/themes/nightOwlLight');
const darkCodeTheme = require('prism-react-renderer/themes/nightOwl');

const prodConfig = {
  url: 'https://iasql.com',
  phKey: 'phc_WjwJsXXSuEl2R2zElUWL55mWpNIfWR8HrFvjxwlTGWH',
};
const localConfig = {
  url: 'http://localhost:3000',
  phKey: 'phc_xvAQWfpHug7G0SuU5P9wwAbvP9ZawgAfIEZ9FUsiarS',
};
const config = process.env.IASQL_ENV === 'local' ? localConfig : prodConfig;
const theButton = require('./src/rehype/thebutton');

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
(
  module.exports = {
    title: 'IaSQL',
    tagline: 'Infrastructure as data in PostgreSQL',
    url: config.url,
    baseUrl: '/',
    trailingSlash: true,
    onBrokenLinks: 'throw',
    onBrokenMarkdownLinks: 'throw',
    favicon: 'img/favicon.png',
    projectName: 'iasql-engine',
    organizationName: 'iasql',

    customFields: config,

    presets: [
      [
        '@docusaurus/preset-classic',
        {
          docs: {
            sidebarPath: require.resolve('./sidebars.js'),
            routeBasePath: '/docs',
            remarkPlugins: [theButton],
          },
          blog: {
            showReadingTime: true,
            routeBasePath: '/blog',
            remarkPlugins: [theButton],
          },
          theme: {
            customCss: require.resolve('./src/css/custom.css'),
          },
          sitemap: {
            changefreq: 'weekly',
            priority: 0.5,
            ignorePatterns: ['/tags/**'],
            filename: 'sitemap.xml',
          },
        },
      ],
    ],

    plugins: [
      [
        'posthog-docusaurus',
        {
          apiKey: config.phKey,
          appUrl: 'https://app.posthog.com', // optional
          enableInDevelopment: true, // optional
          // other options are passed to posthog-js init as is
        },
      ],
    ],

    themeConfig:
      /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
      ({
        colorMode: {
          respectPrefersColorScheme: true,
        },
        navbar: {
          title: '',
          logo: {
            width: '70',
            alt: 'logo',
            src: 'img/logo.png',
            srcDark: 'img/logo_dark.png',
            href: '/',
            target: '_self',
          },
          items: [
            {
              to: 'https://app.iasql.com',
              target: '_self',
              label: 'Dashboard',
            },
            {
              to: 'docs',
              target: '_self',
              label: 'Docs',
            },
            {
              to: 'blog',
              target: '_self',
              label: 'Blog',
            },
            {
              to: 'schema',
              target: '_self',
              label: 'Schema',
            },
            {
              type: 'docsVersionDropdown',
              position: 'right',
            },
            {
              href: 'https://discord.com/invite/machGGczea',
              position: 'right',
              className: 'header-discord-link',
              'aria-label': 'Community',
            },
            {
              href: 'https://github.com/iasql/iasql-engine',
              position: 'right',
              className: 'header-github-link',
              'aria-label': 'GitHub repository',
            },
            {
              type: 'search',
            },
          ],
        },
        footer: {
          style: 'light',
          links: [
            {
              title: 'Product',
              items: [
                {
                  label: 'Docs',
                  href: 'docs',
                  target: '_self',
                },
                {
                  label: 'Blog',
                  href: 'blog',
                  target: '_self',
                },
                {
                  label: 'Dashboard',
                  href: 'https://app.iasql.com',
                  target: '_self',
                },
                {
                  label: 'GitHub',
                  href: 'https://github.com/iasql/iasql-engine',
                  target: '_self',
                },
              ],
            },
            {
              title: 'Community',
              items: [
                {
                  label: 'Discord',
                  href: 'https://discord.com/invite/yxNBQugGbH',
                },
                {
                  label: 'Twitter',
                  href: 'https://twitter.com/iasql',
                },
              ],
            },
          ],
        },
        prism: {
          additionalLanguages: [],
          theme: lightCodeTheme,
          darkTheme: darkCodeTheme,
        },
        algolia: {
          // The application ID provided by Algolia
          appId: '5D0XPJ20G6',
          // Public API key: it is safe to commit it
          apiKey: '3975e3fd292172a78a2092aecca9a2b5',
          indexName: 'docs-iasql',
          contextualSearch: true,
        },
      }),

    scripts: [
      {
        src: 'https://cdnjs.cloudflare.com/ajax/libs/js-cookie/3.0.1/js.cookie.js',
        async: true,
      },
    ],
  }
);
