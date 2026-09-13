#Requires -Version 5.1
<#
.SYNOPSIS
    نصب کامل «پرشین پدل» روی ویندوز سرور.
.DESCRIPTION
    این اسکریپت از صفر تا اجرا را انجام می‌دهد: بررسی پیش‌نیازها، ساخت
    پایگاه داده، نوشتن تنظیمات، اجرای مهاجرت‌ها، و ثبت اپ به‌عنوان سرویس
    ویندوز که با ری‌استارت سرور خودکار بالا می‌آید.

    اسکریپت «بارها قابل اجرا» است: اگر وسط کار قطع شد یا چیزی را جا انداختید،
    دوباره اجرایش کنید. هر مرحله‌ای که قبلاً انجام شده باشد، رد می‌شود.
.EXAMPLE
    .\Install.ps1 -Domain persianpdl.ir -DbPassword 'YourStrongPass!23'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Domain,

    # رمز کاربر پایگاه داده. اگر ندهید، ساخته می‌شود و در پایان نشان داده می‌شود.
    [string]$DbPassword,

    # مسیر نصب اپ
    [string]$InstallPath = 'C:\PersianPadel',

    # پورت داخلی اپ. IIS از بیرون روی ۸۰/۴۴۳ گوش می‌دهد و به اینجا پاس می‌دهد.
    [int]$AppPort = 3000,

    # از نصب IIS و تنظیم ریورس‌پروکسی صرف‌نظر کن (اگر خودتان تنظیم کرده‌اید)
    [switch]$SkipIIS,

    # داده‌ی نمونه (زمین‌ها، بازیکنان آزمایشی) را وارد نکن — برای تحویل واقعی
    [switch]$NoSeed
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# ---------------------------------------------------------------------------
#  کمک‌کننده‌ها
# ---------------------------------------------------------------------------

function Write-Step([string]$Text) {
    Write-Host ''
    Write-Host "==> $Text" -ForegroundColor Cyan
}
function Write-Ok([string]$Text)   { Write-Host "    [OK]   $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text) { Write-Host "    [!]    $Text" -ForegroundColor Yellow }
function Write-Fail([string]$Text) { Write-Host "    [X]    $Text" -ForegroundColor Red }

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal $id).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
}

function New-StrongSecret([int]$Bytes = 48) {
    $b = New-Object 'System.Byte[]' $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    [Convert]::ToBase64String($b)
}

# رمز پایگاه داده نباید نویسه‌هایی داشته باشد که در رشته‌ی اتصال معنا دارند
function New-DbPassword {
    $chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $sb = New-Object System.Text.StringBuilder
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buf = New-Object 'System.Byte[]' 1
    for ($i = 0; $i -lt 28; $i++) {
        $rng.GetBytes($buf)
        [void]$sb.Append($chars[$buf[0] % $chars.Length])
    }
    $sb.ToString()
}

function Find-Command([string]$Name) {
    $c = Get-Command $Name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    return $null
}

# ---------------------------------------------------------------------------
#  ۰. بررسی‌های اولیه
# ---------------------------------------------------------------------------

Write-Host ''
Write-Host '===========================================================' -ForegroundColor Magenta
Write-Host '   PERSIAN PADEL - Windows Server Installer' -ForegroundColor Magenta
Write-Host "   Domain : $Domain" -ForegroundColor Magenta
Write-Host "   Path   : $InstallPath" -ForegroundColor Magenta
Write-Host '===========================================================' -ForegroundColor Magenta

if (-not (Test-Admin)) {
    Write-Fail 'این اسکریپت باید با دسترسی Administrator اجرا شود.'
    Write-Host '    روی PowerShell راست‌کلیک کنید و "Run as Administrator" بزنید.'
    exit 1
}
Write-Ok 'دسترسی Administrator تأیید شد.'

$PackageRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $PackageRoot 'server.js'))) {
    # اسکریپت ممکن است از کنار خودِ بسته اجرا شود
    $PackageRoot = $PSScriptRoot
}
if (-not (Test-Path (Join-Path $PackageRoot 'server.js'))) {
    Write-Fail "فایل server.js پیدا نشد. اسکریپت را از داخل پوشه‌ی بسته اجرا کنید."
    exit 1
}
Write-Ok "بسته‌ی برنامه در: $PackageRoot"

