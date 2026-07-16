/**
 * Сборка статейника и раздела «Решения» в арт-дирекции Warm Editorial.
 * Статьи — markdown в course/articles/*.md (frontmatter + тело) → public/articles/<slug>.html
 * Индекс статей → public/stati.html ; заглушка → public/resheniya.html
 * Каркас (шапка/футер/токены) — общий public/site.css ; бесшовные переходы — public/site.js (#swap).
 * Запуск из skillmake:  node scripts/build-site.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync , statSync } from 'fs'
import { join, basename } from 'path'
import { marked } from 'marked'

marked.setOptions({ gfm: true })
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// «2026-06-28» -> «28 июня 2026» (человеческая дата в мета-строке статьи)
const RU_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
const ruDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  if (!m) return iso || ''
  return parseInt(m[3], 10) + ' ' + RU_MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1]
}

// SEO: <title> до ~65 симв. (H1 остаётся полным). seoTitle из frontmatter главнее.
const smartTitle = (t) => {
  t = String(t || '').trim()
  if (t.length <= 68) return t
  const cut = t.split(/\s+[—–-]\s+|:\s+/)[0].trim()
  if (cut.length >= 25 && cut.length <= 68) return cut
  let out = ''
  for (const w of t.split(/\s+/)) { if ((out + ' ' + w).trim().length > 63) break; out = (out + ' ' + w).trim() }
  return out || t.slice(0, 63)
}
// SEO: meta description до ~160 симв., обрезка по границе предложения/слова.
const trimDesc = (d) => {
  d = String(d || '').trim()
  if (d.length <= 165) return d
  const dot = d.slice(0, 160).lastIndexOf('. ')
  if (dot >= 80) return d.slice(0, dot + 1)
  let out = ''
  for (const w of d.split(/\s+/)) { if ((out + ' ' + w).trim().length > 155) break; out = (out + ' ' + w).trim() }
  return out + '…'
}
const ART_DIR = join(process.cwd(), 'course', 'articles')
const PUB = join(process.cwd(), 'public')
// React-переход (ТЗ v3, Э3): HTML статей теперь контент Next-роута /articles/[slug] —
// пишем в content/articles; обложки/og-картинки остаются в public/articles/img
const CONTENT_ART = join(process.cwd(), 'content', 'articles')
if (!existsSync(join(PUB, 'articles'))) mkdirSync(join(PUB, 'articles'), { recursive: true })
if (!existsSync(CONTENT_ART)) mkdirSync(CONTENT_ART, { recursive: true })

const BUILD = Date.now() // версия для сброса кэша site.css/site.js при каждой сборке
const FONTS_VER = '6a9eec92' // версия fonts.css (сабсет Tabler) — сброс immutable-кэша при смене шрифтов
const HEAD = `<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://mc.yandex.ru" crossorigin>
<link rel="preload" href="/fonts/playfair-display-800-normal-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/inter-400-normal-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/fonts/fonts.css?v=${FONTS_VER}">
<link rel="stylesheet" href="/site.css?v=${BUILD}">`

// контентные стили статейника/статей (каркас — в site.css)
const CSS = `
h1,h2,h3{margin:0;color:var(--text-strong);text-wrap:balance}
a:hover{text-decoration:underline;text-underline-offset:3px}
main{display:block}

.phero{position:relative;overflow:hidden;border-bottom:1px solid var(--border-hair)}
.phero::before{content:"";position:absolute;width:680px;height:680px;left:-160px;top:-300px;background:radial-gradient(circle,rgba(110,99,232,.18),rgba(110,99,232,0) 62%);pointer-events:none}
.phero::after{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(83,74,183,.09) 1px,transparent 1.5px);background-size:26px 26px;-webkit-mask-image:radial-gradient(120% 100% at 28% 0%,#000 25%,transparent 70%);mask-image:radial-gradient(120% 100% at 28% 0%,#000 25%,transparent 70%);pointer-events:none}
.phero-blob{position:absolute;border-radius:50%;filter:blur(70px);pointer-events:none;width:300px;height:300px;right:-40px;bottom:-120px;background:radial-gradient(circle,rgba(190,24,93,.16),rgba(190,24,93,0) 70%);animation:float 10s var(--ease) infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
.phero-in{position:relative;z-index:1;max-width:1140px;margin:0 auto;padding:70px 26px 56px}
.phero .kick{font-family:var(--sans);font-weight:700;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--brand-deep);display:inline-flex;align-items:center;gap:9px}
.phero .kick::before{content:"";width:22px;height:1.5px;background:var(--brand);opacity:.5}
.phero h1{font-family:var(--serif);font-weight:800;font-size:clamp(36px,6.4vw,68px);line-height:1.02;letter-spacing:-.02em;margin:18px 0 0}
.phero h1 em{font-style:italic;color:var(--brand)}
.phero .sub{max-width:62ch;color:var(--text-body);font-size:clamp(17px,2.1vw,20px);line-height:1.55;margin:20px 0 0}

.arts{max-width:1140px;margin:0 auto;padding:56px 26px 96px;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr));gap:22px;grid-auto-flow:dense}
.art-card{display:flex;flex-direction:column;background:var(--bg-surface);border:1px solid var(--border-hair);border-radius:var(--r-lg);padding:26px;box-shadow:var(--shadow-sm);transition:transform .3s var(--ease),box-shadow .3s,border-color .3s}
a.art-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-md);border-color:var(--border-brand);text-decoration:none}
.art-card .tag{align-self:flex-start;font-family:var(--sans);font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--brand);background:var(--brand-tint);padding:5px 11px;border-radius:var(--r-pill)}
.art-card h2{font-family:var(--serif);font-weight:800;font-size:23px;line-height:1.15;margin:16px 0 10px}
.art-card p{font-size:15px;color:var(--text-body);line-height:1.55;flex:1}
.art-card .meta{margin-top:16px;display:flex;align-items:center;gap:10px;font-family:var(--sans);font-size:13px;font-weight:600;color:var(--text-muted)}
.art-card .go{color:var(--brand-deep);display:inline-flex;align-items:center;gap:6px}
.art-card.soon{background:var(--bg-subtle)}
.art-card.soon h3,.art-card.soon .exc{color:var(--text-body)}
.art-card.soon .tag{color:var(--text-muted);background:var(--bg-sunken)}
.art-card .soonb{margin-top:16px;font-family:var(--sans);font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted)}

/* фильтры категорий + поиск (/stati и /stati/<категория>) */
/* hidden-атрибут должен побеждать display карточки/кнопки (UA-стиль слабее авторского display) */
.art-card[hidden],.art-search__clear[hidden],.art-empty[hidden]{display:none!important}
.art-tools{max-width:1140px;margin:0 auto;padding:18px 26px 0;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-start}
.art-filters-wrap{flex:1;min-width:300px}
.art-filters{display:flex;flex-wrap:wrap;gap:8px}
.art-chip{display:inline-flex;align-items:center;gap:7px;font-family:var(--sans);font-weight:600;font-size:13.5px;color:var(--text-body);background:var(--bg-surface);border:1px solid var(--border-soft);border-radius:var(--r-pill);padding:8px 15px;transition:border-color .2s,color .2s,transform .2s var(--ease);cursor:pointer}
.art-chip:hover{border-color:var(--border-brand);color:var(--text-strong);text-decoration:none;transform:translateY(-1px)}
.art-chip .cnt{font-size:11px;font-weight:700;color:var(--text-muted);background:var(--bg-subtle);border-radius:var(--r-pill);padding:1px 7px}
.art-chip.is-active{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:0 4px 12px rgba(83,74,183,.32)}
.art-chip.is-active .cnt{background:rgba(255,255,255,.22);color:#fff}
.art-search{position:relative;flex:0 1 320px;min-width:250px}
.art-status{flex-basis:100%}
.art-search__ic{position:absolute;left:15px;top:50%;width:17px;height:17px;transform:translateY(-50%);color:var(--text-muted);pointer-events:none}
.art-search__input{width:100%;font-family:var(--body-f);font-size:15px;color:var(--text-strong);background:var(--bg-surface);border:1px solid var(--border-soft);border-radius:var(--r-md);padding:11px 42px;transition:border-color .2s,box-shadow .2s}
.art-search__input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-tint)}
.art-search__input::-webkit-search-cancel-button{display:none}
.art-search__clear{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;background:var(--bg-subtle);border:none;border-radius:50%;color:var(--text-muted);font-size:14px}
.art-search__clear:hover{color:var(--text-strong)}
.art-status{margin:10px 2px 0;font-family:var(--sans);font-size:13px;color:var(--text-muted);min-height:1.2em}
.art-empty{max-width:520px;margin:0 auto;padding:24px 26px 60px;text-align:center}
.art-empty .ic{display:inline-flex;width:52px;height:52px;align-items:center;justify-content:center;border-radius:50%;background:var(--brand-tint);color:var(--brand);font-size:24px;margin-bottom:14px}
.art-empty h3{font-family:var(--serif);font-weight:800;font-size:22px;margin:0 0 8px;overflow-wrap:anywhere}
.art-empty p{color:var(--text-body);font-size:15px;margin:0 0 16px}
.art-card h2 mark{background:var(--brand-tint-2);color:inherit;border-radius:3px;padding:0 2px}
.arts:has(+ .arts-more){padding-bottom:20px}
.arts:has(+ .art-empty:not([hidden])){padding-bottom:0}

