#Requires -Version 5.1
<#
.SYNOPSIS
    گرفتن گواهی SSL رایگان (Let's Encrypt) و روشن‌کردن https.
.DESCRIPTION
    از win-acme استفاده می‌کند که نسخه‌ی ویندوزیِ certbot است: گواهی را
    می‌گیرد، به IIS وصل می‌کند، و یک Scheduled Task می‌سازد تا هر ۶۰ روز
    خودش تمدید کند. تمدید دستی فراموش می‌شود و سایت وسط فصل مسابقات
    از کار می‌افتد؛ این کار را خودکار می‌کنیم.

    پس از نصب موفق، هدایت اجباری به https و هدر HSTS روشن می‌شوند — نه
    زودتر، چون تا وقتی گواهی نیست این دو سایت را کاملاً از دسترس خارج می‌کنند.

.NOTES
    پیش‌نیاز: دامنه باید همین حالا به IP این سرور اشاره کند و پورت ۸۰ از
    اینترنت باز باشد. Let's Encrypt برای اثبات مالکیت، خودش از بیرون به
    http://دامنه/.well-known/ سر می‌زند.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Domain,
    [string]$SiteName = 'PersianPadel',
    [string]$InstallPath = 'C:\PersianPadel',
    # ایمیل برای هشدار انقضای گواهی
    [string]$Email,
    # اگر گواهی را از شرکت ایرانی خریده‌اید و فایل pfx دارید
    [string]$PfxPath,
    [string]$PfxPassword
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Ok([string]$t)   { Write-Host "    [OK]   $t" -ForegroundColor Green }
function Write-Warn2([string]$t) { Write-Host "    [!]    $t" -ForegroundColor Yellow }
function Write-Fail([string]$t) { Write-Host "    [X]    $t" -ForegroundColor Red }

Import-Module WebAdministration -ErrorAction Stop

# ---------------------------------------------------------------------------
#  الف) گواهی آماده (pfx) — مسیر شرکت‌های ایرانی
# ---------------------------------------------------------------------------
if ($PfxPath) {
    if (-not (Test-Path $PfxPath)) { Write-Fail "فایل $PfxPath پیدا نشد."; exit 1 }
    Write-Host "==> نصب گواهی از فایل pfx" -ForegroundColor Cyan

    $sec = if ($PfxPassword) { ConvertTo-SecureString $PfxPassword -AsPlainText -Force }
           else { Read-Host -AsSecureString '    رمز فایل pfx' }

    $cert = Import-PfxCertificate -FilePath $PfxPath `
        -CertStoreLocation 'Cert:\LocalMachine\My' -Password $sec
    Write-Ok "گواهی نصب شد. اثر انگشت: $($cert.Thumbprint)"

    if (-not (Get-WebBinding -Name $SiteName -Protocol https -ErrorAction SilentlyContinue)) {
        New-WebBinding -Name $SiteName -Protocol https -Port 443 -HostHeader $Domain -SslFlags 1
    }
    $binding = Get-WebBinding -Name $SiteName -Protocol https
    $binding.AddSslCertificate($cert.Thumbprint, 'My')
    Write-Ok 'گواهی به سایت وصل شد.'
}
# ---------------------------------------------------------------------------
#  ب) Let's Encrypt رایگان — مسیر پیش‌فرض
# ---------------------------------------------------------------------------
else {
    Write-Host '==> گرفتن گواهی رایگان از Let’s Encrypt' -ForegroundColor Cyan

    # پیش‌بررسی: اگر دامنه به این سرور اشاره نکند، درخواست شکست می‌خورد و
    # Let's Encrypt سهمیه‌ی خطای ما را می‌سوزاند. بهتر است زودتر بفهمیم.
    try {
        $resolved = (Resolve-DnsName $Domain -Type A -ErrorAction Stop |
            Where-Object { $_.Type -eq 'A' } | Select-Object -First 1).IPAddress
        $mine = (Invoke-WebRequest 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 15).Content.Trim()
        if ($resolved -ne $mine) {
            Write-Warn2 "دامنه به $resolved اشاره می‌کند ولی IP این سرور $mine است."
            Write-Warn2 'تا وقتی رکورد A درست نشود، گواهی صادر نمی‌شود.'
            $go = Read-Host '    با این حال ادامه می‌دهید؟ (y/N)'
            if ($go -ne 'y') { exit 1 }
        } else {
            Write-Ok "دامنه درست به این سرور ($mine) اشاره می‌کند."
        }
    } catch {
        Write-Warn2 "بررسی DNS ممکن نشد: $($_.Exception.Message)"
    }

    $toolDir = Join-Path $InstallPath 'tools\win-acme'
    $wacs = Join-Path $toolDir 'wacs.exe'
    if (-not (Test-Path $wacs)) {
        New-Item -ItemType Directory -Force -Path $toolDir | Out-Null
        $zip = Join-Path $env:TEMP 'win-acme.zip'
        try {
            Write-Host '    دانلود win-acme...'
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $url = 'https://github.com/win-acme/win-acme/releases/download/v2.2.9.1701/win-acme.v2.2.9.1701.x64.pluggable.zip'
            Invoke-WebRequest $url -OutFile $zip -UseBasicParsing -TimeoutSec 120
            Expand-Archive $zip -DestinationPath $toolDir -Force
            Remove-Item $zip -Force
            Write-Ok 'win-acme آماده شد.'
        } catch {
            Write-Fail "دانلود win-acme ناموفق بود: $_"
            Write-Host ''
            Write-Host '    اگر سرور به گیت‌هاب دسترسی ندارد (روی هاست ایرانی معمول است):'
            Write-Host '      ۱. آخرین نسخه‌ی x64.pluggable را از win-acme.com روی سیستم خودتان بگیرید.'
            Write-Host "      ۲. محتوای zip را در این مسیر باز کنید: $toolDir"
            Write-Host '      ۳. دوباره این اسکریپت را اجرا کنید.'
            Write-Host ''
            Write-Host '    یا اگر گواهی را از شرکت ایرانی خریده‌اید:'
            Write-Host "      .\Setup-SSL.ps1 -Domain $Domain -PfxPath C:\path\to\cert.pfx" -ForegroundColor White
            exit 1
        }
    }

    $args = @(
        '--target', 'iissite', '--siteid', (Get-Website -Name $SiteName).Id,
        '--host', "$Domain,www.$Domain",
        '--installation', 'iis',
        '--accepttos', '--notaskscheduler:false'
    )
    if ($Email) { $args += @('--emailaddress', $Email) }

    & $wacs @args
    if ($LASTEXITCODE -ne 0) {
        Write-Fail 'صدور گواهی ناموفق بود. متن خطای بالا را ببینید.'
        Write-Host ''
        Write-Host '    شایع‌ترین دلیل‌ها:'
        Write-Host '      - رکورد A دامنه هنوز به این سرور نرسیده (تا ۲۴ ساعت طول می‌کشد).'
        Write-Host '      - پورت ۸۰ از اینترنت بسته است (فایروال هاست یا فایروال ویندوز).'
        Write-Host '      - سایت در IIS اجرا نیست.'
        exit 1
    }
    Write-Ok 'گواهی صادر و نصب شد. تمدید خودکار هم تنظیم شد.'
}

# ---------------------------------------------------------------------------
#  آزمون واقعی پیش از اجباری‌کردن https
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '==> بررسی اینکه https واقعاً کار می‌کند' -ForegroundColor Cyan
Start-Sleep -Seconds 3

$httpsOk = $false
try {
    $r = Invoke-WebRequest "https://$Domain/api/health" -UseBasicParsing -TimeoutSec 25
    if ($r.StatusCode -eq 200) { $httpsOk = $true }
} catch {
    Write-Warn2 "پاسخ https: $($_.Exception.Message)"
}

if (-not $httpsOk) {
    Write-Fail 'https هنوز جواب نمی‌دهد.'
    Write-Warn2 'هدایت اجباری روشن نشد — عمداً. اگر الان روشنش کنیم سایت'
    Write-Warn2 'کاملاً از دسترس خارج می‌شود. مشکل را حل و دوباره اجرا کنید.'
    exit 1
}
Write-Ok 'https سالم است.'

# ---------------------------------------------------------------------------
#  روشن‌کردن هدایت اجباری و HSTS
# ---------------------------------------------------------------------------
$webConfigPath = Join-Path $InstallPath 'iis-site\web.config'
[xml]$xml = Get-Content $webConfigPath -Encoding UTF8

$httpsRule = $xml.configuration.'system.webServer'.rewrite.rules.rule |
    Where-Object { $_.name -eq 'HTTPS' }
if ($httpsRule) {
    $httpsRule.SetAttribute('enabled', 'true')
    Write-Ok 'هدایت اجباری http به https روشن شد.'
}

$headers = $xml.configuration.'system.webServer'.httpProtocol.customHeaders
if (-not ($headers.add | Where-Object { $_.name -eq 'Strict-Transport-Security' })) {
    $hsts = $xml.CreateElement('add')
    $hsts.SetAttribute('name', 'Strict-Transport-Security')
    $hsts.SetAttribute('value', 'max-age=31536000; includeSubDomains')
    [void]$headers.AppendChild($hsts)
    Write-Ok 'هدر HSTS اضافه شد.'
}
$xml.Save($webConfigPath)

Write-Host ''
Write-Host '===========================================================' -ForegroundColor Green
Write-Host "   https://$Domain آماده است." -ForegroundColor Green
Write-Host '===========================================================' -ForegroundColor Green
Write-Host ''
Write-Host '    گواهی هر ۶۰ روز خودکار تمدید می‌شود.'
Write-Host '    برای بررسی: Get-ScheduledTask -TaskName "win-acme*"'