# ---------------------------------------------------------------------------
#  ۱. Node.js
# ---------------------------------------------------------------------------

Write-Step 'بررسی Node.js'
$node = Find-Command 'node'
$nodeOk = $false
if ($node) {
    $v = (& node --version) -replace '^v', ''
    $major = [int]($v.Split('.')[0])
    if ($major -ge 20) {
        Write-Ok "Node.js $v نصب است."
        $nodeOk = $true
    } else {
        Write-Warn2 "Node.js $v خیلی قدیمی است (حداقل ۲۰ لازم است)."
    }
}
if (-not $nodeOk) {
    Write-Warn2 'Node.js نصب نیست یا نسخه‌اش قدیمی است.'
    Write-Host ''
    Write-Host '    نسخه‌ی LTS را از اینجا دانلود و نصب کنید، بعد این اسکریپت را دوباره اجرا کنید:'
    Write-Host '      https://nodejs.org/en/download  (Windows Installer .msi  -  LTS)' -ForegroundColor White
    Write-Host ''
    Write-Host '    هنگام نصب، گزینه‌ی "Add to PATH" حتماً تیک بخورد.'
    exit 1
}

# ---------------------------------------------------------------------------
#  ۲. PostgreSQL
# ---------------------------------------------------------------------------

Write-Step 'بررسی PostgreSQL'
$psql = Find-Command 'psql'
if (-not $psql) {
    # نصب‌کننده‌ی رسمی معمولاً اینجا می‌گذاردش و به PATH اضافه نمی‌کند
    $candidates = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending
    foreach ($c in $candidates) {
        $try = Join-Path $c.FullName 'bin\psql.exe'
        if (Test-Path $try) { $psql = $try; break }
    }
}
if (-not $psql) {
    Write-Fail 'PostgreSQL پیدا نشد.'
    Write-Host ''
    Write-Host '    نسخه‌ی ۱۶ را از اینجا نصب کنید، بعد این اسکریپت را دوباره اجرا کنید:'
    Write-Host '      https://www.postgresql.org/download/windows/' -ForegroundColor White
    Write-Host ''
    Write-Host '    نکته‌های مهم هنگام نصب:'
    Write-Host '      - رمز کاربر postgres را یادداشت کنید، لازم می‌شود.'
    Write-Host '      - گزینه‌ی "Stack Builder" را لازم ندارید، رد کنید.'
    Write-Host '      - Locale را روی Default بگذارید.'
    exit 1
}
$pgBin = Split-Path -Parent $psql
Write-Ok "PostgreSQL: $psql"

# سرویس پستگرس باید در حال اجرا و خودکار باشد
$pgSvc = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgSvc) {
    if ($pgSvc.Status -ne 'Running') {
        Write-Warn2 "سرویس $($pgSvc.Name) متوقف است؛ راه‌اندازی می‌شود."
        Start-Service $pgSvc.Name
    }
    Set-Service -Name $pgSvc.Name -StartupType Automatic
    Write-Ok "سرویس پایگاه داده در حال اجرا و روی حالت خودکار است: $($pgSvc.Name)"
} else {
    Write-Warn2 'سرویس PostgreSQL پیدا نشد. اگر روی سرور دیگری است، مشکلی نیست.'
}

Write-Host ''
Write-Host '    رمز کاربر «postgres» را وارد کنید (همان که هنگام نصب PostgreSQL گذاشتید):'
$pgAdminPass = Read-Host -AsSecureString '    رمز postgres'
$pgAdminPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pgAdminPass))

$env:PGPASSWORD = $pgAdminPlain
$probe = & $psql -h 127.0.0.1 -U postgres -d postgres -tAc 'SELECT 1' 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail 'اتصال به PostgreSQL با این رمز برقرار نشد.'
    Write-Host "    پاسخ سرور: $probe"
    exit 1
}
Write-Ok 'اتصال به PostgreSQL برقرار شد.'

# ---------------------------------------------------------------------------
#  ۳. ساخت پایگاه داده و کاربر اختصاصی
# ---------------------------------------------------------------------------

Write-Step 'ساخت پایگاه داده'

if (-not $DbPassword) { $DbPassword = New-DbPassword }
$DbName = 'persian_padel'
$DbUser = 'padel_app'

