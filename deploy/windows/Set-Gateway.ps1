#Requires -Version 5.1
<#
.SYNOPSIS
    وصل‌کردن درگاه پرداخت بدون دست‌زدن به فایل تنظیمات.
.DESCRIPTION
    مقدار درگاه را در .env می‌نویسد، سرویس را ری‌استارت می‌کند، و بررسی
    می‌کند که برنامه واقعاً بالا آمده باشد.

    نسخه‌ی قبلی .env کنار گذاشته می‌شود، پس اگر اشتباه شد راه برگشت هست.
.EXAMPLE
    .\Set-Gateway.ps1 -Provider zarinpal -Key "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    .\Set-Gateway.ps1 -Provider zibal -Key "کد-مرچنت"
    .\Set-Gateway.ps1 -Show
#>
[CmdletBinding()]
param(
    [ValidateSet('zarinpal', 'zibal', 'nextpay')]
    [string]$Provider,

    [string]$Key,

    [string]$InstallPath = 'C:\PersianPadel',
    [string]$ServiceName = 'PersianPadel',
    [int]$AppPort = 3000,

    # فقط نشان بده الان چه تنظیم است
    [switch]$Show
)

$ErrorActionPreference = 'Stop'

function Write-Ok([string]$t)    { Write-Host "    [OK]   $t" -ForegroundColor Green }
function Write-Warn2([string]$t) { Write-Host "    [!]    $t" -ForegroundColor Yellow }
function Write-Fail([string]$t)  { Write-Host "    [X]    $t" -ForegroundColor Red }

$envPath = Join-Path $InstallPath '.env'
if (-not (Test-Path $envPath)) { Write-Fail "فایل .env در $InstallPath نیست."; exit 1 }

# --- فقط نمایش وضعیت ----------------------------------------------------
if ($Show) {
    Write-Host ''
    Write-Host '  وضعیت فعلی درگاه:' -ForegroundColor Cyan
    $cur = (Select-String -Path $envPath -Pattern '^PAYMENT_PROVIDER=' |
        Select-Object -First 1).Line -replace '^PAYMENT_PROVIDER=', ''
    Write-Host "    درگاه : $cur"
    foreach ($k in 'ZARINPAL_MERCHANT_ID', 'ZIBAL_MERCHANT', 'NEXTPAY_API_KEY') {
        $line = Select-String -Path $envPath -Pattern "^$k=" | Select-Object -First 1
        if ($line) {
            $v = $line.Line -replace "^$k=", '' -replace '"', ''
            # کلید کامل چاپ نمی‌شود؛ اسکرین‌شات و لاگ لو نرود
            $masked = if ($v.Length -gt 8) { $v.Substring(0, 4) + '...' + $v.Substring($v.Length - 4) } else { '(خالی)' }
            Write-Host "    $k : $masked"
        }
    }
    Write-Host ''
    if ($cur -eq 'mock') {
        Write-Warn2 'درگاه روی حالت آزمایشی است. پرداخت واقعی کار نمی‌کند.'
    }
    exit 0
}

if (-not $Provider) { Write-Fail 'پارامتر -Provider لازم است. مثال: -Provider zarinpal'; exit 1 }
if (-not $Key)      { Write-Fail 'پارامتر -Key لازم است (کد مرچنت یا API key).';        exit 1 }

# --- اعتبارسنجی ساده‌ی کلید --------------------------------------------
# اشتباه تایپی اینجا گرفته شود، نه وقتی مشتری وسط پرداخت گیر کرد
if ($Provider -eq 'zarinpal' -and $Key -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
    Write-Warn2 'کد مرچنت زرین‌پال معمولاً ۳۶ نویسه با خط تیره است.'
    Write-Warn2 "چیزی که دادید: $($Key.Length) نویسه."
    if ((Read-Host '    مطمئنید؟ (y/N)') -ne 'y') { exit 1 }
}

$keyName = switch ($Provider) {
    'zarinpal' { 'ZARINPAL_MERCHANT_ID' }
    'zibal'    { 'ZIBAL_MERCHANT' }
    'nextpay'  { 'NEXTPAY_API_KEY' }
}

# --- پشتیبان از .env ----------------------------------------------------
$backup = "$envPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $envPath $backup
Write-Ok "نسخه‌ی قبلی نگه داشته شد: $([IO.Path]::GetFileName($backup))"

# --- نوشتن مقادیر -------------------------------------------------------
# خط‌به‌خط بازسازی می‌کنیم تا ترتیب و توضیحات فایل به‌هم نریزد
$lines = [IO.File]::ReadAllLines($envPath)
$out = New-Object System.Collections.Generic.List[string]
$setProvider = $false
$setKey = $false

foreach ($line in $lines) {
    if ($line -match '^\s*#') { $out.Add($line); continue }

    if ($line -match '^PAYMENT_PROVIDER=') {
        $out.Add("PAYMENT_PROVIDER=$Provider"); $setProvider = $true; continue
    }
    # خط کلید ممکن است کامنت‌شده باشد؛ آن حالت پایین‌تر رسیدگی می‌شود
    if ($line -match "^$keyName=") {
        $out.Add("$keyName=`"$Key`""); $setKey = $true; continue
    }
    if ($Provider -eq 'zarinpal' -and $line -match '^ZARINPAL_SANDBOX=') {
        $out.Add('ZARINPAL_SANDBOX=false'); continue
    }
    $out.Add($line)
}

if (-not $setProvider) { $out.Add("PAYMENT_PROVIDER=$Provider") }
if (-not $setKey)      { $out.Add("$keyName=`"$Key`"") }
if ($Provider -eq 'zarinpal' -and -not ($lines -match '^ZARINPAL_SANDBOX=')) {
    $out.Add('ZARINPAL_SANDBOX=false')
}

[IO.File]::WriteAllLines($envPath, $out, (New-Object Text.UTF8Encoding $false))
Write-Ok "درگاه روی $Provider تنظیم شد."

# --- ری‌استارت ----------------------------------------------------------
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) {
    Restart-Service $ServiceName
    Write-Ok 'سرویس ری‌استارت شد.'

    $up = $false
    for ($i = 0; $i -lt 8; $i++) {
        Start-Sleep -Seconds 3
        try {
            $r = Invoke-WebRequest "http://127.0.0.1:$AppPort/api/health" -UseBasicParsing -TimeoutSec 10
            if ($r.StatusCode -eq 200) { $up = $true; break }
        } catch { }
    }

    if ($up) {
        Write-Ok 'برنامه سالم بالا آمد.'
    } else {
        Write-Fail 'برنامه بالا نیامد.'
        Write-Host "    لاگ: $InstallPath\logs\app-error.log"
        Write-Host "    برگشت: Copy-Item '$backup' '$envPath' -Force ; Restart-Service $ServiceName"
        exit 1
    }
} else {
    Write-Warn2 "سرویس $ServiceName پیدا نشد. خودتان ری‌استارتش کنید."
}

Write-Host ''
Write-Host '  حالا حتماً یک پرداخت واقعی با مبلغ کم آزمایش کنید:' -ForegroundColor Cyan
Write-Host '    ۱. با یک حساب بازیکن وارد شوید'
Write-Host '    ۲. کیف پول ← شارژ ← ۱۰٬۰۰۰ تومان'
Write-Host '    ۳. پرداخت را کامل کنید'
Write-Host '    ۴. باید برگردید به سایت و موجودی اضافه شده باشد'
Write-Host ''
Write-Host '  بعد هم آزمون انصراف: پرداخت را شروع کنید و در بانک لغو بزنید.'
Write-Host '  موجودی نباید تغییر کند.'
