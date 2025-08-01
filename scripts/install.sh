#!/bin/bash
# LogScope Production Installer

set -e

INSTALL_DIR="/opt/logscope"
SERVICE_USER="logscope"
CONFIG_DIR="/etc/logscope"

echo "🔍 Installing LogSV..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Create user
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --home-dir "$INSTALL_DIR" --shell /bin/false "$SERVICE_USER"
    echo "✅ Created user: $SERVICE_USER"
fi

# Create directories
mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" /var/log/logscope
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR" /var/log/logscope

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    echo "✅ Installed Node.js"
fi

# Copy files
cp -r . "$INSTALL_DIR/"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

# Install dependencies
cd "$INSTALL_DIR"
npm ci --production
echo "✅ Installed dependencies"

# Copy configuration
cp config/server.example.js "$CONFIG_DIR/server.config.js"
cp config/agent.example.js "$CONFIG_DIR/agent.config.js"
echo "✅ Created configuration files"

# Install systemd services
cp examples/systemd/logsv-server.service /etc/systemd/system/
cp examples/systemd/logsv-agent.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable logsv-server
echo "✅ Installed systemd services"

echo ""
echo "🎉 LogSV installed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Edit configuration: nano $CONFIG_DIR/server.config.js"
echo "2. Start server: systemctl start logsv-server"
echo "3. Configure agents: nano $CONFIG_DIR/agent.config.js"
echo "4. Start agent: systemctl start logsv-agent"
echo "5. Open dashboard: http://localhost:3001"
echo ""
echo "📚 Documentation: https://github.com/yourusername/logsv"