/* цвет категории: пилюля на карточке + тонкий верхний кант (79 одинаковых карточек различимы без чтения) */
.art-card{position:relative;border-top:3px solid transparent}
.tc-vibecoding{border-top-color:#B9B1EC}.tc-vibecoding .tag{background:#ECEAFB;color:#3A337F}
.tc-tech{border-top-color:#A9C6DE}.tc-tech .tag{background:#E3EEF6;color:#2D5A7A}
.tc-build{border-top-color:#A9D4BC}.tc-build .tag{background:#E6F2EA;color:#1B7A53}
.tc-product{border-top-color:#E4C68A}.tc-product .tag{background:#FBF1DD;color:#8A5509}
.tc-publish{border-top-color:#E0A9C4}.tc-publish .tag{background:#F8E7F0;color:#A81D5E}
.tc-monetize{border-top-color:#DFAFA5}.tc-monetize .tag{background:#F8EBE9;color:#A03A2B}

/* featured «Сначала сюда»: кант + бейдж на кромке. span-2 ТОЛЬКО у первой карточки —
   4 широких подряд оставляли пустые ячейки справа и ломали ритм 3-колонки (grid-auto-flow:dense
   на .arts добивает возможные дыры). */
.art-card--f{border:1px solid var(--border-brand);border-top:3px solid var(--brand);box-shadow:var(--shadow-md)}
.arts > .art-card--f:first-child{grid-column:span 2}
.arts > .art-card--f:first-child h2{font-size:28px}
.art-card .startb{position:absolute;top:0;right:16px;transform:translateY(-50%);display:inline-flex;align-items:center;gap:5px;font-family:var(--sans);font-weight:700;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:#fff;background:var(--brand);padding:4px 11px;border-radius:var(--r-pill);box-shadow:var(--shadow-sm)}
@media(max-width:760px){.arts > .art-card--f:first-child{grid-column:auto}.arts > .art-card--f:first-child h2{font-size:22px}}

/* мета карточки: дата + время чтения */
.art-card .meta{flex-wrap:wrap;row-gap:6px}
.art-card .meta .go{margin-left:auto}

/* врезки в сетке (подписка / мостик к курсу) — скрываются при активном фильтре (site.js) */
.grid-note{grid-column:1/-1}
.grid-note[hidden]{display:none!important}
.sub-inline{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;background:var(--brand-tint);border:1px solid var(--border-brand);border-radius:var(--r-lg);padding:24px 28px}
.sub-inline h3{font-family:var(--serif);font-weight:800;font-size:22px;margin:0 0 4px;color:var(--text-strong)}
.sub-inline p{margin:0;font-size:14.5px;color:var(--text-body)}
.kurs-inline{text-align:center;padding:10px 20px}
.kurs-inline p{margin:0;font-family:var(--sans);font-size:15px;color:var(--text-body)}
.kurs-inline a{font-weight:700;color:var(--brand-deep);white-space:nowrap}

/* «Показать ещё» под сеткой */
.arts-more{text-align:center;padding:0 26px 64px}
.arts-more .art-chip{font-size:14.5px;padding:12px 26px}
.arts-more[hidden]{display:none!important}

@media(max-width:640px){
  .art-tools{padding:20px 22px 0;flex-direction:column;align-items:stretch}
  .art-search{order:-1;margin:0 0 12px;max-width:none;flex-basis:auto}
  .art-search__input{font-size:16px} /* <16px триггерит авто-зум iOS Safari при фокусе */
  .art-filters-wrap{position:relative;margin:0 -22px;min-width:0}
  .art-filters{flex-wrap:nowrap;overflow-x:auto;gap:8px;padding:2px 22px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .art-filters::-webkit-scrollbar{display:none}
  /* fade-подсказка «лента скроллится» — без неё категории за краем экрана не найдут */
  .art-filters-wrap::after{content:"";position:absolute;top:0;right:0;bottom:6px;width:42px;background:linear-gradient(90deg,rgba(244,238,226,0),var(--bg-page));pointer-events:none}
  .art-chip{flex:none}
  /* компактные карточки: лента 79 статей вдвое короче */
  .art-card{padding:20px}
  .art-card h2{font-size:20px}
  .art-card p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
}
@media(min-width:641px){
  /* панель прилипает при скролле — смена категории/поиск без возврата наверх */
  .art-tools{position:sticky;top:67px;z-index:40;background:color-mix(in srgb,var(--bg-page) 92%,transparent);backdrop-filter:blur(10px);padding-bottom:12px;border-bottom:1px solid var(--border-hair)}
}

/* крошки + инлайн-CTA в статье */
.crumbs{max-width:74ch;margin:0 auto;padding:18px 26px 0;font-family:var(--sans);font-size:13px;color:var(--text-muted);display:flex;gap:8px;align-items:center}
.crumbs a{color:var(--text-muted)}
.crumbs a:hover{color:var(--brand-deep)}
.art-mid-cta{border-left:3px solid var(--brand);background:var(--brand-tint);border-radius:0 var(--r-md) var(--r-md) 0;padding:16px 20px;margin:30px 0}
.art-mid-cta p{margin:0!important;font-family:var(--sans);font-size:15px;line-height:1.55}
.art-mid-cta a{font-weight:700;white-space:nowrap}
.rel-head{display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap}
.rel-all{font-family:var(--sans);font-weight:600;font-size:14px;color:var(--brand-deep);white-space:nowrap}

.article{max-width:70ch;margin:0 auto;padding:14px 26px 40px;font-size:18px}
.article .back{display:inline-flex;align-items:center;gap:7px;font-family:var(--sans);font-weight:600;font-size:14px;color:var(--text-muted);margin:24px 0 10px}
.art-hero{position:relative;max-width:74ch;margin:0 auto;padding:46px 26px 6px}
.art-hero::before{content:"";position:absolute;left:50%;top:-30px;width:620px;height:320px;max-width:120vw;transform:translateX(-50%);background:radial-gradient(58% 80% at 50% 0,rgba(110,99,232,.14),rgba(110,99,232,0) 70%);pointer-events:none}
.art-hero>*{position:relative}
.art-hero .tag{font-family:var(--sans);font-weight:700;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--brand);background:var(--brand-tint);padding:5px 11px;border-radius:var(--r-pill)}
.art-hero h1{font-family:var(--serif);font-weight:800;font-size:clamp(32px,5.4vw,54px);line-height:1.04;letter-spacing:-.02em;margin:16px 0 14px}
.art-hero .amt{font-family:var(--sans);font-size:13.5px;font-weight:600;color:var(--text-muted);display:flex;gap:18px;flex-wrap:wrap}
.art-hero .amt span{display:inline-flex;gap:7px;align-items:center}.art-hero .amt .ti{color:var(--brand)}
.article p{margin:0 0 19px}
.article h2{font-family:var(--serif);font-weight:800;font-size:clamp(24px,3.4vw,32px);letter-spacing:-.015em;margin:40px 0 14px;line-height:1.1}
.article h3{font-family:var(--sans);font-weight:800;font-size:20px;margin:30px 0 8px}
.article ul,.article ol{padding-left:24px;margin:0 0 19px}
.article li{margin:8px 0}.article li::marker{color:var(--brand)}
.article strong{color:var(--text-strong)}
.article a{text-decoration:underline;text-decoration-color:var(--brand-tint-2);text-underline-offset:3px}
.article code{background:var(--brand-tint);color:var(--brand-deep);padding:2px 7px;border-radius:6px;font-family:var(--mono);font-size:.85em}
.article img{display:block;max-width:100%;height:auto;margin:26px auto;border-radius:14px;border:1px solid var(--border-hair);background:#fff}
/* обложка статьи (cover-*.svg, соотношение 1200×480=2.5): резервируем место заранее —
   иначе до декодирования SVG контейнер схлопывается в «битую» полоску (CLS). */
.article img[src*="cover-"]{width:100%;aspect-ratio:2.5/1;object-fit:cover;margin-top:0}
.article figure{margin:26px 0}.article figure img{margin:0}.article figcaption{text-align:center;font-family:var(--sans);font-size:13px;color:var(--text-muted);margin-top:9px}
.article .mermaid{margin:26px 0;text-align:center;overflow-x:auto;cursor:zoom-in}
.article .mermaid svg{max-width:none;height:auto}
.article pre{background:#1f1b2e;border:1px solid #2c263f;border-radius:12px;padding:16px 18px;overflow:auto;margin:0 0 20px;position:relative}
.article pre code{background:none;color:#e8e5f5;padding:0;font-family:var(--mono);font-size:13.5px;line-height:1.55}
.tbl-wrap{overflow-x:auto;margin:0 0 22px;-webkit-overflow-scrolling:touch}
.article table{width:100%;border-collapse:collapse;margin:0;font-size:15px;min-width:420px}
.article th,.article td{border:1px solid var(--border-hair);padding:9px 12px;text-align:left}
.article th{background:var(--brand-tint);color:var(--text-strong);font-family:var(--sans);font-weight:700}
.callout{display:flex;gap:14px;align-items:flex-start;margin:24px 0;padding:17px 19px;border-radius:14px;background:var(--bg-surface);border:1px solid var(--border-soft)}
.callout__ic{flex:none;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:19px}
.callout__bd{min-width:0}.callout__bd p{margin:0}
.c-tip{background:#F4F2FE;border-color:var(--brand-tint-2)}.c-tip .callout__ic{background:#E8E5FB;color:var(--brand)}
.c-warn{background:var(--warn-bg);border-color:#EAD9B6}.c-warn .callout__ic{background:#FBEAC9;color:var(--warn)}

.cta-card{position:relative;overflow:hidden;background:var(--dark);color:#fff;border-radius:var(--r-xl);padding:48px 38px;text-align:center;margin:48px auto 0;max-width:74ch}
.cta-card::before{content:"";position:absolute;width:520px;height:520px;right:-160px;top:-240px;background:radial-gradient(circle,rgba(110,99,232,.5),rgba(110,99,232,0) 60%);pointer-events:none}
.cta-card h2{position:relative;z-index:1;font-family:var(--serif);color:#fff;font-size:clamp(26px,4vw,38px);font-weight:800;margin:0 0 12px}
.cta-card p{position:relative;z-index:1;color:#cfcadf;max-width:54ch;margin:0 auto 24px;font-size:16px}
.cta-card .btn-light{position:relative;z-index:1;display:inline-flex;align-items:center;gap:9px;background:#fff;color:var(--brand-deep);font-family:var(--sans);font-weight:700;font-size:16px;padding:15px 28px;border-radius:var(--r-md);box-shadow:0 14px 30px -10px rgba(0,0,0,.5)}
.cta-card .btn-light:hover{transform:translateY(-2px);text-decoration:none}
.cta-card .cta-links{position:relative;z-index:1;display:flex;flex-wrap:wrap;justify-content:center;gap:8px 14px;margin-top:18px;font-family:var(--sans);font-size:13px}
.cta-card .cta-links a{color:#b6aef0}
.cta-card .cta-links a:hover{color:#fff}
.cta-card .cta-links span{color:#6a628f}

.soon-wrap{max-width:780px;margin:0 auto;padding:56px 26px 96px;text-align:center}
.soon-badge{display:inline-flex;align-items:center;gap:9px;font-family:var(--sans);font-weight:700;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--warn);background:var(--warn-bg);border:1px solid #EAD9B6;padding:9px 17px;border-radius:var(--r-pill)}
.soon-list{display:grid;gap:14px;margin:32px 0 0;text-align:left}
.soon-item{display:flex;gap:14px;align-items:flex-start;background:var(--bg-surface);border:1px solid var(--border-hair);border-radius:var(--r-lg);padding:20px}
.soon-item .ic{flex:none;width:42px;height:42px;border-radius:12px;background:var(--brand-tint);color:var(--brand);display:grid;place-items:center;font-size:21px}
.soon-item h3{font-family:var(--sans);font-weight:700;font-size:16px;margin:0 0 4px}
.soon-item p{margin:0;font-size:14.5px;color:var(--text-body)}
@media(max-width:640px){.phero-in{padding:48px 22px 40px}.arts{padding:40px 22px 64px}}
.author-box{display:flex;gap:16px;align-items:flex-start;background:var(--bg-subtle);border:1px solid var(--border-hair);border-radius:var(--r-lg);padding:20px 22px;margin:40px 0 0}
.author-box__ava{flex:none;width:46px;height:46px;border-radius:50%;background:var(--brand-tint);color:var(--brand);display:grid;place-items:center;font-size:22px}
.author-box__n{font-family:var(--sans);font-weight:800;font-size:15px;color:var(--text-strong);margin-bottom:4px}
.author-box p{margin:0;font-size:14px;line-height:1.6;color:var(--text-body)}
.rel-wrap{margin:40px 0 0}
.rel-h{font-size:22px;margin:0 0 16px}
.rel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.rel-grid .art-card h3{font-family:var(--serif);font-weight:800;font-size:16.5px;line-height:1.3;margin:10px 0 12px;color:var(--text-strong)}
/* Встроенная игра-змейка (постер → iframe, полноэкранный режим) */
.sk-game{margin:34px 0;border-radius:var(--r-xl);overflow:hidden;position:relative;background:var(--dark);box-shadow:0 26px 60px -24px rgba(58,51,127,.55);border:1px solid rgba(110,99,232,.35)}
.sk-game::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
.sk-game__poster{position:relative;aspect-ratio:16/10;overflow:hidden;cursor:pointer}
.sk-game__poster img{width:100%;height:100%;object-fit:cover;object-position:center 42%;display:block;filter:saturate(1.05)}
.sk-game__overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;background:radial-gradient(120% 90% at 50% 40%,rgba(31,27,46,.15),rgba(31,27,46,.72))}
.sk-game__play{display:inline-flex;align-items:center;gap:12px;font-family:var(--sans);font-weight:800;font-size:clamp(17px,2.4vw,21px);color:#fff;padding:16px 34px;border:none;border-radius:var(--r-pill);cursor:pointer;background:linear-gradient(135deg,var(--brand-bright),var(--brand-deep));box-shadow:0 16px 40px -12px rgba(110,99,232,.9),0 0 0 6px rgba(110,99,232,.16);transition:transform .18s,box-shadow .18s;animation:skPulse 2.6s ease-in-out infinite}
.sk-game__play:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 22px 48px -12px rgba(110,99,232,1),0 0 0 8px rgba(110,99,232,.22)}
.sk-game__ic{font-size:.8em;transform:translateX(1px)}
.sk-game__hint{margin:0;font-family:var(--sans);font-size:13.5px;color:rgba(255,252,246,.82);text-shadow:0 1px 8px rgba(0,0,0,.5)}
@keyframes skPulse{0%,100%{box-shadow:0 16px 40px -12px rgba(110,99,232,.9),0 0 0 6px rgba(110,99,232,.16)}50%{box-shadow:0 16px 40px -12px rgba(110,99,232,.9),0 0 0 12px rgba(110,99,232,0)}}
.sk-game__stage{position:relative;aspect-ratio:16/10;background:#14110c}
.sk-game__stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}
.sk-game__bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 14px;background:var(--dark);border-top:1px solid rgba(110,99,232,.25)}
.sk-game__bar .sk-game__t{font-family:var(--sans);font-weight:700;font-size:13.5px;color:#efeafc;margin-right:auto;display:inline-flex;align-items:center;gap:8px}
.sk-game__bar button{font-family:var(--sans);font-weight:700;font-size:13px;color:#efeafc;background:rgba(110,99,232,.18);border:1px solid rgba(110,99,232,.4);border-radius:9px;padding:8px 13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:background .15s}
.sk-game__bar button:hover{background:rgba(110,99,232,.34)}
.sk-game:fullscreen{border-radius:0;margin:0;display:flex;flex-direction:column;background:#14110c}
.sk-game:fullscreen .sk-game__stage{flex:1;aspect-ratio:auto}
@media(max-width:640px){.sk-game__poster,.sk-game__stage{aspect-ratio:4/5}}
`

// ⚠️ РЕГЕНЕРАЦИЯ: data-goal-разметка ниже попадёт в public/*.html только при `node scripts/build-site.mjs`.
// Сейчас генератор запускать НЕЛЬЗЯ (course/articles/*.md отсутствуют → сотрёт статьи). Запустить,
// когда .md вернутся. Общий движок целей (metrika.js/site.js) уже работает на живых страницах без регенерации.
const NAV = (active) => `<nav class="topnav" aria-label="Разделы сайта">
      <a class="topnav__i${active === 'praktikum' ? ' active' : ''}" href="/kurs" data-goal="nav_click" data-goal-params='{"to":"praktikum"}'>Практикум</a>
      <a class="topnav__i${active === 'stati' ? ' active' : ''}" href="/stati" data-goal="nav_click" data-goal-params='{"to":"stati"}'>Статьи</a>
      <!-- «Решения» временно убраны из хедера (решение владельца, 13.07); страница /resheniya остаётся -->
      <a class="topnav__i" href="/login" data-goal="nav_click" data-goal-params='{"to":"login"}'>Войти</a>
    </nav>`

const SITE_URL = 'https://skillmake.ru'
// JSON-LD: сериализация с экранированием `<` (<) — валидный JSON, и текст ответа
// не может разорвать <script>-блок даже если внутри встретится «</script>».
const jsonLdSafe = (data) => JSON.stringify(data).replace(/</g, '\\u003c')
const shell = ({ title, desc, active, body, noindex, path, ogType, ogImage, jsonLd }) => `<!doctype html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">${noindex ? '\n<meta name="robots" content="noindex">' : ''}${path ? `
<link rel="canonical" href="${SITE_URL}${path}">
<meta property="og:type" content="${ogType || 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE_URL}${path}">${ogImage ? `
<meta property="og:image" content="${SITE_URL}${ogImage}">` : ''}
<meta property="og:site_name" content="skillmake">` : ''}${jsonLd ? `
<script type="application/ld+json">${jsonLdSafe(jsonLd)}</script>` : ''}
${HEAD}
<style>${CSS}</style>
<script>document.documentElement.classList.add('js-reveal')</script></head>
<body>
<a class="skip" href="#swap">Перейти к содержанию</a>
<header class="hdr" id="hdr"><div class="container hdr-in">
    <a href="/kurs" class="logo">skill<span class="lb">make</span></a>
    ${NAV(active)}
    <button class="navtog" aria-label="Открыть меню" aria-expanded="false"><i class="ti ti-menu-2"></i></button>
    <a href="/checkout?utm_source=site" class="btn-cta">Получить навык · 1000 ₽</a>
  </div></header>
<main id="swap">
${body}
</main>
<footer><div class="foot">
  <a href="/kurs" class="logo">skill<span class="lb">make</span></a>
  <span class="links"><a href="/oferta">оферта</a><a href="/privacy">конфиденциальность</a><a href="/cookie">cookie</a><a href="mailto:support@skillmake.ru">контакты</a></span>
  <span class="mut">ООО «ПЕРФОМ ЭДЖЕНСИ» · ИНН 5001143547 · ОГРН 1225000005713</span>
</div></footer>
<div class="mcta"><a href="/checkout?utm_source=site" class="btn-cta">Получить навык · 1000 ₽</a></div>
<script src="/metrika.js" defer></script>
<script src="/site.js?v=${BUILD}" defer></script>
</body></html>`

// Якоря на H2: транслит-слаг из текста заголовка (marked@18 сам id не проставляет)
const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }
function headingId(text) {
  const plain = String(text).replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').toLowerCase()
  let s = ''
  for (const ch of plain) s += TRANSLIT[ch] !== undefined ? TRANSLIT[ch] : ch
  s = s.replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
  if (s.length > 60) s = s.slice(0, 60).replace(/-[a-z0-9]*$/, '')
  return s
}

function richBody(md) {
  let h = marked.parse(md)
  // id на каждый H2 + автооглавление перед первым H2 (когда разделов ≥5)
  const tocItems = []
  const seenIds = new Set()
  h = h.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner) => {
    let id = headingId(inner) || 'razdel'
    while (seenIds.has(id)) id += '-2'
    seenIds.add(id)
    tocItems.push({ id, inner })
    return `<h2 id="${id}">${inner}</h2>`
  })
  if (tocItems.length >= 5) {
    const toc = `<details class="art-toc" open><summary>Содержание</summary><ol>${tocItems.map((t) => `<li><a href="#${t.id}">${t.inner}</a></li>`).join('')}</ol></details>`
    h = h.replace('<h2 ', toc + '<h2 ')
  }
  h = h.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_m, body) => {
    let type = 'tip', ic = '💡'
    if (body.includes('⚠️')) { type = 'warn'; ic = '⚠️' }
    const inner = body.replace('💡', '').replace('⚠️', '').trim()
    return `<div class="callout c-${type}" data-reveal><span class="callout__ic">${ic}</span><div class="callout__bd">${inner}</div></div>`
  })
  // премиум-движение на визуальных блоках (не на тексте — читаемость не страдает)
  h = h.replace(/<figure>/g, '<figure data-reveal>')
  // таблицы — в горизонтально-прокручиваемую обёртку: широкие таблицы (сравнения) не рвут мобильную вёрстку
  h = h.replace(/<table>([\s\S]*?)<\/table>/g, '<div class="tbl-wrap" data-reveal><table>$1</table></div>')
  // SEO: голые URL-анкоры (автолинк marked, текст == href) -> читаемый хост; localhost — не ссылка вовсе
  h = h.replace(/<a href="(https?:\/\/[^"]+)"([^>]*)>\1<\/a>/g, (_m, url, attrs) => {
    try {
      const u = new URL(url)
      if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return '<code>' + url + '</code>'
      const label = u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname.replace(/\/$/, '') : '')
      return `<a href="${url}"${attrs}>${label.length > 48 ? u.hostname.replace(/^www\./, '') : label}</a>`
    } catch { return _m }
  })
  // Встроенная игра-змейка: маркер <!--GAME--> → премиум-блок (постер → iframe, поведение навешивает ArticleClient)
  h = h.replace(/(?:<p>)?\s*<!--\s*GAME\s*-->\s*(?:<\/p>)?/g, GAME_EMBED)
  return h
}

const GAME_EMBED = `<div class="sk-game" data-src="https://snake.skillmake.ru/" data-reveal>
  <div class="sk-game__poster">
    <img src="/land/snake-poster.webp" alt="Играть в змейку онлайн бесплатно" loading="lazy" width="720" height="960">
    <div class="sk-game__overlay">
      <button type="button" class="sk-game__play"><span class="sk-game__ic" aria-hidden="true">▶</span>Играть в змейку</button>
      <p class="sk-game__hint">Бесплатно, без регистрации · стрелки на ПК, свайпы на телефоне</p>
    </div>
  </div>
</div>`

function parseArticle(file) {
  const raw = readFileSync(join(ART_DIR, file), 'utf8')
  const m = raw.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/)
  const fm = {}, bodyMd = m ? m[2] : raw
  // снимаем обрамляющие YAML-кавычки: ведущая " рвала HTML-атрибут content="…"
  if (m) m[1].split('\n').forEach((line) => { const i = line.indexOf(':'); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '') })
  return { slug: basename(file, '.md'), fm, bodyMd }
}

const articles = existsSync(ART_DIR)
  ? readdirSync(ART_DIR).filter((f) => f.endsWith('.md') && !/^[А-ЯЁ]/.test(f)).map(parseArticle) // кириллические имена (ПРАВИЛА-…) — служебные, не статьи
  : []

// Посты из content/posts (рендерятся динамически роутом /posts/[slug]) — показываем карточками в /stati
const POSTS_DIR = join(process.cwd(), 'content', 'posts')
const posts = existsSync(POSTS_DIR)
  ? readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md')).map((file) => {
      const raw = readFileSync(join(POSTS_DIR, file), 'utf8')
      const m = raw.match(/^---\s*([\s\S]*?)\s*---/)
      const fm = {}
      if (m) m[1].split('\n').forEach((line) => { const i = line.indexOf(':'); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '') })
      return { slug: basename(file, '.md'), fm }
    })
  : []

const ctaBlock = `<section class="cta-card">
  <h2>Не просто статьи — тебя доведут до результата</h2>
  <p>В практикуме за 1000 ₽ рядом живая команда практикующих разработчиков и маркетологов: ведём по шагам до твоего работающего приложения. Не «ролики и сам разбирайся» — помогаем на каждом затыке.</p>
  <a class="btn-light" href="/kurs" data-goal="kurs_click" data-goal-params='{"place":"article_cta"}'>Перейти к практикуму <i class="ti ti-arrow-right"></i></a>
  <div class="cta-links"><a href="/account">Уже с нами? Вернуться в кабинет</a><span aria-hidden="true">·</span><a href="/subscribe" data-goal="subscribe_click" data-goal-params='{"place":"article_cta"}'>Не готов покупать — подпишись на новые разборы</a></div>
</section>`

// SEO: related-статьи — frontmatter related: slug1, slug2 … + fallback по пересечению слов заголовков
const STOP_WORDS = new Set('как что такое для в на и с по без из не то это чем от к у о при или же ли а но твоя твой свой первый простыми словами новичка новичку 2026'.split(' '))
const titleWords = (t) => new Set(String(t || '').toLowerCase().replace(/[^а-яёa-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w)))
function relatedFor(a, all) {
  const manual = String(a.fm.related || '').split(',').map((s) => s.trim()).filter(Boolean)
  const bySlug = new Map(all.map((x) => [x.slug, x]))
  const picked = manual.map((s) => bySlug.get(s)).filter(Boolean)
  if (picked.length < 3) {
    // score = title-слова (вес 3) + excerpt-слова (вес 1); тот же тег — бонус 2. Так статьи
    // без общих слов в заголовке (6 «пустых related») всё равно находят родственные.
    const mine = titleWords(a.fm.title)
    const mineEx = titleWords(a.fm.excerpt)
    const scored = all
      .filter((x) => x.slug !== a.slug && !picked.includes(x))
      .map((x) => {
        let s = 0
        const xt = titleWords(x.fm.title), xe = titleWords(x.fm.excerpt)
        for (const w of xt) { if (mine.has(w)) s += 3; else if (mineEx.has(w)) s += 1 }
        for (const w of xe) if (mine.has(w)) s += 1
        if (x.fm.tag && x.fm.tag === a.fm.tag) s += 2
        return { x, s }
      })
      .filter((r) => r.s > 0)
      .sort((r1, r2) => r2.s - r1.s)
    for (const r of scored) { if (picked.length >= 3) break; picked.push(r.x) }
    // гарантия: никогда не пусто — добираем статьями того же тега, затем любыми
    if (picked.length < 3) {
      const rest = all.filter((x) => x.slug !== a.slug && !picked.includes(x))
      const sameTag = rest.filter((x) => x.fm.tag === a.fm.tag)
      for (const x of [...sameTag, ...rest]) { if (picked.length >= 3) break; if (!picked.includes(x)) picked.push(x) }
    }
  }
  return picked.slice(0, 3)
}

// GEO/SEO: FAQPage JSON-LD из блока «## Частые вопросы» (формат: «### Вопрос?» + абзацы-ответ).
// Ответ приводим к плоскому тексту (markdown → HTML → текст) — самый безопасный вид для валидной разметки.
const mdToPlain = (md) => String(marked.parse(md))
  .replace(/<[^>]+>/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim()
function faqJsonLd(bodyMd) {
  // секция от «## Частые вопросы» до следующего H2 (или конца текста); без флага m — `$` это конец строки-целиком
  const sec = ('\n' + bodyMd).match(/\n## Частые вопросы[^\n]*\n([\s\S]*?)(?=\n## |$)/)
  if (!sec) return null
  const chunks = ('\n' + sec[1]).split(/\n### +/).slice(1) // [0] — преамбула до первого вопроса, отбрасываем
  const qa = []
  for (const chunk of chunks) {
    const nl = chunk.indexOf('\n')
    const q = (nl === -1 ? chunk : chunk.slice(0, nl)).trim()
    const a = nl === -1 ? '' : mdToPlain(chunk.slice(nl + 1))
    if (q && a) qa.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })
  }
  if (!qa.length) return null
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa }
}

const authorBlock = `<aside class="author-box" data-reveal>
  <div class="author-box__ava"><i class="ti ti-users-group"></i></div>
  <div>
    <div class="author-box__n">Команда skillmake</div>
    <p>Авторы <a href="/kurs">курса «Собери своё первое приложение с ИИ»</a>: практикующие разработчики и маркетологи. Всё, о чём пишем, проверено на нашей игре, отправленной в App Store, и на учениках курса.</p>
  </div>
</aside>`

// ── Тематические категории (frontmatter category:) — фильтр на /stati + свои посадочные /stati/<slug> ──
const CATEGORIES = [
  { slug: 'vibecoding', btn: 'Вайбкодинг', h1: 'Вайбкодинг и разработка', title: 'Вайбкодинг и разработка с ИИ — статьи для новичков', desc: 'Claude Code, промпты, Git и терминал: как писать приложения словами, без программирования. Статьи для новичков.', intro: 'Claude Code, промпты, Git, терминал и рабочие привычки, без которых ИИ-кодинг превращается в хаос. Эта подборка закрывает базу: от первого запуска до автотестов.' },
  { slug: 'tech', btn: 'Технологии', h1: 'Технологии и архитектура', title: 'Технологии и архитектура приложений — просто о сложном', desc: 'API, базы данных, авторизация и безопасность простыми словами: кирпичики, из которых собирается любое приложение.', intro: 'API, базы данных, авторизация, хранение и защита данных. Кирпичики, из которых собирается любое приложение, — объясняем без снобизма и на примерах.' },
  { slug: 'build', btn: 'Сборка приложений', h1: 'Сборка приложений', title: 'Сборка приложений с ИИ: пошаговые гайды', desc: 'Пошаговые гайды: игра-змейка, лендинг, мультиплеер, офлайн и PWA. Собираем реальные проекты с ИИ от идеи до работающей ссылки.', intro: 'Пошаговые гайды по реальным проектам: от игры-змейки и лендинга до мультиплеера и PWA. Каждый можно повторить, даже если это твой первый проект.' },
  { slug: 'product', btn: 'Идея и продукт', h1: 'Идея и продукт', title: 'Идея и продукт: как придумать и проверить приложение', desc: 'Где брать идеи приложений, как проверить спрос без кода и выбрать бизнес-модель — до того, как потратишь месяцы на разработку.', intro: 'Где брать идеи, как проверить спрос до разработки и выбрать бизнес-модель. Эти статьи экономят месяцы: сначала проверка, потом код.' },
  { slug: 'publish', btn: 'Публикация', h1: 'Публикация и продвижение', title: 'Публикация и продвижение приложений: сторы, ASO, пользователи', desc: 'App Store, Google Play, RuStore и Telegram: как опубликовать приложение из России и привести первых пользователей.', intro: 'App Store, Google Play, RuStore, Telegram Mini Apps — и что делать после релиза: ASO, отзывы, продвижение. Отдельно разбираем публикацию из России.' },
  { slug: 'monetize', btn: 'Деньги и право', h1: 'Деньги и право', title: 'Монетизация и право для владельца приложения', desc: 'Монетизация, приём платежей, юнит-экономика и 152-ФЗ: сколько зарабатывают приложения и какие документы нужны владельцу.', intro: 'Подписки, реклама, приём платежей, юнит-экономика — и юридическая часть: 152-ФЗ, политика конфиденциальности, cookie. Всё про деньги и документы.' },
]
const catBySlug = new Map(CATEGORIES.map((c) => [c.slug, c]))
const catCount = new Map(CATEGORIES.map((c) => [c.slug, articles.filter((x) => x.fm.category === c.slug).length]))

for (const a of articles) {
  const { slug, fm, bodyMd } = a
  const rel = relatedFor(a, articles)
  const relBlock = rel.length
    ? `<section class="rel-wrap" data-reveal><div class="rel-head"><h2 class="rel-h">Читай дальше</h2><a class="rel-all" href="/stati">Все статьи <i class="ti ti-arrow-right"></i></a></div><div class="rel-grid">${rel
        .map((r) => `<a class="art-card" href="/articles/${r.slug}" data-goal="related_click" data-goal-params='{"slug":"${r.slug}"}'><span class="tag">${esc(r.fm.tag || 'Статья')}</span><h3>${esc(r.fm.title)}</h3><div class="meta"><span><i class="ti ti-clock"></i>${esc(r.fm.read || '5 мин')}</span><span class="go">Читать <i class="ti ti-arrow-right"></i></span></div></a>`)
        .join('')}</div></section>`
    : ''
  const ogPngFile = join(PUB, 'articles', 'img', `og-${slug}.png`)
  const ogPng = existsSync(ogPngFile) ? `/articles/img/og-${slug}.png` : null
  // dateModified — реальная дата правки .md (сигнал свежести для поиска/ИИ); не раньше публикации
  let dateModified
  try { dateModified = statSync(join(ART_DIR, slug + '.md')).mtime.toISOString().slice(0, 10) } catch {}
  if (fm.date && dateModified && dateModified < fm.date) dateModified = fm.date
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    description: trimDesc(fm.excerpt || fm.title),
    datePublished: fm.date || undefined,
    ...(dateModified ? { dateModified } : {}),
    ...(ogPng ? { image: SITE_URL + ogPng } : {}),
    author: { '@type': 'Organization', name: 'Команда skillmake', url: SITE_URL + '/kurs' },
    publisher: { '@type': 'Organization', name: 'skillmake', url: SITE_URL },
    mainEntityOfPage: SITE_URL + `/articles/${slug}`,
  }
  // GEO: если в статье есть блок «## Частые вопросы» — добавляем FAQPage вторым элементом JSON-LD-массива
  const faqLd = faqJsonLd(bodyMd)
  // Хлебные крошки: Статьи → Категория → Статья (перелинковка с посадочной категории + BreadcrumbList)
  const cat = catBySlug.get(fm.category)
  const crumbLd = cat
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Статьи', item: SITE_URL + '/stati' },
          { '@type': 'ListItem', position: 2, name: cat.h1, item: SITE_URL + `/stati/${cat.slug}` },
          { '@type': 'ListItem', position: 3, name: fm.title },
        ],
      }
    : null
  // Инлайн-CTA в середину длинных статей: мобильные читатели часто не доходят до финального CTA
  const midCta = `<aside class="art-mid-cta" data-reveal><p>Читаешь, как это делается? В практикуме skillmake ты собираешь своё первое приложение руками — команда рядом на каждом шаге. <a href="/kurs" data-goal="kurs_click" data-goal-params='{"place":"article_mid"}'>Посмотреть программу →</a></p></aside>`
  const withMidCta = (html) => {
    const parts = html.split(/(?=<h2)/)
    if (parts.length < 6) return html // короткие статьи не трогаем
    const mid = Math.ceil(parts.length / 2)
    parts.splice(mid, 0, midCta)
    return parts.join('')
  }
  const body = `
${cat ? `<nav class="crumbs" aria-label="Хлебные крошки"><a href="/stati">Статьи</a><span aria-hidden="true">·</span><a href="/stati/${cat.slug}">${esc(cat.h1)}</a></nav>` : ''}
<header class="art-hero">
  ${cat ? `<a class="tag" href="/stati/${cat.slug}">${esc(cat.btn)}</a>` : `<span class="tag">${esc(fm.tag || 'Статья')}</span>`}
  <h1>${esc(fm.title)}</h1>
  <div class="amt"><span><i class="ti ti-clock"></i>${esc(fm.read || '5 мин')}</span><span><i class="ti ti-calendar"></i>Актуально на <span data-fresh="${slug}">${esc(ruDate(fm.updated || fm.date))}</span></span></div>
</header>
<article class="article">
  ${withMidCta(richBody(bodyMd))}
  ${authorBlock}
  ${relBlock}
  ${ctaBlock}
  <a class="back" href="/stati"><i class="ti ti-arrow-left"></i>Все статьи</a>${cat ? ` <a class="back" href="/stati/${cat.slug}">Ещё: ${esc(cat.h1.toLowerCase())}</a>` : ''}
</article>`
  // бренд-суффикс « — skillmake» добавляем ТОЛЬКО если общий <title> остаётся ≤66 симв,
  // иначе ключ в заголовке обрезается в выдаче
  const t0 = smartTitle(fm.seoTitle || fm.title)
  const pageTitle = (t0.length + 12 <= 66) ? t0 + ' — skillmake' : t0
  writeFileSync(join(CONTENT_ART, slug + '.html'),
    shell({ title: pageTitle, desc: trimDesc(fm.seoDescription || fm.excerpt || fm.title), active: 'stati', body, path: `/articles/${slug}`, ogType: 'article', ogImage: ogPng, jsonLd: [jsonLd, ...(crumbLd ? [crumbLd] : []), ...(faqLd ? [faqLd] : [])] }), 'utf8')
}

const soon = [
  { tag: 'Разбор', title: 'Как ИИ пишет код: что происходит внутри Claude Code' },
  { tag: 'Гайд', title: 'Как опубликовать своё приложение в интернете' },
  { tag: 'Разбор', title: 'Сколько стоит набор инструментов: считаем расходы новичка' },
]

// «Сначала сюда» — входные статьи для новичка (бейдж на карточке)
const FEATURED = new Set(['chto-takoe-vaibkoding', 'chto-takoe-claude-code', '10-oshibok-novichkov-vibecoding', 'ideya-v-dohod-za-90-dney'])

// Карточка: пилюля = ТЕМАТИЧЕСКАЯ категория со своим цветом (жанровый тег не помогал выбирать),
// дата — сигнал свежести для ИИ-тематики; featured («Сначала сюда») — широкая карточка с кантом.
const articleCard = (a) => {
  const cat = catBySlug.get(a.fm.category)
  const f = FEATURED.has(a.slug)
  return `<a class="art-card${f ? ' art-card--f' : ''}${cat ? ' tc-' + cat.slug : ''}" data-reveal href="/articles/${a.slug}" data-cat="${esc(a.fm.category || '')}" data-t="${esc((a.fm.title || '').toLowerCase())}" data-x="${esc((a.fm.excerpt || '').toLowerCase())}">
    ${f ? '<span class="startb"><i class="ti ti-rocket"></i>Сначала сюда</span>' : ''}<span class="tag">${esc(cat ? cat.btn : (a.fm.tag || 'Статья'))}</span>
    <h2>${esc(a.fm.title)}</h2>
    <p>${esc(a.fm.excerpt || '')}</p>
    <div class="meta"><span><i class="ti ti-clock"></i>${esc(a.fm.read || '5 мин')}</span><span><i class="ti ti-calendar"></i>Актуально на <span data-fresh="${a.slug}">${esc(ruDate(a.fm.updated || a.fm.date))}</span></span><span class="go">Читать <i class="ti ti-arrow-right"></i></span></div>
  </a>`
}
// «Сначала сюда» — в начало списка (алфавит по slug читатель принимал за приоритет)
const byFeatured = (a, b) => (FEATURED.has(b.slug) ? 1 : 0) - (FEATURED.has(a.slug) ? 1 : 0)

// Врезки в сетку /stati (grid-note скрываются при активном фильтре/поиске — см. site.js)
const subInline = `<div class="grid-note sub-inline" data-reveal>
    <div><h3>Новые разборы — на почту</h3><p>Свежие статьи о создании приложений с ИИ. Без спама, отписка в один клик.</p></div>
    <a class="btn-cta" href="/subscribe" data-goal="subscribe_click" data-goal-params='{"place":"stati_list"}'>Подписаться</a>
  </div>`
const kursInline = `<div class="grid-note kurs-inline" data-reveal>
    <p>Освоил теорию? В практикуме доводим до работающего приложения — с живой командой рядом. <a href="/kurs" data-goal="kurs_click" data-goal-params='{"place":"stati_list"}'>Открыть курс →</a></p>
  </div>`

const otherCards = [
  ...posts.map((p) => `<a class="art-card" data-reveal href="/posts/${p.slug}" data-cat="" data-t="${esc((p.fm.title || '').toLowerCase())}" data-x="${esc((p.fm.excerpt || '').toLowerCase())}">
    <span class="tag">${esc(p.fm.tag || 'Статья')}</span>
    <h2>${esc(p.fm.title)}</h2>
    <p>${esc(p.fm.excerpt || '')}</p>
    <div class="meta"><span><i class="ti ti-clock"></i>${esc(p.fm.read || '8 мин')}</span><span class="go">Читать <i class="ti ti-arrow-right"></i></span></div>
  </a>`),
  ...soon.map((s) => `<div class="art-card soon" data-reveal data-cat="" data-t="${esc(s.title.toLowerCase())}" data-x="">
    <span class="tag">${esc(s.tag)}</span>
    <h2>${esc(s.title)}</h2>
    <p>Готовим разбор — скоро опубликуем.</p>
    <div class="soonb">Скоро</div>
  </div>`),
]

// Чипы категорий: настоящие ссылки на посадочные (SEO), на /stati кликом перехватывает JS (мгновенный фильтр)
const chipsRow = (activeSlug) => `<div class="art-filters-wrap"><div class="art-filters" aria-label="Категории статей">
    <a class="art-chip${!activeSlug ? ' is-active' : ''}" href="/stati" data-cat=""${!activeSlug ? ' aria-current="page"' : ''} data-goal="art_chip" data-goal-params='{"cat":"all"}'>Все статьи <span class="cnt">${articles.length}</span></a>
    ${CATEGORIES.map((c) => `<a class="art-chip${activeSlug === c.slug ? ' is-active' : ''}" href="/stati/${c.slug}" data-cat="${c.slug}"${activeSlug === c.slug ? ' aria-current="page"' : ''} data-goal="art_chip" data-goal-params='{"cat":"${c.slug}"}'>${esc(c.btn)} <span class="cnt">${catCount.get(c.slug)}</span></a>`).join('\n    ')}
  </div></div>`

const searchRow = `<div class="art-search">
    <svg class="art-search__ic" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input type="search" id="artSearch" class="art-search__input" placeholder="Например: публикация в App Store" aria-label="Поиск по статьям" autocomplete="off">
    <button type="button" class="art-search__clear" aria-label="Очистить поиск" hidden><i class="ti ti-x"></i></button>
  </div>
  <p id="artStatus" class="art-status" role="status" aria-live="polite"></p>`

const emptyBlock = `<div class="art-empty" id="artEmpty" hidden>
    <span class="ic"><i class="ti ti-mood-empty"></i></span>
    <h3>Ничего не нашли</h3>
    <p>Попробуй короче — одно слово — или выбери другую категорию.</p>
    <button type="button" class="art-chip" id="artReset">Сбросить поиск</button>
  </div>`

// CollectionPage + ItemList (GEO/SEO): чем «богаче» описана подборка, тем понятнее она роботам
const collectionLd = (cat, list) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: cat ? cat.title : 'Статьи о создании приложений с ИИ',
  url: SITE_URL + (cat ? `/stati/${cat.slug}` : '/stati'),
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: list.length,
    itemListElement: list.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + `/articles/${a.slug}` })),
  },
})
const crumbsLd = (cat) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Статьи', item: SITE_URL + '/stati' },
    { '@type': 'ListItem', position: 2, name: cat.h1, item: SITE_URL + `/stati/${cat.slug}` },
  ],
})

