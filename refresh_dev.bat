@echo off
setlocal
echo ================================
echo Refresh Development Docker Environment
echo ================================

REM -- Step 1: Optional git pull
choice /C YN /N /M "Step 1: Pull latest from remote (git pull)? [Y/N]"
if errorlevel 2 goto SKIP_PULL
echo --- Pulling latest from git ---
git pull
:SKIP_PULL

echo --- Bringing down existing containers ---
docker-compose down --remove-orphans

echo --- Building and starting services (docker-compose up -d --build) ---
docker-compose up -d --build

echo --- Waiting for backend health endpoint ---
powershell -Command "$ok=$false; for ($i=0;$i -lt 30;$i++){ try{ Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 2; $ok=$true; break } catch {}; Start-Sleep -Seconds 2 }; if ($ok) { Write-Host 'Backend healthy' ; docker-compose exec backend alembic upgrade head } else { Write-Host 'Backend did not respond in time; skipping migrations' }"

echo --- Showing last 200 lines of backend logs ---
docker-compose logs --no-color --tail=200 backend

echo --- Refresh complete ---
endlocal
pause
