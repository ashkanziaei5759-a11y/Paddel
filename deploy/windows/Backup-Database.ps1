#Requires -Version 5.1
<#
.SYNOPSIS
    پشتیبان‌گیری از پایگاه داده.
.DESCRIPTION
    یک فایل فشرده در پوشه‌ی backups می‌سازد و نسخه‌های قدیمی‌تر از N روز را
    پاک می‌کند تا دیسک پر نشود.

    این اسکریپت را حتماً روی زمان‌بندی روزانه بگذارید. یک باشگاه بدون پشتیبان،
    یک خرابیِ دیسک با کل تاریخچه‌ی رزروها و کیف پول‌ها فاصله دارد.

    برای زمان‌بندی خودکار:
      .\Backup-Database.ps1 -InstallSchedule
.EXAMPLE
    .\Backup-Database.ps1
    .\Backup-Database.ps1 -KeepDays 30 -InstallSchedule
#>
[CmdletBinding()]
param(
    [string]$InstallPath = 'C:\PersianPadel',
    [int]$KeepDays = 14,
    [switch]$InstallSchedule
)

$ErrorActionPreference = 'Stop'

# --- ثبت زمان‌بندی روزانه ------------------------------------------------
if ($InstallSchedule) {
    $script = Join-Path $InstallPath 'deploy\windows\Backup-Database.ps1'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -InstallPath `"$InstallPath`" -KeepDays $KeepDays"
    # ۳ بامداد: باشگاه بسته است و قفل‌های پشتیبان‌گیری مزاحم کسی نمی‌شوند
    $trigger = New-ScheduledTaskTrigger -Daily -At 3am
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName 'PersianPadel-Backup' -Action $action `
        -Trigger $trigger -Principal $principal -Force | Out-Null
    Write-Host '[OK] پشتیبان‌گیری روزانه ساعت ۳ بامداد تنظیم شد.' -ForegroundColor Green
    exit 0
}

# --- خواندن رشته‌ی اتصال از .env ----------------------------------------
$envFile = Join-Path $InstallPath '.env'
if (-not (Test-Path $envFile)) { throw "فایل .env در $InstallPath نیست." }

$line = Select-String -Path $envFile -Pattern '^DATABASE_URL=' | Select-Object -First 1
if (-not $line) { throw 'DATABASE_URL در .env پیدا نشد.' }
$url = $line.Line -replace '^DATABASE_URL=', '' -replace '^"', '' -replace '"$', ''

# postgresql://user:pass@host:port/dbname?params
if ($url -notmatch '^postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)') {
    throw 'قالب DATABASE_URL شناخته نشد.'
}
$dbUser = $Matches[1]; $dbPass = $Matches[2]
$dbHost = $Matches[3]; $dbPort = $Matches[4]; $dbName = $Matches[5]

# --- پیداکردن pg_dump ----------------------------------------------------
$pgDump = (Get-Command pg_dump -ErrorAction SilentlyContinue).Source
if (-not $pgDump) {
    $found = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin\pg_dump.exe' } |
        Where-Object { Test-Path $_ } | Select-Object -First 1
    $pgDump = $found
}
if (-not $pgDump) { throw 'pg_dump پیدا نشد.' }

# --- خود پشتیبان‌گیری ----------------------------------------------------
$backupDir = Join-Path $InstallPath 'backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$out = Join-Path $backupDir "padel_$stamp.dump"

$env:PGPASSWORD = $dbPass
try {
    # قالب custom (-Fc) هم فشرده است هم امکان بازگردانی گزینشی می‌دهد
    & $pgDump -h $dbHost -p $dbPort -U $dbUser -d $dbName -Fc -f $out
    if ($LASTEXITCODE -ne 0) { throw "pg_dump با کد $LASTEXITCODE خارج شد." }
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

$sizeMb = [math]::Round((Get-Item $out).Length / 1MB, 2)
Write-Host "[OK] پشتیبان ساخته شد: $([IO.Path]::GetFileName($out))  ($sizeMb MB)" -ForegroundColor Green

# --- پاک‌کردن نسخه‌های قدیمی --------------------------------------------
$cutoff = (Get-Date).AddDays(-$KeepDays)
$old = Get-ChildItem $backupDir -Filter 'padel_*.dump' | Where-Object { $_.LastWriteTime -lt $cutoff }
if ($old) {
    $old | Remove-Item -Force
    Write-Host "[OK] $($old.Count) پشتیبان قدیمی‌تر از $KeepDays روز پاک شد." -ForegroundColor Green
}

Write-Host ''
Write-Host '  بازگردانی این پشتیبان:' -ForegroundColor Cyan
Write-Host "    pg_restore -h $dbHost -U $dbUser -d $dbName --clean --if-exists `"$out`""
Write-Host ''
Write-Host '  توصیه: هر چند وقت یک بار یک فایل پشتیبان را جای دیگری هم نگه دارید.' -ForegroundColor Yellow
Write-Host '  پشتیبانی که روی همان دیسکِ سرور است، با خرابیِ همان دیسک از بین می‌رود.' -ForegroundColor Yellow
