#Requires -Version 5.1
<#
.SYNOPSIS
    ثبت «پرشین پدل» به‌عنوان سرویس ویندوز.
.DESCRIPTION
    بدون سرویس، اپ فقط تا وقتی پنجره‌ی PowerShell باز است زنده می‌ماند و با
    اولین ری‌استارت سرور یا بسته‌شدن نشست RDP از بین می‌رود. سرویس ویندوز
    یعنی: خودکار با بوت بالا می‌آید، اگر کرش کند دوباره اجرا می‌شود، و
    خروجی‌اش در فایل لاگ می‌ماند.

    از NSSM استفاده می‌کنیم چون سرویس‌های بومی ویندوز انتظار یک اجرایی با
    پروتکل خاص دارند و node.exe چنین چیزی نیست. NSSM این فاصله را پر می‌کند.
#>
[CmdletBinding()]
param(
    [string]$InstallPath = 'C:\PersianPadel',
    [int]$AppPort = 3000,
    [string]$ServiceName = 'PersianPadel'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Ok([string]$t)   { Write-Host "    [OK]   $t" -ForegroundColor Green }
function Write-Warn2([string]$t) { Write-Host "    [!]    $t" -ForegroundColor Yellow }
function Write-Fail([string]$t) { Write-Host "    [X]    $t" -ForegroundColor Red }

$nssmDir = Join-Path $InstallPath 'tools'
$nssm    = Join-Path $nssmDir 'nssm.exe'

# --- تهیه‌ی NSSM ---------------------------------------------------------
if (-not (Test-Path $nssm)) {
    New-Item -ItemType Directory -Force -Path $nssmDir | Out-Null
    $zip = Join-Path $env:TEMP 'nssm.zip'
    try {
        Write-Host '    دانلود NSSM...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $zip -UseBasicParsing -TimeoutSec 90
        $tmp = Join-Path $env:TEMP 'nssm-extract'
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
        Expand-Archive $zip -DestinationPath $tmp -Force
        $arch = if ([Environment]::Is64BitOperatingSystem) { 'win64' } else { 'win32' }
        $src = Get-ChildItem $tmp -Recurse -Filter 'nssm.exe' |
            Where-Object { $_.FullName -like "*\$arch\*" } | Select-Object -First 1
        if (-not $src) { throw 'nssm.exe در آرشیو پیدا نشد.' }
        Copy-Item $src.FullName $nssm -Force
        Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
        Write-Ok 'NSSM آماده شد.'
    } catch {
        Write-Fail "دانلود NSSM ناموفق بود: $_"
        Write-Host ''
        Write-Host '    اگر سرور به اینترنت آزاد دسترسی ندارد (روی هاست‌های ایرانی معمول است):'
        Write-Host '      ۱. فایل nssm-2.24.zip را از https://nssm.cc/download روی سیستم خودتان بگیرید.'
        Write-Host "      ۲. nssm.exe نسخه‌ی win64 را در این مسیر بگذارید:"
        Write-Host "         $nssm" -ForegroundColor White
        Write-Host '      ۳. دوباره این اسکریپت را اجرا کنید.'
        exit 1
    }
} else {
    Write-Ok 'NSSM از قبل موجود است.'
}

# --- پاک‌کردن سرویس قبلی -------------------------------------------------
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -eq 'Running') {
        Stop-Service $ServiceName -Force
        # NSSM کمی وقت می‌خواهد تا فرایند را واقعاً ببندد
        Start-Sleep -Seconds 3
    }
    & $nssm remove $ServiceName confirm | Out-Null
    Start-Sleep -Seconds 2
    Write-Ok 'سرویس قبلی حذف شد.'
}

# --- ساخت سرویس ---------------------------------------------------------
$nodeExe = (Get-Command node).Source
$server  = Join-Path $InstallPath 'server.js'
if (-not (Test-Path $server)) { Write-Fail "server.js در $InstallPath نیست."; exit 1 }

& $nssm install $ServiceName $nodeExe $server | Out-Null
& $nssm set $ServiceName AppDirectory   $InstallPath          | Out-Null
& $nssm set $ServiceName DisplayName    'Persian Padel'       | Out-Null
& $nssm set $ServiceName Description    'باشگاه پدل - رزرو زمین و مدیریت بازیکنان' | Out-Null
& $nssm set $ServiceName Start          SERVICE_AUTO_START    | Out-Null

# متغیرهای محیطی: server.js خودش .env را نمی‌خواند، پس اینجا می‌دهیم.
# NSSM آنها را با \n جدا می‌کند.
& $nssm set $ServiceName AppEnvironmentExtra `
    "NODE_ENV=production" `
    "PORT=$AppPort" `
    "HOSTNAME=127.0.0.1" `
    "UV_THREADPOOL_SIZE=8" | Out-Null

# لاگ‌ها
$logDir = Join-Path $InstallPath 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
& $nssm set $ServiceName AppStdout (Join-Path $logDir 'app.log')       | Out-Null
& $nssm set $ServiceName AppStderr (Join-Path $logDir 'app-error.log') | Out-Null
# چرخش لاگ: هر ۱۰ مگابایت یک فایل تازه، وگرنه دیسک سرور پر می‌شود
& $nssm set $ServiceName AppRotateFiles 1        | Out-Null
& $nssm set $ServiceName AppRotateOnline 1       | Out-Null
& $nssm set $ServiceName AppRotateBytes 10485760 | Out-Null

# اگر کرش کرد، بعد از ۵ ثانیه دوباره بالا بیاید
& $nssm set $ServiceName AppExit Default Restart | Out-Null
& $nssm set $ServiceName AppRestartDelay 5000    | Out-Null
# هنگام توقف، اول مؤدبانه بخواه بعد زور بزن — تراکنش نیمه‌کاره نماند
& $nssm set $ServiceName AppStopMethodConsole 15000 | Out-Null

Write-Ok 'سرویس ساخته شد.'

# --- راه‌اندازی ----------------------------------------------------------
Start-Service $ServiceName
Start-Sleep -Seconds 4

$svc = Get-Service $ServiceName
if ($svc.Status -eq 'Running') {
    Write-Ok "سرویس در حال اجراست (پورت $AppPort)."
} else {
    Write-Fail "سرویس بالا نیامد. وضعیت: $($svc.Status)"
    Write-Host "    لاگ خطا: $logDir\app-error.log"
    exit 1
}

Write-Host ''
Write-Host '    دستورهای روزمره:' -ForegroundColor Cyan
Write-Host "      شروع   :  Start-Service $ServiceName"
Write-Host "      توقف   :  Stop-Service $ServiceName"
Write-Host "      ری‌استارت:  Restart-Service $ServiceName"
Write-Host "      وضعیت  :  Get-Service $ServiceName"
Write-Host "      لاگ    :  Get-Content $logDir\app.log -Tail 50 -Wait"
