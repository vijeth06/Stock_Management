Write-Host "Starting Fabric network (docker-compose up -d)..."
docker-compose -f ..\docker-compose.yml up -d

Write-Host "Starting gateway via npm in background..."
Start-Process -FilePath "npm" -ArgumentList "--prefix", "..\gateway", "start" -NoNewWindow

# Wait for gateway health endpoint to become available
$healthUrl = "http://localhost:3000/health"
$maxAttempts = 60
$attempt = 0
Write-Host "Waiting for gateway health at $healthUrl (timeout: $maxAttempts attempts)..."
while ($attempt -lt $maxAttempts) {
	try {
		$resp = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 5 -ErrorAction Stop
		if ($resp.StatusCode -eq 200) {
			Write-Host "Gateway healthy: $($resp.StatusCode)"
			exit 0
		}
	} catch {
		# ignore and retry
	}
	Start-Sleep -Seconds 2
	$attempt++
}

Write-Host "Timed out waiting for gateway health after $maxAttempts attempts." -ForegroundColor Red
exit 1