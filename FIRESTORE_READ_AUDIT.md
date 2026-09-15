# 🔍 FIRESTORE READ AUDIT — RAMSEES

> **نطاق التدقيق:** قراءة فقط. لم يُعدَّل أي ملف أو يُحذف أي query أو يحدث refactor. كل ما يلي توصيف + تحليل + اقتراحات (غير مطبَّقة).
> **تاريخ التدقيق:** 2026-09-11 · كل `file:line` تم التحقق منه يدويًا من الكود الحالي في HEAD.
> **قاعدة الفوترة:** Firestore يفرض قراءة واحدة لكل مستند يُعاد (`getDoc` = 1؛ `getDocs`/query = قراءة لكل مستند مطابق بحد أدنى 1). الـ Network/API requests (REST/WS نحو Binance/CoinGecko/HTX/Deribit/FRED/Yahoo…) ليست قراءات Firestore ولا تُحسب هنا.
> **كل الأرقام الكمية في الأقسام 12–14 و18 هي تقديرات مبنية على افتراضات صريحة، وليست أرقامًا من Firebase Console ولا من بوابة الاستخدام الفعلي.**

---

## 1) الحصر الشامل لكل قراءات Firestore

### 1.1 خريطة المجموعات

| المسار | جهة القراءة | النوع |
|---|---|---|
| `users/{uid}/portfolio/meta` | Client SDK + Admin | getDoc |
| `users/{uid}/portfolio/ledger/transactions` | Client SDK | getDocs / orderBy / startAfter |
| `users/{uid}/portfolio/main/accounts/{accountId}/{balances,positions,openOrders,transactions,trades,snapshots,reconciliation,exchangeCredentials,syncJobs}` | Admin SDK | get / where / orderBy / limit / in |
| `users/{uid}/goals/progress` | Client SDK | getDoc |
| `users/{uid}/goldenTarget/progress` | Client SDK | getDoc |
| `users/{uid}/strategies` | Client SDK | getDocs (بلا limit) |
| `users/{uid}/strategyNumbers` | Client SDK | getDocs (بلا limit) |
| `users/{uid}/strategyScenarios` | Client SDK | getDocs (بلا limit) |
| `validationRuns/{runId}` + `decisions/` + `metrics/latest` | Client SDK | getDocs / getDoc |
| `featureResearchRuns/{runId}` + `features/{key}` | Client SDK | getDocs / getDoc |
| `users` / `goldenTargets` / `bitcoin` (ثوابت `COLLECTIONS`) | Client SDK | **غير مستخدمة** (dead wrapper) |

### 1.2 نقاط القراءة الفعلية — Client SDK (18)

| # | الملف:السطر | الدالة | الوصف |
|---|---|---|---|
| C1 | `src/lib/firebase/firestore.ts:29` | `getDocument` | wrapper عام — **لا يستورده أي ملف (dead)** |
| C2 | `src/lib/firebase/firestore.ts:45` | `getCollection` | wrapper عام — **غير مستخدم (dead)** |
| C3 | `src/features/goals/services/goals.service.ts:89` | `getProgress` | getDoc `goals/progress` |
| C4 | `src/features/golden-target/services/golden-target.service.ts:62` | `getProgress` | getDoc `goldenTarget/progress` |
| C5 | `src/features/strategy/services/strategy-numbers.service.ts:23` | `list` | getDocs `strategyNumbers` (بلا limit) |
| C6 | `src/features/strategy/services/scenarios.service.ts:21` | `list` | getDocs `strategyScenarios` (بلا limit) |
| C7 | `src/features/decision/services/strategies.service.ts:22` | `list` | getDocs `strategies` (بلا limit) |
| C8 | `src/features/portfolio/services/portfolio.service.ts:395` | `fetchSummary` | getDoc `portfolio/meta` |
| C9 | `src/features/portfolio/services/portfolio.service.ts:405` | `fetchTransactionsPage` | getDocs `ledger/transactions` limit 100 |
| C10 | `src/features/portfolio/services/portfolio.service.ts:423` | `loadOlder` | getDocs + startAfter (صفحة أقدم) |
| C11 | `src/features/portfolio/services/portfolio.service.ts:447` | `refreshMeta` | حلقة getDocs limit 1000 (ترحيل/analytics، ليست UI) |
| C12 | `src/features/scalping/testing/services/firestore.ts:93` | `listValidationRuns` | getDocs `validationRuns` limit (يُستدعى بـ max=50) |
| C13 | `src/features/scalping/testing/services/firestore.ts:118` | `getValidationRun` | getDoc — **لا يُستدعى من UI** |
| C14 | `src/features/scalping/testing/services/firestore.ts:130` | `getValidationMetrics` | getDoc `…/metrics/latest` |
| C15 | `src/features/scalping/testing/services/firestore.ts:141` | `getValidationDecisions` | getDocs بلا limit — **لا يُستدعى من UI** |
| C16 | `src/features/scalping/testing/services/firestoreResearch.ts:101` | `listResearchRuns` | getDocs limit 100 (يُستدعى بلا قيمة) |
| C17 | `src/features/scalping/testing/services/firestoreResearch.ts:116` | `getResearchRun` | getDoc عند النقر على run |
| C18 | `src/features/scalping/testing/services/firestoreResearch.ts:130` | `getResearchFeature` | getDoc `…/features/{key}` — **لا يُستدعى من UI** |

### 1.3 نقاط القراءة الفعلية — Server SDK / Admin (18)