# اپ با کاربر خودش وصل می‌شود، نه با postgres. اگر روزی رشته‌ی اتصال لو برود،
# دسترسی‌اش فقط همین یک پایگاه داده است نه کل سرور.
$exists = & $psql -h 127.0.0.1 -U postgres -d postgres -tAc `
    "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'" 2>$null
if ($exists -eq '1') {
    & $psql -h 127.0.0.1 -U postgres -d postgres -c `
        "ALTER ROLE $DbUser WITH LOGIN PASSWORD '$DbPassword'" | Out-Null
    Write-Ok "کاربر $DbUser از قبل بود؛ رمزش به‌روز شد."
} else {
    & $psql -h 127.0.0.1 -U postgres -d postgres -c `
        "CREATE ROLE $DbUser WITH LOGIN PASSWORD '$DbPassword'" | Out-Null
    Write-Ok "کاربر $DbUser ساخته شد."
}

$dbExists = & $psql -h 127.0.0.1 -U postgres -d postgres -tAc `
    "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>$null
if ($dbExists -eq '1') {
    Write-Ok "پایگاه داده‌ی $DbName از قبل وجود دارد."
} else {
    & $psql -h 127.0.0.1 -U postgres -d postgres -c `
        "CREATE DATABASE $DbName OWNER $DbUser ENCODING 'UTF8'" | Out-Null
    Write-Ok "پایگاه داده‌ی $DbName ساخته شد."
}
& $psql -h 127.0.0.1 -U postgres -d $DbName -c `
    "GRANT ALL ON SCHEMA public TO $DbUser" | Out-Null
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

# ---------------------------------------------------------------------------
#  ۴. کپی فایل‌های برنامه
# ---------------------------------------------------------------------------

Write-Step 'کپی فایل‌های برنامه'
if ($PackageRoot -ne $InstallPath) {
    New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
    # /XD : پوشه‌هایی که نباید رونویسی شوند (لاگ و پشتیبان از اجرای قبلی)
    robocopy $PackageRoot $InstallPath /E /NFL /NDL /NJH /NJS /NP /XD logs backups | Out-Null
    if ($LASTEXITCODE -ge 8) { Write-Fail 'کپی فایل‌ها ناموفق بود.'; exit 1 }
}
New-Item -ItemType Directory -Force -Path (Join-Path $InstallPath 'logs')    | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallPath 'backups') | Out-Null
Write-Ok "برنامه در $InstallPath قرار گرفت."

# ---------------------------------------------------------------------------
#  ۵. فایل تنظیمات (.env)
# ---------------------------------------------------------------------------

Write-Step 'ساخت فایل تنظیمات'
$envPath = Join-Path $InstallPath '.env'

if (Test-Path $envPath) {
    $backup = "$envPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $envPath $backup
    Write-Warn2 "فایل .env قبلی به $([IO.Path]::GetFileName($backup)) منتقل شد و دست‌نخورده ماند."
    Write-Warn2 'برای جلوگیری از باطل‌شدن نشست‌ها، AUTH_SECRET عوض نمی‌شود.'
} else {
    $authSecret = New-StrongSecret 48
    $cronSecret = New-StrongSecret 24
    $connStr = "postgresql://${DbUser}:${DbPassword}@127.0.0.1:5432/${DbName}?schema=public&connection_limit=10&pool_timeout=15&connect_timeout=10"

    $envContent = @"
# ---------------------------------------------------------------------------
# PERSIAN PADEL - تنظیمات سرور
# ساخته‌شده توسط Install.ps1 در $(Get-Date -Format 'yyyy-MM-dd HH:mm')
#
# هشدار: این فایل رمز پایگاه داده و کلید امضای نشست‌ها را دارد.
# آن را جایی کپی نکنید و در ایمیل/تلگرام نفرستید.
# ---------------------------------------------------------------------------

NODE_ENV=production
PORT=$AppPort
HOSTNAME=127.0.0.1

# استخر نخ‌ها برای هش رمز عبور. کمتر از این، ورودهای هم‌زمان کند می‌شوند.
UV_THREADPOOL_SIZE=8

# --- پایگاه داده ---
DATABASE_URL="$connStr"
DIRECT_URL="$connStr"

# --- امنیت ---
# هم نشست‌ها را امضا می‌کند هم کدهای تأیید را هش. عوض کردنش همه را
# از حساب بیرون می‌اندازد. یک بار تنظیم شد و نباید دست بخورد.
AUTH_SECRET="$authSecret"
SESSION_TTL_DAYS=30
CRON_SECRET="$cronSecret"

# --- نشانی برنامه ---
NEXT_PUBLIC_APP_URL="https://$Domain"
APP_TIMEZONE="Asia/Tehran"

# --- پیامک ---
# تا وقتی روی console باشد، کد تأیید فقط در لاگ سرور چاپ می‌شود و
# پیامکی ارسال نمی‌گردد. برای راه‌اندازی واقعی حتماً عوضش کنید.
OTP_PROVIDER=console
OTP_LENGTH=5
OTP_TTL_SECONDS=120
# KAVENEGAR_API_KEY=""
# KAVENEGAR_TEMPLATE="verify"

# --- درگاه پرداخت ---
# راهنمای کامل: docs\PAYMENT-GATEWAY.md
# تا وقتی mock باشد، در حالت production کار نمی‌کند و خطای روشن می‌دهد.
PAYMENT_PROVIDER=mock
# ZARINPAL_MERCHANT_ID=""
# ZARINPAL_SANDBOX=false
# ZIBAL_MERCHANT=""
# NEXTPAY_API_KEY=""
"@
    # بدون BOM؛ dotenv با BOM مشکل دارد
    [IO.File]::WriteAllText($envPath, $envContent, (New-Object Text.UTF8Encoding $false))
    Write-Ok 'فایل .env ساخته شد با کلیدهای تصادفی.'
}

# فقط Administrators و SYSTEM بتوانند .env را بخوانند
$acl = Get-Acl $envPath
$acl.SetAccessRuleProtection($true, $false)
foreach ($who in 'BUILTIN\Administrators', 'NT AUTHORITY\SYSTEM') {
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
        $who, 'FullControl', 'Allow')))
}
Set-Acl $envPath $acl
Write-Ok 'دسترسی فایل .env محدود شد.'

