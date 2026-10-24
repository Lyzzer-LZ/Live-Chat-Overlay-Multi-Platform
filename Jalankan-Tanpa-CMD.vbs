Option Explicit
Dim sh, fso, dir, exe
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
exe = dir & "\node_modules\electron\dist\electron.exe"
sh.CurrentDirectory = dir

If Not fso.FileExists(exe) Then
  ' Pertama kali: jalankan pemasangan lewat Jalankan.cmd (jendela CMD tampil sampai selesai)
  sh.Run """" & dir & "\Jalankan.cmd""", 1, True
Else
  ' Sudah terpasang: langsung buka overlay tanpa jendela CMD
  sh.Run """" & exe & """ """ & dir & """", 1, False
End If
