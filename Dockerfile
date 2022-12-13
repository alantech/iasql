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

# Update postgresql APT repository [apt.postgresql.org](https://wiki.postgresql.org/wiki/Apt)
RUN ["bash", "-c", "curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null"]
RUN ["bash", "-c", "echo 'deb http://apt.postgresql.org/pub/repos/apt/ bullseye-pgdg main' > /etc/apt/sources.list.d/postgresql.list"]
RUN apt update
RUN apt upgrade -y
RUN apt install postgresql-client-14 postgresql-14 postgresql-14-cron pgbouncer postgresql-server-dev-14 libcurl4-openssl-dev git make g++ locales-all -y
COPY ./src/scripts/postgresql.conf /etc/postgresql/14/main/postgresql.conf
COPY ./src/scripts/pg_hba.conf /etc/postgresql/14/main/pg_hba.conf

RUN git clone https://github.com/pramsey/pgsql-http
RUN cd pgsql-http && make && make install && cd ..

COPY . /engine/
RUN yarn build

# Default ENVs that can be overwritten
ARG IASQL_ENV=local
ENV IASQL_ENV=$IASQL_ENV
ARG SENTRY_RELEASE=0.0.35
ENV SENTRY_RELEASE=$SENTRY_RELEASE
ARG DB_USER=postgres
ENV DB_USER=$DB_USER
ARG DB_PASSWORD=test
ENV DB_PASSWORD=$DB_PASSWORD

EXPOSE 5432
ENTRYPOINT ["/engine/docker-entrypoint.sh"]