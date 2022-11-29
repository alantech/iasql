FROM debian:bullseye
WORKDIR /engine/

COPY package.json /engine/package.json
COPY yarn.lock /engine/yarn.lock
RUN apt update
RUN apt install curl ca-certificates gnupg -y
RUN ["bash", "-c", "curl -fsSL https://deb.nodesource.com/setup_16.x | bash -"]
RUN apt install nodejs -y
RUN npm install -g yarn
RUN yarn install

# TODO: Revive this when we're ready to upgrade to Postgres 14
# RUN ["bash", "-c", "curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null"]
# RUN ["bash", "-c", "echo 'deb http://apt.postgresql.org/pub/repos/apt/ bullseye-pgdg main' > /etc/apt/sources.list.d/postgresql.list"]
# RUN apt update
# RUN apt upgrade -y
# RUN apt install postgresql-client-14 postgresql-14 pgbouncer -y
# COPY ./src/scripts/postgresql.conf /etc/postgresql/14/main/postgresql.conf
# COPY ./src/scripts/pg_hba.conf /etc/postgresql/14/main/pg_hba.conf

# Update postgresql APT repository [apt.postgresql.org](https://wiki.postgresql.org/wiki/Apt)
RUN ["bash", "-c", "curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null"]
RUN ["bash", "-c", "echo 'deb http://apt.postgresql.org/pub/repos/apt/ bullseye-pgdg main' > /etc/apt/sources.list.d/postgresql.list"]
RUN apt update
RUN apt upgrade -y
# From https://unix.stackexchange.com/a/366722
RUN apt install postgresql-client-13 postgresql-13 postgresql-13-cron pgbouncer locales-all -y
COPY ./src/scripts/postgresql.conf /etc/postgresql/13/main/postgresql.conf
COPY ./src/scripts/pg_hba.conf /etc/postgresql/13/main/pg_hba.conf

COPY . /engine/
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
ARG IASQL_ENV
ENV IASQL_ENV=$IASQL_ENV
RUN yarn build

EXPOSE 8088
EXPOSE 5432
ENTRYPOINT ["/engine/docker-entrypoint.sh"]