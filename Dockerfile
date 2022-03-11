FROM node:17-bullseye
WORKDIR /engine/
COPY . /engine/
RUN apt update
RUN apt upgrade -y
RUN apt install postgresql-client-13 -y
RUN yarn
RUN yarn build
EXPOSE 8088
CMD yarn start