// ── /stati (все категории, клиентский фильтр) ──
writeFileSync(join(PUB, 'stati.html'), shell({
  title: 'Статьи о создании приложений с ИИ — skillmake',
  desc: 'Разборы и объяснялки: как создавать приложения с ИИ без кода, вайбкодинг, инструменты и заработок.',
  active: 'stati',
  path: '/stati',
  jsonLd: collectionLd(null, articles),
  body: `<section class="phero"><span class="phero-blob"></span><div class="phero-in">
    <span class="kick">Статьи и разборы</span>
    <h1>Как создавать приложения <em>с ИИ</em> — без кода</h1>
    <p class="sub">Объясняем простыми словами: что такое вайбкодинг, какие инструменты нужны, как обойти барьеры из России и зарабатывать на своих приложениях.</p>
  </div></section>
  <div class="art-tools" data-active="">
  ${chipsRow('')}
  ${searchRow}
  </div>
  <section class="arts">${(() => {
    const items = [...[...articles].sort(byFeatured).map(articleCard), ...otherCards]
    items.splice(8, 0, subInline)   // врезка подписки после ~2 экранов карточек
    items.splice(27, 0, kursInline) // лёгкий мостик к курсу глубже по списку
    return items.join('\n')
  })()}</section>
  <div class="arts-more"><button type="button" class="art-chip" id="artMore" hidden>Показать ещё</button></div>
  ${emptyBlock}
  <div style="max-width:1140px;margin:0 auto;padding:0 26px 84px">${ctaBlock}</div>`,
}), 'utf8')

