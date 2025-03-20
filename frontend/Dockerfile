# Use the official Node.js image for the frontend
FROM node:18

# Set the working directory for the frontend
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (for faster Docker builds)
COPY package*.json ./

# Install the frontend dependencies
RUN npm install

# Copy all frontend code into the container
COPY . .

# Expose the port that the React app will run on
EXPOSE 3001

# Command to start the frontend app
CMD ["npm", "start"]
