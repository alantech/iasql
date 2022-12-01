FROM debian:bullseye
WORKDIR /psql/

RUN apt update
RUN apt install curl ca-certificates gnupg -y
RUN ["bash", "-c", "curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null"]
RUN ["bash", "-c", "echo 'deb http://apt.postgresql.org/pub/repos/apt/ bullseye-pgdg main' > /etc/apt/sources.list.d/postgresql.list"]
RUN apt update
RUN apt upgrade -y
RUN apt install postgresql-client-14 postgresql-14 postgresql-14-cron pgbouncer postgresql-server-dev-14 libcurl4-openssl-dev git make g++ locales-all -y
COPY ./postgresql.conf /etc/postgresql/14/main/postgresql.conf
COPY ./pg_hba.conf /etc/postgresql/14/main/pg_hba.conf
COPY ./docker-entrypoint.sh /psql/docker-entrypoint.sh

RUN git clone https://github.com/pramsey/pgsql-http
RUN cd pgsql-http && make && make install && cd ..

EXPOSE 5432
ENTRYPOINT ["/psql/docker-entrypoint.sh"]