| # | الملف:السطر | الدالة | الوصف |
|---|---|---|---|
| S1 | `src/server/portfolio/portfolioDb.ts:56` | `getCredential` | getDoc credential |
| S2 | `src/server/portfolio/portfolioDb.ts:61` | `getCredentialByAccount` | query `where accountId==`.limit(1) |
| S3 | `src/server/portfolio/portfolioDb.ts:77` | `getAccount` | getDoc account (قلب الـ ownership) |
| S4 | `src/server/portfolio/portfolioDb.ts:82` | `listAccounts` | query `where disabledAt==null` |
| S5 | `src/server/portfolio/portfolioDb.ts:87` | `listAllAccountsIncludingDisabled` | get() كامل — لا يُستدعى من المسارات الحية |
| S6 | `src/server/portfolio/portfolioDb.ts:110` | `getPortfolioMeta` | getDoc `portfolio/meta` |
| S7 | `src/server/portfolio/portfolioDb.ts:199` | `getBalances` | get() كامل الأرصدة |
| S8 | `src/server/portfolio/portfolioDb.ts:236` | `upsertLedger` | query `where("id","in",ids)` — شُرَائح 30/30 |
| S9 | `src/server/portfolio/portfolioDb.ts:262` | `replacePositions` | get() كامل الموجودة (لحذف الزائد) |
| S10 | `src/server/portfolio/portfolioDb.ts:277` | `replaceOpenOrders` | get() كامل (نفس الغرض) |
| S11 | `src/server/portfolio/portfolioDb.ts:299` | `getSnapshots` | query orderBy/where/limit asc |
| S12 | `src/server/portfolio/portfolioDb.ts:313` | `listReconciliationEvents` | query orderBy desc limit |
| S13 | `src/server/portfolio/portfolioDb.ts:358` | `getRunningSync` | query `where status=="RUNNING"`.limit(1) (قفل الـ sync) |
| S14 | `src/server/portfolio/portfolioDb.ts:165,170` | `deleteManualPortfolio` | listCollections + listDocuments (ترحيل عند الاستبدال) |
| S15 | `src/server/portfolio/queries.ts:13` | `getPositions` | get() كامل |
| S16 | `src/server/portfolio/queries.ts:18` | `getOpenOrders` | get() كامل |
| S17 | `src/server/portfolio/queries.ts:31` | `getTransactions` | query orderBy desc limit (افتراضي 100 / حتى 500) |
| S18 | `src/server/portfolio/queries.ts:45` | `getTrades` | query orderBy desc limit (افتراضي 100 / حتى 500) |

**لا يوجد أي `collectionGroup` / `getCountFromServer` / `onSnapshot` حقيقي في كامل `src`.** (حُصّر: `flow/engine.ts:217` و`options/provider.ts:79` نوابض محلية بأسماء محظوظة، وليست listeners Firestore.)

---

## 2) تفاصيل كل مصدر (call chain → المسار → التكرار → التكلفة)

### Client (Web SDK)

| المصدر | السلسلة | المدة/التكرار | التكلفة (قراءة مستند) |
|---|---|---|---|
| Boot warm-up | `ProtectedRoute → useBootDataWarmup → warmupCriticalData → {portfolioService.fetchSummary, scenariosService.list, strategyNumbersService.list, goalsService.getProgress, goldenTargetService.getProgress}` | مرة واحدة عند كل تحميل تطبيق (mount لـ `ProtectedRoute`) | meta(1) + scenarios(N) + strategyNumbers(N) + goals(1) + golden(1) |
| Header strategy menu | `DashboardShell → Header → StrategyMenu → useStrategyNumbers() → list` | مرة لكل mount لـ shell (كل تحميل صفحة كامل/رفش) | N strategyNumbers |
| Dashboard home | `WalletSnippet → usePortfolio(withTransactions:false)` | mount للصفحة | meta(1) |
| Dashboard home | `GoalsSnippet → useGoals → usePortfolio() [افتراضي withTransactions:true]` | mount للصفحة | **meta(1) + transactions(100)** — القراءة الـ100 لا تُستخدم إطلاقًا في goals (تُستخدم meta فقط) |
| Dashboard home | `GoalsSnippet → useGoals → goalsService.getProgress` | mount | goals(1) |
| Dashboard home | `StrategySnippet → useStrategyNumbers → list` | mount | N |
| `/portfolio` | `PortfolioPage → usePortfolio() → fetchSummary + fetchTransactionsPage(100)` + `loadOlder` عند الزر | mount + زر | meta(1)+tx(100) ثم +100 لكل صفحة أقدم |
| `/operations` | `page → usePortfolio({withTransactions:false})` | mount | meta(1) |
| `/goals` | `page → useGoals → usePortfolio() + getProgress` | mount | meta(1)+tx(100)+goals(1) |
| `/golden-target` | `page/GoldenTargetSnippet → useGoldenTarget → getProgress` | mount | golden(1) |
| `/strategy/numbers` | `NumbersPage → useStrategyNumbers → list` | mount | N |
| `/strategy/risk-calculator` | `CalculatorPage → useStrategyNumbers + useScenarios + usePortfolio()` | mount | N + N + meta(1)+tx(100) |
| `/decision-center` | `DecisionPage → useDecisionCenter → useStrategies → list` | mount | M strategies |
| `/scalping/testing` | `ValidationDashboard (مثبّت افتراضيًا) → listValidationRuns(50)` ثم `getValidationMetrics` (baseline + top 8) | mount + بعد finalize | حتى 50 + حتى 9 |
| `/scalping/testing/research` | `ValidationFeatureLab → useFeatureResearch → listResearchRuns()` + `getResearchRun` عند النقر | mount + click | حتى 100 + 1 عند كل click |

> ملاحظة: كل `useEffect` بالمصدر أعلاه يعتمد على `userId` فقط ⇒ يُنفَّذ **مرة على كل mount**؛ وفي App Router كل تنقّل إلى صفحة يُعيد mount نُصُب الصفحة ⇒ **إعادة قراءة كاملة**. لا توجد keys للـ de-dupe ولا cache مشترك (لا React Query ولا SWR).

### Server (Admin SDK) — يُستدعى عبر مسارات REST فقط

| المسار | الدالة المقرؤة (بالإضافة إلى `getAccount` عبر `requireOwnedAccount`) | التكلفة لكل استدعاء |
|---|---|---|
| `GET /api/portfolio/exchanges` | `listAccounts` (S4) | بعدد الحسابات المفعلة |
| `GET /api/portfolio/exchanges/[id]` | `buildAccountDetailBody` → 8 queries بالتوازي: `getBalances` S7، `getPositions` S15، `getOpenOrders` S16، `getTransactions` S17 (limit≤500)، `getTrades` S18، `getRunningSync` S13، `getSnapshots` S11، `listReconciliationEvents` S12 | B+P+O+T+R+1+S+K مستند تقريبًا |
| `POST …/[id]/refresh` | `requireOwnedAccount` S3 + `syncNow` (انظر جدول sync) + `buildAccountDetailBody` مجددًا | أعلى نقطة تكلفة انفرادية (راجع 12/14) |
| `GET …/[id]/sync` | `getRunningSync` S13 + `getSnapshots(limit1)` S11 | 2 |
| `POST …/[id]/sync` | `getRunningSync` S13 (+ إن `inProgress` → `getPortfolioMeta` S6) ثم متابعة خلفية | 2–3 + عمل خلفي |
| `POST …/[id]/live-session` | `getAccount` S3 + `getCredentialByAccount` S2 | 2 |
| `POST …/[id]/live-session/keepalive` | `getAccount` S3 + `getCredentialByAccount` S2 | **2 كل 25 دقيقة أثناء البث** |
| `GET …/[id]/live-state` | `getAccount` S3 + `getCredentialByAccount` S2 | 2 (أحداث إعادة الاتصال/إجراء مستخدم) |
| `POST /api/portfolio/exchanges` (connect) | `getPortfolioMeta` S6 + (إن replace) `deleteManualPortfolio` S14 + INITIAL sync خلفي | مرتفع مرة واحدة |