# ---------------------------------------------------------------------------
#  ۶. مهاجرت پایگاه داده
# ---------------------------------------------------------------------------

Write-Step 'ساخت جدول‌های پایگاه داده'

# رشته‌ی اتصال را صریح به فرایندهای فرزند می‌دهیم و به «پیداکردن خودکار .env»
# تکیه نمی‌کنیم. ابزار prisma و کتابخانه‌ی کلاینت، دو منطق متفاوت برای یافتن
# .env دارند و اگر یکی‌شان فایل را پیدا نکند یا فایلِ دیگری را پیدا کند،
# مهاجرت روی پایگاه داده‌ی اشتباه اجرا می‌شود — بدون هیچ پیام خطایی.
$envLine = Select-String -Path $envPath -Pattern '^DATABASE_URL=' | Select-Object -First 1
if (-not $envLine) { Write-Fail 'DATABASE_URL در .env پیدا نشد.'; exit 1 }
$dbUrl = $envLine.Line -replace '^DATABASE_URL=', '' -replace '^"', '' -replace '"$', ''
$env:DATABASE_URL = $dbUrl
$env:DIRECT_URL   = $dbUrl

Push-Location $InstallPath
try {
    & node (Join-Path $InstallPath 'node_modules\prisma\build\index.js') migrate deploy 2>&1 |
        ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -ne 0) { throw 'اجرای مهاجرت‌ها ناموفق بود.' }
    Write-Ok 'جدول‌ها ساخته شدند.'

    # بررسی اینکه جدول‌ها واقعاً روی همان پایگاه داده ساخته شدند
    $tableCount = & node -e "const{PrismaClient}=require('@prisma/client');const c=new PrismaClient();c.`$queryRaw``SELECT count(*)::int as n FROM information_schema.tables WHERE table_schema='public'``.then(r=>{console.log(r[0].n);return c.`$disconnect()}).catch(()=>{console.log(0)})" 2>$null
    if ([int]$tableCount -lt 10) {
        throw "پس از مهاجرت فقط $tableCount جدول پیدا شد. چیزی درست نیست."
    }
    Write-Ok "$tableCount جدول در پایگاه داده تأیید شد."

    if (-not $NoSeed) {
        $seed = Join-Path $InstallPath 'prisma\seed.js'
        if (Test-Path $seed) {
            & node $seed 2>&1 | ForEach-Object { Write-Host "    $_" }
            if ($LASTEXITCODE -ne 0) { throw 'ورود داده‌ی اولیه ناموفق بود.' }

            # «موفق» گفتنِ اسکریپت کافی نیست؛ خودمان می‌شماریم
            $userCount = & node -e "const{PrismaClient}=require('@prisma/client');const c=new PrismaClient();c.user.count().then(n=>{console.log(n);return c.`$disconnect()}).catch(()=>{console.log(0)})" 2>$null
            if ([int]$userCount -lt 1) {
                throw 'داده‌ی اولیه وارد نشد — هیچ کاربری ساخته نشد.'
            }
            Write-Ok "داده‌ی اولیه وارد شد ($userCount کاربر)."
        }
    } else {
        Write-Warn2 'داده‌ی نمونه وارد نشد (NoSeed-).'
    }
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
#  ۷. ثبت سرویس ویندوز
# ---------------------------------------------------------------------------

