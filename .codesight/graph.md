# Dependency Graph

## Most Imported Files (change these carefully)

- `web\src\components\pdf-container\plugin-annotation-2\lib\types.ts` — imported by **10** files
- `web\src\components\pdf-container\plugin-scroll-2\lib\types.ts` — imported by **7** files
- `web\src\components\pdf-container\plugin-selection-2\lib\types.ts` — imported by **7** files
- `web\src\db\schemas\web\projects.ts` — imported by **7** files
- `/schemas.py` — imported by **6** files
- `web\src\components\pdf-container\plugin-annotation-2\lib\state.ts` — imported by **6** files
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\types.ts` — imported by **6** files
- `web\src\components\pdf-container\plugin-scroll-2\lib\types\virtual-item.ts` — imported by **6** files
- `web\src\db\schemas\web\schema.ts` — imported by **6** files
- `web\src\components\plugin-store\hooks\use-plugin-store.ts` — imported by **5** files
- `web\src\components\pdf-container\plugin-search-2\lib\types.ts` — imported by **5** files
- `web\src\components\pdf-container\plugin-zoom-2\lib\types.ts` — imported by **5** files
- `web\src\components\pdf-container\plugin-interaction-manager-2\hooks\use-interaction-manager.ts` — imported by **4** files
- `web\src\db\schemas\workers\schema.ts` — imported by **4** files
- `/config.py` — imported by **3** files
- `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\base-strategy.ts` — imported by **3** files
- `web\src\components\pdf-container\plugin-selection-2\components\types.ts` — imported by **3** files
- `web\src\components\pdf-container\plugin-selection-2\lib\utils.ts` — imported by **3** files
- `web\src\components\pdf-container\plugin-zoom-2\hooks\use-zoom.ts` — imported by **3** files
- `web\src\db\schemas\api\schema.ts` — imported by **3** files

## Import Map (who imports what)

- `web\src\components\pdf-container\plugin-annotation-2\lib\types.ts` ← `web\src\components\pdf-container\plugin-annotation-2\components\annotation-container\annotation-container.tsx`, `web\src\components\pdf-container\plugin-annotation-2\components\annotation-container\selected-menu.tsx`, `web\src\components\pdf-container\plugin-annotation-2\components\annotations.tsx`, `web\src\components\pdf-container\plugin-annotation-2\components\text-markup\preview.tsx`, `web\src\components\pdf-container\plugin-annotation-2\lib\actions.ts` +5 more
- `web\src\components\pdf-container\plugin-scroll-2\lib\types.ts` ← `web\src\components\pdf-container\plugin-scroll-2\lib\actions.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\index.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\index.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\manifest.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\reducer.ts` +2 more
- `web\src\components\pdf-container\plugin-selection-2\lib\types.ts` ← `web\src\components\pdf-container\plugin-selection-2\lib\actions.ts`, `web\src\components\pdf-container\plugin-selection-2\lib\index.ts`, `web\src\components\pdf-container\plugin-selection-2\lib\index.ts`, `web\src\components\pdf-container\plugin-selection-2\lib\manifest.ts`, `web\src\components\pdf-container\plugin-selection-2\lib\reducer.ts` +2 more
- `web\src\db\schemas\web\projects.ts` ← `web\src\db\schemas\api\prompts.ts`, `web\src\db\schemas\web\entity-types.ts`, `web\src\db\schemas\web\index.ts`, `web\src\db\schemas\web\users.ts`, `web\src\db\schemas\workers\billing.ts` +2 more
- `/schemas.py` ← `api\app\domains\billing\router.py`, `api\app\domains\billing\service.py`, `api\app\domains\llm_ner\router.py`, `api\app\domains\llm_ner\service.py`, `api\app\domains\pdf_utils\router.py` +1 more
- `web\src\components\pdf-container\plugin-annotation-2\lib\state.ts` ← `web\src\components\pdf-container\plugin-annotation-2\components\annotations.tsx`, `web\src\components\pdf-container\plugin-annotation-2\lib\actions.ts`, `web\src\components\pdf-container\plugin-annotation-2\lib\annotation-plugin.ts`, `web\src\components\pdf-container\plugin-annotation-2\lib\annotation-plugin.ts`, `web\src\components\pdf-container\plugin-annotation-2\lib\index.ts` +1 more
- `web\src\components\pdf-container\plugin-interaction-manager-2\lib\types.ts` ← `web\src\components\pdf-container\plugin-interaction-manager-2\lib\actions.ts`, `web\src\components\pdf-container\plugin-interaction-manager-2\lib\helper.ts`, `web\src\components\pdf-container\plugin-interaction-manager-2\lib\index.ts`, `web\src\components\pdf-container\plugin-interaction-manager-2\lib\index.ts`, `web\src\components\pdf-container\plugin-interaction-manager-2\lib\manifest.ts` +1 more
- `web\src\components\pdf-container\plugin-scroll-2\lib\types\virtual-item.ts` ← `web\src\components\pdf-container\plugin-scroll-2\lib\index.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\scroll-plugin.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\base-strategy.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\horizontal-strategy.ts`, `web\src\components\pdf-container\plugin-scroll-2\lib\strategies\vertical-strategy.ts` +1 more
- `web\src\db\schemas\web\schema.ts` ← `web\src\db\schemas\web\annotations.ts`, `web\src\db\schemas\web\entity-types.ts`, `web\src\db\schemas\web\index.ts`, `web\src\db\schemas\web\pdfs.ts`, `web\src\db\schemas\web\projects.ts` +1 more
- `web\src\components\plugin-store\hooks\use-plugin-store.ts` ← `web\src\components\entity-table\components\entity-table.tsx`, `web\src\components\pdf-container\dev\toolbar-dev.tsx`, `web\src\components\pdf-container\toolbar.tsx`, `web\src\components\plugin-store\components\dev\plugin-store-table.tsx`, `web\src\components\plugin-store\components\plugin-store-sync.tsx`