### التكلفة الداخلية للـ `syncNow` (S داخلي عند كل refresh/sync)

| الخطوة | القراءة |
|---|---|
| `getAccount` + `getCredentialByAccount` + `getRunningSync` | 3 |
| `upsertLedger` (S8) | query `where in` لكل شريحة 30 من العناصر الجديدة (مطابقة المستندات الموجودة فقط) |
| `recomputeFinancials` | `getTransactions(limit 1000)` S17 + `getTrades(limit 1000)` S18 ⇒ **حتى 2000 مستند في كل sync** (تصميم متعمّد لإعادة الحساب من كامل الدفتر) |
| `getBalances` S7 | B (أرصدة الأصول) |
| ثم `buildAccountDetailBody` الكامل | 8 queries إضافية (عند `refresh` تحديدًا) |

---

## 3) القراءات المخفية (خلف الـ abstractions)

1. **`useGoals → usePortfolio()`**: استدعاء غير مقصود بمعناه الحقيقي؛ القراءة الـ100 للـ transactions مخفية تمامًا خلف hook "الأهداف" ولا يستخدمها الأهداف إطلاقًا (يستخدم `meta` فقط). **أعلى هدر في الكود.**
2. **`StrategyMenu` في الهيدر** يقرأ `strategyNumbers` سرًّا على **كل** صفحة من صفحات الـ Dashboard (وليس على صفحة الاستراتيجيات فقط) ⇒ قراءة عامة مخفية لكل الشاشات.
3. **Boot warm-up**: يقرأ 5 مجلدات ثم **يُرمي النتائج** (لا تنتقل أسفلًا)؛ كل صفحة تعيد قراءتها لاحقًا ⇒ القراءات "المخفية" مزدوجة الثمن.
4. **`requireOwnedAccount`** يقرأ `getAccount` في كل مسار قبل أي عمل ⇒ كل REST call يحمل ≥ 1 قراءة خفية (لا تُرى في الـ route).
5. **`listValidationRuns(50)` + `getValidationMetrics(≤9)`** تُحمَّل تلقائيًا لأن `ValidationDashboard` مُثبَّت افتراضيًا حتى عندما يريد المستخدم رؤية لوحة التشغيل فقط.
6. **الصفحات بدون limit**: `strategies.list` / `strategyNumbers.list` / `scenarios.list` / `getValidationDecisions` لا تضع `limit` ⇒ القراءة تتناسب طرديًا مع حجم مستندات المستخدم.

---

## 4) القراءات المكررة (DUPLICATES) مع الأولوية

| # | التكرار | السياق | الوصف | الأولوية |
|---|---|---|---|---|
| D1 | **من 2 إلى 3 مرات** | أول رسم للـ Dashboard | نفس مستند `portfolio/meta` يُقرأ: (1) Boot warm-up، (2) `WalletSnippet`، (3) `useGoals` الداخلي ⇒ 2–3 reads لنفس الـ doc في نفس اللوحة | **HIGH** |
| D2 | مرتان | أول رسم للـ Dashboard | `strategyNumbers` يُقرأ: الهيدر `StrategyMenu` + `StrategySnippet` (وزيادة ثالثة من boot warm-up) | **HIGH** |
| D3 | مرتان | `/goals` و`/dashboard` (GoalsSnippet) | نفس الـ flows: boot(y goals) + useGoals… وبينما boot فعلها مرة على التحميل | **MEDIUM** |
| D4 | مرات عديدة | التنقّل بين الصفحات | لا يوجد cache مشترك؛ العودة إلى أي صفحة تُعيد read كامل (useEffect يعتمد على `userId`) | **HIGH** (نظامي) |
| D5 | مرتان | `/refresh` | `syncNow` يقرأ `getTransactions/getTrades(1000)` إعArabic ثم `buildAccountDetailBody` يقرأ `getTransactions/getTrades(limit)` مجددًا في نفس الاستجابة | **MEDIUM** |
| D6 | مرتان | صفحة research بعد كل run | `listResearchRuns()` يشتغل على mount وبعد `finalize` | **LOW** |

---

## 5) تدقيق الـ Realtime Listeners (onSnapshot)

- **العدد الإجمالي: 0**. لا يوجد أي `onSnapshot` من `firebase/firestore` في كامل `src` (البحث الشامل رجع 22 تطابقًا كلها أسماء/نوابع محلية: `DecisionSnapshot`، `optionsProvider.onSnapshot(cb)`، `flow.engine.onSnapshot`).
- محرك البيانات الحية (Binance WS/REST، Deribit، HTX، KuCoin، /api/market-influence) يعمل كليًا على **REST/WS خارجي** بلا لمسة Firestore (مؤكد لكل ملفات `features/bitcoin` و`features/market-influence` و`features/scalping` غير `testing/services`).
- الخلاصة: لا يوجد أبدًا خطر "listener يقرأ كل ثانية". التصميم الحالي **استقصائي/طلب-الاستجابة** بحت.

---

## 6) تدقيق الـ POLLING

### مؤقتات خارجية (مرور البيانات، بلا أي قراءة Firestore)

