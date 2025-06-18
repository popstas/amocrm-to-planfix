# Use the official Node.js LTS image with Debian
FROM node:20-slim

# Set environment to production
ENV NODE_ENV=production

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Expose the port the app runs on
EXPOSE 3012

# Command to run the application
CMD ["npm", "start"]
