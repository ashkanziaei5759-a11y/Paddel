' Creates a desktop shortcut that runs the homework downloader with one
' double-click. Run this file once (double-click it); after that, use the
' icon it creates on the Desktop instead of run_homework.bat.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName)
target = scriptFolder & "\run_homework.bat"
desktop = shell.SpecialFolders("Desktop")
shortcutPath = desktop & "\دانلود تکالیف.lnk"

If Not fso.FileExists(target) Then
    MsgBox "run_homework.bat در این پوشه پیدا نشد:" & vbCrLf & scriptFolder, vbCritical, "خطا"
    WScript.Quit 1
End If

Set link = shell.CreateShortcut(shortcutPath)
link.TargetPath = target
link.WorkingDirectory = scriptFolder
' A document/download-style icon from the standard Windows icon set.
link.IconLocation = "%SystemRoot%\System32\imageres.dll,174"
link.Description = "دانلود تکالیف از پورتال"
link.WindowStyle = 1
link.Save

MsgBox "آیکون روی دسکتاپ ساخته شد: دانلود تکالیف" & vbCrLf & vbCrLf & _
       "از این به بعد فقط روی همون آیکون دابل‌کلیک کنید.", vbInformation, "انجام شد"
