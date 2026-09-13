#Requires -Version 5.1
<#
.SYNOPSIS
    تنظیم IIS به‌عنوان ریورس‌پروکسی جلوی اپ.
.DESCRIPTION
    اپ روی 127.0.0.1:3000 گوش می‌دهد و عمداً از بیرون در دسترس نیست.
    IIS روی ۸۰ و ۴۴۳ می‌نشیند، گواهی SSL را نگه می‌دارد، دامنه را می‌شناسد،
    و درخواست‌ها را به اپ پاس می‌دهد.

    چرا مستقیم اپ را روی ۸۰ نگذاریم؟ چون آن‌وقت SSL، تمدید گواهی، فشرده‌سازی
    و محدودکردن حجم آپلود همه باید در کد حل شوند. IIS این‌ها را رایگان می‌دهد.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Domain,
    [string]$InstallPath = 'C:\PersianPadel',
    [int]$AppPort = 3000,
    [string]$SiteName = 'PersianPadel'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Ok([string]$t)   { Write-Host "    [OK]   $t" -ForegroundColor Green }
function Write-Warn2([string]$t) { Write-Host "    [!]    $t" -ForegroundColor Yellow }
function Write-Fail([string]$t) { Write-Host "    [X]    $t" -ForegroundColor Red }

# --- نصب نقش IIS --------------------------------------------------------
$iis = Get-WindowsFeature -Name Web-Server -ErrorAction SilentlyContinue
if ($iis -and -not $iis.Installed) {
    Write-Host '    نصب IIS...'
    Install-WindowsFeature -Name Web-Server -IncludeManagementTools | Out-Null
    Write-Ok 'IIS نصب شد.'
} else {
    Write-Ok 'IIS از قبل نصب است.'
}
Import-Module WebAdministration -ErrorAction Stop

# --- ماژول‌های لازم -----------------------------------------------------
# ریورس‌پروکسی در IIS بدون این دو ماژول کار نمی‌کند و هیچ‌کدام پیش‌فرض نیستند.
$hasRewrite = Test-Path 'HKLM:\SOFTWARE\Microsoft\IIS Extensions\URL Rewrite'
$hasARR = (Test-Path 'HKLM:\SOFTWARE\Microsoft\IIS Extensions\Application Request Routing') -or
          (Test-Path 'C:\Program Files\IIS\Application Request Routing')

if (-not $hasRewrite -or -not $hasARR) {
    Write-Warn2 'ماژول‌های ریورس‌پروکسی نصب نیستند.'
    Write-Host ''
    Write-Host '    این دو را نصب کنید و دوباره اسکریپت را اجرا کنید:' -ForegroundColor Yellow
    if (-not $hasRewrite) {
        Write-Host '      URL Rewrite 2.1:'
        Write-Host '        https://www.iis.net/downloads/microsoft/url-rewrite' -ForegroundColor White
    }
    if (-not $hasARR) {
        Write-Host '      Application Request Routing 3.0:'
        Write-Host '        https://www.iis.net/downloads/microsoft/application-request-routing' -ForegroundColor White
    }
    Write-Host ''
    Write-Host '    اگر سرور اینترنت آزاد ندارد، فایل‌های نصب را روی سیستم خودتان دانلود'
    Write-Host '    و با RDP کپی کنید. حجمشان چند مگابایت است.'
    exit 1
}
Write-Ok 'URL Rewrite و ARR موجودند.'

# ARR باید در سطح سرور روشن باشد وگرنه قاعده‌ی پروکسی بی‌اثر است
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' `
    -Filter 'system.webServer/proxy' -Name 'enabled' -Value 'True' -ErrorAction SilentlyContinue
# هدر Server را حذف کن تا نسخه‌ی IIS را به همه اعلام نکنیم
Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' `
    -Filter 'system.webServer/proxy' -Name 'reverseRewriteHostInResponseHeaders' -Value 'False' -ErrorAction SilentlyContinue
Write-Ok 'ARR فعال شد.'

# --- پوشه‌ی سایت --------------------------------------------------------
# IIS فقط web.config را از اینجا می‌خواند؛ فایل‌های واقعی دست Node است.
$siteRoot = Join-Path $InstallPath 'iis-site'
New-Item -ItemType Directory -Force -Path $siteRoot | Out-Null

$webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<!--
  IIS فقط دروازه است: هر درخواست به اپ Node روی 127.0.0.1:$AppPort می‌رود.
