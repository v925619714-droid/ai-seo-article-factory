// Диагностика ИИ-маркеров по всему контенту сайта (для де-ИИзации).
// Считает плотность длинного тире и частоту типовых ИИ-фраз. Запуск: node scripts/ai-tells-scan.mjs
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const targets = []
function addDir(dir, filter) {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) continue
    if (filter(f)) targets.push(p)
  }
}
// статьи, модули, лендинги, ключевые страницы, письма
addDir(join(ROOT, 'course', 'articles'), (f) => f.endsWith('.md') && !/^[А-ЯЁ]/.test(f))
addDir(join(ROOT, 'course'), (f) => /^(module-\d|errors-playbook)\.md$/.test(f))
addDir(join(ROOT, 'public'), (f) => /^kurs(2|-archive)?\.html$/.test(f))

// ИИ-фразы-маркеры (регэкспы, без учёта регистра)
const PHRASES = [
  ['Представь(?:те)?[,:]', 'Представь:'],
  ['Важно (?:отметить|понимать|помнить)', 'Важно отметить'],
  ['Сто[ий]т (?:отметить|учитывать|помнить)', 'Стоит учитывать'],
  ['В (?:современном мире|цифровую эпоху|наше время|мире технологий)', 'В современном мире'],
  ['Давай(?:те)? (?:разбер[её]мся|разберём|посмотрим)', 'Давай разберёмся'],
  ['В (?:этой статье|данной статье) (?:мы )?(?:рассмотрим|разбер[её]м|расскажем)', 'В этой статье рассмотрим'],
  ['(?:Итак|Таким образом|В итоге|Подводя итог)', 'Итак/Таким образом'],
  ['(?:Не секрет|Как известно|Ни для кого не секрет)', 'Не секрет'],
  ['Это не [^.,—]{2,30} — а ', 'Это не X, а Y'],
  ['играет (?:важную|ключевую|значимую) роль', 'играет важную роль'],
  ['в современном (?:мире|обществе)', 'в современном мире'],
]

const rows = []
for (const p of targets) {
  const raw = readFileSync(p, 'utf8')
  // тело без frontmatter/html-тегов для честной плотности
  const text = raw.replace(/^---[\s\S]*?---/, '').replace(/<[^>]+>/g, ' ')
  const chars = text.length || 1
  const emdash = (text.match(/—/g) || []).length
  const per1k = (emdash / chars) * 1000
  let phraseHits = 0
  const hitList = []
  for (const [re, label] of PHRASES) {
    const n = (text.match(new RegExp(re, 'gi')) || []).length
    if (n) { phraseHits += n; hitList.push(label + '×' + n) }
  }
  rows.push({ file: p.replace(ROOT + '\\', '').replace(/\\/g, '/'), chars, emdash, per1k: +per1k.toFixed(1), phraseHits, hits: hitList.join(', ') })
}

rows.sort((a, b) => b.per1k - a.per1k)
console.log('ФАЙЛ | тире | тире/1000 | ИИ-фраз | какие')
for (const r of rows) {
  console.log(`${r.file} | ${r.emdash} | ${r.per1k} | ${r.phraseHits} | ${r.hits}`)
}
const totEm = rows.reduce((s, r) => s + r.emdash, 0)
const totPh = rows.reduce((s, r) => s + r.phraseHits, 0)
const avg = (rows.reduce((s, r) => s + r.per1k, 0) / rows.length).toFixed(1)
console.log(`\nИТОГО: файлов ${rows.length}, тире ${totEm} (средняя плотность ${avg}/1000), ИИ-фраз ${totPh}`)
console.log('Ориентир «живого» текста: ~3–6 тире/1000; выше ~8 — заметный ИИ-переизбыток.')
