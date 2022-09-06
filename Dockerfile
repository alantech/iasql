FROM node:16-bullseye
WORKDIR /engine/

COPY package.json /engine/package.json
COPY yarn.lock /engine/yarn.lock
RUN ["yarn", "install"]

RUN ["apt", "update"]
RUN ["apt", "install", "curl", "ca-certificates", "gnupg", "-y"]
RUN ["bash", "-c", "curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null"]
RUN ["bash", "-c", "echo 'deb http://apt.postgresql.org/pub/repos/apt/ bullseye-pgdg main' > /etc/apt/sources.list.d/postgresql.list"]
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