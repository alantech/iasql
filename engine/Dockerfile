FROM node:14
COPY . .
ENV NODE_OPTIONS="--max_old_space_size=8192"
RUN yarn
RUN yarn build
EXPOSE 8088
CMD yarn start