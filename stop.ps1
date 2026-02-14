# Stop and remove the Cognitive 3D Learning AI container
# This script stops and removes the running container

Write-Host "🛑 Stopping Cognitive 3D Learning AI container..." -ForegroundColor Yellow

$existingContainer = docker ps -a -q -f name=cognitive-3d-app
if ($existingContainer) {
    docker stop cognitive-3d-app | Out-Null
    docker rm cognitive-3d-app | Out-Null
    Write-Host "✅ Container stopped and removed." -ForegroundColor Green
} else {
    Write-Host "ℹ️  No running container found." -ForegroundColor Cyan
}
