# Use official Node.js LTS (Long Term Support) image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies inside the Docker image
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Create .env file with placeholder if not exists (can be overridden with volume mount)
RUN if [ ! -f .env ]; then echo "GEMINI_API_KEY=placeholder_key\nPORT=3000" > .env; fi

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
