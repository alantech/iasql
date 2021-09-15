FROM node:14
COPY . .
RUN yarn
RUN yarn build
EXPOSE 8088
CMD yarn start