Write-Step 'ثبت برنامه به‌عنوان سرویس ویندوز'
& (Join-Path $PSScriptRoot 'Install-Service.ps1') -InstallPath $InstallPath -AppPort $AppPort

# ---------------------------------------------------------------------------
#  ۸. IIS به‌عنوان ریورس‌پروکسی
# ---------------------------------------------------------------------------

if (-not $SkipIIS) {
    Write-Step 'تنظیم IIS'
    & (Join-Path $PSScriptRoot 'Install-IIS.ps1') -Domain $Domain -InstallPath $InstallPath -AppPort $AppPort
} else {
    Write-Warn2 'تنظیم IIS رد شد (SkipIIS-).'
}

# ---------------------------------------------------------------------------
#  ۹. فایروال
# ---------------------------------------------------------------------------

Write-Step 'قواعد فایروال'
foreach ($p in 80, 443) {
    $name = "Persian Padel HTTP $p"
    if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP `
            -LocalPort $p -Action Allow | Out-Null
    }
}
Write-Ok 'پورت‌های ۸۰ و ۴۴۳ باز شدند.'

# پورت داخلی اپ نباید از بیرون در دسترس باشد — فقط IIS با آن حرف می‌زند
$blockName = "Persian Padel block external $AppPort"
if (-not (Get-NetFirewallRule -DisplayName $blockName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $blockName -Direction Inbound -Protocol TCP `
        -LocalPort $AppPort -RemoteAddress Internet -Action Block | Out-Null
}
Write-Ok "پورت داخلی $AppPort از دسترس بیرون بسته شد."

# ---------------------------------------------------------------------------
#  پایان
# ---------------------------------------------------------------------------

Start-Sleep -Seconds 3
$health = $null
try {
    $health = Invoke-WebRequest "http://127.0.0.1:$AppPort/api/health" -UseBasicParsing -TimeoutSec 20
} catch { }

Write-Host ''
Write-Host '===========================================================' -ForegroundColor Magenta
if ($health -and $health.StatusCode -eq 200) {
    Write-Host '   نصب با موفقیت تمام شد.' -ForegroundColor Green
} else {
    Write-Host '   نصب تمام شد، ولی اپ هنوز پاسخ نمی‌دهد.' -ForegroundColor Yellow
    Write-Host "   لاگ را ببینید: $InstallPath\logs\app-error.log" -ForegroundColor Yellow
}
Write-Host '===========================================================' -ForegroundColor Magenta
Write-Host ''
Write-Host "   نشانی محلی : http://127.0.0.1:$AppPort"
Write-Host "   نشانی سایت : https://$Domain"
Write-Host ''
Write-Host '   رمز پایگاه داده (یادداشت کنید):' -ForegroundColor Yellow
Write-Host "     $DbPassword" -ForegroundColor White
Write-Host ''
Write-Host '   کارهای باقی‌مانده:' -ForegroundColor Cyan
Write-Host '     ۱. دامنه را به IP این سرور اشاره دهید (رکورد A).'
Write-Host "     ۲. گواهی SSL بگیرید:  .\Setup-SSL.ps1 -Domain $Domain"
Write-Host '     ۳. سرویس پیامک را در .env تنظیم کنید (OTP_PROVIDER).'
Write-Host '     ۴. درگاه پرداخت را وصل کنید — docs\PAYMENT-GATEWAY.md'
Write-Host '     ۵. رمز مدیر را از پنل عوض کنید.'
Write-Host ''
