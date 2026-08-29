@echo off
setlocal
echo ================================
echo Tail Docker Compose Logs (live)
echo ================================

if "%1"=="" (
  echo Usage: tail_logs.bat [backend|frontend|postgres|redis|all]
  goto :EOF
)

set SERVICE=%1
if /I "%SERVICE%"=="all" (
  echo Tailing logs for all services (press Ctrl+C to exit)
  docker-compose logs --no-color -f
  goto :EOF
)

echo Tailing logs for %SERVICE% (press Ctrl+C to exit)
docker-compose logs --no-color -f %SERVICE%

endlocal