-->
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- هر چیزی که با http آمد، به https برود. اپ کوکی نشست را
             Secure می‌فرستد و روی http اصلاً کار نمی‌کند. -->
        <!-- تا وقتی گواهی SSL نصب نشده این قاعده خاموش است. اگر روشن باشد
             و https کار نکند، مرورگر در حلقه‌ی بی‌پایان هدایت می‌افتد و سایت
             اصلاً باز نمی‌شود. Setup-SSL.ps1 بعد از گرفتن گواهی روشنش می‌کند. -->
        <rule name="HTTPS" enabled="false" stopProcessing="true">
          <match url="(.*)" />
          <conditions>
            <add input="{HTTPS}" pattern="^OFF$" />
            <!-- مسیر تأیید گواهی باید روی http باز بماند -->
            <add input="{REQUEST_URI}" pattern="^/\.well-known/" negate="true" />
          </conditions>
          <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
        </rule>

        <rule name="ReverseProxy" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:$AppPort/{R:1}" />
          <serverVariables>
            <!-- بدون این‌ها اپ IP همه را 127.0.0.1 می‌بیند و محدودیت نرخ
                 بی‌معنا می‌شود: یک نفر می‌تواند سهمیه‌ی همه را بسوزاند. -->
            <set name="HTTP_X_FORWARDED_FOR"   value="{REMOTE_ADDR}" />
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_HOST"  value="{HTTP_HOST}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>

    <security>
      <requestFiltering>
        <!-- ۲۰ مگابایت: سقف آپلود عکس زمین و محصول -->
        <requestLimits maxAllowedContentLength="20971520" />
      </requestFiltering>
    </security>

    <httpProtocol>
      <customHeaders>
        <remove name="X-Powered-By" />
        <!-- HSTS عمداً اینجا نیست: اگر پیش از کارکردن قطعیِ SSL فعال شود،
             مرورگر تا یک سال حاضر نمی‌شود سایت را روی http باز کند و اگر
             گواهی مشکل پیدا کند راه برگشتی نمی‌ماند. Setup-SSL اضافه‌اش می‌کند. -->
      </customHeaders>
    </httpProtocol>

    <!-- خطاهای IIS را نشان نده؛ اپ خودش صفحه‌ی خطای فارسی دارد -->
    <httpErrors existingResponse="PassThrough" />
  </system.webServer>
</configuration>
"@
[IO.File]::WriteAllText((Join-Path $siteRoot 'web.config'), $webConfig,
    (New-Object Text.UTF8Encoding $false))
Write-Ok 'فایل web.config نوشته شد.'

# سرور متغیرها را تا وقتی مجاز نشوند نمی‌پذیرد
foreach ($v in 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED_PROTO', 'HTTP_X_FORWARDED_HOST') {
    $exists = Get-WebConfiguration -PSPath 'MACHINE/WEBROOT/APPHOST' `
        -Filter "system.webServer/rewrite/allowedServerVariables/add[@name='$v']" -ErrorAction SilentlyContinue
    if (-not $exists) {
        Add-WebConfiguration -PSPath 'MACHINE/WEBROOT/APPHOST' `
            -Filter 'system.webServer/rewrite/allowedServerVariables' `
            -Value @{ name = $v } -ErrorAction SilentlyContinue
    }
}
Write-Ok 'متغیرهای پروکسی مجاز شدند.'

# --- سایت ---------------------------------------------------------------
# سایت پیش‌فرض روی ۸۰ می‌نشیند و با ما تداخل می‌کند
$def = Get-Website -Name 'Default Web Site' -ErrorAction SilentlyContinue
if ($def -and $def.State -eq 'Started') {
    Stop-Website -Name 'Default Web Site'
    Set-ItemProperty 'IIS:\Sites\Default Web Site' -Name serverAutoStart -Value $false
    Write-Warn2 'سایت پیش‌فرض IIS متوقف شد (پورت ۸۰ را اشغال می‌کرد).'
}

if (Get-Website -Name $SiteName -ErrorAction SilentlyContinue) {
    Remove-Website -Name $SiteName
}
New-Website -Name $SiteName -PhysicalPath $siteRoot -Port 80 -HostHeader $Domain -Force | Out-Null
New-WebBinding -Name $SiteName -Protocol http -Port 80 -HostHeader "www.$Domain" -ErrorAction SilentlyContinue

# استخر برنامه بدون کد مدیریت‌شده و بدون خواب رفتن
$pool = "$SiteName-pool"
if (-not (Test-Path "IIS:\AppPools\$pool")) { New-WebAppPool -Name $pool | Out-Null }
Set-ItemProperty "IIS:\AppPools\$pool" -Name managedRuntimeVersion -Value ''
Set-ItemProperty "IIS:\AppPools\$pool" -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)
Set-ItemProperty "IIS:\AppPools\$pool" -Name recycling.periodicRestart.time -Value ([TimeSpan]::Zero)
Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $pool
Write-Ok "سایت $SiteName روی دامنه‌ی $Domain ساخته شد."

Start-Website -Name $SiteName
Write-Ok 'سایت راه‌اندازی شد.'

Write-Host ''
Write-Warn2 'سایت فعلاً فقط روی http کار می‌کند. هدایت اجباری به https و HSTS'
Write-Warn2 'عمداً خاموش‌اند تا پیش از نصب گواهی، سایت در حلقه نیفتد.'
Write-Host '    مرحله‌ی بعد:' -ForegroundColor Cyan
Write-Host "      .\Setup-SSL.ps1 -Domain $Domain" -ForegroundColor White
