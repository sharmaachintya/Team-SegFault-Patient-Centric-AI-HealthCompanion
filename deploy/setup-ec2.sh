#!/bin/bash
# =============================================================
# AI Health Companion - EC2 Deployment Script
# Run this on a fresh Ubuntu 22.04+ EC2 instance
# =============================================================

set -e

echo "🏥 AI Health Companion - EC2 Setup"
echo "=================================="

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Python 3.11+
echo "🐍 Installing Python..."
sudo apt install -y python3 python3-pip python3-venv

# Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# Clone the repository (update URL)
echo "📥 Cloning repository..."
cd /home/ubuntu
if [ ! -d "ai-health-companion" ]; then
    echo "Please clone your repository first:"
    echo "  git clone <your-repo-url> ai-health-companion"
    echo "Then re-run this script."
    # For now, assume the code is already here
fi

cd /home/ubuntu/ai-health-companion

# ============================================================
# Build Frontend
# ============================================================
echo "🎨 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# ============================================================
# Setup Backend
# ============================================================
echo "🔧 Setting up backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env file if not exists
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️  Created .env file from template. Update it with your AWS settings:"
    echo "    nano /home/ubuntu/ai-health-companion/backend/.env"
    echo ""
    echo "    Set STORAGE_MODE=aws for production"
fi

cd ..

# ============================================================
# Create DynamoDB Tables
# ============================================================
echo "📊 Creating DynamoDB tables..."
aws dynamodb create-table \
    --table-name HealthCompanion_Profiles \
    --attribute-definitions AttributeName=patient_id,AttributeType=S \
    --key-schema AttributeName=patient_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ap-south-1 2>/dev/null || echo "  Table HealthCompanion_Profiles already exists"

aws dynamodb create-table \
    --table-name HealthCompanion_Timeline \
    --attribute-definitions \
        AttributeName=patient_id,AttributeType=S \
        AttributeName=event_id,AttributeType=S \
    --key-schema \
        AttributeName=patient_id,KeyType=HASH \
        AttributeName=event_id,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region ap-south-1 2>/dev/null || echo "  Table HealthCompanion_Timeline already exists"

aws dynamodb create-table \
    --table-name HealthCompanion_Conversations \
    --attribute-definitions \
        AttributeName=patient_id,AttributeType=S \
        AttributeName=message_id,AttributeType=S \
    --key-schema \
        AttributeName=patient_id,KeyType=HASH \
        AttributeName=message_id,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region ap-south-1 2>/dev/null || echo "  Table HealthCompanion_Conversations already exists"

# ============================================================
# Create S3 Bucket
# ============================================================
echo "🪣 Creating S3 bucket..."
aws s3 mb s3://health-companion-images --region ap-south-1 2>/dev/null || echo "  S3 bucket already exists"

# ============================================================
# Configure Nginx
# ============================================================
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/health-companion > /dev/null <<'NGINX_CONF'
server {
    listen 80;
    server_name _;

    # Frontend static files
    location / {
        root /home/ubuntu/ai-health-companion/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
    }
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/health-companion /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# ============================================================
# Create systemd service
# ============================================================
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/health-companion.service > /dev/null <<'SERVICE'
[Unit]
Description=AI Health Companion Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ai-health-companion/backend
Environment=PATH=/home/ubuntu/ai-health-companion/backend/venv/bin
EnvironmentFile=/home/ubuntu/ai-health-companion/backend/.env
ExecStart=/home/ubuntu/ai-health-companion/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable health-companion
sudo systemctl start health-companion

# ============================================================
# Done!
# ============================================================
echo ""
echo "✅ Deployment complete!"
echo "=================================="
echo ""
echo "📝 Next steps:"
echo "  1. Update .env file: nano /home/ubuntu/ai-health-companion/backend/.env"
echo "     - Set STORAGE_MODE=aws"
echo "     - Verify AWS_REGION"
echo "  2. Ensure EC2 instance has IAM role with:"
echo "     - bedrock:InvokeModel permission"
echo "     - dynamodb:* permissions for HealthCompanion_* tables"
echo "     - s3:* permissions for health-companion-images bucket"
echo "  3. Ensure Security Group allows inbound HTTP (port 80)"
echo "  4. Restart backend: sudo systemctl restart health-companion"
echo ""
echo "🌐 Access your app at: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'YOUR-EC2-IP')"
echo ""
echo "📋 Useful commands:"
echo "  sudo systemctl status health-companion  # Check status"
echo "  sudo journalctl -u health-companion -f   # View logs"
echo "  sudo systemctl restart health-companion  # Restart"