// ── посадочные категорий /stati/<slug> (свои title/H1/интро — индексируются отдельно) ──
if (!existsSync(join(PUB, 'stati'))) mkdirSync(join(PUB, 'stati'), { recursive: true })
for (const cat of CATEGORIES) {
  const list = articles.filter((a) => a.fm.category === cat.slug).sort(byFeatured)
  writeFileSync(join(PUB, 'stati', cat.slug + '.html'), shell({
    title: (cat.title.length + 12 <= 66) ? cat.title + ' — skillmake' : cat.title,
    desc: cat.desc,
    active: 'stati',
    path: `/stati/${cat.slug}`,
    jsonLd: [collectionLd(cat, list), crumbsLd(cat)],
    body: `<section class="phero"><span class="phero-blob"></span><div class="phero-in">
    <span class="kick"><a href="/stati" style="color:inherit">Статьи</a> · ${esc(cat.h1)}</span>
    <h1>${esc(cat.h1)}</h1>
    <p class="sub">${esc(cat.intro)}</p>
  </div></section>
  <div class="art-tools" data-active="${cat.slug}">
  ${chipsRow(cat.slug)}
  ${searchRow}
  </div>
  <section class="arts">${list.map(articleCard).join('\n')}</section>
  ${emptyBlock}
  <div style="max-width:1140px;margin:0 auto;padding:0 26px 84px">${ctaBlock}</div>`,
  }), 'utf8')
}
console.log('built: 6 страниц категорий (/stati/<slug>): ' + CATEGORIES.map((c) => `${c.slug}=${catCount.get(c.slug)}`).join(', '))