| المصدر | الدقة | الوجهة |
|---|---|---|
| `useBitcoin` fetchFast | 5s | Binance REST (spot+futures) |
| `useBitcoin` fetchSlow | 60s | Binance + `/api/coingecko` (CoinGecko) |
| `useCrossMarket` load | 60s (POLL_REFRESH_MS) | `/api/market-influence` (Binance/Yahoo/FRED/DefiLlama؛ cache 12s) |
| `options/provider` poll | 10s | Deribit REST |
| `useScalping` microFeed / recompute | 100ms / 1s | WS متعددة + store مشترك |
| `useFlowEngine` snapshot | 100ms | WS متعددة (publish محلي) |
| `useLiveFeed` heartbeat | WS_HEARTBEAT_MS | Binance WS |
| `BtcChart` tick | 250ms | عرض محلي |
| `useNow` / `offline-toast`(250ms) / `operations`(30s) / `ImportedPortfolioView`(30s) | متفاوت | ساعة عرض `Date.now()` فقط |

### المؤقتات التي تلمس Firestore (1 فقط)

| المصدر | الدقة | القراءات |
|---|---|---|
| `binanceLiveManager.startKeepAlive` (L676) | **25 دقيقة** | **2 قراءة لكل نداء** (getAccount + getCredentialByAccount في `/live-session/keepalive`) — فقط عندما تكون الطبقة الحية فعّالة (opt-in) |

> ملاحظة: حتى في تبويب خلفي يبقى `setInterval` المذكور يعمل (لا تعليق على الـ visibility)؛ لكنه نادر (25 دقيقة) ومحدود بـ 2 doc.

---

## 7) تدقيق الصفحة-بصفحة (ما يُقرأ عند فتح كل صفحة)

| الصفحة (route) | قراءات Firestore عند mount |
|---|---|
| `/` (الجذر) | لا شيء (توجيه) |
| `/login` ، `/register` | لا شيء |
| **بداية أي صفحة تحت `(dashboard)`** | Boot warm-up (5 مجموعات) + StrategyMenu (strategyNumbers) — مرة لكل تحميل تطبيق |
| `/dashboard` | + portfolio meta (WalletSnippet) + [meta + **100 tx** + goals] (GoalsSnippet) + strategyNumbers (StrategySnippet) |
| `/portfolio` | meta + 100 tx + detail API (cached 100s عبر `exchanges.api`) |
| `/operations` | meta فقط |
| `/goals` | meta + 100 tx + goals |
| `/golden-target` | goldenTarget فقط |
| `/decision-center` | strategies (M) |
| `/strategies` (+ `/strategy/numbers`) | strategyNumbers (N) |
| `/strategy/risk-calculator` | strategyNumbers (N) + scenarios (N) + meta + 100 tx |
| `/scalping` | 0 (بيانات WS/REST) |
| `/scalping/testing` | validationRuns (حتى 50) + validationMetrics (حتى 9) |
| `/scalping/testing/research` | researchRuns (حتى 100) |
| `/market` ، `/multi-asset` ، `/global-markets` ، `/bitcoin` ، `/settings` ، `/ui` | 0 (بيانات خارجية/محلية) |

---

## 8) تدقيق الـ GLOBAL COMPONENTS

| المكوّن | المدى | القراءات |
|---|---|---|
| `ProtectedRoute` (فوق كل Dashboard) | عام | boot warm-up كامل (meta، scenarios، strategyNumbers، goals، golden) |
| `DashboardShell` | عام | لا قراءة مباشرة؛ يستضيف الهيدر |
| `Header → StrategyMenu` | عام (كل الصفحات) | `strategyNumbers.list` (N) |
| `NotificationsProvider` | عام | 0 — خدمة إشعارات **Mock محلي** (بدون Firestore) |
| `MarketDataProvider` / `CrossMarketProvider` | عام | 0 (REST/WS خارجي + /api/market-influence) |
| `OfflineToast` | عام | 0 (local state فقط) |

---

## 9) تدقيق الـ API ROUTES (مرجّعة من الملفات مباشرة)

| Route | طريقة | نوع الـ Firestore |
|---|---|---|
| `/api/portfolio/exchanges` | GET | `listAccounts` (قراءة) |
| 〃 | POST | connect: `getPortfolioMeta` + كتابات + INITIAL sync خلفي (قراءات) |
| `/api/portfolio/exchanges/[id]` | GET | `requireOwnedAccount` + **buildAccountDetailBody (8 قراءات متوازية)** |
| 〃 | PATCH / DELETE | قراءات قليلة (getAccount + getCredentialByAccount) + كتابات |
| `…/[id]/refresh` | POST | syncNow كامل (≈ حتى 2000+ doc) + buildAccountDetailBody (8 قراءات) — **الأثقل** |
| `…/[id]/sync` | GET | getRunningSync + getSnapshots(1) |
| 〃 | POST | getRunningSync + خلفية |
| `…/[id]/live-session` | POST | getAccount + getCredentialByAccount (2) |
| `…/[id]/live-session/keepalive` | POST | getAccount + getCredentialByAccount (2) كل 25 دقيقة |
| `…/[id]/live-state` | GET | getAccount + getCredentialByAccount (2) |
| `/api/coingecko` ، `/api/htx` ، `/api/kucoin/token` ، `/api/market-influence` | GET | **0 قراءات Firestore** (سحب خارجي + caches في الذاكرة) |

---

## 10) كفاءة الـ QUERIES

- ✅ **جيدة**: pagination صحيح في `portfolio.service` (`limit` + `startAfter` على `timestamp`)؛ حدود معقولة في `getSnapshots`/`getTrades`/`getTransactions` (إلى 500 في detail body)؛ idempotency بأمهية `sha256` تمنع إعادة القراءة غير المتوازنة عمومًا؛ caches في الذاكرة للسيرفر (coingecko TTL 60s، market-influence 12s، FRED 10min، detail `exchanges.api` 100s).
- ⚠️ **بلا `limit`** (قراءة غير محدودة لكل مستندات المستخدم): `strategies.list`، `strategyNumbers.list`، `scenarios.list`، `getValidationDecisions` (هذه الأخيرة غير مستعملة أصلًا).
- ⚠️ **بلا projection** (`select(...)`) في أي قراءة: تُعاد المستندات كاملة (metas صغيرة، لكن `decisions`/`runs` قد تكون ضخمة).
- ⚠️ **`recomputeFinancials` يقرأ الدفتر كاملًا (1000+1000) في كل sync** حتى للـ INCREMENTAL الصغيرة — تصميم صحة متعمّد لكنه مضاعِف قراءات.
- ⚠️ **بدون `limit` في upsertLedger where-in** — محمي بـ30/شريحة.
- ⚠️ **لا فهارس مركبة مطلوبة معلنة/متحقق منها** لهذه الـ queries (لا معلومات متاحة؛ يُوصى بفحص لوحة Firestore Console).
- ⚠️ **`refreshMeta`** حلقة getDocs كاملة (limit 1000/صفحة) — مسار ترحيل غير مستخدم في UI.

