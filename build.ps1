# Build Docker image for Cognitive 3D Learning AI
# This script builds the Docker image with all dependencies installed

Write-Host "🐳 Building Docker image for Cognitive 3D Learning AI..." -ForegroundColor Cyan

# Build the Docker image
docker build -t cognitive-3d-learning-ai:latest .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker image built successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To run the container, execute: .\run.ps1" -ForegroundColor Yellow
} else {
    Write-Host "❌ Docker build failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}