// ── sitemap.xml: публичные страницы + статьи + посты ──
const today = new Date().toISOString().slice(0, 10)
// SEO: без `/` (редирект) и /posts (noindex); lastmod — реальная дата правки исходника
const mdDate = (file) => { try { return statSync(join(ART_DIR, file)).mtime.toISOString().slice(0, 10) } catch { return today } }
const smUrls = [
  { loc: '/kurs', priority: '1.0', lastmod: today },
  { loc: '/stati', priority: '0.8', lastmod: today },
  { loc: '/vaibkodery', priority: '0.7', lastmod: today },
  // посадочные категорий: lastmod = самая свежая статья категории
  ...CATEGORIES.map((c) => ({
    loc: `/stati/${c.slug}`,
    priority: '0.75',
    lastmod: articles.filter((a) => a.fm.category === c.slug).map((a) => mdDate(a.slug + '.md')).sort().pop() || today,
  })),
  ...articles.map((a) => ({ loc: `/articles/${a.slug}`, priority: '0.7', lastmod: mdDate(a.slug + '.md') })),
]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${smUrls.map((u) => `  <url><loc>${SITE_URL}${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`
writeFileSync(join(PUB, 'sitemap.xml'), sitemap, 'utf8')

writeFileSync(join(PUB, 'resheniya.html'), shell({
  title: 'Решения — skillmake',
  desc: 'Готовые приложения, шаблоны и решения для авторов — раздел в разработке.',
  active: 'resheniya',
  noindex: true,
  body: `<section class="phero"><span class="phero-blob"></span><div class="phero-in">
    <span class="kick">Решения</span>
    <h1>Готовые приложения и шаблоны</h1>
    <p class="sub">Раздел для авторов: библиотека готовых решений, шаблонов и наработок, которые ускоряют сборку твоих приложений.</p>
  </div></section>
  <section class="soon-wrap">
    <span class="soon-badge"><i class="ti ti-tools"></i>Раздел в разработке</span>
    <div class="soon-list">
      <div class="soon-item" data-reveal><span class="ic"><i class="ti ti-template"></i></span><div><h3>Шаблоны приложений</h3><p>Готовые заготовки игр и утилит — берёшь, меняешь под себя, собираешь быстрее.</p></div></div>
      <div class="soon-item" data-reveal><span class="ic"><i class="ti ti-bolt"></i></span><div><h3>Готовые промпты</h3><p>Проверенные формулировки задач для ИИ — те, что сработали у нас.</p></div></div>
      <div class="soon-item" data-reveal><span class="ic"><i class="ti ti-rocket"></i></span><div><h3>Кейсы запусков</h3><p>Разборы реальных приложений: что собрали, как продвинули, что заработали.</p></div></div>
    </div>
    ${ctaBlock}
  </section>`,
}), 'utf8')

const faqCount = articles.filter((a) => faqJsonLd(a.bodyMd)).length
console.log('built: stati.html + resheniya.html + ' + articles.length + ' статей, из них с FAQPage JSON-LD: ' + faqCount + ' (' + articles.map((a) => a.slug).join(', ') + ')')
