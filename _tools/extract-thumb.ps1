# Extract a thumbnail from a media file using IShellItemImageFactory.
# Usage: powershell -ExecutionPolicy Bypass -File extract-thumb.ps1 <video> <out.png> [width]
param(
  [Parameter(Mandatory=$true)][string]$Video,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$Width = 1024
)

Add-Type -AssemblyName System.Drawing

$source = @'
using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Drawing.Imaging;

public static class ShellThumb {
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(
    [MarshalAs(UnmanagedType.LPWStr)] string path,
    IntPtr pbc,
    [MarshalAs(UnmanagedType.LPStruct)] Guid iid,
    [MarshalAs(UnmanagedType.Interface)] out IShellItem item);

  [DllImport("gdi32.dll")]
  static extern bool DeleteObject(IntPtr hObject);

  [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"),
   InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void _VtblGap1_5();
    void _VtblGap2_4();
  }

  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"),
   InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory {
    [PreserveSig]
    int GetImage(SIZE size, int flags, out IntPtr hbitmap);
  }

  [StructLayout(LayoutKind.Sequential)]
  struct SIZE { public int cx, cy; public SIZE(int x, int y) { cx = x; cy = y; } }

  public static void Save(string path, string outPath, int w) {
    Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
    IShellItem item;
    SHCreateItemFromParsingName(path, IntPtr.Zero, typeof(IShellItem).GUID, out item);
    IShellItemImageFactory factory = (IShellItemImageFactory)item;
    IntPtr hBmp;
    int hr = factory.GetImage(new SIZE(w, w), 0, out hBmp);
    if (hr != 0) throw new Exception("GetImage failed: " + hr);
    Bitmap bmp = Bitmap.FromHbitmap(hBmp);
    DeleteObject(hBmp);
    bmp.Save(outPath, ImageFormat.Png);
    bmp.Dispose();
  }
}
'@

Add-Type -TypeDefinition $source -ReferencedAssemblies System.Drawing
[ShellThumb]::Save($Video, $Out, $Width)
Write-Output ("OK -> " + $Out)
