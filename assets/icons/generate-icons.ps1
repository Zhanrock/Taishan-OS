Add-Type -AssemblyName System.Drawing

function New-TaishanIcon {
    param(
        [int]$Size,
        [string]$OutPath,
        [double]$GlyphScale
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $bg = [System.Drawing.ColorTranslator]::FromHtml("#0a0a0f")
    $g.Clear($bg)

    # soft glow behind glyph
    $glowColor = [System.Drawing.Color]::FromArgb(40, 124, 106, 255)
    $glowBrush = New-Object System.Drawing.SolidBrush($glowColor)
    $glowSize = $Size * 0.72
    $glowRect = New-Object System.Drawing.RectangleF((($Size - $glowSize) / 2), (($Size - $glowSize) / 2), $glowSize, $glowSize)
    $g.FillEllipse($glowBrush, $glowRect)
    $glowBrush.Dispose()

    $accent = [System.Drawing.ColorTranslator]::FromHtml("#7c6aff")
    $brush = New-Object System.Drawing.SolidBrush($accent)

    $fontSize = [float]($Size * $GlyphScale)
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $text = "T"
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

    $rect = New-Object System.Drawing.RectangleF(0, 0, $Size, ($Size * 1.02))
    $g.DrawString($text, $font, $brush, $rect, $fmt)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $font.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

# "any" purpose icons — glyph can sit close to the edges
New-TaishanIcon -Size 512 -OutPath (Join-Path $dir "icon-512.png") -GlyphScale 0.62
New-TaishanIcon -Size 192 -OutPath (Join-Path $dir "icon-192.png") -GlyphScale 0.62
New-TaishanIcon -Size 180 -OutPath (Join-Path $dir "apple-touch-icon.png") -GlyphScale 0.62

# "maskable" icon — glyph must stay inside the ~80% safe-zone circle so OS masks don't clip it
New-TaishanIcon -Size 512 -OutPath (Join-Path $dir "icon-maskable-512.png") -GlyphScale 0.42

Write-Host "Icons written to $dir"
