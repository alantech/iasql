# Website

This website is built using [Docusaurus 2](https://docusaurus.io/), a modern static website generator.

### Installation

```
$ yarn
```

### Local Development

```
$ yarn start:local
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```
$ yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

### Version

```
$ yarn run docusaurus docs:version $VERSION
```

This command generates a copy of the latest docs under `versioned_docs` with the provided $VERSION

### Deployment

Use the github actions `deploy` job