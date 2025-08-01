FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY bin/ ./bin/

# Create non-root user
RUN addgroup -g 1001 -S logscope && \
    adduser -S logscope -u 1001

# Create directories
RUN mkdir -p /logs && chown -R logscope:logscope /app /logs

# Switch to non-root user
USER logscope

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Expose ports
EXPOSE 3001 8080

# Default command
CMD ["node", "src/server/index.js"]
