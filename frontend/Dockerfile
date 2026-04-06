# Stage 1: Build the React application using Vite
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies based on package-lock to ensure identical environments
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
# (.env environments injected during build processes will be read here)
COPY . .

# Build the production bundle
# Vite automatically compiles and minifies files into the /dist folder
RUN npm run build


# Stage 2: Serve the application via Nginx
# Using alpine Nginx for a minimal, highly performant HTTP server instance
FROM nginx:alpine

# Remove default nginx static assets out of security caution
RUN rm -rf /usr/share/nginx/html/*

# Copy the generated production build folder from the builder stage over to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port 80
EXPOSE 80

# Configure Nginx to serve the SPA (Single Page Application) natively
# React requires fallback routing to index.html for React-Router to function client-side.
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Start Nginx in foreground, preventing container exit
CMD ["nginx", "-g", "daemon off;"]
