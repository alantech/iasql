FROM node:16-bullseye
WORKDIR /engine/
COPY . /engine/
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
ARG IASQL_ENV
ENV IASQL_ENV=$IASQL_ENV
RUN apt update
RUN apt upgrade -y
RUN apt install postgresql-client-13 -y
RUN yarn
RUN yarn build
EXPOSE 8088
CMD yarn start