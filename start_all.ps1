$env:Path += ";C:\Program Files\nodejs\"

Write-Host "Starting MedAssist Pro 상용화 환경..." -ForegroundColor Green

# 1. Start Backend in background of current session to ensure PATH is identical
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$env:Path += ";C:\Program Files\nodejs\"; cd E:\mediAI\backend; npm run dev"

# 2. Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$env:Path += ";C:\Program Files\nodejs\"; cd E:\mediAI\frontend; npm run dev"

Write-Host "Servers starting... Backend on :5000, Frontend on :3000" -ForegroundColor Yellow