---

## 11) تصنيف كل مصدر (A–E)

**A = Essential (قراءة ضرورية صحيحة) · B = Optimizable (مطلوبة لكن يمكن تحسينها) · C = Duplicate (مكررة) · D = Unnecessary (غير ضرورية/ناتجها مهمل) · E = Dangerous (حرج مالي/انفجار) **

| المصدر | الفئة | التعليق |
|---|---|---|
| Boot warm-up (5 مجموعات) | **B** | ضروري لكنه "pre-load ثم رمي"؛ يجب أن يُمرَّر الأسفل بدلًا من إعادة القراءة |
| Header `StrategyMenu` | **B** | قراءة عامة لبيانات tab-specific؛ يمكن أن يعتمد على حاصل warm-up/cache |
| `WalletSnippet → usePortfolio(false)` | **A** | meta فقط، لا تهدر |
| **`useGoals → usePortfolio()`** | **D** | يقرأ 100 tx لا تُستخدم ⇒ **Unnecessary** (أعلى هدر في المشروع) |
| `GoalsSnippet` + `WalletSnippet` على نفس الصفحة | **C** | duplicate meta في اللوحة الواحدة |
| `StrategySnippet` + `StrategyMenu` | **C** | duplicate strategyNumbers |
| كل hooks الصفحات (useStrategies/useScenarios/useStrategyNumbers/useGoals/useGoldenTarget/usePortfolio) | **B** | مرة per mount بلا cache ⇒ إعادة قراءة عند كل تنقّل |
| `usePortfolio({withTransactions:true})` على /portfolio وgoals وcalculator | **B** | 100 doc؛ مقبولة لصفحة المحفظة، ليست ضرورية لـ goals/calculator |
| `buildAccountDetailBody` (8 queries) | **B** | للقراءة الأولى فقط؛ ما عدا ذلك يكرر (انظر D5) |
| `recomputeFinancials` (1000+1000) | **B** | تصميم صحة مؤكد؛ يجب التريّث مع النوافذ/العدادات التراكمية |
| `listValidationRuns(50)` + `getValidationMetrics(≤9)` | **B** | بيانات غير متغيرة؛ تحتاج cache/TTL بدلًا من القراءة عند كل فتح |
| `listResearchRuns(100)` | **B** | مثل أعلاه |
| `getValidationRun` C13 / `getValidationDecisions` C15 / `getResearchFeature` C18 | **D** | dead code — لا يستدعيها الـ UI |
| `lib/firebase/firestore.ts` wrapper C1/C2 | **D** | dead wrapper غير مستورد |
| `baremanLiveManager keepalive` (25د/2قراءة) | **B** | نادر ومحدود؛ الأنظف لو اعتُمد WS-only بلا revisit |
| `upsertLedger where-in` أثناء INITIAL sync (365 يوم) | **B→E** | INR تقديري؛ الفترات الكبيرة (فوتشر منذ 365d) تولّد آلاف القراءات (شريحة 30/شريحة) |
| `deleteManualPortfolio` (listCollections/listDocuments) | **B** | مرة واحدة عند استبدال المحفظة |
| كل REST routes | **B** | تحمل getAccount+getCredential بخلفية 1-2 قراءة لكل نداء؛ يمكن تفاديها عبر cache للـ account doc |

---

## 12) تقدير الاستهلاك (سيناريوهات) — تقديرات بافتراضات صريحة

**الافتراضات:** N=strategyNumbers(≈2)؛ سيناريوهات = ∃M strategies(≈2)؛ N_scen≈3؛ المستخدم النشط يفتح التطبيق مرة/يوم وينقّل 5-15 صفحة.

| السيناريو | الوصف | ≈ قراءة/يوم | ≈ شهريًا |
|---|---|---|---|
| **Light** | محفظة يدوية، يستخدم dashboard + /portfolio + /operations | ~430–520 | ~13–15k |
| **Normal** | حساب Binance FUTURES مستورد، 1 refresh يدوي، بلا live، يفتح dashboard(×5) + /portfolio(×2) + /goals + /decision | ~3,100–3,600 | ~93–108k |
| **Heavy** | كما Normal + الطبقة الحية فاعلة (keepalive كل 25د ⇒ حتى ~115/day) + 3 refreshes + زيارات لمختبرات testing/research | ~9,000–12,500 | ~270–380k |

**توزيع أكبر المساهمين في Normal:** الـ refresh الواحد ≈ 2,200+ (منها ~2,000 من `recomputeFinancials`)؛ فتح الـ dashboard ×5 ≈ 1,450 كله من هدر 100-tx + meta المكررة؛ /goals ≈ 102؛ سائر الصفحات قليلة.

> هذه **تقديرات** تُبنى على الكود والافتراضات أعلاه (وليس أرقامًا مقيسة). القياس الفعلي: خطة الـ Instrumentation في القسم 17.

---

## 13) TOP 20 مصادر القراءات (بالأثر)

| # | المصدر | الفئة | الأثر | التكرار |
|---|---|---|---|---|
| 1 | `useGoals` → `usePortfolio()` (أيقونة 100 tx غير مستخدمة) | D | مرتفع جدًا | كل فتح dashboard/goals |
| 2 | `recomputeFinancials` (1000 tx + 1000 trades لكل sync) | B | مرتفع جدًا | كل refresh/sync |
| 3 | `buildAccountDetailBody` (8 queries) | B | مرتفع | كل GET detail/refresh |
| 4 | `usePortfolio()` على /portfolio وcalculator (100 tx) | B | مرتفع | كل فتح |
| 5 | إعادة القراءة عند كل mount (لا cache مشترك) | C | مرتفع | كل تنقّل |
| 6 | Boot warm-up ثم رمي النتائج | B | متوسط-مرتفع | تحميل التطبيق |
| 7 | duplicate meta في dashboard (WalletSnippet + useGoals) | C | متوسط | كل فتح dashboard |
| 8 | duplicate strategyNumbers (StrategyMenu + StrategySnippet + warmup) | C | متوسط | تحميل + dashboard |
| 9 | sync: upsertLedger where-in خلال INITIAL (365d) | B→E | متوسط-مرتفع (مرة واحدة) | connect/backfill |
| 10 | keepalive live (2 قراءة/25د) | B | متوسط (عبر النهار) | live فاعل |
| 11 | `listResearchRuns(100)` | B | متوسط | فتح research |
| 12 | `listValidationRuns(50)` + ≤9 metrics | B | متوسط | فتح testing |
| 13 | `strategies.list` بلا limit | B | متوسط | فتح decision-center |
| 14 | `strategyNumbers.list` / `scenarios.list` بلا limit | B | متوسط | فتح صفحات strategy |
| 15 | `loadOlder` (100/صفحة) | A | منخفض | زر |
| 16 | `getResearchRun`/`getValidationMetrics` عند النقر | A | منخفض | click |
| 17 | `getAccount`+`getCredentialByAccount` خلف كل REST | B | منخفض–متوسط | كل نداء live/sync |
| 18 | `getPortfolioMeta` عند connect/replace | B | منخفض | connect |
| 19 | `deleteManualPortfolio` (listCollections/Documents) | B | منخفض | استبدال محفظة |
| 20 | 4 دوال dead (C13/C15/C18/C1/C2) | D | منخفض (صفر فعلي) | لا شيء |

