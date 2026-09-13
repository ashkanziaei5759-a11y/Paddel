#Requires -Version 5.1
<#
.SYNOPSIS
    به‌روزرسانی برنامه به نسخه‌ی جدید.
.DESCRIPTION
    ترتیب کارها مهم است و عمداً همین است:
      ۱. پشتیبان می‌گیرد — اگر مهاجرت خراب شد، راه برگشت هست.
      ۲. سرویس را متوقف می‌کند — کپی روی فایل در حال استفاده شکست می‌خورد.
      ۳. فایل‌ها را جایگزین می‌کند ولی .env و پشتیبان‌ها را دست نمی‌زند.
      ۴. مهاجرت‌های تازه را اجرا می‌کند.
      ۵. سرویس را بالا می‌آورد و سلامتش را می‌سنجد.
    اگر مرحله‌ی ۴ یا ۵ شکست بخورد، نسخه‌ی قبلی در پوشه‌ی rollback می‌ماند.
.EXAMPLE
    .\Update-App.ps1 -NewPackage C:\Users\Admin\Desktop\persian-padel-new
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$NewPackage,
    [string]$InstallPath = 'C:\PersianPadel',
    [string]$ServiceName = 'PersianPadel',
    [int]$AppPort = 3000
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Cyan }
function Write-Ok([string]$t)   { Write-Host "    [OK]   $t" -ForegroundColor Green }
function Write-Fail([string]$t) { Write-Host "    [X]    $t" -ForegroundColor Red }

if (-not (Test-Path (Join-Path $NewPackage 'server.js'))) {
    Write-Fail "در $NewPackage فایل server.js نیست. مسیر بسته‌ی جدید را بررسی کنید."
    exit 1
}

Write-Step 'پشتیبان‌گیری پیش از به‌روزرسانی'
& (Join-Path $PSScriptRoot 'Backup-Database.ps1') -InstallPath $InstallPath

Write-Step 'توقف سرویس'
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
    Stop-Service $ServiceName -Force
    Start-Sleep -Seconds 3
    Write-Ok 'سرویس متوقف شد.'
}

Write-Step 'نگه‌داشتن نسخه‌ی فعلی برای بازگشت'
$rollback = Join-Path $InstallPath ('rollback\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $rollback | Out-Null
robocopy $InstallPath $rollback /E /NFL /NDL /NJH /NJS /NP `
    /XD logs backups rollback tools iis-site node_modules | Out-Null
Write-Ok "نسخه‌ی فعلی در $rollback"

Write-Step 'جایگزینی فایل‌ها'
# .env و داده‌ها هرگز از بسته‌ی جدید نمی‌آیند
robocopy $NewPackage $InstallPath /E /NFL /NDL /NJH /NJS /NP `
    /XF .env /XD logs backups rollback iis-site | Out-Null
if ($LASTEXITCODE -ge 8) { Write-Fail 'کپی ناموفق بود.'; exit 1 }
Write-Ok 'فایل‌های برنامه به‌روز شدند (.env دست‌نخورده ماند).'

Write-Step 'اجرای مهاجرت‌های پایگاه داده'
# مثل نصب اولیه: رشته‌ی اتصال صریح داده می‌شود، نه با حدسِ خودکار
$envLine = Select-String -Path (Join-Path $InstallPath '.env') -Pattern '^DATABASE_URL=' | Select-Object -First 1
if (-not $envLine) { Write-Fail 'DATABASE_URL در .env پیدا نشد.'; exit 1 }
$dbUrl = $envLine.Line -replace '^DATABASE_URL=', '' -replace '^"', '' -replace '"$', ''
$env:DATABASE_URL = $dbUrl
$env:DIRECT_URL   = $dbUrl

Push-Location $InstallPath
try {
    & node (Join-Path $InstallPath 'node_modules\prisma\build\index.js') migrate deploy 2>&1 |
        ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -ne 0) { throw 'مهاجرت ناموفق بود.' }
    Write-Ok 'پایگاه داده به‌روز شد.'
} catch {
    Write-Fail $_
    Write-Host ''
    Write-Host "    برای بازگشت: محتوای $rollback را روی $InstallPath کپی کنید" -ForegroundColor Yellow
    Write-Host '    و پشتیبان پایگاه داده را با pg_restore برگردانید.' -ForegroundColor Yellow
    Pop-Location
    exit 1
} finally {
    if ((Get-Location).Path -eq $InstallPath) { Pop-Location }
}

Write-Step 'راه‌اندازی سرویس'
Start-Service $ServiceName
Start-Sleep -Seconds 5

$ok = $false
for ($i = 0; $i -lt 6; $i++) {
    try {
        $r = Invoke-WebRequest "http://127.0.0.1:$AppPort/api/health" -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { Start-Sleep -Seconds 3 }
}

if ($ok) {
    Write-Ok 'برنامه سالم بالا آمد.'
    Write-Host ''
    Write-Host '  به‌روزرسانی با موفقیت تمام شد.' -ForegroundColor Green
    Write-Host "  پوشه‌های rollback قدیمی را هر چند وقت پاک کنید: $InstallPath\rollback"
} else {
    Write-Fail 'برنامه پاسخ نمی‌دهد.'
    Write-Host "    لاگ: $InstallPath\logs\app-error.log"
    Write-Host "    بازگشت: محتوای $rollback را برگردانید و سرویس را ری‌استارت کنید."
    exit 1
}
