# Run Docker container for Cognitive 3D Learning AI
# This script runs the Docker container and maps port 3000

Write-Host "🚀 Starting Cognitive 3D Learning AI container..." -ForegroundColor Cyan

# Stop and remove existing container if running
$existingContainer = docker ps -a -q -f name=cognitive-3d-app
if ($existingContainer) {
    Write-Host "🛑 Stopping existing container..." -ForegroundColor Yellow
    docker stop cognitive-3d-app | Out-Null
    docker rm cognitive-3d-app | Out-Null
}

# Run the container
# -d: run in detached mode (background)
# --name: give the container a friendly name
# -p 3000:3000: map port 3000 from container to host
# -v: mount .env file to allow custom configuration (optional)
docker run -d `
    --name cognitive-3d-app `
    -p 3000:3000 `
    -v "${PWD}/.env:/app/.env:ro" `
    cognitive-3d-learning-ai:latest

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Application running at: http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor Yellow
    Write-Host "  View logs:     docker logs -f cognitive-3d-app" -ForegroundColor White
    Write-Host "  Stop:          docker stop cognitive-3d-app" -ForegroundColor White
    Write-Host "  Restart:       docker restart cognitive-3d-app" -ForegroundColor White
    Write-Host "  Remove:        docker rm -f cognitive-3d-app" -ForegroundColor White
    Write-Host ""
    
    # Show initial logs
    Start-Sleep -Seconds 2
    Write-Host "📋 Initial logs:" -ForegroundColor Cyan
    docker logs cognitive-3d-app
} else {
    Write-Host "❌ Failed to start container. Please check Docker is running." -ForegroundColor Red
    exit 1
}