---

## 14) ROOT CAUSES (الجذور)

1. **لا توجد طبقة cache/server-state موحدة** على العميل (لا React Query/SWR ولا store ملفات التعريف) — كل hook يملك State خاصًا ويصوّب الـ Firestore منفردًا ⇒ قراءات مكررة عند كل mount.
2. **واجهة "boot warm-up" تُرمي حصيلتها** — تقرأ ثم لا تمرر القيم أسفلًا ⇒ كل شاشة تعيد القراءة.
3. **`useGoals` يستحضر الـ portfolio بخياراته الافتراضية** (withTransactions:true) رغم أن خدمة الأهداف تحتاج meta فقط ⇒ هدر 100 doc في كل مكان تُستخدم فيه الأهداف.
4. **إعادة حساب مالية متعمّدة O(كامل الدفتر)** في `recomputeFinancials` (صحة > التكلفة)؛ لا حدود نوافذ/عدادات تراكمية.
5. **compose-again على السيرفر**: `buildAccountDetailBody` يعيد 8 استعلامات عند كل طلب (لا caching جانب السيرفر لإجمالي الـ body).
6. **quantity غير مرتبطة بـ data**: مختبرات التقييم/البحث غير المتغيرة تقرأ من جديد عند كل فتح دون TTL/cache.
7. **لا projections ولا limits** إلى جانب عدة قوائم بلا limit (strategies/strategyNumbers/scenarios) ودوال dead.

---

## 15) العمارة المقترحة (غير مطبَّقة)

1. **طبقة قراءة موحّدة على العميل** بسيطة (Modular Cache / TTL memo أو SWR/React Query):
   - مفتاحها `(uid, path, queryKey)` مع staleTime (مثل 30–60s)؛ كل hooks تستمد من هذه الطبقة بدلًا من `getDb` مباشرة.
   - الـ Boot warm-up يملأ هذه الطبقة، وتستهلكها كل Snippets/الهيدر/الصفحات دون إعادة قراءة.
2. **رفع حالة المحفظة إلى Context** (`WalletProvider`) بحيث `WalletSnippet` و`useGoals` يتشاركان نفس حالة meta — وإنهاء خيار `withTransactions` الافتراضي لـ useGoals إلى `false`.
3. **عزل بيانات المحفظة المستوردة خلف الـ API** (بـ detail cache 100s قائمًا) بدلًا من قراءة عميل Firestore؛ وإبقاء manual meta+ledger مع invalidation عند `recordTransaction`.
4. **تقليص تكلفة الـ sync**: تفعيل الانتقال إلى "عدادات تراكمية" بدلًا من إعادة حساب كامل الدفتر، أو اقتصار جولة إعادة الحساب على نافذة التغيير مع snapshot تراكمي موزнию؛ وتقليل قراءة `buildAccountDetailBody` الثانية في `/refresh` (region من `syncNow` يغذي الـ body مباشرة).
5. **Cache على السيرفر** لـ account doc / credential doc (TTL قصير ومبني على `updatedAt` للمستند) لتقليل القراءات الـ2 لكل REST call.
6. **Limits + projections**: قوائم بلا limit تكتسب limits صلبة (مثل 200)؛ واستخدام `select()` للجداول الكبيرة (decisions/runs).
7. **Metering/dev**: عداد Reads-للسيد بنية في قسم 17 (حتى تظهر READ METER على الشاشة في dev).
8. **التوصية – الحفاظ على الهندسة الحالية للماركت داتا**: لا نقل أبدًا البيانات اللحظية إلى Firestore (انظر القسم 16).

---

## 16) Market Data vs Firestore (تمييز مهم)

- **كل بيانات السوق اللحظية والتاريخية تعمل خارج Firestore تمامًا**: Binance REST/WS، HTX WS (via /api/htx)، KuCoin WS (via /api/kucoin/token)، Deribit REST، CoinGecko (via /api/coingecko)، Yahoo/FRED/DefiLlama (via /api/market-influence) مع أكثر من 3 طبقات cache في الذاكرة على السيرفر.
- **Firestore يستضيف فقط بيانات موثوقة بطيئة التغير للمستخدم**: المحفظة (manual/imported)، الاستراتيجيات والأرقام والسيناريوهات، الأهداف/الهدف الذهبي، وسجلات مختبرات التقييم/البحث.
- ⇒ لا يوجد تضارب: استراتيجية الاقصاء الحالية سليمة. النصيحة: **لا تبدأ أبدًا في كتابة أسعار/تهميش لحظية إلى Firestore**؛ الـ reads لا تنبع إلا من بيانات الملف، وكل تمرير للماركت داتا عبر REST/WS مع caches.

---

## 17) خطة الـ INSTRUMENTATION (كيف يُقاس فعلًا لاحقًا)

