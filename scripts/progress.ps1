$raw = Get-Content -Raw 'C:\Users\user\Desktop\stock-backtest\logs\ingest_run_stdout.log'
$lines = $raw -split "[\r\n]+" | Where-Object { $_ -ne '' }
$lines | Select-Object -Last 5
