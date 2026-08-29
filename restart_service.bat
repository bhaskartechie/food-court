@echo off
setlocal
echo ================================
echo Restart Docker Compose Service
echo ================================

if "%1"=="" (
  echo Usage: restart_service.bat [backend|frontend|postgres|redis|all]
  goto :EOF
)

set SERVICE=%1

if /I "%SERVICE%"=="all" (
  echo Restarting all services (docker-compose up -d --build)
  docker-compose up -d --build
  goto :DO_MIGRATE
)

echo Restarting service: %SERVICE%
docker-compose up -d --build %SERVICE%

:DO_MIGRATE
REM If restarting backend, attempt migrations after it's healthy
if /I "%SERVICE%"=="backend" (
  echo Waiting for backend health...
  powershell -Command "$ok=$false; for ($i=0;$i -lt 30;$i++){ try{ Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 2; $ok=$true; break } catch {}; Start-Sleep -Seconds 2 }; if ($ok) { Write-Host 'Backend healthy' ; docker-compose exec backend alembic upgrade head } else { Write-Host 'Backend did not respond in time; skipping migrations' }"
)

echo Done. Showing last 100 lines of logs for %SERVICE%:
docker-compose logs --no-color --tail=100 %SERVICE%

endlocal