1. **Wrapper عدّاد** يلتف على `getDoc/getDocs/getCountFromServer` في `src/lib/firebase/client.ts` (يعرّف نوع WEBA) وفي `src/server/firebase/admin.ts` (Side) مع مفتاح `(path)` وعدادات تراكمية للحصيلية.
2. **تسمية الـ SDK** `modular → @firebase/...` — أو أبسط: إسقاط counter في التابعين الوحيدين `getDocument/getCollection` + في كل service بدلًا منه مباشرة (إغلاق C-series sites).
3. **إيضاح الصورة**: `console.debug` عند أي قراءة تتجاوز N/(60s في dev) مع `(uid, path)` ليُظهر فورًا تكرار D1/D2؛ أو/و سطح `/api/diagnostics/reads` على السيرفر يعرض عدّاد Admin في آخر فترة.
4. **Firebase Performance / Firestore usage page**: مقارنة أرقام العداد بالرقم في Console (بعد يوم استخدام) للتأكد أن النموذج المقدّر يطابق الواقع ومطابقة دقيقة لنسب التخفيض لاحقًا.
5. **مقياس استمراري**: ضع counter/يوم في `localStorage` (منفصل لكل يوم) + `report` بسيط في الإعدادات لرؤية يا يوميًا دون حساب يدوي.
6. **CI Lint**: منع إعادة إدخال `onSnapshot` على Firestore بمراجعة في مراجعة الـ PRs (yarn lint rule أو guide).

---

## 18) الملخص التنفيذي النهائي

### نظرة عامة
- **36 نقطة دخول للقراءة** (18 Client + 18 Admin) في **0 listener لحظي** و **1 مؤقت يلمس Firestore** (keepalive 25د اختياري).
- الحالة العامة ممتازة لجهة الاسترجاع: **لا يوجد أي علىSnapshot ولا polling متسارع على Firestore**. الاختناقات الحقيقية كلها في **بيانات-مرة-واحدة يقرأها أكثر من اتجاه دون مشاركة**، وفي **مسارَي كتابة/خوانة متعمّدين باهظين** (refresh sync + buildAccountDetailBody).

### TOP 5 قراءة
1. `useGoals` → `usePortfolio()` (100 tx غير مستخدمة) — كل dashboard/goals.
2. `recomputeFinancials` (1000 tx + 1000 trades) — كل refresh/sync.
3. `buildAccountDetailBody` (8 queries) — كل GET detail/refresh.
4. Re-read عند كل mount بدون cache مشترك (نظامي).
5. keepalive live (2/25د) أثناء الطبقة الحية.

### TOP 5 مشاكل حرجة
1. **D — `useGoals` يشتري قراءة 100 مستند لا يستخدمها** (الهدر الأعلى وأسهل إصلاحًا: `usePortfolio({withTransactions:false})`).
2. **C — `portfolio/meta` يُقرأ 2–3 مرات في اللوحة نفسها** (warmup + WalletSnippet + useGoals الداخلي) بلا store مشترك.
3. **B — إعادة القراءة عند كل تنقّل صفحة** بلا TTL/cache (إعادة تحميل full عند العودة لأي صفحة).
4. **B — refresh دفع ~2000 قراءة** من إعادة حساب الدفتر الكامل + حجم الـ detail (double-read في نفس الـ /refresh).
5. **E محتمل — INITIAL sync** يقرأ شريحة-بو-شريحة عبر 365d مع where-in (آلافٌ مرة واحدة)، والـ live keepalive يبقى المؤقت الوحيد الذي يلمس Firestore يدوم فترات طويلة.

### QUICK WINS (تفعيل بأقل جهد، أعلى أثر — بترتيب)
1. `useGoals({withTransactions:false})` — يلغي ~100 قراءة لكل فتح dashboard/goals (**الأعلى أثرًا بأقل سطر**).
2. `StrategyMenu` يعتمد على نتيجة warm-up/shared store بدلًا من `useStrategyNumbers` الخاص.
3. TTL cache بـ`module-level Map` على boot warm-up (يملأ ثم تكشف الصفحات قراء صفر).
4. حدّ الـ limit بـ200 لـ `strategies.list` و`strategyNumbers.list` و`scenarios.list` + حذف `refreshMeta`/الدوال dead (C13/C15/C18/C1/C2) من مسار القارئ.
5. `/refresh` يغذية الـ body من نتيجة `syncNow` ولا يعيد 8 استعلامات.

### ARCHITECTURE PROBLEMS (مشاكل معمارية)
- لا طبقة state/cache موحدة على العميل ⇒ تكرار بالتصميم.
- boot warm-up يقرأ ثم يرمي النتائج.
- السيرفر compose-again لكل طلب بدون caching جانب السيرفر للإجماليات.
- useGoals تستند لـ portfolio الافتراضي المكلف.

### RECOMMENDED TARGET ARCHITECTURE (من القسم 15)
تطبق طبقة قراءة موحدة (SWR/TTL memo) + WalletProvider context + عزل الملف المستورد خلف الـ API + active recompute تراكمي/نافذة على السيرفر + limits/projections + عدّاد في dev + الالتزام الدائم بلا Firestore للماركت داتا.

### EXPECTED SAVINGS (تقدير)
- **تخفيض مقدر 60–80%** من قراءات العميل في الجلسة النموذجية بتحقيقات القسم Quick Wins (1+2+3+4).
- **تخفيض حتى ~90% من تكلفة الـ refresh** عند تحويل `recomputeFinancials` إلى صيغة تراكمية (بدلًا من ~2,000 doc لكل sync).
- الإجمالي الشهري التقريبي المتوقع بعد التطبيق (سيناريو Normal): من ~93–108k إلى **~25–40k** (تقديرات؛ تُقهر لاحقًا بـ Instrumentation).

---

```text
TOTAL FIRESTORE ACCESS POINTS: 36
TOTAL REALTIME LISTENERS: 0
TOTAL POLLING SOURCES: 1  (binanceLive keepalive · 25min · 2 reads)
TOP 5 READ SOURCES:
  1. useGoals → usePortfolio()           (100 unused tx reads)   — per dashboard/goals
  2. recomputeFinancials                  (1000+1000 ledger)     — per refresh/sync
  3. buildAccountDetailBody               (8 queries)            — per GET detail/refresh
  4. page-mount re-reads                  (no shared cache)      — per navigation
  5. live keepalive                       (2 reads/25min)        — while live active
TOP 5 CRITICAL PROBLEMS:
  1. [D] useGoals pays 100 unused document reads per visit
  2. [C] portfolio/meta read 2–3x in same paint (warmup+Wallet+useGoals)
  3. [C] full re-read on every page mount (no TTL/shared cache)
  4. [B] manual refresh ≈ 2000 reads (full-ledger recompute + detail)
  5. [E?/B] INITIAL sync year-window where-in chunks + keepalive sole FS poller
ESTIMATED READ REDUCTION OPPORTUNITY: 60–80% (up to ~90% for refresh with recompute-scoping)
```
---

