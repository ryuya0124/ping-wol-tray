@echo off
REM distフォルダを削除
rmdir /s /q dist

REM ビルドを同期的に実行
call npm run build

REM dist フォルダへ移動
cd dist

REM .exe 以外のファイルを削除
for %%f in (*) do (
    if /I not "%%~xf"==".exe" del "%%f"
)

REM フォルダを削除（例: win-unpacked や他のビルド補助フォルダ）
for /d %%d in (*) do (
    rmdir /s /q "%%d"
)

pause
