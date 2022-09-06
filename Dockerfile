FROM node:16-bullseye
WORKDIR /engine/

COPY package.json /engine/package.json
COPY yarn.lock /engine/yarn.lock
RUN ["yarn", "install"]

RUN ["apt", "update"]
RUN ["apt", "upgrade", "-y"]
RUN ["apt", "install", "postgresql-client-14", "-y"]

COPY . /engine/
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
ARG IASQL_ENV
ENV IASQL_ENV=$IASQL_ENV
RUN ["yarn", "build"]
EXPOSE 8088
ENTRYPOINT ["/engine/docker-entrypoint.sh"]