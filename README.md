# Маршрут на завтра

Мобильное веб-приложение (PWA) для водителей: выбираете клиентов на завтра, приложение выставляет порядок объезда, строит маршрут для грузовой машины и показывает платные участки, плохие дороги и весовые посты. Подробности — в `ARCHITECTURE.md`.

## Запуск за 15 минут

1. **Supabase**: создайте проект, откройте SQL Editor и выполните `supabase/schema.sql`. В Authentication для начала можно отключить подтверждение email. Скопируйте Project URL и anon key (Settings → API).
2. **OpenRouteService**: бесплатный ключ на openrouteservice.org.
3. **GitHub**: загрузите папку в новый репозиторий.
4. **Netlify**: New site → Import from Git → выберите репозиторий. В Site settings → Environment variables добавьте:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ORS_API_KEY`
5. Откройте сайт, зарегистрируйтесь, затем в Supabase назначьте себя диспетчером:
   `update profiles set role = 'dispatcher' where id = '<ваш uuid из Authentication → Users>';`
6. Диспетчер добавляет клиентов (вкладка «Клиенты»), водители отмечают опасные точки, затем вкладка «Маршрут».

На телефоне: меню браузера → «Добавить на главный экран».

## Обновление базы
Если база уже создана старой версией `schema.sql`, по очереди выполните в SQL Editor (Run) файлы:
1. `supabase/migration_2.sql` — удаление клиентов и сохранённые рейсы;
2. `supabase/migration_3.sql` — окна приёмки, телефоны, режим «Еду», быстрые отметки на дороге.

Новая установка: достаточно одного `schema.sql`.

## Локально
```
npm test          # тесты решателя порядка точек
npx netlify dev   # приложение + функции, переменные в .env
```

## Структура
- `public/` — интерфейс (PWA)
- `netlify/functions/optimize.js` — расчёт маршрута; `lib/solver.js` — порядок точек
- `netlify/functions/geocode.js` — адрес → координаты
- `supabase/schema.sql` — таблицы и права доступа
