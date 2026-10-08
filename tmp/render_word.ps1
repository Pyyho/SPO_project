$ErrorActionPreference = 'Stop'
$inputDocx = 'C:\Users\Данил\Desktop\CPO project\output\Service_trip_system_practicals_1-4.docx'
$renderDir = 'C:\Users\Данил\Desktop\CPO project\tmp\rendered_report'
$outputPdf = Join-Path $renderDir 'Service_trip_system_practicals_1-4.pdf'
New-Item -ItemType Directory -Force -Path $renderDir | Out-Null

$wordApp = New-Object -ComObject Word.Application
$wordApp.Visible = $false
$wordApp.DisplayAlerts = 0
try {
    $wordDoc = $wordApp.Documents.Open($inputDocx, $false, $true)
    try {
        $wordDoc.ExportAsFixedFormat($outputPdf, 17)
    }
    finally {
        $wordDoc.Close($false)
    }
}
finally {
    $wordApp.Quit()
}

Write-Output $outputPdf
