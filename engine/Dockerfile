FROM node:16
WORKDIR /engine/
COPY . /engine/
RUN yarn
RUN yarn build
EXPOSE 8088
CMD yarn start