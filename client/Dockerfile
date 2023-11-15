FROM node:lts-alpine as build

WORKDIR /app

# Install deps.
COPY --link . ./
RUN npm install

ENV NODE_ENV=production
RUN npm run build

FROM nginx:stable-alpine as web_client

COPY --from=build /app/dist /usr/share/nginx/html