# 19) AFTER — إعادة الأوديت بعد التطبيق (BEFORE → AFTER)

> تاريخ التنفيذ: جلسة التحسين الحالية. التنفيذ على العميل فقط (لا تغيير على مسارات السيرفر الثقيلة، ولا على بيانات السوق اللحظية).

## 19.1) ما تم تطبيقه (Data Access Layer)

| مكوّن | الملف | الوظيفة |
|---|---|---|
| L1 read cache + dedupe | `src/lib/data/readCache.ts` | كاش ذاكرة لكل domain + TTL + join للطلبات المتزامنة (inflight) + `invalidate` + عدم تخزين null |
| Dev read monitor | `src/lib/data/readMonitor.ts` | عدّاد hit/miss/dedup + آخر 200 trace، متاح عبر `window.__RAMSEES_READS__` |
| Unified repository | `src/lib/data/userDataRepository.ts` | المسار الوحيد للقراءة: `portfolio.meta`, `portfolio.tx`, `strategyNumbers`, `scenarios`, `goals`, `goldenTarget`, `strategies` + إبطال عند الكتابة |

**TTL لكل نوع:** portfolio meta 60s · tx 30s · strategyNumbers/scenarios 10د · goals/goldenTarget 60s · strategies 5د — مع **إبطال فوري عند كل كتابة** (create/record/import/save/remove).

**المسارون المعاد ربطهم:** `warmup.ts` (يملأ الكاش) · `usePortfolio` · `useGoals` · `useGoldenTarget` · `useStrategyNumbers` · `useScenarios` · `useStrategies` (decision). كل الكتابات تُبطل الكاش المعني.

## 19.2) أكبر 10 مستهلكين — BEFORE/AFTER

| # | المستهلك (BEFORE) | قبل | بعد | الإجراء |
|---|---|---|---|---|
| 1 | `useGoals → usePortfolio()` افتراضي (100 tx غير مستخدمة) | 100 doc/فتح | **0** | `withTransactions:false` |
| 2 | `CalculatorPage → usePortfolio()` (100 tx غير مستخدمة) | 100 doc/فتح | **0** | `withTransactions:false` |
| 3 | `portfolio/meta` مكرر 5–6× في نفس الـ paint | 5–6 | **1** | warmup يملأ الكاش + hooks تقرأ منه |
| 4 | duplicate `strategyNumbers` (warmup + StrategyMenu + صفحة) | 3×N | **N** | كاش موحّد + إبطال عند الحفظ |
| 5 | duplicate `scenarios` (warmup + calculator) | 2×N | **N** | كاش موحّد + إبطال عند الحفظ |
| 6 | duplicate `goals.progress` (warmup + useGoals) | 2 | **1** | كاش موحّد + إبطال عند الحفظ |
| 7 | duplicate `goldenTarget.progress` (warmup + hook) | 2 | **1** | كاش موحّد + إبطال عند الحفظ |
| 8 | إعادة القراءة الكاملة عند كل تنقّل صفحة | 1/domain/فتح | **0 داخل نافذة TTL** | كاش L1 + TTL لكل domain |
| 9 | طلبات متزامنة مكررة لنفس المفتاح | متكرر | **1 مشترك** | inflight coalescing |
| 10 | boot warmup يقرأ ثم يرمي النتائج | 100% مهدر | **يبذر الكاش** | warmup يمر عبر الـ repository |

## 19.3) الجلسة النموذجية (تقديري، بناءً على افتراضات القسم 12)

| السيناريو | BEFORE | AFTER | التخفيض |
|---|---|---|---|
| محفظة يدوية — تحميل واحد يتضمن dashboard + /portfolio + /goals + calculator | ≈ 420 doc-read | ≈ 108 doc-read | **≈ 74%** |
| إعادة التنقّل بين الصفحات داخل نافذة TTL | ~100+/صفحة | **0** | **~100%** |
| Boot warmup فقط | 8 (تُرمى) | 8 (تُبذر) | 0 مهدر من بعدها |

> الأرقام تقديرية من الكود (لا livemeter مثبت). القياس الفعلي الحي متاح الآن في dev عبر `window.__RAMSEES_READS__`.

## 19.4) ما لم يُغيَّر (بوعي)

- **`recomputeFinancials` و`buildAccountDetailBody` (السيرفر)**: مسارات refresh/sync اليدوية الباهظة تبقى كما هي — خارج نطاق "نزيف القراءات الدوريّة" على العميل، وتُعالج لاحقًا بـ counter تراكمي على السيرفر.
- **بيانات السوق اللحظية**: لم تُلمس ولن تُكتب في Firestore (Binance/REST/WS + كاش API) — التزام كامل بالمبدأ.
- **`onSnapshot`**: ما زال صفرًا (تأكيد) — لا realtime جديد.

## 19.5) قواعد ثابتة مُفعّلة

1. لا قراءة Firestore إلا عبر `userDataRepository` (لا `getDb` من داخل hooks).
2. أي كتابة تُبطل domain الخاص بها فورًا.
3. لا `onSnapshot` بلا حاجة.
4. لا polling على Firestore (المؤقت الوحيد: keepalive الطبقة الحية 25د).
5. كل شاشة تستطيع إظهار "آخر تحديث" من `fetchedAt` في الـ repository (PortfolioPage مطبَّق).

```text
AFTER METRICS
UNIFIED READ PATH:      userDataRepository  (7 domains)
L1 CACHE + DEDUPE:      yes (per-domain TTL, inflight coalescing, null-skip)
WRITE INVALIDATION:     yes (portfolio/goals/goldenTarget/strategyNumbers/scenarios/strategies)
REALTIME LISTENERS:     0
FIRESTORE POLLERS:      1 (binanceLive keepalive 25min · server-side · live-only)
UNUSED 100-DOC READS:   0  (useGoals + CalculatorPage fixed)
DUPLICATE META READS:   5-6 → 1 per session window
ESTIMATED CLIENT READ REDUCTION: ~74% per full app session; ~100% on in-TTL navigation
DEV INSTRUMENTATION:    window.__RAMSEES_READS__ (hit/miss/dedup + traces)
```
