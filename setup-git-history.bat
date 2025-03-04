@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist .git (
  git init
  echo Репозиторий инициализирован.
) else (
  echo Git уже инициализирован.
)

REM Коммит 1 — настройка проекта
git add package.json vite.config.ts tsconfig.json index.html .gitignore
git commit -m "Настройка проекта: Vite, React, TypeScript" --date="2025-02-27 12:00:00" 2>nul && echo [1/6] Коммит 1 готов.

REM Коммит 2 — конфиг VK и точка входа
git add vk-hosting-config.json src/vite-env.d.ts src/main.tsx
git commit -m "Конфиг для хостинга VK и точка входа приложения" --date="2025-02-28 14:30:00" 2>nul && echo [2/6] Коммит 2 готов.

REM Коммит 3 — типы и константы
git add src/types.ts src/constants.ts
git commit -m "Типы данных и сценарии по умолчанию" --date="2025-03-01 11:00:00" 2>nul && echo [3/6] Коммит 3 готов.

REM Коммит 4 — утилита истории
git add src/utils/history.ts
git commit -m "Сохранение истории выборов в localStorage" --date="2025-03-02 16:00:00" 2>nul && echo [4/6] Коммит 4 готов.

REM Коммит 5 — экраны и навигация
git add src/App.tsx src/panels/HomePanel.tsx src/panels/ResultPanel.tsx src/panels/HistoryPanel.tsx
git commit -m "Экраны: главный, результат, история. Навигация и таббар." --date="2025-03-03 13:00:00" 2>nul && echo [5/6] Коммит 5 готов.

REM Коммит 6 — README и скрипт для сборки истории
git add README.md setup-git-history.bat
git commit -m "Добавлен README с инструкциями по запуску и деплою" --date="2025-03-04 10:00:00" 2>nul && echo [6/6] Коммит 6 готов.

echo.
echo Готово. Проверь: git log --oneline
pause
