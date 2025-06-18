# Use the official Node.js LTS image as the base image
FROM node:20-alpine

# Set environment to production
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./


# Install app dependencies
RUN npm install --production

# Bundle app source
COPY . .

# Expose the port the app runs on
EXPOSE 3012



# Command to run the application
CMD ["npm", "start"]
