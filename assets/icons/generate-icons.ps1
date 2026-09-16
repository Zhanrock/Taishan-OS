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

    # mountain glyph: twin peaks (Taishan), scaled to sit inside a $GlyphScale-wide box centered in the canvas
    $box = $Size * $GlyphScale * 1.55
    $ox = ($Size - $box) / 2
    $oy = ($Size - $box) / 2 + ($Size * 0.06)

    function P([double]$fx, [double]$fy) {
        New-Object System.Drawing.PointF(($ox + $fx * $box), ($oy + $fy * $box))
    }

    # back peak — dimmer accent
    $backColor = [System.Drawing.Color]::FromArgb(255, 74, 63, 150)
    $backBrush = New-Object System.Drawing.SolidBrush($backColor)
    $backPeak = @(
        (P 0.36 0.16),
        (P 0.10 0.80),
        (P 0.62 0.80)
    )
    $g.FillPolygon($backBrush, $backPeak)
    $backBrush.Dispose()

    # front peak — full accent
    $accent = [System.Drawing.ColorTranslator]::FromHtml("#7c6aff")
    $frontBrush = New-Object System.Drawing.SolidBrush($accent)
    $frontPeak = @(
        (P 0.64 0.30),
        (P 0.30 0.80),
        (P 0.98 0.80)
    )
    $g.FillPolygon($frontBrush, $frontPeak)

    # snow cap on front peak — light accent triangle
    $snow = [System.Drawing.Color]::FromArgb(255, 224, 220, 255)
    $snowBrush = New-Object System.Drawing.SolidBrush($snow)
    $snowCap = @(
        (P 0.64 0.30),
        (P 0.56 0.42),
        (P 0.64 0.40),
        (P 0.72 0.42)
    )
    $g.FillPolygon($snowBrush, $snowCap)
    $snowBrush.Dispose()
    $frontBrush.Dispose()

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)

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
