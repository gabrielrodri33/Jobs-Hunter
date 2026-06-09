FROM apify/actor-node-playwright-chrome:20
COPY package*.json ./
RUN npm --quiet set progress=false \
    && npm install --only=prod --no-optional \
    && echo "Playwright Chrome ready"
COPY . ./
CMD ["node", "src/main.js"]
