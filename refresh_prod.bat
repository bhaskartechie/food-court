@echo off
setlocal
echo ================================
echo Refresh Production Docker Environment (uses docker-compose.prod.yml)
echo ================================

choice /C YN /N /M "Step 1: Pull latest from remote (git pull)? [Y/N]"
if errorlevel 2 goto SKIP_PULL
echo --- Pulling latest from git ---
git pull
:SKIP_PULL

echo --- Bringing down existing production containers ---
docker-compose -f docker-compose.prod.yml down --remove-orphans

echo --- Building and starting production services ---
docker-compose -f docker-compose.prod.yml up -d --build

echo --- Waiting for backend health endpoint ---
powershell -Command "$ok=$false; for ($i=0;$i -lt 30;$i++){ try{ Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 2; $ok=$true; break } catch {}; Start-Sleep -Seconds 2 }; if ($ok) { Write-Host 'Backend healthy' ; docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head } else { Write-Host 'Backend did not respond in time; skipping migrations' }"

echo --- Showing last 200 lines of backend logs ---
docker-compose -f docker-compose.prod.yml logs --no-color --tail=200 backend

echo --- Production refresh complete ---
endlocal
pause
