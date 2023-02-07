FROM debian:bullseye

# Install OS Packages
RUN apt update
RUN apt install curl ca-certificates gnupg build-essential git jq -y

# Install Postgres
# Update postgresql APT repository [apt.postgresql.org](https://wiki.postgresql.org/wiki/Apt)
RUN ["bash", "-c", "curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null"]
RUN ["bash", "-c", "echo 'deb http://apt.postgresql.org/pub/repos/apt/ bullseye-pgdg main' > /etc/apt/sources.list.d/postgresql.list"]
RUN apt update
RUN apt upgrade -y
RUN apt install postgresql-client-14 postgresql-14 postgresql-14-cron pgbouncer postgresql-server-dev-14 libcurl4-openssl-dev git make g++ locales-all -y

RUN git clone --depth 1 https://github.com/pramsey/pgsql-http
RUN cd pgsql-http && make && make install

# Install NodeJS
RUN ["bash", "-c", "curl -fsSL https://deb.nodesource.com/setup_16.x | bash -"]
RUN apt install nodejs -y
RUN npm install -g yarn

# Dashboard
WORKDIR /dashboard

COPY dashboard/package.json package.json
COPY dashboard/yarn.lock yarn.lock
RUN yarn install

COPY dashboard/assets assets
COPY dashboard/public public
COPY dashboard/tsconfig.json tsconfig.json
COPY dashboard/tailwind.config.js tailwind.config.js
COPY dashboard/craco.config.js craco.config.js
COPY dashboard/src src
ENV REACT_APP_IASQL_ENV=local
RUN yarn build

## Run service
WORKDIR /dashboard/run

COPY dashboard/run/package.json package.json
COPY dashboard/run/yarn.lock yarn.lock
RUN yarn install

COPY dashboard/run/tsconfig.json tsconfig.json
COPY dashboard/run/src src
RUN yarn build

# Engine
WORKDIR /engine

COPY package.json package.json
COPY yarn.lock yarn.lock
RUN yarn install

COPY docker-entrypoint.sh docker-entrypoint.sh
COPY ormconfig.js ormconfig.js
COPY tsconfig.json tsconfig.json
COPY src src
RUN yarn build

COPY ./src/scripts/postgresql.conf /etc/postgresql/14/main/postgresql.conf
COPY ./src/scripts/pg_hba.conf /etc/postgresql/14/main/pg_hba.conf

# Default ENVs that can be overwritten
ARG IASQL_ENV=local
ENV IASQL_ENV=$IASQL_ENV
ARG DB_USER=postgres
ENV DB_USER=$DB_USER
ARG DB_PASSWORD=test
ENV DB_PASSWORD=$DB_PASSWORD

EXPOSE 5432
EXPOSE 3000
EXPOSE 8888
ENTRYPOINT ["/engine/docker-entrypoint.sh"]
