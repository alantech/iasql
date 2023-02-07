FROM node:18-bullseye
WORKDIR /run/

COPY package.json /run/package.json
COPY yarn.lock /run/yarn.lock
COPY tsconfig.json /run/tsconfig.json
RUN apt update
RUN apt upgrade -y

COPY src/ /run/src/
RUN yarn
RUN yarn build

# Default ENVs that can be overwritten
ARG IASQL_ENV=local
ENV IASQL_ENV=$IASQL_ENV

EXPOSE 8888
CMD yarn start