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
const testDoc = require('./src/rehype/testdoc');

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
(
  module.exports = {
    title: 'IaSQL',
    tagline: 'Infrastructure as data in PostgreSQL',
    url: config.url,
    baseUrl: '/',
    trailingSlash: true,
    onBrokenLinks: 'warn', // TODO set to throw
    onBrokenMarkdownLinks: 'throw',
    favicon: 'img/favicon.png',
    projectName: 'iasql',
    organizationName: 'alantech',
    customFields: config,

    presets: [
      [
        '@docusaurus/preset-classic',
        {
          docs: {
            routeBasePath: '/docs',
            remarkPlugins: [testDoc],
            sidebarPath: require.resolve('./sidebars.js'),
            editUrl: 'https://github.com/alantech/iasql/tree/main/site/',
          },
          blog: {
            showReadingTime: true,
            routeBasePath: '/blog',
            remarkPlugins: [testDoc],
            exclude: ['unlisted/*'],
            blogSidebarTitle: 'All posts',
            blogSidebarCount: 'ALL',
            editUrl: 'https://github.com/alantech/iasql/tree/main/site/',
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
          enableInDevelopment: false, // optional
          // other options are passed to posthog-js init as is
        },
      ],
      ['docusaurus-plugin-iasql', { sidebar: { usedSidebar: 'docs' } }],
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
              type: 'docsVersionDropdown',
              position: 'right',
            },
            {
              href: 'https://github.com/alantech/iasql',
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
                  label: 'GitHub',
                  to: 'https://github.com/alantech/iasql',
                  target: '_self',
                }
              ],
            },
            {
              title: 'Content',
              items: [
                {
                  label: 'Docs',
                  to: 'docs',
                  target: '_self',
                },
                {
                  label: 'Blog',
                  to: 'blog',
                  target: '_self',
                }
              ],
            },
          ],
        },
        prism: {
          additionalLanguages: ['hcl'],
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
        src: '/js/js.cookie.min.js',
        async: true,
      },
      {
        src: '/js/lz-string.min.js',
        async: true,
      },
    ],
  }
);
