/* ============================================================
   MusicBiz 原型 · 页面逻辑（无后端，纯前端渲染 + 模拟流程）
   ============================================================ */
(function () {
  'use strict';
/* ===== 静态展示模式（static-demo）===== */
  const STATIC_MODE = true;
  (function staticInit() {
    try {
      const sd = window.MUSICBIZ_STATIC_DATA;
      if (!sd) return;
      /* 静态版每次加载都用打包数据覆盖本地缓存（确定性展示，不受旧缓存/坏数据影响） */
      if (Array.isArray(sd.artists)) {
        localStorage.setItem('musicbiz_artists', JSON.stringify(sd.artists));
      }
      if (Array.isArray(sd.deleted)) {
        localStorage.setItem('musicbiz_deleted_artists', JSON.stringify(sd.deleted));
      }
      if (sd.snapshots) {
        localStorage.setItem('musicbiz_artist_snapshots', JSON.stringify(sd.snapshots));
      }
      if (sd.analytics) {
        localStorage.setItem('musicbiz_analytics', JSON.stringify(sd.analytics));
      }
    } catch (e) { /* 存储不可用忽略 */ }
    document.addEventListener('DOMContentLoaded', function () { document.body.classList.add('static-mode'); });
  })();

  const $  = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const M  = window.MOCK;

  /* ---------- 手动入库音乐人持久化（localStorage） ---------- */
  const ARTISTS_LS_KEY = 'musicbiz_artists';
  const DELETED_ARTISTS_LS_KEY = 'musicbiz_deleted_artists';
  const deletedArtistIds = new Set();
  /* mock 艺人采集增强快照：跨 reload 保留讨论度等运行时采集结果（mock 数据本身来自文件，运行时增强需要单独存） */
  const SNAP_LS_KEY = 'musicbiz_artist_snapshots';
  const extraArtists = [];
  function loadArtistSnapshots() {
    try {
      const raw = localStorage.getItem(SNAP_LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && typeof d === 'object') {
        /* 深合并：只填空缺字段，不覆盖 mock 固化数据（否则旧快照会覆盖掉 mock 新增字段如 showDiscussion） */
        const fill = (target, src) => {
          if (!src || typeof src !== 'object') return;
          Object.keys(src).forEach(k => {
            const v = src[k];
            if (v === null || v === undefined) return;
            if (Array.isArray(v)) { if (target[k] == null || (Array.isArray(target[k]) && !target[k].length)) target[k] = v; return; }
            if (typeof v === 'object') { target[k] = target[k] || {}; fill(target[k], v); return; }
            if (target[k] == null) target[k] = v;
          });
        };
        M.artists.forEach(a => {
          const s = d[a.id];
          if (!s) return;
          if (s.paid) fill(a.paid = a.paid || {}, s.paid);
          if (s.social) fill(a.social = a.social || {}, s.social);
          if (s.fans) fill(a.fans = a.fans || {}, s.fans);
          if (s.weiboUrl) a.weiboUrl = s.weiboUrl;
          if (s.snapshotTime) a.snapshotTime = s.snapshotTime;
        });
      }
    } catch (e) { /* 存储不可用时忽略 */ }
  }
  function loadDeletedArtists() {
    try {
      const raw = localStorage.getItem(DELETED_ARTISTS_LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) arr.forEach(id => deletedArtistIds.add(id));
      if (deletedArtistIds.size) M.artists = M.artists.filter(a => !deletedArtistIds.has(a.id));
    } catch (e) { /* 存储不可用时忽略 */ }
  }
  function persistDeletedArtists() {
    try { localStorage.setItem(DELETED_ARTISTS_LS_KEY, JSON.stringify(Array.from(deletedArtistIds))); } catch (e) {}
    pushToServer();
  }
  function loadExtraArtists() {
    try {
      const raw = localStorage.getItem(ARTISTS_LS_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(a => {
          /* 按 id 或名称去重：mock 数据优先（避免同名人重复/覆盖真实数据） */
          if (a && a.id && a.name && !M.artists.some(x => x.id === a.id || x.name === a.name)) {
            M.artists.push(a);
            extraArtists.push(a);
          }
        });
      }
    } catch (e) { /* 存储不可用时忽略 */ }
  }
  function persistArtists() {
    try {
      /* 多标签页并发保护：先读 localStorage 现有艺人，与内存按 id 合并（保留其他标签页新加的），避免互相覆盖丢失；已删除的艺人排除 */
      const stored = safeParseLS(ARTISTS_LS_KEY) || [];
      const map = new Map(stored.filter(a => a && !deletedArtistIds.has(a.id)).map(a => [a.id, a]));
      extraArtists.forEach(a => { if (a && !deletedArtistIds.has(a.id)) map.set(a.id, a); });
      localStorage.setItem(ARTISTS_LS_KEY, JSON.stringify(Array.from(map.values())));
      /* 同步保存 mock 艺人采集增强快照（讨论度等），reload 后仍可见 */
      const d = {};
      M.artists.forEach(a => {
        const snap = {};
        if (a.paid && (a.paid.dmUrl || a.paid.showstartUrl || a.paid.source || (a.paid.showList && a.paid.showList.length))) snap.paid = a.paid;
        if (a.social) snap.social = a.social;
        if (a.fans) snap.fans = a.fans;
        if (a.weiboUrl) snap.weiboUrl = a.weiboUrl;
        if (a.snapshotTime) snap.snapshotTime = a.snapshotTime;
        if (Object.keys(snap).length) d[a.id] = snap;
      });
      localStorage.setItem(SNAP_LS_KEY, JSON.stringify(d));
    } catch (e) { /* 存储不可用时忽略 */ }
    pushToServer();
  }

  /* 加载删除标记 + 手动入库音乐人 + 采集增强快照（须在评分引擎前执行，保证入库艺人也能自动算分） */
  loadDeletedArtists();
  loadExtraArtists();
  loadArtistSnapshots();

  /* ---------- 服务端同步（跨浏览器共享数据） ----------
   * 原理：报告/任务/入库音乐人平时存 localStorage（每浏览器各一份）；
   * 现在同时存到服务端文件（musicbiz-data.json），任何浏览器/设备打开时先拉取服务端数据。
   * 启动时：本地渲染 → 异步拉服务端 → 有变化则刷新一次。
   * 写入时：persist 函数同时推送到服务端。
   */
  const LS_KEYS_ALL = { artists: ARTISTS_LS_KEY, analytics: 'musicbiz_analytics', snapshots: SNAP_LS_KEY, deleted: DELETED_ARTISTS_LS_KEY };
  function safeParseLS(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  async function syncFromServer() { if (STATIC_MODE) return false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch('/api/data', { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) return false;
      const d = await r.json();
      if (!d || typeof d !== 'object') return false;
      let changed = false;
      /* 合并而非覆盖：防止本地新数据被旧服务端数据覆盖丢失（如提报后推送失败场景） */
      /* artists：服务端优先合并（服务端是持久层权威；本地新提报但未推送成功的补回）
         2026-08-19 修复：原「本地优先」导致服务端更新的艺人（如 AI 人工数据）拉不到 */
      const localArts = safeParseLS(ARTISTS_LS_KEY) || [];
      const srvArts = Array.isArray(d.artists) ? d.artists : [];
      const seen = new Set();
      const merged = [];
      srvArts.forEach(a => { if (a && a.id && !seen.has(a.id)) { merged.push(a); seen.add(a.id); } });
      localArts.forEach(a => { if (a && a.id && !seen.has(a.id)) { merged.push(a); seen.add(a.id); } });
      if (merged.length !== localArts.length || JSON.stringify(merged) !== JSON.stringify(localArts)) {
        localStorage.setItem(ARTISTS_LS_KEY, JSON.stringify(merged));
        changed = true;
      }
      /* deleted：并集 */
      const localDel = safeParseLS(DELETED_ARTISTS_LS_KEY) || [];
      const srvDel = Array.isArray(d.deleted) ? d.deleted : [];
      const delSet = new Set([].concat(localDel, srvDel));
      if (delSet.size !== new Set(localDel).size) {
        localStorage.setItem(DELETED_ARTISTS_LS_KEY, JSON.stringify(Array.from(delSet)));
        changed = true;
      }
      /* snapshots：按 key 合并（本地缺失才补） */
      const localSnap = safeParseLS(SNAP_LS_KEY) || {};
      const srvSnap = d.snapshots && typeof d.snapshots === 'object' ? d.snapshots : {};
      let snapChanged = false;
      Object.keys(srvSnap).forEach(k => { if (!(k in localSnap)) { localSnap[k] = srvSnap[k]; snapChanged = true; } });
      if (snapChanged) { localStorage.setItem(SNAP_LS_KEY, JSON.stringify(localSnap)); changed = true; }
      /* analytics：本地为空才用服务端（本地有则保留，避免覆盖） */
      const localAn = safeParseLS('musicbiz_analytics');
      if (!localAn || (!localAn.tasks && !localAn.reports)) {
        if (d.analytics) { localStorage.setItem('musicbiz_analytics', JSON.stringify(d.analytics)); changed = true; }
      }
      if (changed) pushToServer();   /* 合并结果回推，服务端补全 */
      return changed;
    } catch (e) { return false; }
  }
  function pushToServer() { if (STATIC_MODE) return;
    try {
      const payload = {};
      Object.keys(LS_KEYS_ALL).forEach(k => { payload[k] = safeParseLS(LS_KEYS_ALL[k]); });
      fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
    } catch (e) { /* 推送失败不影响本地使用 */ }
  }
  /* 启动时异步拉服务端数据；有更新则刷新一次（让当前页面用服务端数据重渲染） */
  syncFromServer().then(changed => { if (changed) location.reload(); });

  /* ---------- 评分引擎初始化：为每个 artist 实时计算 score / dims / _breakdown ---------- */
  if (window.ScoreEngine) {
    M.artists.forEach(a => {
      const result = ScoreEngine.calcScore(a);
      a.score      = result.score;
      a.dims       = result.dims;
      a._breakdown = result.breakdown;
    });
    /* 注：首页 KPI（累计/本月/平均分）由报告记录统计（runAnalysis 写入 + localStorage 持久化），
       不在此处用音乐人数量覆盖，避免与报告数量语义冲突 */
  }

  /* ---------- 工具函数 ---------- */
  const avatar = i => (typeof i === 'string' && i.startsWith('http')) ? i
    : 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#22222E"/><circle cx="40" cy="32" r="14" fill="#5A5A72"/><path d="M14 70c0-14 12-22 26-22s26 8 26 22" fill="#5A5A72"/></svg>');
  const scoreLabelOf = s => s >= 200 ? '高价值' : (s >= 100 ? '中价值' : '低价值');
  const scoreClsOf = s => s >= 200 ? 'high' : (s >= 100 ? 'mid' : 'low');
  const artistById = id => M.artists.find(a => a.id === id) || M.artists[0];
  /* 是否已有真正采集数据：只靠网易云 songCount/albumCount 这种“身份识别”不算，避免空报告伪装成报告 */
  function hasCollectData(a) {
    if (!a) return false;
    const p = a.paid || {};
    const wb = (a.social && a.social.weibo) || {};
    const nt = (a.social && a.social.netease) || {};
    const xhs = (a.social && a.social.xiaohongshu) || {};
    const merch = (a.merch && a.merch.discussion) || {};
    return !!(
      p.shows != null || (p.showList && p.showList.length) || p.priceMax != null || p.wantSee != null ||
      wb.fans != null || wb.interactAvg != null || wb.chaohuaFans != null || wb.chaohuaPosts != null || wb.discussion || wb.showDiscussion ||
      nt.followers != null || nt.eventCount != null || nt.videoCount != null || nt.topSongName ||
      xhs.fans != null || xhs.likesCollects != null || (xhs.latest3 && xhs.latest3.length) ||
      merch.weiboTotal != null || merch.xhsTopLikes
    );
  }
  const STATUS = {
    queued:  { text: '排队',   cls: 'gray' },
    running: { text: '进行中', cls: 'orange' },
    done:    { text: '完成',   cls: 'green' },
    failed:  { text: '失败',   cls: 'red' }
  };
  const urlParam = k => new URLSearchParams(location.search).get(k);

  /* ---------- 采集结果合并：只填空缺字段，不覆盖已有真实数据 ---------- */
  /* AI 综合判断自动生成：基于已采集数据拼装（仅当 insight 为空时），保证每个报告都有综合判断 */
  function buildInsight(a) {
    const p = a.paid || {};
    const wb = (a.social && a.social.weibo) || {};
    const nt = (a.social && a.social.netease) || {};
    const md = (a.merch && a.merch.discussion) || {};
    const d = wb.discussion || {};
    const pts = [];
    pts.push(a.name + '为' + (a.genre || '音乐人'));
    if (nt.songCount) pts.push('网易云音乐 ' + (nt.albumCount || '?') + ' 张专辑 / ' + nt.songCount + ' 首歌曲' + (nt.topSongName ? '，热门单曲《' + nt.topSongName + '》' : ''));
    if (nt.followers != null) pts.push('网易云粉丝 <strong>' + nt.followers + (nt.followersUnit || '万') + '</strong>');
    if (p.shows != null && p.shows > 0) pts.push('近期演出 <strong>' + p.shows + ' 场 / ' + (p.cities || '?') + ' 城</strong>' + (p.priceMin != null ? '，票价 ¥' + p.priceMin + ' 起' : ''));
    if (wb.fans != null) pts.push('微博粉丝 <strong>' + wb.fans + (wb.fansUnit || '万') + '</strong>');
    if (wb.chaohuaFans != null) pts.push('超话粉丝 ' + wb.chaohuaFans + '万');
    if (d.postCount30d != null) pts.push('近30天微博提及 <strong>' + d.postCount30d + ' 帖 / 互动 ' + d.interactTotal30d + '</strong>');
    const xhs = (a.social && a.social.xiaohongshu) || null;
    if (xhs && xhs.fans != null) pts.push('小红书粉丝 <strong>' + xhs.fans + (xhs.fansUnit || '万') + '</strong>' + (xhs.likesCollects != null ? ' / 获赞收藏 ' + xhs.likesCollects + (xhs.likesCollectsUnit || '万') : ''));
    if (md.weiboTotal != null) pts.push('周边讨论近30天 ' + md.weiboTotal + ' 帖');
    if (md.xhsTopLikes && md.xhsTopLikes.likes != null) pts.push('小红书周边最热帖 <strong>' + md.xhsTopLikes.likes + ' 赞</strong>');
    const collected = pts.length > 2;

    /* 基于三维评分推导周边合作品类建议 */
    const dims = a.dims || {};
    const paidScore = dims.paid || 0;
    const socialScore = dims.social || 0;
    const fansScore = dims.fans || 0;
    const totalScore = (a.score || 0);
    const genre = (a.genre || '').toLowerCase();

    const recs = [];

    /* 演出相关周边：高付费维度 → 演出限定款 */
    if (paidScore >= 40) {
      const showType = paidScore >= 70 ? '巡演限定' : '演出限定';
      recs.push('<strong>' + showType + '周边</strong>（T恤/帽子/徽章）——演出活跃度高，现场售卖转化链路成熟');
    }

    /* 粉丝粘性高 → 情感类/定制类 */
    if (fansScore >= 35) {
      recs.push('<strong>粉丝向定制品</strong>（歌词印刷品/限定笔记本/写真集）——粉丝忠诚度强，情感类产品溢价空间大');
    } else if (fansScore >= 20) {
      recs.push('<strong>轻量文创单品</strong>（贴纸/明信片/徽章套装）——粉丝有粘性，低客单品易于试水');
    }

    /* 社媒热度高 → 联名或话题款 */
    if (socialScore >= 40) {
      recs.push('<strong>联名合作款</strong>（服饰/配件/生活用品）——社媒热度足以支撑联名曝光，助力双方品牌互相引流');
    }

    /* 独立/民谣/实验类音乐人 → 文化调性品 */
    if (/独立|indie|民谣|folk|实验|post/.test(genre)) {
      recs.push('<strong>音乐主题文创</strong>（限定黑胶/艺术装帧歌词册/帆布袋）——受众文化消费意愿强，适配独立音乐调性');
    }

    /* 有周边讨论数据 → 数字/签名品 */
    if (md.weiboTotal != null && md.weiboTotal >= 50) {
      recs.push('<strong>签名限定/数字藏品</strong>——已有自发求购讨论，稀缺性产品可直接激活现有需求');
    }

    /* 如果一个建议都没有（数据不足） */
    if (recs.length === 0) {
      if (totalScore >= 80) {
        recs.push('<strong>轻量演出周边</strong>（徽章/贴纸）——作为低风险切入点，积累合作经验');
      } else {
        recs.push('建议待更多维度数据采集完成后再评估合作方向');
      }
    }

    const nums = ['①', '②', '③', '④', '⑤'];
    const recText = recs.length === 1
      ? recs[0]
      : recs.map((r, i) => (nums[i] || '') + ' ' + r).join('；');

    return (collected ? '基于已采集数据：' : '数据待补齐（以下为现有维度摘要）：') +
      pts.join('，') + '。<br><br><strong>建议周边合作方向：</strong>' + recText + '。';
  }

  function mergeCollect(artist, data) {
    const ac = data.artist;
    if (ac && !artist.avatar && ac.avatar) artist.avatar = ac.avatar;

    /* 场次交叉合并：现有 + 大麦 + 秀动，按「日期+城市」去重，字段取全，链接双平台 */
    const mergeShowLists = lists => {
      const map = new Map();
      const keyOf = s => ((s.date || '') + '|' + (s.city || '')).replace(/\s+/g, '');
      const isSs = u => u && u.indexOf('showstart.com') >= 0;
      lists.forEach(list => (list || []).forEach(s => {
        const k = keyOf(s);
        const ex = map.get(k);
        if (!ex) {
          const n = Object.assign({}, s);
          if (n.dmUrl && isSs(n.dmUrl)) { n.ssUrl = n.dmUrl; n.dmUrl = null; }
          map.set(k, n);
        } else {
          /* 同一场演出：补全缺失字段 + 记录双平台链接 */
          if (!ex.priceRange && s.priceRange) ex.priceRange = s.priceRange;
          if (ex.wantSee == null && s.wantSee != null) { ex.wantSee = s.wantSee; ex.wantSeeUnit = s.wantSeeUnit; ex.wantSeePercentile = s.wantSeePercentile; }
          if (ex.wish == null && s.wish != null) { ex.wish = s.wish; ex.wishUnit = s.wishUnit; }
          const u = s.dmUrl;
          if (u) { if (isSs(u)) { if (!ex.ssUrl) ex.ssUrl = u; } else if (!ex.dmUrl) ex.dmUrl = u; }
        }
      }));
      return Array.from(map.values());
    };

    const p = artist.paid = artist.paid || {};
    const d = data.damai, ss = data.showstart;
    const merged = mergeShowLists([p.showList || [], (d && d.showList) || [], (ss && ss.showList) || []]);
    p.showList = merged;
    if (merged.length) {
      p.shows = merged.length;                       // 唯一场次数（排除跨平台重合）
      p.cities = [...new Set(merged.map(s => s.city).filter(Boolean))].length;
      const prices = [];
      merged.forEach(s => {
        if (!s.priceRange) return;
        const m = s.priceRange.match(/([\d.]+)/g);
        if (m) m.forEach(x => prices.push(parseFloat(x)));
      });
      if (prices.length) { p.priceMin = Math.min.apply(null, prices); p.priceMax = Math.max.apply(null, prices); }
    }
    /* 平台入口（缺省补齐） */
    if (p.dmUrl == null) p.dmUrl = 'https://m.damai.cn/shows/search.html?keyword=' + encodeURIComponent(artist.name);
    if (p.showstartUrl == null) p.showstartUrl = 'https://www.showstart.com/event/list?keyword=' + encodeURIComponent(artist.name);
    /* 用户意愿：优先大麦想看；没有想看时用许愿人数兜底 */
    if (d && d.wantSee != null && p.wantSee == null) {
      p.wantSee = d.wantSee;
      if (p.wantSeeUnit == null && d.wantSeeUnit) p.wantSeeUnit = d.wantSeeUnit;
    }
    if (d && d.wish != null && p.wantSee == null && p.wish == null) {
      p.wish = d.wish;
      if (p.wishUnit == null && d.wishUnit) p.wishUnit = d.wishUnit;
    }

    if (data.weibo) {
      const w = artist.social = artist.social || {};
      w.weibo = w.weibo || {};
      if (w.weibo.fans == null && data.weibo.fansWan != null) {
        w.weibo.fans = data.weibo.fansWan;   // 万
      }
      if (!w.weibo.fansUnit) w.weibo.fansUnit = '万';
      /* 互动均值：近 N 条微博转评赞均值（只填空缺） */
      if (w.weibo.interactAvg == null && data.weibo.interactAvg != null) w.weibo.interactAvg = data.weibo.interactAvg;
      if (!artist.weiboUrl && data.weibo.uid) artist.weiboUrl = 'https://weibo.com/u/' + data.weibo.uid;
    }
    /* 微博讨论度：近30天提及帖规模与互动（只填空缺） */
    if (data.weiboDiscussion) {
      const w = artist.social = artist.social || {};
      w.weibo = w.weibo || {};
      if (!w.weibo.discussion) w.weibo.discussion = data.weiboDiscussion;
    }
    /* 演出付费意愿信号：微博演出讨论度（只填空缺） */
    if (data.showDiscussion) {
      const w = artist.social = artist.social || {};
      w.weibo = w.weibo || {};
      if (!w.weibo.showDiscussion) w.weibo.showDiscussion = data.showDiscussion;
    }
    /* 微博超话：粉丝/帖子/阅读（只填空缺） */
    if (data.chaohua) {
      const w = artist.social = artist.social || {};
      w.weibo = w.weibo || {};
      if (w.weibo.chaohuaFans == null && data.chaohua.fansWan != null) { w.weibo.chaohuaFans = data.chaohua.fansWan; w.weibo.chaohuaFansUnit = '万'; }
      if (w.weibo.chaohuaPosts == null && data.chaohua.postsCount != null) w.weibo.chaohuaPosts = data.chaohua.postsCount;
      if (w.weibo.chaohuaReads == null && data.chaohua.readsWan != null) w.weibo.chaohuaReads = data.chaohua.readsWan;
    }
    /* 小红书：官方账号（粉丝/笔记数/获赞收藏/账号主页链接/近三条笔记获赞）+ 周边最热帖（归入周边消费）——只填空缺 */
    if (data.xiaohongshu) {
      const w = artist.social = artist.social || {};
      const x = w.xiaohongshu = w.xiaohongshu || {};
      if (x.fans == null && data.xiaohongshu.fans != null) { x.fans = data.xiaohongshu.fans; x.fansUnit = data.xiaohongshu.fansUnit || '万'; }
      if (x.notes == null && data.xiaohongshu.notes != null) x.notes = data.xiaohongshu.notes;
      if (x.likesCollects == null && data.xiaohongshu.likesCollects != null) { x.likesCollects = data.xiaohongshu.likesCollects; x.likesCollectsUnit = data.xiaohongshu.likesCollectsUnit || '万'; }
      if (x.xhsId == null && data.xiaohongshu.xhsId) x.xhsId = data.xiaohongshu.xhsId;
      if (!x.accountUrl && data.xiaohongshu.accountUrl) x.accountUrl = data.xiaohongshu.accountUrl;
      if (!x.latest3 && data.xiaohongshu.latest3) x.latest3 = data.xiaohongshu.latest3;
      if (data.xiaohongshu.merchTopLikes) {
        const m = artist.merch = artist.merch || {};
        const md2 = m.discussion = m.discussion || {};
        if (!md2.xhsTopLikes) md2.xhsTopLikes = data.xiaohongshu.merchTopLikes;
      }
    }
    /* 网易云站内热度：浏览器采集的粉丝/歌曲/专辑/播放量（只填空缺） */
    if (data.netease) {
      const s = artist.social = artist.social || {};
      const n = s.netease = s.netease || {};
      if (n.followers == null && data.netease.followers != null) { n.followers = data.netease.followers; n.followersUnit = data.netease.followersUnit || '万'; }
      if (n.songCount == null && data.netease.songCount != null) n.songCount = data.netease.songCount;
      if (n.albumCount == null && data.netease.albumCount != null) n.albumCount = data.netease.albumCount;
      if (n.topSongName == null && data.netease.topSongName) n.topSongName = data.netease.topSongName;
      if (n.topSongPlays == null && data.netease.topSongPlays != null) { n.topSongPlays = data.netease.topSongPlays; n.topSongPlaysUnit = '次'; }
      if (n.eventCount == null && data.netease.eventCount != null) n.eventCount = data.netease.eventCount;
      if (n.videoCount == null && data.netease.videoCount != null) n.videoCount = data.netease.videoCount;
      if (n.identity == null && data.netease.identity) n.identity = data.netease.identity;
    }
    /* 周边消费讨论度：微博搜「艺人+周边」帖规模与互动（只填空缺） */
    if (data.merchDiscussion) {
      const m = artist.merch = artist.merch || {};
      const d = m.discussion = m.discussion || {};
      if (d.weiboTotal == null && data.merchDiscussion.weiboTotal != null) d.weiboTotal = data.merchDiscussion.weiboTotal;
      if (d.weiboInteract == null && data.merchDiscussion.weiboInteract != null) d.weiboInteract = data.merchDiscussion.weiboInteract;
      if (d.weiboDemand == null && data.merchDiscussion.weiboDemand != null) d.weiboDemand = data.merchDiscussion.weiboDemand;
      if (d.weiboSupply == null && data.merchDiscussion.weiboSupply != null) d.weiboSupply = data.merchDiscussion.weiboSupply;
      if (d.keyword == null && data.merchDiscussion.keyword) d.keyword = data.merchDiscussion.keyword;
      if (d.aliasBase == null && data.merchDiscussion.aliasBase) d.aliasBase = data.merchDiscussion.aliasBase;
      if (d.empty30d == null && data.merchDiscussion.empty30d != null) d.empty30d = data.merchDiscussion.empty30d;
      if (!d.snapshotTime) d.snapshotTime = new Date().toISOString().slice(0, 10);
    }
    /* AI 综合判断：采集合并后自动生成（仅当为空时），保证每个报告都有综合判断 */
    if (!artist.fans) artist.fans = {};
    if (!artist.fans.insight) artist.fans.insight = buildInsight(artist);
  }

  /* ---------- 采集 API 调用：静态版完全禁用（纯展示，无后端） ---------- */
  async function apiCollect(name, aliases) {
    if (STATIC_MODE) throw new Error('静态展示版不提供采集功能');
    const q = '/api/collect-deep?name=' + encodeURIComponent(name) +
      (aliases && aliases.length ? '&aliases=' + encodeURIComponent(aliases.join(',')) : '');
    let lastErr = '';
    for (const base of ['', 'http://localhost:8124']) {
      try {
        const r = await fetch(base + q);
        const j = await r.json();
        if (j && !j.error) return j;
        lastErr = (j && j.error) ? j.error : 'HTTP ' + r.status;
      } catch (e) { lastErr = String(e.message || e); }
    }
    throw new Error(lastErr || '采集服务不可用');
  }

  /* ---------- 分析记录持久化（localStorage）：跨页同步任务/报告/统计 ---------- */
  const LS_KEY = 'musicbiz_analytics';
  function loadAnalytics() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Array.isArray(d.tasks)) {
        /* 自愈：超过 24 小时仍卡在 running 的任务视为中断残留，加载时清除（正常采集几分钟内完成） */
        const staleCut = Date.now() - 24 * 3600 * 1000;
        const cleaned = d.tasks.filter(t => t.status !== 'running' || !t.time || Date.parse(t.time.replace(/-/g, '/')) >= staleCut);
        M.tasks = cleaned;
        if (cleaned.length !== d.tasks.length) {
          /* 清理结果回写本地 + 服务端，避免其他标签页再把残留推回来 */
          localStorage.setItem(LS_KEY, JSON.stringify({ tasks: cleaned, reports: d.reports, stats: d.stats }));
          pushToServer();
        }
      }
      if (Array.isArray(d.reports)) {
        M.reports = d.reports;
        /* 兼容旧数据：localStorage 中缺少 complete 标记的报告补齐（防止刷新后按钮消失） */
        M.reports.forEach(r => { if (r.complete == null) r.complete = true; });
      }
      if (d.stats && typeof d.stats === 'object') M.stats = Object.assign(M.stats, d.stats);
    } catch (e) { /* 存储不可用时忽略 */ }
  }
  function persistAnalytics() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ tasks: M.tasks, reports: M.reports, stats: M.stats }));
    } catch (e) { /* 存储不可用时忽略 */ }
    pushToServer();
  }

  /* ---------- 顶部导航高亮 ---------- */
  const page = document.body.dataset.page;
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));

  /* ---------- 评分引擎：启动时为所有音乐人实时计算 score / dims / _breakdown（已在上方初始化块执行） ---------- */
  /* 读取历史分析记录（本地持久化） */
  loadAnalytics();
  /* 孤儿任务清理：任务引用的音乐人已被删除时自动移除（避免「未知音乐人」残留）
     注意：报告历史是资产，不随音乐人删除而删除；显示时兜底为「已删除音乐人」 */
  {
    const validIds = new Set(M.artists.map(a => a.id));
    if (Array.isArray(M.tasks)) {
      const before = M.tasks.length;
      M.tasks = M.tasks.filter(t => t && validIds.has(t.artistId));
      if (M.tasks.length !== before) persistAnalytics();
    }
  }
  const DIM_LABEL = { paid: '付费行为', social: '社媒热度', fans: '粉丝粘性' };
  const contrib = b => {
    const pct = b.collected ? Math.min(100, (b.score / b.max) * 100) : 0;
    const label = b.collected ? b.score.toFixed(1) + ' / ' + b.max : '0 / ' + b.max;
    return '<div class="card-contrib" data-metainfo="原子-文字">' +
      '<div class="contrib-bar-wrap"><div class="contrib-bar-fill' + (b.collected ? '' : ' uncollected') + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
      '<span class="contrib-label">' + label + '</span></div>';
  };

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ---------- 空状态 / 数值兜底 ---------- */
  function emptyNote(el, msg) {
    if (!el) return;
    el.innerHTML = '<div class="empty"><i class="fa-solid fa-database"></i>' + msg + '</div>';
  }
  const dash = v => (v === undefined || v === null || v === '') ? '—' : v;
  const dashNum = v => (v === undefined || v === null || v === '') ? '—' : (typeof v === 'number' ? v.toLocaleString() : v);
  const sectionRefreshBtn = key => '<button class="section-refresh-btn" data-refresh-section="' + key + '" title="重新采集本板块" onclick="event.stopPropagation()"><i class="fa-solid fa-rotate"></i></button>';

  /* ============================================================
     人工数据来源标记（AI 识别填入）
     - 写入时记录 artist._fieldSources[path] = { source:'manual_ai', sourceText, updatedAt }
     - 报告页渲染：来源为 manual_ai 的字段显示蓝色 + 「人工」标签
     ============================================================ */
  const isManual = (a, path) => !!(a && a._fieldSources && a._fieldSources[path]);
  const mval = (a, path, val, unitHtml) => {
    if (val === undefined || val === null || val === '') return dash(val);
    if (isManual(a, path)) {
      const src = a._fieldSources[path];
      return '<span class="manual-value" title="人工数据：' + (src.sourceText || '') + '">' + val + '</span>' + (unitHtml || '');
    }
    return val + (unitHtml || '');
  };

  /* ---------- 规则识别器：从人工文本中提取可用的音乐人数据字段 ----------
   * 返回 [{ path, label, value, unit, sourceText, confidence }] */
  function parseManualText(text) {
    const results = [];
    if (!text) return results;
    const t = text.replace(/\s+/g, ' ');
    const push = (path, label, value, unit, sourceText, confidence) => {
      if (value === null || value === undefined || isNaN(value)) return;
      results.push({ path: path, label: label, value: value, unit: unit, sourceText: sourceText || '', confidence: confidence || 'medium' });
    };
    const numWan = s => {
      if (!s) return null;
      s = String(s).trim();
      const m = s.match(/^([\d.]+)\s*(万|w|W|亿)?$/);
      if (!m) return null;
      const n = parseFloat(m[1]);
      if (m[2] === '亿') return n * 10000;
      return (m[2] === '万' || m[2] === 'w' || m[2] === 'W') ? n : n / 10000;
    };
    const numPlain = s => {
      if (!s) return null;
      const m = String(s).trim().match(/^([\d.]+)(万|w|W|亿)?$/);
      if (!m) return null;
      const n = parseFloat(m[1]);
      if (m[2] === '亿') return n * 100000000;
      if (m[2] === '万' || m[2] === 'w' || m[2] === 'W') return n * 10000;
      return n;
    };

    /* ---- 艺人名 ---- */
    const nameM = t.match(/^([\u4e00-\u9fa5A-Za-z0-9（）()\s·.·]{2,20}?)[，,、。\s]|^([\u4e00-\u9fa5A-Za-z0-9（）()\s·.·]{2,20})$/);
    if (nameM) {
      const nm = (nameM[1] || nameM[2] || '').trim();
      if (nm && nm.length >= 2 && !/粉丝|超话|网易云|微博|小红书|大麦|秀动|周边|演出|票价|场次|城市|乐迷|帖子|阅读|互动|讨论|想看|许愿|求购|开箱|获赞|笔记|专辑|歌曲/.test(nm)) {
        results.push({ path: 'name', label: '音乐人名称', value: nm, unit: null, sourceText: nm, confidence: 'high' });
      }
    }

    /* ---- 微博 ---- */
    let m = t.match(/(?:微博)\s*粉丝\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (!m) m = t.match(/(?:微博)\s*([\d.]+)\s*(万|w|W|亿)?/);   /* 简写：微博160.6w */
    if (m && m[1] != null) push('social.weibo.fans', '微博粉丝量', numWan(m[1] + (m[2] || '')), '万', m[0], m[2] ? 'high' : 'medium');
    m = t.match(/(?:微博)\s*(?:近\s*20\s*条|近\s*30\s*条)?\s*互动(?:均值)?\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (m) push('social.weibo.interactAvg', '微博互动均值', numPlain(m[1] + (m[2] || '')), '', m[0], 'medium');
    m = t.match(/(?:微博)\s*讨论(?:度|帖)?\s*[:：]?\s*([\d.]+)\s*(?:帖|条)?/);
    if (m) push('social.weibo.discussion.postCount30d', '微博近30天讨论帖数', numPlain(m[1] + (m[2] || '')), '帖', m[0], 'medium');

    /* ---- 超话 ---- */
    m = t.match(/(?:超话|乐迷)\s*(?:粉丝|乐迷)?\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (m) push('social.weibo.chaohuaFans', '超话粉丝/乐迷数', numWan(m[1] + (m[2] || '')), '万', m[0], 'high');
    m = t.match(/(?:超话)?\s*(?:帖子|贴子|帖)\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (m) push('social.weibo.chaohuaPosts', '超话帖子数', numPlain(m[1] + (m[2] || '')), '条', m[0], 'high');
    m = t.match(/(?:超话)\s*(?:阅读|阅读量)\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (m) push('social.weibo.chaohuaReads', '超话阅读数', numWan(m[1] + (m[2] || '')), '万', m[0], 'medium');

    /* ---- 网易云 ---- */
    m = t.match(/(?:网易云|网易云音乐)\s*粉丝\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (m) push('social.netease.followers', '网易云粉丝量', numWan(m[1] + (m[2] || '')), '万', m[0], 'high');
    m = t.match(/(?:网易云|网易云音乐)\s*(?:歌曲|单曲)\s*[:：]?\s*([\d.]+)\s*首/);
    if (m) push('social.netease.songCount', '网易云歌曲数', numPlain(m[1]), '首', m[0], 'medium');
    m = t.match(/(?:网易云|网易云音乐)\s*专辑\s*[:：]?\s*([\d.]+)\s*张/);
    if (m) push('social.netease.albumCount', '网易云专辑数', numPlain(m[1]), '张', m[0], 'medium');

    /* ---- 小红书 ---- */
    m = t.match(/(?:小红书)\s*粉丝\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (!m) m = t.match(/(?:小红书)\s*([\d.]+)\s*(万|w|W|亿)?/);   /* 简写：小红书10.8w */
    if (m && m[1] != null) push('social.xiaohongshu.fans', '小红书粉丝量', numWan(m[1] + (m[2] || '')), '万', m[0], m[2] ? 'high' : 'medium');
    m = t.match(/(?:小红书)\s*(?:获赞收藏|获赞与收藏|获赞)\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (!m) m = t.match(/([\d.]+)\s*(万|w|W|亿)?\s*(?:获赞收藏|获赞与收藏)/);   /* 数字在前：78w获赞收藏 */
    if (m) push('social.xiaohongshu.likesCollects', '小红书获赞收藏', numWan(m[1] + (m[2] || '')), '万', m[0], 'medium');
    m = t.match(/(?:小红书)?\s*(?:周边|周边最热帖|周边热帖)\s*(?:最热帖|热帖)?\s*(?:获赞|赞数|点赞)\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (!m) m = t.match(/(?:小红书)?\s*(?:周边|周边最热帖|周边热帖)\s*(?:最热帖|热帖)?\s*([\d.]+)\s*(万|w|W|亿)?\s*赞/);
    if (m) push('merch.discussion.xhsTopLikes.likes', '小红书周边最热帖获赞', numPlain(m[1] + (m[2] || '')), '赞', m[0], 'medium');

    /* ---- 抖音（待接入平台，人工数据可先填写） ---- */
    m = t.match(/(?:抖音)\s*粉丝\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (!m) m = t.match(/(?:抖音)\s*([\d.]+)\s*(万|w|W|亿)?/);   /* 简写：抖音146.9w */
    if (m && m[1] != null) push('social.douyin.fans', '抖音粉丝量', numWan(m[1] + (m[2] || '')), '万', m[0], m[2] ? 'high' : 'medium');
    m = t.match(/(?:抖音)[^（(]*（?\s*([\d.]+)\s*(万|w|W|亿)?\s*(?:获赞|总获赞)/);
    if (m) push('social.douyin.totalLikes', '抖音总获赞', numWan(m[1] + (m[2] || '')), '万', m[0], 'medium');

    /* ---- 付费行为：大麦/秀动 ---- */
    m = t.match(/(?:近\s*12\s*月)?\s*演出\s*(?:场次|场数)?\s*[:：]?\s*([\d.]+)\s*场/);
    if (m) push('paid.shows', '演出场次', numPlain(m[1]), '场', m[0], 'medium');
    m = t.match(/(?:覆盖|城市)\s*[:：]?\s*([\d.]+)\s*城/);
    if (m) push('paid.cities', '城市覆盖数', numPlain(m[1]), '城', m[0], 'medium');
    m = t.match(/(?:票价|票价区间|票价档位)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*[~-]\s*(\d+(?:\.\d+)?)\s*元/);
    if (m) { push('paid.priceMin', '最低票价', numPlain(m[1]), '元', m[0], 'high'); push('paid.priceMax', '最高票价', numPlain(m[2]), '元', m[0], 'high'); }
    m = t.match(/(?:票价|票价区间)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*元/);
    if (m && !results.some(r => r.path === 'paid.priceMin')) { push('paid.priceMax', '最高票价', numPlain(m[1]), '元', m[0], 'medium'); }
    /* 括号票价档位：【366/666/922/1266】 */
    m = t.match(/【\s*([\d.]+)(?:[/／\s]+[\d.]+)+\s*】/);
    if (m) {
      const nums = m[0].match(/[\d.]+/g).map(Number);
      if (nums.length) {
        push('paid.priceMin', '最低票价', Math.min.apply(null, nums), '元', m[0], 'high');
        push('paid.priceMax', '最高票价', Math.max.apply(null, nums), '元', m[0], 'high');
      }
    }
    m = t.match(/(?:大麦)?\s*(?:「想看」|想看)\s*(?:人数)?\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (m) push('paid.wantSee', '大麦想看人数', numWan(m[1] + (m[2] || '')), '万', m[0], 'high');
    m = t.match(/(?:大麦)?\s*(?:许愿|许愿人数)\s*[:：]?\s*([\d.]+)\s*(万|w|W|亿)?/);
    if (m) push('paid.wish', '大麦许愿人数', numWan(m[1] + (m[2] || '')), '万', m[0], 'medium');

    /* ---- 周边消费（微博） ---- */
    m = t.match(/(?:周边|周边消费)\s*(?:讨论|讨论度|帖数)?\s*[:：]?\s*([\d.]+)\s*(?:帖|条)/);
    if (m) push('merch.discussion.weiboTotal', '周边讨论帖数', numPlain(m[1]), '帖', m[0], 'medium');
    m = t.match(/(?:求购|求购讨论)\s*[:：]?\s*([\d.]+)\s*(?:帖|条)/);
    if (m) push('merch.discussion.weiboDemand', '周边求购讨论', numPlain(m[1]), '帖', m[0], 'medium');
    m = t.match(/(?:开箱|晒图|晒单)\s*[:：]?\s*([\d.]+)\s*(?:帖|条)/);
    if (m) push('merch.discussion.weiboSupply', '周边开箱晒图', numPlain(m[1]), '帖', m[0], 'medium');

    /* ---- 周边渠道 / 品类 / 销量（人工数据） ---- */
    m = t.match(/购买[:：]\s*([^。\n]+?)(?=\s*(?:销量|ps|特殊属性|$))/);
    if (m) {
      const shops = m[1].split(/[、，,]/).map(s => s.replace(/（[^）]*）/g, '').trim()).filter(Boolean);
      if (shops.length) results.push({ path: 'merch.officialShops', label: '官方周边渠道', value: shops, unit: null, sourceText: m[0], confidence: 'medium' });
      results.push({ path: 'merch.official', label: '有官方周边', value: true, unit: null, sourceText: m[0], confidence: 'high' });
    }
    m = t.match(/周边（([^）]+)）/);
    if (m) {
      const types = m[1].split(/[、，,]/).map(s => s.replace(/[\d.]+\+?/g, '').trim()).filter(Boolean);
      if (types.length) results.push({ path: 'merch.types', label: '周边品类', value: types, unit: null, sourceText: m[0], confidence: 'medium' });
    }
    m = t.match(/销量[:：]\s*([^。\n]+?)(?=\s*(?:ps|特殊属性|$))/);
    if (m) results.push({ path: 'merch.notes', label: '周边销量备注', value: m[1].trim(), unit: null, sourceText: m[0], confidence: 'medium' });

    /* 去重：同一 path 保留 sourceText 更长的（更精确） */
    const seen = {};
    return results.filter(r => {
      const k = r.path;
      if (!seen[k]) { seen[k] = r; return true; }
      if (r.sourceText.length > seen[k].sourceText.length) { seen[k] = r; return true; }
      return false;
    });
  }

  /* ============================================================
     首页 · 商业分析
     ============================================================ */
  function initHome() {
    const selArtist = $('#sel-artist');
    const btnGenerate = $('#btn-generate');
    const stepsWrap = $('#progress-steps');

    /* 选项填充（隐藏 select 保留，供原跳转逻辑复用） */
    M.artists.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id; opt.textContent = a.name + '（' + a.genre + '）';
      selArtist.appendChild(opt);
    });

    /* 统计卡：实时计算 */
    renderKPIs();
    function renderKPIs() {
      const now = new Date();
      const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const total = M.reports.length;
      const month = M.reports.filter(r => (r.date || r.time || '').startsWith(ym)).length;
      /* 平均分：取当前 M.artists 中有报告记录的音乐人实时分数均值（近30天） */
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
      const recentReportedIds = new Set(
        M.reports.filter(r => {
          const d = r.date || r.time;
          return d && new Date(d) >= thirtyDaysAgo;
        }).map(r => r.artistId)
      );
      const recentArtists = M.artists.filter(a => recentReportedIds.has(a.id));
      const avg = recentArtists.length
        ? Math.round(recentArtists.reduce((s, a) => s + (a.score || 0), 0) / recentArtists.length)
        : null;
      /* 高价值：总分 ≥ 200（满分 300，约等于原"85分"比例） */
      const reportedIds = new Set(M.reports.map(r => r.artistId));
      const highValue = M.artists.filter(a => reportedIds.has(a.id) && a.score >= 200).length;
      $('#kpi-total').textContent = total || 0;
      $('#kpi-month').textContent = month || 0;
      $('#kpi-avg').textContent = avg != null ? avg : '—';
      $('#kpi-high').textContent = highValue || 0;
      /* 同步更新 kpi-sub 中的当月标签 */
      const kpiMonthSub = document.getElementById('kpi-month-label');
      if (kpiMonthSub) kpiMonthSub.textContent = ym;
    }

    /* 近期分析图表（初始化调用，生成报告后刷新） */
    renderScoreChart();

    /* 搜索直达组件：替换下拉选择，候选点击直接生成报告 */
    initArtistSearch();

    /* 「生成报告」按钮保留：作为搜索已选中后的备用触发 */
    btnGenerate.addEventListener('click', runAnalysis);

    /* URL 参数自动触发：从音乐人库点「生成报告」跳转过来时，自动选中艺人并展开面板 */
    const autoGenerateId = urlParam('generate');
    if (autoGenerateId) {
      const panel = document.getElementById('generate-panel');
      const btnEntry = document.getElementById('btn-quick-entry');
      if (panel) { panel.style.display = 'block'; if (btnEntry) btnEntry.style.display = 'none'; }
      selArtist.value = autoGenerateId;
      /* 触发搜索直达组件同步选中状态 */
      const searchInput = document.getElementById('artist-search-input');
      const a = M.artists.find(x => x.id === autoGenerateId);
      if (searchInput && a) searchInput.value = a.name + '（' + a.genre + '）';
      setTimeout(() => panel && panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }

    /* ---------- 近期分析图表 ---------- */
    function renderScoreChart() {
      const wrap = document.getElementById('score-chart');
      if (!wrap) return;
      wrap.innerHTML = '';

      /* 取最近 8 条报告（有对应音乐人），去重保留最新一条 */
      const seen = new Set();
      const rows = [];
      for (const r of M.reports) {
        if (seen.has(r.artistId)) continue;
        const a = M.artists.find(x => x.id === r.artistId);
        if (!a) continue;
        seen.add(r.artistId);
        rows.push({ a, r });
        if (rows.length >= 8) break;
      }

      if (!rows.length) {
        const empty = document.createElement('div');
        empty.className = 'chart-empty';
        empty.innerHTML = '<i class="fa-solid fa-chart-bar"></i> 暂无分析记录 · 生成报告后在此展示';
        wrap.appendChild(empty);
        return;
      }

      /* 最大值基准：300 分满分，条宽按百分比 */
      const MAX = 300;
      rows.forEach(({ a, r }) => {
        const dims = a.dims || { paid: 0, social: 0, fans: 0 };
        const total = a.score || 0;
        const paidPct  = Math.round((dims.paid  || 0) / MAX * 100);
        const socialPct= Math.round((dims.social || 0) / MAX * 100);
        const fansPct  = Math.round((dims.fans   || 0) / MAX * 100);
        const totalPct = Math.round(total / MAX * 100);
        const cls = total >= 200 ? 'high' : total >= 100 ? 'mid' : 'low';

        const row = document.createElement('div');
        row.className = 'chart-row';
        row.innerHTML =
          '<div class="chart-name">' +
            '<img src="' + avatar(a.avatar) + '" class="chart-avatar" alt="">' +
            '<span class="chart-name-text">' + a.name + '</span>' +
            '<span class="chart-score-badge ' + cls + '">' + total + '</span>' +
          '</div>' +
          '<div class="chart-bars">' +
            '<div class="chart-bar-track">' +
              '<div class="chart-bar-seg paid"  style="width:0%" data-w="' + paidPct  + '%"></div>' +
              '<div class="chart-bar-seg social" style="width:0%" data-w="' + socialPct + '%"></div>' +
              '<div class="chart-bar-seg fans"  style="width:0%" data-w="' + fansPct  + '%"></div>' +
            '</div>' +
            '<span class="chart-pct">' + totalPct + '%</span>' +
          '</div>';
        row.addEventListener('click', () => location.href = 'report.html?id=' + a.id + '&type=' + encodeURIComponent(r.coop || ''));
        wrap.appendChild(row);
      });

      /* 入场动画：下一帧展开 */
      requestAnimationFrame(() => {
        wrap.querySelectorAll('.chart-bar-seg').forEach(seg => {
          seg.style.transition = 'width 0.7s cubic-bezier(0.25,1,0.5,1)';
          seg.style.width = seg.dataset.w;
        });
      });
    }

    /* ---------- 音乐人搜索直达 ---------- */
    function initArtistSearch() {
      const selectField = $('#sel-artist') ? $('#sel-artist').closest('.form-field') : null;
      if (selectField) selectField.style.display = 'none';

      const field = document.createElement('div');
      field.className = 'form-field';
      field.setAttribute('data-metainfo', '分子-音乐人搜索');
      field.innerHTML =
        '<label class="form-label" data-metainfo="原子-文字">选择音乐人</label>' +
        '<div class="artist-search-wrap" data-metainfo="分子-搜索组件">' +
          '<input type="text" class="artist-search-input" id="artist-search-input" placeholder="搜索音乐人，选中后确认生成报告…" autocomplete="off" data-metainfo="原子-控件">' +
          '<div class="artist-dropdown" id="artist-dropdown" data-metainfo="分子-候选列表"></div>' +
        '</div>' +
        (M.artists.length ? '' : '<div class="form-note" data-metainfo="原子-文字"><i class="fa-solid fa-circle-info"></i> 音乐人数据待采集接入，接入后即可搜索</div>');
      if (selectField && selectField.parentNode) {
        selectField.parentNode.insertBefore(field, selectField);
      } else {
        btnGenerate.closest('.card').prepend(field);
      }

      const input = field.querySelector('.artist-search-input');
      const dd = field.querySelector('.artist-dropdown');

      function renderOptions(kw) {
        const kwl = (kw || '').trim().toLowerCase();
        let list = M.artists;
        if (kwl) list = M.artists.filter(a => (a.name + a.genre + a.style).toLowerCase().includes(kwl));
        if (!list.length) {
          dd.innerHTML = '<div class="artist-option empty" data-metainfo="原子-文字">未找到匹配的音乐人</div>' +
            '<a class="artist-add-link" href="artists.html?add=1" data-metainfo="原子-链接"><i class="fa-solid fa-plus"></i> 提报新音乐人入库</a>';
        } else {
          dd.innerHTML = list.map(a =>
            '<div class="artist-option" data-id="' + a.id + '" data-metainfo="分子-候选">' +
              '<img src="' + avatar(a.avatar) + '" alt="">' +
              '<div class="ao-main">' +
                '<div class="ao-name">' + a.name + '</div>' +
                '<div class="ao-meta">' + a.genre + ' · ' + a.style + '</div>' +
              '</div>' +
              '<span class="score-label ' + scoreClsOf(a.score) + '">' + a.score + ' ' + scoreLabelOf(a.score) + '</span>' +
            '</div>'
          ).join('');
        }
        dd.classList.add('open');
      }

      input.addEventListener('input', () => renderOptions(input.value));
      input.addEventListener('focus', () => { if (!input.value.trim()) renderOptions(''); });
      /* 失焦延迟收起；候选区 mousedown 阻止失焦，避免点击与收起竞态 */
      input.addEventListener('blur', () => setTimeout(() => dd.classList.remove('open'), 150));
      dd.addEventListener('mousedown', e => e.preventDefault());
      dd.addEventListener('click', e => {
        const opt = e.target.closest('.artist-option[data-id]');
        if (!opt) return;
        const a = artistById(opt.dataset.id);
        if (!a) return;
        selArtist.value = a.id;      /* 同步隐藏 select，供确认流程复用 */
        input.value = a.name;
        dd.classList.remove('open');
        /* 选中后不直接分析：需点击下方「生成报告」按钮确认（避免搜索误触直接进入采集分析） */
        btnGenerate.classList.add('ready');
        btnGenerate.innerHTML = '<i class="fa-solid fa-circle-check"></i> 确认生成「' + a.name + '」报告';
        toast('已选择「' + a.name + '」，点击下方按钮确认生成报告');
      });
    }

    /* ---------- 生成报告流程（核心原则：报告页每个数据板块 = 生成报告时全量采集的数据源；
       采集 → 合并去重 → 评分 → 完整呈现，不依赖手工填充；采集不到的平台如实标注「待采集」） ---------- */
    let analyzing = false;   /* 防重入：流程进行中忽略重复触发 */
    function runAnalysis() {
      if (analyzing) return;
      if (!selArtist.value) { toast('请先选择音乐人'); return; }
      /* 合作方向固定为周边合作，报告默认覆盖当前设计的全部板块 */
      const coop = ['周边'];
      const dims = M.dims.map(d => d.label);

      analyzing = true;
      btnGenerate.disabled = true;
      stepsWrap.innerHTML = '';
      const steps = [
        '采集数据快照（大麦 / 秀动 / 微博粉丝·讨论度 / 网易云 / 抖音）',
        '计算三维评分（付费行为·社媒热度·粉丝粘性）',
        '生成 AI 合作建议',
        '完成，报告已生成'
      ];
      steps.forEach(t => {
        const s = document.createElement('div');
        s.className = 'progress-step';
        s.innerHTML = '<span class="step-icon"><i class="fa-solid fa-spinner fa-spin"></i></span>' + t;
        stepsWrap.appendChild(s);
      });
      const stepEls = $$('.progress-step', stepsWrap);
      const markDone = idx => {
        stepEls[idx].className = 'progress-step done';
        stepEls[idx].querySelector('.step-icon').innerHTML = '<i class="fa-solid fa-check"></i>';
      };
      const markRunning = idx => {
        stepEls[idx].classList.add('running');
        stepEls[idx].querySelector('.step-icon').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      };

      /* 第 1 步：全量采集（服务端无头浏览器 + 纯 HTTP，按数据源清单逐项抓取：
         网易云(艺人) → 秀动(演出) → 微博讨论度 → 周边消费讨论 → 大麦(演出，反爬受限) → 微博(粉丝) → 抖音(待接入)；
         关键词规则：本名优先；本名无结果或近30天为0时自动尝试联想别名（如「南青乐队」→「南青」）继续搜索；
         采集结果合并进艺人数据（只填空缺、跨平台场次按日期+城市去重），评分重算，报告完整呈现） */
      markRunning(0);
      const artist = artistById(selArtist.value);
      const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
      const task = {
        id: 't' + Date.now(),
        artistId: selArtist.value,
        type: coop.join(','),
        owner: '当前用户',
        time: now,
        status: 'running',
        note: '正在采集数据快照'
      };
      M.tasks.unshift(task);
      persistAnalytics();
      (async () => {
        let collectNote = '';
        let collectOk = true;   // 是否真正采集到数据
        if (artist) {
          try {
            const data = await apiCollect(artist.name, artist.weiboAlias || []);
            mergeCollect(artist, data);
            if (window.ScoreEngine) window.ScoreEngine.calcScore(artist);
            persistArtists();
            const okCount = data.sources.filter(s => s.ok).length;
            const failCount = data.sources.length - okCount;
            collectOk = okCount > 0;
            collectNote = '成功 ' + okCount + ' 源 / 受限 ' + failCount + ' 源' +
              (data.damai && data.damai.showCount != null ? ' · 大麦 ' + data.damai.showCount + ' 场' : '');
          } catch (e) {
            /* 采集服务不可用（纯前端演示模式）：标注数据待采集，报告页如实展示空状态 */
            collectOk = true;   /* 演示模式：允许生成报告，报告页各板块显示「待采集」 */
            collectNote = '演示模式（采集服务未接入）';
          }
        }
        markDone(0);
        task.note = collectNote || (collectOk ? '采集完成' : '采集失败');
        if (!collectOk) task.status = 'failed';
        persistAnalytics();
        stepEls[0].innerHTML = '<span class="step-icon"><i class="fa-solid ' + (collectOk ? 'fa-check' : 'fa-triangle-exclamation') + '"></i></span>采集数据快照（' + collectNote + '）';

        /* 第 2~4 步：评分 / 建议 / 完成 */
        let i = 1;
        const timer = setInterval(() => {
          if (i > 1) markDone(i - 1);
          if (i < steps.length) markRunning(i);
          i++;
          if (i > steps.length) {
            clearInterval(timer);
            btnGenerate.disabled = false;
            analyzing = false;

            /* 如实反映采集结果：无数据时明确提示「未采集到数据」 */
            const lastStep = stepEls[stepEls.length - 1];
            lastStep.innerHTML = '<span class="step-icon"><i class="fa-solid ' + (collectOk ? 'fa-check' : 'fa-triangle-exclamation') + '"></i></span>' +
              (collectOk ? '完成，报告已生成' : '完成（未采集到数据）');
            lastStep.className = 'progress-step done' + (collectOk ? '' : ' warn');
            if (!collectOk) toast('采集失败，任务已标记失败，未生成空报告');

            task.status = collectOk ? 'done' : 'failed';
            task.note = collectNote || (collectOk ? '采集完成' : '采集失败');
            if (collectOk) {
              /* 写入报告历史：只有真实采集有结果才生成报告，避免空报告伪装完成 */
              M.reports.unshift({ artistId: selArtist.value, coop: coop.join(','), time: now });
              /* 刷新首页统计卡 */
              renderKPIs();
              /* 刷新近期记录图表 */
              renderScoreChart();
            }
            /* 持久化任务/报告/统计，跨页同步 */
            persistAnalytics();
            /* 入库音乐人数据已更新，持久化 */
            persistArtists();

            if (collectOk) {
              toast('分析完成，正在打开报告…');
              setTimeout(() => {
                location.href = 'report.html?id=' + selArtist.value + '&type=' + encodeURIComponent(coop.join(','));
              }, 600);
            } else {
              toast('采集失败，任务已标记失败，未生成空报告');
            }
          }
        }, 600);
      })();
    }
  }

  /* ============================================================
     音乐人库 · 列表
     ============================================================ */
  function initArtists() {
    const tbody = $('#artist-tbody');
    const inputSearch = $('#f-search');
    const selPlatform = $('#f-platform');
    const selFans = $('#f-fans');
    const selScore = $('#f-score');
    let sortKey = 'score';
    let sortAsc = false;

    function rowHtml(a) {
      const wb = (a.social && a.social.weibo) || {};
      /* 人工识别数据在列表页也标蓝（mval 渲染蓝色 + 人工标签） */
      const fansWan = wb.fans != null ? mval(a, 'social.weibo.fans', wb.fans, wb.fansUnit || '万') : '待采集';
      /* 网易云站内粉丝量（独立参考字段，替代原微博互动率列） */
      const nt = (a.social && a.social.netease) || {};
      const neteaseFans = nt.followers != null ? mval(a, 'social.netease.followers', nt.followers, nt.followersUnit || '万') : '待采集';
      return '<tr class="row-click" data-id="' + a.id + '">' +
        '<td><div class="artist-cell"><img src="' + avatar(a.avatar) + '" alt="">' +
          '<div><div class="name">' + a.name + '</div><div class="meta">' + a.genre + ' · ' + a.style + '</div></div></div></td>' +
        '<td><span class="tag">微博</span><span class="tag">抖音</span><span class="tag">小红书' + ((a.social && a.social.xiaohongshu && a.social.xiaohongshu.fans != null) ? '' : '*') + '</span></td>' +
        '<td class="num">' + fansWan + '</td>' +
        '<td class="num">' + neteaseFans + '</td>' +
        '<td><div class="score-cell">' +
          '<div class="score-top">' +
            '<span class="score-num">' + a.score + '</span>' +
            '<span class="score-label ' + scoreClsOf(a.score) + '">' + scoreLabelOf(a.score) + '</span>' +
          '</div>' +
          '<div class="score-bar-wrap">' +
            '<div class="score-bar-seg seg-paid" style="width:' + (a.dims.paid / 3).toFixed(1) + '%"></div>' +
            '<div class="score-bar-seg seg-social" style="width:' + (a.dims.social / 3).toFixed(1) + '%"></div>' +
            '<div class="score-bar-seg seg-fans" style="width:' + (a.dims.fans / 3).toFixed(1) + '%"></div>' +
          '</div>' +
          '<div class="score-bar-legend">' +
            '<span>付费 ' + Math.round(a.dims.paid) + '</span>' +
            '<span>社媒 ' + Math.round(a.dims.social) + '</span>' +
            '<span>粘性 ' + Math.round(a.dims.fans) + '</span>' +
          '</div>' +
        '</div></td>' +
        '<td class="num" style="font-size:12px;color:var(--text3)">' + a.snapshotTime + '</td>' +
        '<td><div class="artist-actions">' +
          (hasCollectData(a)
            ? '<button class="btn btn-link btn-sm" data-view="' + a.id + '"><i class="fa-solid fa-file-lines"></i> 查看报告</button>'
            : '<span class="muted" style="font-size:11px">待采集</span>') +
          (STATIC_MODE ? '' : '<button class="btn btn-ghost btn-xs danger" data-delete="' + a.id + '" title="删除音乐人"><i class="fa-solid fa-trash"></i></button>') + '</div></td>' +
      '</tr>';
    }

    function render() {
      const kw = inputSearch.value.trim().toLowerCase();
      let list = M.artists.filter(a => {
        if (kw && !(a.name + a.genre + a.style).toLowerCase().includes(kw)) return false;
        if (selPlatform.value && !a.platformsForFilter(selPlatform.value)) return false;
        if (selFans.value) {
          const f = ((a.social && a.social.weibo) || {}).fans;
          if (f == null) return false;
          const [min, max] = selFans.value.split('-').map(Number);
          if (f < min || (max && f >= max)) return false;
        }
        if (selScore.value) {
          const [min, max] = selScore.value.split('-').map(Number);
          if (a.score < min || (max && a.score >= max)) return false;
        }
        return true;
      });
      list.sort((x, y) => {
        const nx = x.social && x.social.netease;
        const ny = y.social && y.social.netease;
        const vx = sortKey === 'score' ? (x.score || 0) : sortKey === 'fans' ? (((x.social && x.social.weibo) || {}).fans || 0) : sortKey === 'netfans' ? ((nx && nx.followers) || 0) : (x.score || 0);
        const vy = sortKey === 'score' ? (y.score || 0) : sortKey === 'fans' ? (((y.social && y.social.weibo) || {}).fans || 0) : sortKey === 'netfans' ? ((ny && ny.followers) || 0) : (y.score || 0);
        return sortAsc ? vx - vy : vy - vx;
      });
      tbody.innerHTML = list.length ? list.map(rowHtml).join('')
        : (M.artists.length
            ? '<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-magnifying-glass"></i>没有匹配的音乐人，换个筛选条件试试</div></td></tr>'
            : '<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-database"></i>暂无音乐人数据 · 待数据采集接入后展示</div></td></tr>');
    }

    /* 平台筛选：按音乐人实际数据判断（小红书账号数据采到才算接入） */
    M.artists.forEach(a => { a.platformsForFilter = p => p === 'xiaohongshu' ? !!a.social.xiaohongshu : true; });

    inputSearch.addEventListener('input', render);
    selPlatform.addEventListener('change', render);
    selFans.addEventListener('change', render);
    selScore.addEventListener('change', render);

    /* ---------- 评分规则 Modal ---------- */
    const ruleModal = $('#score-rule-modal');
    if (ruleModal) {
      $('#btn-score-rule').addEventListener('click', e => { e.stopPropagation(); ruleModal.classList.add('open'); });
      $('#score-rule-close').addEventListener('click', () => ruleModal.classList.remove('open'));
      ruleModal.addEventListener('click', e => { if (e.target === ruleModal) ruleModal.classList.remove('open'); });
    }

    /* ---------- 生成报告 Modal ---------- */
    const ALL_COOP = ['周边', '品牌合作', '线下活动', '数字内容'];
    const genModal = $('#gen-report-modal');
    let genArtistId = null;
    let selectedCoop = [];

    function openGenModal(id) {
      if (!genModal) return;
      const a = M.artists.find(x => x.id === id);
      if (!a) return;
      genArtistId = id;
      selectedCoop = (a.cooperation || []).slice();

      const info = $('#gen-artist-info');
      if (info) info.innerHTML =
        '<img src="' + avatar(a.avatar) + '" class="gen-artist-avatar">' +
        '<div><div class="gen-artist-name">' + a.name + '</div>' +
        '<div class="gen-artist-meta"><span class="tag">' + a.genre + '</span><span class="tag">' + a.style + '</span>' +
        '<span class="score-badge-sm">' + a.score + ' 分</span></div></div>';

      const tagsEl = $('#gen-coop-tags');
      if (tagsEl) {
        tagsEl.innerHTML = ALL_COOP.map(t =>
          '<button class="coop-tag' + (selectedCoop.includes(t) ? ' active' : '') + '" data-coop="' + t + '">' + t + '</button>'
        ).join('');
        tagsEl.querySelectorAll('.coop-tag').forEach(btn => {
          btn.addEventListener('click', () => {
            const v = btn.dataset.coop;
            if (selectedCoop.includes(v)) selectedCoop = selectedCoop.filter(x => x !== v);
            else selectedCoop.push(v);
            btn.classList.toggle('active', selectedCoop.includes(v));
          });
        });
      }
      genModal.classList.add('open');
    }

    if (genModal) {
      const closeGen = () => { genModal.classList.remove('open'); genArtistId = null; };
      $('#gen-modal-close').addEventListener('click', closeGen);
      $('#gen-modal-cancel').addEventListener('click', closeGen);
      genModal.addEventListener('click', e => { if (e.target === genModal) closeGen(); });
      $('#gen-modal-confirm').addEventListener('click', async () => {
        if (!genArtistId) return;
        const targetId = genArtistId;
        const artist = M.artists.find(x => x.id === targetId);
        if (!artist) return;
        const coopText = (selectedCoop.length ? selectedCoop : ['周边']).join('、');
        const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');

        /* 关键修复：音乐人库生成报告必须先真实采集，禁止先写 complete 报告。
           之前这里直接 M.reports.unshift(... complete:true)，导致按钮立刻变「查看报告」，但报告是空的。 */
        closeGen();
        const genBtn = tbody.querySelector('[data-generate="' + targetId + '"]');
        if (genBtn) {
          genBtn.disabled = true;
          genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 正在采集…';
          genBtn.classList.remove('btn-ghost');
        }

        const task = {
          id: 't' + Date.now(),
          artistId: targetId,
          type: coopText,
          owner: '当前用户',
          time: now,
          status: 'running',
          note: '正在采集数据快照'
        };
        M.tasks.unshift(task);
        persistAnalytics();
        toast('开始采集数据，请稍等…');

        try {
          const data = await apiCollect(artist.name, artist.weiboAlias || []);
          const okCount = (data.sources || []).filter(s => s.ok).length;
          const failCount = (data.sources || []).length - okCount;
          if (okCount <= 0) throw new Error('未采集到有效数据');

          mergeCollect(artist, data);
          if (window.ScoreEngine) window.ScoreEngine.calcScore(artist);
          persistArtists();

          task.status = 'done';
          task.note = '成功 ' + okCount + ' 源 / 受限 ' + failCount + ' 源' +
            (data.damai && data.damai.showCount != null ? ' · 大麦 ' + data.damai.showCount + ' 场' : '');

          const existing = M.reports.find(r => r.artistId === targetId && r.complete);
          if (existing) { existing.time = now; existing.coop = coopText; }
          else M.reports.unshift({ artistId: targetId, coop: coopText, time: now, complete: true });
          persistAnalytics();

          render();
          toast('采集完成，正在打开报告…');
          setTimeout(() => {
            location.href = 'report.html?id=' + targetId + '&type=' + encodeURIComponent(coopText);
          }, 600);
        } catch (e) {
          task.status = 'failed';
          task.note = '采集失败：' + String(e.message || e).slice(0, 60);
          persistAnalytics();
          if (genBtn) {
            genBtn.disabled = false;
            genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 重新生成';
            genBtn.classList.add('btn-ghost');
          }
          render();
          toast('采集失败，未生成空报告');
        }
      });
    }

    tbody.addEventListener('click', e => {
      const viewBtn = e.target.closest('[data-view]');
      const delBtn = e.target.closest('[data-delete]');
      const genBtn = e.target.closest('[data-generate]');
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      if (delBtn) {
        e.stopPropagation();
        const id = delBtn.dataset.delete;
        const a = M.artists.find(x => x.id === id);
        if (!a) return;
        if (!confirm('确认删除音乐人「' + a.name + '」？此操作会从当前音乐人库移除。')) return;
        M.artists = M.artists.filter(x => x.id !== id);
        for (let i = extraArtists.length - 1; i >= 0; i--) if (extraArtists[i].id === id) extraArtists.splice(i, 1);
        deletedArtistIds.add(id);
        persistDeletedArtists();
        persistArtists();
        render();
        toast('已删除「' + a.name + '」');
      } else if (viewBtn) {
        e.stopPropagation();
        location.href = 'report.html?id=' + viewBtn.dataset.view;
      } else if (genBtn) {
        e.stopPropagation();
        openGenModal(genBtn.dataset.generate);
      } else {
        const id = row.dataset.id;
        const a = M.artists.find(x => x.id === id);
        const hasData = hasCollectData(a);
        if (hasData) location.href = 'report.html?id=' + id;
        else openGenModal(id);
      }
    });

    /* ============================================================
       AI 识别填入：粘贴人工收集文本 → 识别字段 → 确认写入（人工数据蓝色标记）
       ============================================================ */
    const aiModal = $('#ai-fill-modal');
    if (aiModal) {
      const aiArtistSel = $('#ai-fill-artist');
      const aiText = $('#ai-fill-text');
      const aiResult = $('#ai-fill-result');
      const aiRun = $('#ai-fill-run');
      const aiSubmit = $('#ai-fill-submit');
      let aiParsed = [];
      let aiArtistId = null;

      const setByPath = (obj, path, val) => {
        const parts = path.split('.');
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = val;
      };
      const getByPath = (obj, path) => {
        const parts = path.split('.');
        let cur = obj;
        for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
        return cur;
      };

      const openAiFill = () => {
        aiParsed = [];
        aiArtistId = null;
        aiText.value = '';
        aiResult.innerHTML = '';
        aiSubmit.disabled = true;
        aiArtistSel.innerHTML = '<option value="">请选择…</option>' + M.artists.map(a =>
          '<option value="' + a.id + '">' + a.name + '</option>').join('');
        aiModal.classList.add('open');
      };

      aiRun.addEventListener('click', () => {
        const text = aiText.value.trim();
        if (!text) { toast('请先粘贴人工收集的资料'); return; }
        const parsed = parseManualText(text);
        if (!parsed.length) { aiResult.innerHTML = '<div class="pending-text">未识别到可用字段，请检查文本格式（如“微博粉丝31.2万”“超话乐迷8072”）</div>'; return; }
        aiParsed = parsed;
        const nameHit = parsed.find(r => r.path === 'name');
        if (nameHit) {
          const core = x => String(x || '').replace(/[（(][^）)]*[）)]/g, '').trim();
          const hit = M.artists.find(a => core(a.name) === core(nameHit.value) || core(a.name).includes(core(nameHit.value)) || core(nameHit.value).includes(core(a.name)));
          if (hit) { aiArtistId = hit.id; aiArtistSel.value = hit.id; }
        }
        renderAiResult();
      });

      function renderAiResult() {
        const artist = aiArtistId ? M.artists.find(x => x.id === aiArtistId) : null;
        const rows = aiParsed.filter(r => r.path !== 'name').map(r => {
          const cur = artist ? getByPath(artist, r.path) : undefined;
          const src = artist && artist._fieldSources && artist._fieldSources[r.path];
          const isSystemValue = cur !== undefined && cur !== null && !(Array.isArray(cur) && !cur.length) && !(src && src.source === 'manual_ai');
          const isComplex = Array.isArray(r.value) || typeof r.value === 'boolean' || typeof r.value === 'string';
          const curShow = cur === undefined || cur === null || (Array.isArray(cur) && !cur.length) ? '<span class="muted">空</span>' : (Array.isArray(cur) ? cur.join('、') : cur);
          const conflict = !isComplex && cur !== undefined && cur !== null && String(cur) !== String(r.value) && Math.abs(Number(cur) - Number(r.value)) > 1e-9;
          const complexConflict = isComplex && isSystemValue && JSON.stringify(cur) !== JSON.stringify(r.value);
          const systemConflict = (conflict || complexConflict) && isSystemValue;
          const displayVal = (!isComplex && r.unit === '万' && r.value < 1 && r.value > 0 && /人|乐迷/.test(r.sourceText)) ? (r.value * 10000) : (isComplex ? '' : r.value);
          const valCell = isComplex
            ? '<span style="font-size:12px">' + (Array.isArray(r.value) ? r.value.join('、') : r.value) + '</span>'
            : '<input type="text" class="input" data-ai-val="' + r.path + '" value="' + displayVal + '" style="width:90px;padding:4px 8px;font-size:12px"' + (systemConflict ? ' disabled' : '') + '> <span class="muted">' + (r.unit || '') + '</span>';
          const badge = systemConflict
            ? ' <span class="manual-tag" style="background:rgba(239,68,68,.10);color:#dc2626;border-color:rgba(239,68,68,.25)">保留爬虫</span>'
            : (conflict || complexConflict ? ' <span class="manual-tag" style="background:rgba(234,179,8,.12);color:#b45309;border-color:rgba(234,179,8,.3)">冲突</span>' : '');
          return '<tr>' +
            '<td>' + r.label + '</td>' +
            '<td>' + curShow + badge + '</td>' +
            '<td>' + valCell + '</td>' +
            '<td class="muted" style="font-size:11px">' + r.sourceText + '</td>' +
            '<td>' + (systemConflict
              ? '<span class="muted" style="font-size:11px">不覆盖</span><input type="checkbox" data-ai-pick="' + r.path + '" disabled style="display:none">'
              : '<input type="checkbox" data-ai-pick="' + r.path + '" checked>') + '</td>' +
          '</tr>';
        }).join('');
        aiResult.innerHTML =
          '<div class="ai-fill-note"><i class="fa-solid fa-circle-info"></i> 识别到 ' + aiParsed.length + ' 个字段。若识别值与已有爬虫数据冲突，默认保留爬虫数据，不允许人工覆盖；空字段和已有人工字段可写入。</div>' +
          '<table class="rule-table ai-fill-table"><thead><tr><th>字段</th><th>当前值</th><th>识别值</th><th>来源</th><th>写入</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table>';
        aiSubmit.disabled = false;
      }

      aiArtistSel.addEventListener('change', () => { aiArtistId = aiArtistSel.value || null; if (aiParsed.length) renderAiResult(); });

      aiSubmit.addEventListener('click', () => {
        const artist = aiArtistId ? M.artists.find(x => x.id === aiArtistId) : null;
        if (!artist) { toast('请选择音乐人'); return; }
        let n = 0;
        aiParsed.filter(r => r.path !== 'name').forEach(r => {
          const pick = aiResult.querySelector('[data-ai-pick="' + r.path + '"]');
          if (pick && !pick.checked) return;
          const input = aiResult.querySelector('[data-ai-val="' + r.path + '"]');
          let val = r.value;
          if (input) {
            const parsed = parseFloat(input.value);
            if (isNaN(parsed)) return;
            val = parsed;
            if (r.unit === '万' && r.value < 1 && r.value > 0 && /人|乐迷/.test(r.sourceText)) {
              if (val >= 1 && val < 1000000 && /人|乐迷/.test(r.sourceText)) val = val / 10000;
            }
          }
          setByPath(artist, r.path, val);
          artist._fieldSources = artist._fieldSources || {};
          artist._fieldSources[r.path] = { source: 'manual_ai', sourceText: r.sourceText, updatedAt: new Date().toISOString() };
          /* 自动补齐单位字段（报告渲染需要） */
          if (r.unit === '万') {
            const unitMap = {
              'social.weibo.fans': 'fansUnit',
              'social.weibo.chaohuaFans': 'chaohuaFansUnit',
              'social.weibo.chaohuaReads': 'chaohuaReadsUnit',
              'social.netease.followers': 'followersUnit',
              'social.xiaohongshu.fans': 'fansUnit',
              'social.xiaohongshu.likesCollects': 'likesCollectsUnit',
              'social.douyin.fans': 'fansUnit',
              'social.douyin.totalLikes': 'totalLikesUnit'
            };
            const unitField = unitMap[r.path];
            if (unitField) {
              const base = r.path.split('.').slice(0, -1).join('.');
              const obj = getByPath(artist, base);
              if (obj && obj[unitField] == null) obj[unitField] = '万';
            }
          }
          n++;
        });
        if (!n) { toast('未选择任何字段'); return; }
        if (window.ScoreEngine) window.ScoreEngine.calcScore(artist);
        persistArtists();
        toast('已写入 ' + n + ' 个字段（人工数据）');
        aiModal.classList.remove('open');
        render();
      });

      $('#btn-ai-fill').addEventListener('click', openAiFill);
      $('#ai-fill-close').addEventListener('click', () => aiModal.classList.remove('open'));
      $('#ai-fill-cancel').addEventListener('click', () => aiModal.classList.remove('open'));
      aiModal.addEventListener('click', e => { if (e.target === aiModal) aiModal.classList.remove('open'); });
    }

    $$('#artist-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const k = th.dataset.sort;
        if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = false; }
        $$('#artist-table th.sortable').forEach(t => { t.querySelector('.sort-icon').innerHTML = ''; });
        th.querySelector('.sort-icon').innerHTML = sortAsc ? '▲' : '▼';
        render();
      });
    });

    /* ---------- 提报音乐人入库（输入名称 → 轻量识别网易云账号和微博名 → 用户确认入库） ---------- */
    const addModal = $('#add-artist-modal');
    const btnAdd = $('#btn-add-artist');
    if (addModal && btnAdd) {
      let identifyData = null;
      const openModal = () => addModal.classList.add('open');
      const closeModal = () => addModal.classList.remove('open');
      const resetModal = () => {
        identifyData = null;
        $('#af-name').value = '';
        $('#af-weibo-alias').value = '';
        $('#af-progress').innerHTML = '';
        $('#af-result').innerHTML = '';
        $('#add-modal-submit').disabled = true;
      };
      async function identifyArtistForSubmit() {
        const name = $('#af-name').value.trim();
        if (!name) { toast('请输入音乐人名称'); return; }
        if (M.artists.some(a => a.name === name)) { toast('「' + name + '」已在库中，可直接生成报告'); return; }
        const prog = $('#af-progress');
        const result = $('#af-result');
        const submit = $('#add-modal-submit');
        submit.disabled = true;
        identifyData = null;
        result.innerHTML = '';
        prog.innerHTML = '<div class="collect-item running"><i class="fa-solid fa-spinner fa-spin"></i><span>正在查找网易云账号和微博名…</span></div>';
        try {
          const r = await fetch('/api/identify?name=' + encodeURIComponent(name));
          const data = await r.json();
          if (data.error) throw new Error(data.error);
          identifyData = data;
          const ac = data.artist;
          const wb = data.weibo;
          if (ac && ac.name) $('#af-name').value = ac.name;
          if (wb && wb.name) $('#af-weibo-alias').value = wb.name;
          prog.innerHTML = (data.sources || []).map(s =>
            '<div class="collect-item ' + (s.ok ? 'ok' : 'fail') + '"><i class="fa-solid ' + (s.ok ? 'fa-circle-check' : 'fa-circle-xmark') + '"></i><span><b>' + s.source + '</b>：' + s.note + '</span></div>'
          ).join('');
          result.innerHTML = '<div class="collect-summary">' +
            (ac && ac.avatar ? '<img src="' + ac.avatar + '" alt="">' : '') +
            '<div class="cs-main"><div class="cs-name">' + (ac && ac.name ? ac.name : name) + '</div>' +
            '<div class="cs-meta">网易云：' + (ac ? ('ID ' + ac.id + ' · 歌曲 ' + (ac.musicSize || 0) + ' 首 / 专辑 ' + (ac.albumSize || 0) + ' 张') : '未找到') + '</div>' +
            '<div class="cs-meta">微博：' + (wb ? (wb.name + (wb.fansRaw ? ' · 粉丝 ' + wb.fansRaw : '')) : '未识别，可手动填写') + '</div>' +
            '<div class="cs-note">请确认名称和微博名；入库后，生成报告时再全量采集数据。</div></div></div>';
          submit.disabled = false;
        } catch (e) {
          prog.innerHTML = '<div class="collect-item fail"><i class="fa-solid fa-circle-xmark"></i><span>识别失败（' + String(e.message || e).slice(0, 50) + '）</span></div>';
          result.innerHTML = '<div class="collect-empty">可稍后重试；或只填写名称和微博名后入库。</div>';
          submit.disabled = false;
        }
      }
      btnAdd.addEventListener('click', () => { resetModal(); openModal(); });
      $('#add-modal-close').addEventListener('click', closeModal);
      $('#add-modal-cancel').addEventListener('click', closeModal);
      addModal.addEventListener('click', e => { if (e.target === addModal) closeModal(); });
      $('#af-identify').addEventListener('click', identifyArtistForSubmit);

      $('#add-modal-submit').disabled = true;
      $('#add-modal-submit').addEventListener('click', () => {
        const name = $('#af-name').value.trim();
        const aliasVal = $('#af-weibo-alias').value.trim();
        if (!name) { toast('请输入音乐人名称'); return; }
        if (M.artists.some(a => a.name === name)) { toast('「' + name + '」已在库中，可直接生成报告'); return; }
        const ac = identifyData && identifyData.artist;
        const wb = identifyData && identifyData.weibo;
        const artist = {
          id: 'a' + Date.now(),
          name: name,
          neteaseId: ac && ac.id ? ac.id : null,
          genre: '音乐人',
          style: '未分类',
          avatar: (ac && ac.avatar) || null,
          verified: false,
          weiboUrl: wb && wb.uid ? 'https://weibo.com/u/' + wb.uid : '',
          weiboAlias: aliasVal ? [aliasVal] : undefined,
          snapshotTime: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
          cooperation: ['周边', '品牌合作'],
          paid: {
            shows: null, cities: null, priceMin: null, priceMax: null, sellout: null, selloutHours: null,
            wantSee: null, wantSeeUnit: '万', wantSeeAvg: null, source: '大麦 / 秀动', stable: true,
            dmUrl: 'https://m.damai.cn/shows/search.html?keyword=' + encodeURIComponent(name),
            showstartUrl: 'https://www.showstart.com/event/list?keyword=' + encodeURIComponent(name),
            showList: []
          },
          social: {
            weibo: { fans: null, fansUnit: '万', interactAvg: null, chaohuaFans: null, chaohuaFansUnit: '万', chaohuaPosts: null, stable: true },
            douyin: null,
            xiaohongshu: null,
            netease: ac ? { artistId: ac.id, songCount: ac.musicSize || null, albumCount: ac.albumSize || null } : null
          },
          fans: { interactRate: null, avgRate: null, chaohuaActive: null, fanContent: null, insight: '' },
          merch: null
        };
        extraArtists.push(artist);
        M.artists.push(artist);
        if (window.ScoreEngine) window.ScoreEngine.calcScore(artist);
        persistArtists();
        closeModal();
        resetModal();
        render();
        toast('「' + name + '」已入库；生成报告时将全量采集数据');
      });
      /* 从首页搜索空态等入口带 ?add=1 自动打开弹窗 */
      if (urlParam('add') === '1') openModal();
    }

    render();
  }

  /* ============================================================
     任务与报告
     ============================================================ */
  function initTasks() {
    const tbody = $('#task-tbody');
    const rlist = $('#report-list');
    const btnRefresh = $('#btn-refresh-tasks');

    function safeArtist(id) {
      return M.artists.find(a => a.id === id) || { id: id, name: '已删除音乐人', genre: '—', style: '—', avatar: null, score: 0 };
    }

    function taskRow(t) {
      const a = M.artists.find(x => x.id === t.artistId);
      if (!a) return '';   /* 已删除音乐人的任务不再显示 */
      const st = STATUS[t.status] || STATUS.queued;
      const canView = t.status === 'done';
      const action = canView
        ? '<a class="btn btn-link btn-sm" href="report.html?id=' + a.id + '&type=' + encodeURIComponent(t.type || '') + '"><i class="fa-solid fa-file-lines"></i> 查看报告</a>'
        : (t.status === 'running'
          ? '<span style="font-size:12px;color:var(--orange)"><i class="fa-solid fa-spinner fa-spin"></i> 采集中…</span>'
          : '<span style="font-size:12px;color:var(--text3)">—</span>');
      return '<tr data-task="' + t.id + '">' +
        '<td><div class="artist-cell"><img src="' + avatar(a.avatar) + '" alt="">' +
          '<div><div class="name">' + a.name + ' × ' + (t.type || '商业分析') + '</div><div class="meta">发起人：' + (t.owner || '当前用户') + '</div></div></div></td>' +
        '<td class="num" style="font-size:12px;color:var(--text3)">' + (t.time || '—') + '</td>' +
        '<td><span class="status-badge ' + st.cls + '">' + (t.status === 'running' ? '<i class="fa-solid fa-spinner fa-spin"></i> ' : '') + st.text + '</span>' +
          (t.note ? '<div class="meta" style="font-size:11px;color:var(--text3);margin-top:4px">' + t.note + '</div>' : '') + '</td>' +
        '<td>' + action + '</td>' +
      '</tr>';
    }

    function reportItem(r) {
      const a = M.artists.find(x => x.id === r.artistId);
      if (!a) return null;   /* 已删除音乐人的报告不再显示 */
      const el = document.createElement('div');
      el.className = 'record-item';
      /* 兼容两种历史格式：旧版 date 字段 / 新版 time 字段 */
      const rt = r.time || (r.date ? String(r.date) + ' 生成' : '—');
      el.innerHTML =
        '<img src="' + avatar(a.avatar) + '" alt="">' +
        '<div class="record-main">' +
          '<div class="record-name">' + a.name + '<span class="tag">' + (r.coop || '商业分析') + '</span>' +
            '<span class="score-label ' + scoreClsOf(a.score || 0) + '">' + scoreLabelOf(a.score || 0) + '</span></div>' +
          '<div class="record-meta"><i class="fa-regular fa-clock"></i> ' + rt + '</div>' +
        '</div>' +
        '<div class="record-score ' + ((a.score || 0) >= 240 ? '' : (a.score || 0) >= 150 ? 'gold' : 'gray') + '">' + (a.score || 0) + '</div>' +
        '<button class="btn btn-ghost btn-sm" data-export><i class="fa-solid fa-file-arrow-down"></i> 导出</button>';
      el.querySelector('[data-export]').addEventListener('click', e => { e.stopPropagation(); toast('导出 PDF 将在后续迭代接入'); });
      el.addEventListener('click', () => location.href = 'report.html?id=' + a.id + '&type=' + encodeURIComponent(r.coop || ''));
      return el;
    }

    function renderTasks() {
      tbody.innerHTML = M.tasks.length
        ? M.tasks.map(taskRow).filter(Boolean).join('')
        : '<tr><td colspan="4"><div class="empty"><i class="fa-solid fa-list-check"></i>暂无真实分析任务 · 从「商业分析」页发起</div></td></tr>';
    }

    function renderReports() {
      rlist.innerHTML = '';
      const alive = M.reports.filter(r => M.artists.some(x => x.id === r.artistId));
      if (!alive.length) { emptyNote(rlist, '暂无报告 · 分析任务真实采集完成后自动生成'); return; }
      alive.forEach(r => { const el = reportItem(r); if (el) rlist.appendChild(el); });
    }

    function refreshFromStorage() {
      loadAnalytics();
      renderTasks();
      renderReports();
    }

    if (btnRefresh) btnRefresh.addEventListener('click', () => { refreshFromStorage(); toast('任务状态已刷新'); });
    window.addEventListener('storage', e => { if (e.key === LS_KEY) refreshFromStorage(); });
    /* 真实任务在首页采集过程中会持续写入 localStorage；任务页保持轻量同步刷新 */
    setInterval(refreshFromStorage, 2000);

    renderTasks();
    renderReports();
  }

  /* ============================================================
     报告页 · 商业价值报告（沿用 demo 结构）
     ============================================================ */
  function initReport() {
    const id = urlParam('id');
    /* 直接按 id 精确查找：未知 id 显示空状态，避免误展示其他音乐人 */
    const a = id ? M.artists.find(x => x.id === id) : undefined;
    if (!a) {
      /* 首屏保护：数据可能仍在与服务端同步（首次访问/新设备时 syncFromServer 异步拉取中），
         先显示「加载中」，稍后重查；确认不存在再显示空状态 */
      const sb = $('.sidebar'); if (sb) sb.style.display = 'none';
      const meta = $('.topbar-meta'); if (meta) meta.style.display = 'none';
      const emp = $('#rp-empty');
      if (emp) {
        emp.style.display = 'block';
        emp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>' +
          '<div class="empty-title">正在加载数据…</div>' +
          '<div class="empty-sub">首次访问或数据同步中，请稍候，页面会自动刷新</div>';
      }
      let tries = 0;
      const recheck = setInterval(() => {
        tries++;
        const now = M.artists.find(x => x.id === id);
        if (now) { clearInterval(recheck); location.reload(); return; }
        if (tries >= 6) {
          clearInterval(recheck);
          if (emp) {
            emp.innerHTML = '<i class="fa-solid fa-database"></i>' +
              '<div class="empty-title">暂无该音乐人的数据</div>' +
              '<div class="empty-sub">数据采集接入后，这里将展示商业价值报告：<br>付费行为（大麦/秀动）· 社媒热度（微博/抖音）· 粉丝粘性（派生指标）</div>' +
              '<a href="artists.html" class="btn btn-ghost btn-sm" data-metainfo="原子-按钮"><i class="fa-solid fa-arrow-left"></i> 返回音乐人库</a>';
          }
        }
      }, 1500);
      return;
    }
    const coopParam = urlParam('type');
    const coopTags = (coopParam ? coopParam.split(',') : a.cooperation).filter(Boolean);

    /* 禁止空报告：没有关键采集数据时，不渲染报告正文，只给采集入口 */
    if (!hasCollectData(a)) {
      const sb = $('.sidebar'); if (sb) sb.style.display = 'none';
      const meta = $('.topbar-meta'); if (meta) meta.style.display = 'none';
      const sectionsEl = $('#rp-sections');
      if (sectionsEl) sectionsEl.innerHTML = '';
      const inc = $('#rp-incomplete-note');
      if (inc) inc.style.display = 'none';
      const emp = $('#rp-empty');
      if (emp) {
        emp.style.display = 'block';
        emp.innerHTML = '<i class="fa-solid fa-database"></i>' +
          '<div class="empty-title">该音乐人尚未采集数据</div>' +
          '<div class="empty-sub">不会展示空报告。请先完成真实采集，成功后才会生成报告。</div>' +
          '<button class="btn btn-primary" id="btn-empty-collect"><i class="fa-solid fa-wand-magic-sparkles"></i> 开始采集并生成报告</button>' +
          '<a href="artists.html" class="btn btn-ghost btn-sm" style="margin-left:8px"><i class="fa-solid fa-arrow-left"></i> 返回音乐人库</a>';
      }
      const btn = $('#btn-empty-collect');
      if (btn) btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 正在采集…';
        const now = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-');
        const task = { id: 't' + Date.now(), artistId: a.id, type: coopTags.join('、') || '周边', owner: '当前用户', time: now, status: 'running', note: '正在采集数据快照' };
        M.tasks.unshift(task);
        persistAnalytics();
        try {
          const data = await apiCollect(a.name, a.weiboAlias || []);
          const okCount = (data.sources || []).filter(s => s.ok).length;
          const failCount = (data.sources || []).length - okCount;
          if (okCount <= 0) throw new Error('未采集到有效数据');
          mergeCollect(a, data);
          if (window.ScoreEngine) window.ScoreEngine.calcScore(a);
          persistArtists();
          task.status = 'done';
          task.note = '成功 ' + okCount + ' 源 / 受限 ' + failCount + ' 源' + (data.damai && data.damai.showCount != null ? ' · 大麦 ' + data.damai.showCount + ' 场' : '');
          if (!M.reports.some(r => r.artistId === a.id && r.complete)) M.reports.unshift({ artistId: a.id, coop: task.type, time: now, complete: true });
          persistAnalytics();
          location.reload();
        } catch (e) {
          task.status = 'failed';
          task.note = '采集失败：' + String(e.message || e).slice(0, 60);
          persistAnalytics();
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 采集失败，重试';
          toast('采集失败，未生成空报告');
        }
      });
      return;
    }

    /* 侧边栏 */
    $('#rp-avatar').src = avatar(a.avatar);
    $('#rp-name').textContent = a.name;
    $('#rp-tags').innerHTML = '<span class="tag">' + a.genre + '</span><span class="tag">' + a.style + '</span>';
    $('#rp-score').textContent = a.score;
    $('#rp-score-label').textContent = scoreLabelOf(a.score);
    $('#dim-paid').textContent = Math.round(a.dims.paid);
    $('#dim-social').textContent = Math.round(a.dims.social);
    $('#dim-fans').textContent = Math.round(a.dims.fans);

    /* 维度进度条（3px，宽度 = 维度分 / 100） */
    $('#bar-paid').style.width = a.dims.paid + '%';
    $('#bar-social').style.width = a.dims.social + '%';
    $('#bar-fans').style.width = a.dims.fans + '%';

    /* 维度气泡 + 点击展开得分明细 */
    initWeightBubbles(a);

    /* 顶部栏：生成时间取该艺人最近一份完整报告；兼容 date/time 两种历史格式 */
    const lastReport = M.reports.find(r => r.artistId === a.id && r.complete);
    $('#rp-time').textContent = lastReport ? (lastReport.time || lastReport.date || '—') : '—';
    $('#rp-snapshot').textContent = a.snapshotTime;
    $('#rp-coop').innerHTML = coopTags.map(t => '<span class="meta-tag"><i class="fa-solid fa-tag"></i> ' + t + '</span>').join('');

    /* 三维 Section */
    $('#rp-sections').innerHTML =
      neteaseSection(a) + paidSection(a) + socialSection(a) + fansSection(a) + merchSection(a) + insightSection(a);

    /* 数据完整性提示：关键来源缺失时醒目提示（不伪装成完整报告） */
    const missing = [];
    const hasPaid = a.paid && (a.paid.shows != null || (a.paid.showList && a.paid.showList.length));
    const hasWeibo = a.social && a.social.weibo && a.social.weibo.fans != null;
    if (!hasPaid) missing.push('大麦演出');
    if (!hasWeibo) missing.push('微博粉丝');
    const incNote = $('#rp-incomplete-note');
    if (incNote && missing.length) {
      incNote.style.display = 'flex';
      incNote.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> 报告数据不完整：' + missing.join('、') +
        ' 未采集到数据，相关区域显示「待采集」。可点击侧边栏「重新采集数据」重试。';
    }

    /* 雷达图渲染 */
    (function renderRadar() {
      const svg = $('#radar-svg');
      if (!svg) return;
      const W = 160, H = 150, cx = 80, cy = 72, R = 54;
      /* 三顶点：付费(上)、社媒(右下)、粉丝(左下) — 顺时针，-90° 起始 */
      const angles = [-90, 30, 150]; /* degrees */
      const dims = ['paid', 'social', 'fans'];
      const labels = ['付费行为', '社媒热度', '粉丝粘性'];
      const scores = dims.map(d => Math.min(a.dims[d] || 0, 100));
      const colors = { paid: 'var(--red)', social: 'var(--orange)', fans: 'var(--green)' };

      const toRad = deg => deg * Math.PI / 180;
      const pt = (ang, r) => ({
        x: cx + r * Math.cos(toRad(ang)),
        y: cy + r * Math.sin(toRad(ang))
      });
      const pts2str = pts => pts.map(p => p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ');

      /* 背景格线：25%, 50%, 75%, 100% */
      const gridEl = $('#radar-grid');
      gridEl.innerHTML = [0.25, 0.5, 0.75, 1].map(t => {
        const ps = angles.map(ang => pt(ang, R * t));
        return '<polygon points="' + pts2str(ps) + '" class="radar-grid-poly" opacity="' + (t < 1 ? 0.25 : 0.45) + '"/>';
      }).join('') +
      /* 辐射线 */
      angles.map(ang => {
        const p = pt(ang, R);
        return '<line x1="' + cx + '" y1="' + cy + '" x2="' + p.x.toFixed(2) + '" y2="' + p.y.toFixed(2) + '" class="radar-grid-line"/>';
      }).join('');

      /* 数据多边形（初始坍缩，再 transition 展开） */
      const zeroPts = angles.map(ang => pt(ang, 0));
      const dataPts = angles.map((ang, i) => pt(ang, R * scores[i] / 100));
      $('#radar-fill').setAttribute('points', pts2str(zeroPts));
      $('#radar-stroke').setAttribute('points', pts2str(zeroPts));
      setTimeout(() => {
        $('#radar-fill').setAttribute('points', pts2str(dataPts));
        $('#radar-stroke').setAttribute('points', pts2str(dataPts));
      }, 80);

      /* 顶点标签 */
      const labelsEl = $('#radar-labels');
      labelsEl.innerHTML = angles.map((ang, i) => {
        const off = pt(ang, R + 16);
        const score = scores[i].toFixed(0);
        const anchor = i === 0 ? 'middle' : (i === 1 ? 'start' : 'end');
        const dy = i === 0 ? '-4' : '4';
        return '<text x="' + off.x.toFixed(2) + '" y="' + off.y.toFixed(2) + '" text-anchor="' + anchor + '" dy="' + dy + '" class="radar-label">' +
          labels[i] + '</text>' +
          '<text x="' + off.x.toFixed(2) + '" y="' + (parseFloat(off.y) + 13).toFixed(2) + '" text-anchor="' + anchor + '" class="radar-score-label">' +
          score + '</text>';
      }).join('');
    })();

    /* 维度导航：点击跳转 + 滚动联动 */
    const dimBtns = $$('.dim-btn');
    const sections = $$('.dim-section');
    dimBtns.forEach(btn => btn.addEventListener('click', () => {
      dimBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const t = document.getElementById(btn.dataset.target);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          dimBtns.forEach(b => b.classList.toggle('active', b.dataset.target === en.target.id));
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(s => observer.observe(s));

    /* 导出 / 分享（占位） */
    $('.btn-export').addEventListener('click', () => toast('导出 PDF 将在后续迭代接入'));
    $('.btn-share:not(#btn-recollect)').addEventListener('click', () => toast('分享链接功能将在后续迭代接入'));

    /* ---------- 自动/手动采集最新数据 ---------- */
    const collectNote = $('#rp-collect-note');
    let collecting = false;
    function recollect() {
      if (collecting) return;
      collecting = true;
      if (collectNote) collectNote.style.display = 'inline-flex';
      (async () => {
        /* 记录采集前关键字段，判断数据是否真的变化（避免空跑导致无限刷新） */
        const disc = a.social && a.social.weibo && a.social.weibo.discussion;
        const nt = a.social && a.social.netease;
        const merch = a.merch && a.merch.discussion;
        const wb = a.social && a.social.weibo;
        const sd = wb && wb.showDiscussion;
        const xhs = a.social && a.social.xiaohongshu;
        const beforeKey = [a.paid && a.paid.shows, a.paid && a.paid.showList && a.paid.showList.length,
          a.paid && a.paid.priceMin, a.paid && a.paid.priceMax, a.paid && a.paid.wantSee,
          wb && wb.fans, wb && wb.interactAvg, wb && wb.chaohuaFans, wb && wb.chaohuaPosts, wb && wb.chaohuaReads,
          disc && disc.postCount30d, disc && disc.interactTotal30d, sd && sd.postCount30d,
          nt && nt.songCount, nt && nt.albumCount, nt && nt.eventCount, nt && nt.videoCount, nt && nt.topSongName, nt && nt.followers,
          merch && merch.weiboTotal, merch && merch.weiboInteract, merch && merch.weiboDemand, merch && merch.weiboSupply,
          xhs && xhs.fans, xhs && xhs.likesCollects, xhs && xhs.latest3 && xhs.latest3.length,
          merch && merch.xhsTopLikes && merch.xhsTopLikes.likes].join('|');
        try {
          const data = await apiCollect(a.name, a.weiboAlias || []);
          mergeCollect(a, data);
          if (window.ScoreEngine) window.ScoreEngine.calcScore(a);
          persistArtists();
          const afterDisc = a.social && a.social.weibo && a.social.weibo.discussion;
          const afterNt = a.social && a.social.netease;
          const afterMerch = a.merch && a.merch.discussion;
          const afterWb = a.social && a.social.weibo;
          const afterSd = afterWb && afterWb.showDiscussion;
          const afterXhs = a.social && a.social.xiaohongshu;
          const afterKey = [a.paid && a.paid.shows, a.paid && a.paid.showList && a.paid.showList.length,
            a.paid && a.paid.priceMin, a.paid && a.paid.priceMax, a.paid && a.paid.wantSee,
            afterWb && afterWb.fans, afterWb && afterWb.interactAvg, afterWb && afterWb.chaohuaFans, afterWb && afterWb.chaohuaPosts, afterWb && afterWb.chaohuaReads,
            afterDisc && afterDisc.postCount30d, afterDisc && afterDisc.interactTotal30d, afterSd && afterSd.postCount30d,
            afterNt && afterNt.songCount, afterNt && afterNt.albumCount, afterNt && afterNt.eventCount, afterNt && afterNt.videoCount, afterNt && afterNt.topSongName, afterNt && afterNt.followers,
            afterMerch && afterMerch.weiboTotal, afterMerch && afterMerch.weiboInteract, afterMerch && afterMerch.weiboDemand, afterMerch && afterMerch.weiboSupply,
            afterXhs && afterXhs.fans, afterXhs && afterXhs.likesCollects, afterXhs && afterXhs.latest3 && afterXhs.latest3.length,
            afterMerch && afterMerch.xhsTopLikes && afterMerch.xhsTopLikes.likes].join('|');
          if (beforeKey !== afterKey) {
            location.reload();   // 数据有变化，重渲染报告
            return;
          }
          toast('已是最新数据（本次采集无变化）');
        } catch (e) {
          toast('采集失败：' + String(e.message || e).slice(0, 30));
        }
        collecting = false;
        if (collectNote) collectNote.style.display = 'none';
      })();
    }
    function mergeCollectSection(artist, data, sectionKey) {
      /* 单板块更新：覆盖该板块字段，用最新采集结果/最新算法刷新，不污染其他板块 */
      if (!data) return;
      if (sectionKey === 'netease') {
        if (data.artist && data.artist.avatar) artist.avatar = data.artist.avatar;
        if (data.netease) {
          const s = artist.social = artist.social || {};
          const n = s.netease = s.netease || {};
          Object.keys(data.netease).forEach(k => { if (data.netease[k] != null) n[k] = data.netease[k]; });
        }
      }
      if (sectionKey === 'paid') {
        mergeCollect(artist, { damai: data.damai, showstart: data.showstart, showDiscussion: data.showDiscussion });
      }
      if (sectionKey === 'social') {
        const s = artist.social = artist.social || {};
        const w = s.weibo = s.weibo || {};
        if (data.weibo) {
          if (data.weibo.fansWan != null) { w.fans = data.weibo.fansWan; w.fansUnit = '万'; }
          if (data.weibo.interactAvg != null) w.interactAvg = data.weibo.interactAvg;
          if (data.weibo.uid) artist.weiboUrl = 'https://weibo.com/u/' + data.weibo.uid;
        }
        if (data.weiboDiscussion) w.discussion = data.weiboDiscussion;
        if (data.chaohua) {
          if (data.chaohua.fansWan != null) { w.chaohuaFans = data.chaohua.fansWan; w.chaohuaFansUnit = '万'; }
          if (data.chaohua.postsCount != null) w.chaohuaPosts = data.chaohua.postsCount;
          if (data.chaohua.readsWan != null) w.chaohuaReads = data.chaohua.readsWan;
        }
        if (data.xiaohongshu) {
          const x = s.xiaohongshu = s.xiaohongshu || {};
          ['fans', 'fansUnit', 'notes', 'likesCollects', 'likesCollectsUnit', 'xhsId', 'accountUrl', 'latest3'].forEach(k => {
            if (data.xiaohongshu[k] != null) x[k] = data.xiaohongshu[k];
          });
        }
      }
      if (sectionKey === 'merch') {
        const m = artist.merch = artist.merch || {};
        const d = m.discussion = m.discussion || {};
        if (data.merchDiscussion) Object.keys(data.merchDiscussion).forEach(k => { if (data.merchDiscussion[k] != null) d[k] = data.merchDiscussion[k]; });
        if (data.xiaohongshu && data.xiaohongshu.merchTopLikes) d.xhsTopLikes = data.xiaohongshu.merchTopLikes;
        if (!d.snapshotTime) d.snapshotTime = new Date().toISOString().slice(0, 10);
      }
      if (sectionKey === 'fans') {
        /* 粉丝粘性是派生维度：这里只按当前最新 score-engine 重新计算 */
      }
    }

    async function refreshSection(sectionKey, btn) {
      if (collecting) return;
      collecting = true;
      if (btn) { btn.disabled = true; btn.classList.add('loading'); }
      if (collectNote) collectNote.style.display = 'inline-flex';
      try {
        if (sectionKey !== 'fans') {
          const data = await apiCollect(a.name, a.weiboAlias || []);
          mergeCollectSection(a, data, sectionKey);
        }
        if (window.ScoreEngine) window.ScoreEngine.calcScore(a);
        persistArtists();
        toast('本板块已更新');
        location.reload();
      } catch (e) {
        toast('本板块更新失败：' + String(e.message || e).slice(0, 30));
        collecting = false;
        if (collectNote) collectNote.style.display = 'none';
        if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
      }
    }

    const btnRecollect = $('#btn-recollect');
    if (btnRecollect) btnRecollect.addEventListener('click', recollect);
    $$('#rp-sections [data-refresh-section]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        refreshSection(btn.dataset.refreshSection, btn);
      });
    });
    /* 报告默认为静态展示，仅点击刷新按钮时触发数据更新 */
  }

  /* 维度气泡：点击展开子项得分明细 */
  function initWeightBubbles(a) {
    const bubbles = $$('.weight-bubble');
    const detail = $('#weight-detail');
    if (!bubbles.length || !detail) return;
    bubbles.forEach(b => {
      const k = b.dataset.dim;
      b.innerHTML = '<i class="fa-solid fa-' + (k === 'paid' ? 'ticket' : k === 'social' ? 'signal' : 'heart-pulse') + '"></i> ' + DIM_LABEL[k];
      b.addEventListener('click', () => {
        const wasOpen = detail.classList.contains('show') && detail.dataset.dim === k;
        bubbles.forEach(x => x.classList.remove('on'));
        detail.classList.remove('show');
        if (wasOpen) return;
        b.classList.add('on');
        detail.dataset.dim = k;
        const bd = a._breakdown[k];
        let html = '<div class="wd-title" data-metainfo="原子-文字">' + DIM_LABEL[k] + ' 得分明细（' + Math.round(a.dims[k]) + ' / 100）</div>';
        Object.keys(bd).forEach(key => {
          const it = bd[key];
          html += '<div class="wd-item" data-metainfo="原子-文字"><span>' + it.label + '</span>' +
            '<span class="wd-score">' + (it.collected ? it.score.toFixed(1) : '待采集') +
            ' <span class="muted">/ ' + it.max + '</span></span></div>';
        });
        detail.innerHTML = html;
        detail.classList.add('show');
      });
    });
  }

  /* 演出状态徽章 */
  const SHOW_STATUS = {
    sellout:      { text: '已售罄', cls: 'red' },
    on_sale:      { text: '购票中', cls: 'green' },
    pre_register: { text: '预约中', cls: 'orange' },
    upcoming:     { text: '待公布', cls: 'gray' }
  };

  function paidSection(a) {
    const p = a.paid || {};
    const sellout = String(p.sellout || '').split('/');
    const selloutLabel = !p.sellout ? '待采集' : (sellout[0] === sellout[1] && +sellout[0] > 0 ? '全部售罄' : '部分售罄');

    /* 聚合大麦按钮 */
    const dmBtn = p.dmUrl
      ? '<a class="btn-damai" href="' + p.dmUrl + '" target="_blank" rel="noopener" data-metainfo="原子-按钮">' +
          '<i class="fa-solid fa-ticket"></i> 大麦售票</a>'
      : '';

    /* 聚合秀动按钮（与大麦并列的数据源入口） */
    const ssBtn = p.showstartUrl
      ? '<a class="btn-damai ss" href="' + p.showstartUrl + '" target="_blank" rel="noopener" data-metainfo="原子-按钮">' +
          '<i class="fa-solid fa-ticket"></i> 秀动售票</a>'
      : '';

    /* 大麦用户意愿：有想看 → 显示想看；没想看但有许愿 → 显示许愿；都没有 → 显示暂无 */
    let wantSeeCard;
    if (p.showList && p.showList.length) {
      const best = p.showList.reduce((mx, s) => (s.wantSee != null && (mx == null || s.wantSee > mx.wantSee)) ? s : mx, null);
      const bestWish = p.showList.reduce((mx, s) => (s.wish != null && (mx == null || s.wish > mx.wish)) ? s : mx, null);
      if (best && best.wantSee != null) {
        wantSeeCard = '<div class="stat-main"><span class="stat-num">' + mval(a, 'paid.wantSee', best.wantSee) + '</span><span class="stat-unit">' + (best.wantSeeUnit || '万') + '</span></div>' +
          '<div class="stat-sub">大麦想看人数</div>' +
          '<div class="stat-extra">最高单场（' + best.city + '）' +
            (best.wantSeePercentile != null ? ' · 超 ' + best.wantSeePercentile + '% 同类' : '') + '</div>';
      } else if (p.wantSee != null) {
        wantSeeCard = '<div class="stat-main"><span class="stat-num">' + mval(a, 'paid.wantSee', p.wantSee) + '</span><span class="stat-unit">' + (p.wantSeeUnit || '人') + '</span></div>' +
          '<div class="stat-sub">大麦想看人数</div><div class="stat-extra">大麦聚合值（单场明细待补）</div>';
      } else if (bestWish && bestWish.wish != null) {
        wantSeeCard = '<div class="stat-main"><span class="stat-num">' + mval(a, 'paid.wish', bestWish.wish) + '</span><span class="stat-unit">' + (bestWish.wishUnit || '人') + '</span></div>' +
          '<div class="stat-sub">大麦许愿人数</div><div class="stat-extra">最高单场（' + (bestWish.city || '—') + '）</div>';
      } else if (p.wish != null) {
        wantSeeCard = '<div class="stat-main"><span class="stat-num">' + mval(a, 'paid.wish', p.wish) + '</span><span class="stat-unit">' + (p.wishUnit || '人') + '</span></div>' +
          '<div class="stat-sub">大麦许愿人数</div><div class="stat-extra">没有想看数据时使用许愿人数</div>';
      } else {
        wantSeeCard = '<div class="stat-main"><span class="stat-num">暂无</span></div>' +
          '<div class="stat-sub">大麦用户意愿</div><div class="stat-extra">暂无想看/许愿数据</div>';
      }
    } else {
      if (p.wantSee != null) {
        wantSeeCard = '<div class="stat-main"><span class="stat-num">' + p.wantSee + '</span><span class="stat-unit">' + (p.wantSeeUnit || '人') + '</span></div>' +
          '<div class="stat-sub">大麦想看人数</div><div class="stat-extra">同量级均值 ' + (p.wantSeeAvg == null ? '—' : dash(p.wantSeeAvg) + dash(p.wantSeeUnit)) + '</div>';
      } else if (p.wish != null) {
        wantSeeCard = '<div class="stat-main"><span class="stat-num">' + p.wish + '</span><span class="stat-unit">' + (p.wishUnit || '人') + '</span></div>' +
          '<div class="stat-sub">大麦许愿人数</div><div class="stat-extra">没有想看数据时使用许愿人数</div>';
      } else {
        wantSeeCard = '<div class="stat-main"><span class="stat-num">暂无</span></div>' +
          '<div class="stat-sub">大麦用户意愿</div><div class="stat-extra">暂无想看/许愿数据</div>';
      }
    }

    /* 场次列表 HTML */
    let showListHtml = '';
    if (p.showList && p.showList.length) {
      const rows = p.showList.map(s => {
        const st = SHOW_STATUS[s.status] || { text: '待公布', cls: 'gray' };
        /* 购票按钮：大麦（红）/ 秀动（绿），同一场双平台都支持时并列显示 */
        const btns = [];
        if (s.dmUrl) btns.push('<a class="show-dm-btn" href="' + s.dmUrl + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" data-metainfo="原子-按钮">大麦</a>');
        if (s.ssUrl) btns.push('<a class="show-dm-btn ss" href="' + s.ssUrl + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" data-metainfo="原子-按钮">秀动</a>');
        const showDmBtn = btns.length ? btns.join(' ') : '<span class="show-dm-btn disabled" data-metainfo="原子-按钮">待上线</span>';
        const wantSeeStr = s.wantSee != null
          ? s.wantSee + (s.wantSeeUnit || '万') + (s.wantSeePercentile != null ? '<span class="show-percentile"> 超' + s.wantSeePercentile + '%</span>' : '')
          : (s.wish != null ? s.wish + (s.wishUnit || '人') + '<span class="show-percentile"> 许愿</span>' : '<span class="muted">暂无</span>');
        return '<tr class="show-row" data-metainfo="分子-场次行">' +
          '<td class="show-date" data-metainfo="原子-文字">' + s.date + '</td>' +
          '<td class="show-city" data-metainfo="原子-文字">' + s.city + '</td>' +
          '<td class="show-venue" data-metainfo="原子-文字">' + (s.venue || '<span class="muted">待公布</span>') + '</td>' +
          '<td class="show-price" data-metainfo="原子-文字">' + (s.priceRange || '<span class="muted">待公布</span>') + '</td>' +
          '<td data-metainfo="原子-文字"><span class="status-badge ' + st.cls + '">' + st.text + '</span></td>' +
          '<td class="show-wantsee" data-metainfo="原子-文字">' + wantSeeStr + '</td>' +
          '<td>' + showDmBtn + '</td>' +
        '</tr>';
      });
      const SHOW_PREVIEW = 3;
      const visibleRows = rows.slice(0, SHOW_PREVIEW).join('');
      const hiddenRows = rows.length > SHOW_PREVIEW ? rows.slice(SHOW_PREVIEW).join('') : '';
      const moreBtn = hiddenRows
        ? '<tr class="show-row-more" data-metainfo="原子-按钮"><td colspan="7">' +
            '<button class="btn-show-more" onclick="(function(btn){var tr=btn.closest(\'tr\');var tbody=tr.closest(\'tbody\');tbody.querySelectorAll(\'.show-row-hidden\').forEach(function(r){r.style.display=\'\';});tr.style.display=\'none\';})(this)">' +
            '<i class="fa-solid fa-chevron-down"></i> 展开余下 ' + (rows.length - SHOW_PREVIEW) + ' 场</button>' +
          '</td></tr>'
        : '';
      const hiddenRowsHtml = hiddenRows
        ? hiddenRows.replace(/<tr class="show-row"/g, '<tr class="show-row show-row-hidden" style="display:none"')
        : '';
      showListHtml =
        '<div class="show-list-wrap open" data-metainfo="分子-场次列表">' +
          '<div class="show-list-toggle" onclick="this.closest(\'.show-list-wrap\').classList.toggle(\'open\')" data-metainfo="原子-按钮">' +
            '<i class="fa-solid fa-list-ul"></i> 场次明细 · 共 ' + p.showList.length + ' 场' +
            '<i class="fa-solid fa-chevron-down toggle-chevron"></i>' +
          '</div>' +
          '<div class="show-list-body">' +
            '<table class="show-table" data-metainfo="分子-列表">' +
              '<thead><tr>' +
                '<th>日期</th><th>城市</th><th>场馆</th><th>票价</th><th>状态</th><th>意愿</th><th></th>' +
              '</tr></thead>' +
              '<tbody>' + visibleRows + hiddenRowsHtml + moreBtn + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>';
    }

    return '<section class="dim-section" id="section-paid" data-metainfo="组织-付费行为">' +
      '<div class="section-header">' +
        '<div class="section-header-left"><span class="section-icon paid-icon"><i class="fa-solid fa-ticket"></i></span>' +
        '<div><h2 class="section-title">付费行为 ' + sectionRefreshBtn('paid') + '</h2><p class="section-desc">离钱最近的商业信号 · 数据来源：' +
          (p.dmUrl ? '<a class="source-link" href="' + p.dmUrl + '" target="_blank" rel="noopener">' + (p.source || '大麦') + '</a>' : (p.source || '大麦')) +
        '</p></div></div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
          (p.stable ? '<span class="section-badge stable" data-metainfo="原子-文字"><i class="fa-solid fa-circle-check"></i> 稳定采集</span>' : '') +
          dmBtn +
          ssBtn +
          '<span class="dim-score-chip paid" data-metainfo="原子-文字">本维度 ' + Math.round(a.dims.paid) + ' / 100</span>' +
        '</div>' +
      '</div>' +
      (function() {
        /* 付费行为结论条 */
        const shows = p.shows || 0, cities = p.cities || 0;
        const level = shows >= 20 ? '高活跃' : shows >= 10 ? '中活跃' : shows > 0 ? '低活跃' : '暂无数据';
        const priceNote = p.priceMax >= 800 ? '票价偏高' : p.priceMax >= 300 ? 'Livehouse 体量' : p.priceMax > 0 ? '小型演出体量' : '';
        const mk2 = (path, text) => isManual(a, path) ? '<span class="manual-value">' + text + '</span>' : text;
        const parts = [];
        if (shows > 0) parts.push('近12月 <strong>' + mk2('paid.shows', shows) + '</strong> 场演出，覆盖 <strong>' + mk2('paid.cities', cities) + '</strong> 城');
        if (priceNote) parts.push(priceNote + '，属 <strong>' + level + '</strong>');
        else if (shows > 0) parts.push('演出活跃度 <strong>' + level + '</strong>');
        const text = parts.length ? parts.join('；') : '演出数据待采集';
        return '<div class="section-conclusion" data-metainfo="分子-结论条"><i class="fa-solid fa-circle-info"></i><span>' + text + '</span></div>';
      })() +
      '<div class="subsection" data-metainfo="组织-演出数据">' +
        '<div class="subsection-title"><i class="fa-solid fa-music"></i> 演出数据 <span class="source-tag green">' + (p.source || '—') + '</span></div>' +
        '<div class="stat-grid three-col">' +
          '<div class="stat-card highlight" data-metainfo="分子-卡片"><div class="stat-main"><span class="stat-num">' + mval(a, 'paid.shows', p.shows) + '</span><span class="stat-unit">场</span></div>' +
            '<div class="stat-sub">近12月演出场次</div><div class="stat-extra">覆盖 <strong>' + mval(a, 'paid.cities', dash(p.cities)) + '</strong> 座城市</div>' +
            contrib(a._breakdown.paid.shows) + '</div>' +
          '<div class="stat-card" data-metainfo="分子-卡片"><div class="stat-main"><span class="stat-num">' + mval(a, 'paid.priceMin', p.priceMin) + '</span><span class="stat-unit">~</span><span class="stat-num">' + mval(a, 'paid.priceMax', p.priceMax) + '</span><span class="stat-unit">元</span></div>' +
            '<div class="stat-sub">票价区间</div><div class="stat-extra">最高档 <strong>' + mval(a, 'paid.priceMax', dash(p.priceMax)) + '元</strong></div>' +
            contrib(a._breakdown.paid.priceMax) + '</div>' +
          '<div class="stat-card" data-metainfo="分子-卡片">' + wantSeeCard +
            contrib(a._breakdown.paid.wantSee) + '</div>' +
        '</div>' +
        /* 付费意愿信号：微博演出讨论度 */
        (function() {
          var sd = a._breakdown.paid.showDisc;
          var wb = (a.social && a.social.weibo) || {};
          var disc = wb.showDiscussion;
          if (disc && disc.postCount30d != null) {
            return '<div class="subsection" data-metainfo="组织-付费意愿信号">' +
              '<div class="subsection-title"><i class="fa-solid fa-comment-dots"></i> 付费意愿信号 <span class="source-tag green">微博讨论度</span></div>' +
              '<div class="stat-grid two-col">' +
                '<div class="stat-card highlight" data-metainfo="分子-卡片">' +
                  '<div class="stat-main"><span class="stat-num">' + dashNum(disc.postCount30d) + '</span></div>' +
                  '<div class="stat-sub">演出相关讨论帖（近30天）</div>' +
                  '<div class="stat-extra">微博搜「' + (disc.keyword || a.name + ' 演唱会') + '」</div>' +
                  contrib(sd) +
                '</div>' +
                '<div class="stat-card" data-metainfo="分子-卡片">' +
                  '<div class="stat-main"><span class="stat-num">' + dashNum(disc.interactTotal30d) + '</span></div>' +
                  '<div class="stat-sub">相关帖互动总量</div>' +
                  '<div class="stat-extra">转评赞之和</div>' +
                '</div>' +
              '</div>' +
            '</div>';
          }
          return '<div class="subsection" data-metainfo="组织-付费意愿信号">' +
            '<div class="subsection-title"><i class="fa-solid fa-comment-dots"></i> 付费意愿信号 <span class="source-tag gray">待采集</span></div>' +
            '<div class="pending-block small"><i class="fa-solid fa-comment-dots pending-icon"></i>' +
              '<div class="pending-text">微博演出讨论度待采集</div>' +
              '<div class="pending-sub">搜「' + a.name + ' 演唱会/巡演」关键词 · ' + contrib(sd) + '</div></div>' +
          '</div>';
        })() +
        showListHtml +
      '</div>' +
    '</section>';
  }

  function socialSection(a) {
    const s = a.social || {};
    const wb = s.weibo || {}, dy = s.douyin || {};
    const douyinEmpty = !s.douyin || (dy.fans === undefined && dy.totalLikes === undefined);
    let douyinBlock;
    if (douyinEmpty) {
      douyinBlock = '<div class="pending-block">' +
        '<i class="fa-solid fa-triangle-exclamation pending-icon"></i>' +
        '<div class="pending-text">抖音账号数据本次快照未采集</div>' +
        '<div class="pending-sub">需登录态访问，低频采集策略待配置</div>' +
        '<div class="pending-fields"><span class="pending-field">账号粉丝量</span><span class="pending-field">总获赞量</span><span class="pending-field">近30天提及帖子数</span><span class="pending-field">帖子互动量</span></div>' +
      '</div>';
    } else {
      douyinBlock = '<div class="stat-grid two-col">' +
        '<div class="stat-card unstable"><div class="stat-main secondary"><span class="stat-num">' + mval(a, 'social.douyin.fans', dy.fans) + '</span><span class="stat-unit">' + dash(dy.fansUnit) + '</span></div><div class="stat-sub">账号粉丝量</div><div class="unstable-note"><i class="fa-solid fa-triangle-exclamation"></i> 每日低频采集，数据存在滞后</div>' + contrib(a._breakdown.social.douyinFans || { label: '抖音粉丝量', max: 10, collected: false, score: 0 }) + '</div>' +
        '<div class="stat-card unstable"><div class="stat-main secondary"><span class="stat-num">' + mval(a, 'social.douyin.totalLikes', dashNum(dy.totalLikes)) + '</span><span class="stat-unit">' + dash(dy.totalLikesUnit) + '</span></div><div class="stat-sub">账号总获赞量</div><div class="unstable-note"><i class="fa-solid fa-triangle-exclamation"></i> 每日低频采集，数据存在滞后</div>' + contrib(a._breakdown.social.douyinLikes || { label: '抖音获赞量', max: 10, collected: false, score: 0 }) + '</div>' +
      '</div>';
    }
    /* 小红书子板块（社媒热度）：账号粉丝/获赞收藏/笔记数/小红书号 + 近三条笔记获赞；周边最热帖在周边消费-社媒讨论热度展示 */
    let xhsBlock = '';
    const xhsData = s.xiaohongshu;
    const xhsReady = xhsData && (xhsData.fans != null || (xhsData.latest3 && xhsData.latest3.length));
    if (xhsReady) {
      const x = xhsData;
      const latestHtml = (x.latest3 && x.latest3.length)
        ? '<div class="stat-grid ' + (x.latest3.length >= 3 ? 'three-col' : 'two-col') + '" style="margin-top:10px">' + x.latest3.map((n, i) =>
            '<div class="stat-card"><div class="stat-main"><span class="stat-num">' + (n.likes >= 10000 ? (n.likes / 10000).toFixed(1) + '万' : dashNum(n.likes)) + '</span><span class="stat-unit">赞</span></div><div class="stat-sub">近三条笔记获赞</div><div class="stat-extra">' + n.title + '</div></div>'
          ).join('') + '</div>'
        : '';
      xhsBlock = '<div class="stat-grid four-col">' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + mval(a, 'social.xiaohongshu.fans', x.fans) + '</span><span class="stat-unit">' + dash(x.fansUnit) + '</span></div><div class="stat-sub">账号粉丝量</div>' + (x.accountUrl ? '<div class="stat-extra"><a href="' + x.accountUrl + '" target="_blank" rel="noopener">查看主页 ↗</a></div>' : '') + contrib(a._breakdown.social.xhsFans || { label: '小红书粉丝量', max: 10, collected: false, score: 0 }) + '</div>' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + mval(a, 'social.xiaohongshu.likesCollects', x.likesCollects) + '</span><span class="stat-unit">' + dash(x.likesCollectsUnit) + '</span></div><div class="stat-sub">获赞与收藏</div>' + contrib(a._breakdown.social.xhsLikes || { label: '小红书获赞收藏', max: 10, collected: false, score: 0 }) + '</div>' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + dashNum(x.notes) + '</span><span class="stat-unit">篇</span></div><div class="stat-sub">账号笔记数</div></div>' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + dash(x.xhsId) + '</span></div><div class="stat-sub">小红书号</div></div>' +
      '</div>' + latestHtml;
    } else {
      xhsBlock = '<div class="pending-block">' +
        '<i class="fa-solid fa-database pending-icon"></i>' +
        '<div class="pending-text">小红书数据待采集</div>' +
        '<div class="pending-sub">需登录态浏览器采集（登录 cookie 会过期）</div>' +
        '<div class="pending-fields"><span class="pending-field">账号粉丝量</span><span class="pending-field">获赞与收藏</span><span class="pending-field">近三条笔记获赞</span></div>' +
      '</div>';
    }
    /* 微博讨论度：近30天提及「艺名」帖子的规模与互动 */
    const wbDisc = wb.discussion;
    const wbDiscSub = (wbDisc && wbDisc.postCount30d != null)
      ? '<div class="stat-grid two-col">' +
          '<div class="stat-card highlight"><div class="stat-main"><span class="stat-num">' + mval(a, 'social.weibo.discussion.postCount30d', dashNum(wbDisc.postCount30d)) + '</span></div>' +
            '<div class="stat-sub">近30天发帖量</div><div class="stat-extra">搜索「' + a.name + '」相关内容</div>' +
            contrib(a._breakdown.social.weiboDiscussion || { label: '微博整体讨论帖数', max: 10, collected: false, score: 0 }) + '</div>' +
          '<div class="stat-card"><div class="stat-main"><span class="stat-num">' + mval(a, 'social.weibo.discussion.interactTotal30d', dashNum(wbDisc.interactTotal30d)) + '</span></div>' +
            '<div class="stat-sub">互动量合计</div><div class="stat-extra">转评赞之和</div></div>' +
        '</div>'
      : '<div class="pending-block small"><i class="fa-solid fa-magnifying-glass pending-icon"></i>' +
          '<div class="pending-text">微博讨论度待采集</div>' +
          '<div class="pending-sub">搜索「' + a.name + '」关键词接入后展示</div></div>';
    return '<section class="dim-section" id="section-social">' +
      '<div class="section-header">' +
        '<div class="section-header-left"><span class="section-icon social-icon"><i class="fa-solid fa-signal"></i></span>' +
        '<div><h2 class="section-title">社媒热度 ' + sectionRefreshBtn('social') + '</h2><p class="section-desc">传播声量与曝光潜力 · 数据来源：微博（稳定）· 抖音（低频）· 小红书（登录态采集）</p></div></div>' +
        '<span class="dim-score-chip social" data-metainfo="原子-文字">本维度 ' + Math.round(a.dims.social) + ' / 100</span>' +
      '</div>' +
      (function() {
        /* 社媒热度结论条 */
        const fans = wb.fans || 0, fansUnit = wb.fansUnit || '';
        const interact = wb.interactAvg || 0;
        const mk = (path, text) => isManual(a, path) ? '<span class="manual-value">' + text + '</span>' : text;
        const parts = [];
        if (fans > 0) parts.push('微博 <strong>' + mk('social.weibo.fans', fans) + '</strong>' + fansUnit + ' 粉丝');
        if (interact > 0) parts.push('近30条互动均值 <strong>' + mk('social.weibo.interactAvg', interact) + '</strong>');
        const chPosts = wb.chaohuaPosts || 0;
        if (chPosts > 0) parts.push('超话累计 <strong>' + mk('social.weibo.chaohuaPosts', (chPosts > 10000 ? (chPosts/10000).toFixed(1) + '万' : chPosts)) + '</strong> 帖');
        const text = parts.length ? parts.join('，') : '微博数据待采集';
        return '<div class="section-conclusion" data-metainfo="分子-结论条"><i class="fa-solid fa-circle-info"></i><span>' + text + '</span></div>';
      })() +
      '<div class="subsection">' +
        '<div class="subsection-title"><i class="fa-solid fa-globe"></i> 微博 <span class="source-tag green">稳定采集</span></div>' +
        '<div class="stat-grid four-col">' +
          '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + mval(a, 'social.weibo.fans', wb.fans) + '</span><span class="stat-unit">' + dash(wb.fansUnit) + '</span></div><div class="stat-sub">账号粉丝量</div><div class="stat-note">绝对量仅供参考</div>' + contrib(a._breakdown.social.weiboFans || { label: '微博粉丝量', max: 10, collected: false, score: 0 }) + '</div>' +
          '<div class="stat-card highlight"><div class="stat-main"><span class="stat-num">' + mval(a, 'social.weibo.interactAvg', dashNum(wb.interactAvg)) + '</span></div><div class="stat-sub">近30条微博互动均值</div><div class="stat-extra">转评赞之和</div>' +
            contrib(a._breakdown.social.weiboInteract) + '</div>' +
          '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + mval(a, 'social.weibo.chaohuaFans', wb.chaohuaFans) + '</span><span class="stat-unit">' + dash(wb.chaohuaFansUnit) + '</span></div><div class="stat-sub">超话粉丝量</div>' +
            contrib(a._breakdown.social.chaohuaFans) + '</div>' +
          '<div class="stat-card"><div class="stat-main"><span class="stat-num">' + mval(a, 'social.weibo.chaohuaPosts', dashNum(wb.chaohuaPosts)) + '</span><span class="stat-unit">条</span></div><div class="stat-sub">超话累计帖子数</div><div class="stat-note">超话主页可见，稳定采集</div>' +
            contrib(a._breakdown.social.chaohuaPosts) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="subsection">' +
        '<div class="subsection-title"><i class="fa-solid fa-magnifying-glass"></i> 微博讨论度 <span class="source-tag green">稳定采集</span></div>' +
        wbDiscSub +
      '</div>' +
      '<div class="subsection">' +
        '<div class="subsection-title"><i class="fa-brands fa-tiktok"></i> 抖音 <span class="source-tag orange">低频采集 · 不稳定</span></div>' +
        douyinBlock +
      '</div>' +
      '<div class="subsection">' +
        '<div class="subsection-title"><i class="fa-solid fa-seedling"></i> 小红书 <span class="source-tag ' + (xhsReady ? 'green">登录态采集' : 'gray">待接入') + '</span></div>' +
        xhsBlock +
      '</div>' +
    '</section>';
  }

  /* ============================================================
     网易云站内热度 Section（独立参考，不参与评分）
     ============================================================ */
  function neteaseSection(a) {
    const n = (a.social && a.social.netease) || null;
    if (!n) {
      return '<section class="dim-section" id="section-netease" data-metainfo="组织-网易云站内热度">' +
        '<div class="section-header">' +
          '<div class="section-header-left"><span class="section-icon netease-icon"><i class="fa-solid fa-headphones"></i></span>' +
          '<div><h2 class="section-title">网易云站内热度 ' + sectionRefreshBtn('netease') + '</h2><p class="section-desc">音乐消费行为 · 独立参考维度，不参与评分 · 粉丝数已采集 · 播放量/评论数仅 App 可见</p></div></div>' +
          '<span class="dim-score-chip social" data-metainfo="原子-文字">参考</span>' +
        '</div>' +
        '<div class="pending-block"><i class="fa-solid fa-headphones pending-icon"></i>' +
          '<div class="pending-text">网易云数据待采集</div>' +
          '<div class="pending-sub">粉丝数 · 播放量 · 评论数 · 接入后自动展示</div></div>' +
      '</section>';
    }
    return '<section class="dim-section" id="section-netease" data-metainfo="组织-网易云站内热度">' +
      '<div class="section-header">' +
        '<div class="section-header-left"><span class="section-icon netease-icon"><i class="fa-solid fa-headphones"></i></span>' +
        '<div><h2 class="section-title">网易云站内热度 ' + sectionRefreshBtn('netease') + '</h2><p class="section-desc">音乐消费行为 · 独立参考维度，不参与评分 · 粉丝数已采集 · 播放量/评论数仅 App 可见</p></div></div>' +
        '<span class="dim-score-chip social" data-metainfo="原子-文字">参考</span>' +
      '</div>' +
      '<div class="stat-grid four-col">' +
        '<div class="stat-card"><div class="stat-main"><span class="stat-num">' + mval(a, 'social.netease.followers', n.followers) + '</span><span class="stat-unit">' + dash(n.followersUnit) + '</span></div>' +
          '<div class="stat-sub">网易云粉丝数</div><div class="stat-extra">站内关注量</div></div>' +
        '<div class="stat-card highlight"><div class="stat-main"><span class="stat-num">' + dash(n.totalPlays) + '</span><span class="stat-unit">' + dash(n.totalPlaysUnit) + '</span></div>' +
          '<div class="stat-sub">歌曲总播放量</div><div class="stat-extra">全部已上线歌曲累计</div></div>' +
        '<div class="stat-card"><div class="stat-main"><span class="stat-num">' + dash(n.topSongPlays) + '</span><span class="stat-unit">' + dash(n.topSongPlaysUnit) + '</span></div>' +
          '<div class="stat-sub">最热单曲播放量</div><div class="stat-extra">' + (n.topSongName ? '《' + n.topSongName + '》' : '—') + '</div></div>' +
        '<div class="stat-card"><div class="stat-main"><span class="stat-num">' + dashNum(n.commentCount) + '</span><span class="stat-unit">条</span></div>' +
          '<div class="stat-sub">代表作评论总数</div><div class="stat-extra">热评讨论规模</div></div>' +
      '</div>' +
      '<div class="stat-grid two-col">' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + mval(a, 'social.netease.songCount', n.songCount) + '</span><span class="stat-unit">首</span></div>' +
          '<div class="stat-sub">已上线歌曲数</div></div>' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + mval(a, 'social.netease.albumCount', n.albumCount) + '</span><span class="stat-unit">张</span></div>' +
          '<div class="stat-sub">专辑数</div></div>' +
      '</div>' +
      '<div class="stat-grid three-col">' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + dashNum(n.eventCount) + '</span><span class="stat-unit">条</span></div>' +
          '<div class="stat-sub">站内动态数</div></div>' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + dashNum(n.videoCount) + '</span><span class="stat-unit">支</span></div>' +
          '<div class="stat-sub">MV / 视频数</div></div>' +
        '<div class="stat-card"><div class="stat-main secondary"><span class="stat-num">' + dash(n.topSongName) + '</span></div>' +
          '<div class="stat-sub">热门单曲</div></div>' +
      '</div>' +
      (n.identity ? '<div class="stat-note" style="margin-top:10px"><i class="fa-solid fa-circle-check"></i> 认证：' + n.identity + '</div>' : '') +
    '</section>';
  }

  function fansSection(a) {
    const f = a.fans || {};
    const wb = (a.social && a.social.weibo) || {};
    const nt = (a.social && a.social.netease) || {};
    const bd = a._breakdown.fans;
    /* 核心粉丝密度 */
    const corePct = (wb.chaohuaFans != null && wb.fans != null && wb.fans > 0)
      ? ((wb.chaohuaFans / wb.fans) * 100).toFixed(1) + '%' : '—';
    /* 粉丝忠诚转化率展示 */
    const loyaltyDisplay = (nt.followers != null && nt.monthlyListeners != null && nt.monthlyListeners > 0)
      ? ((nt.followers / nt.monthlyListeners) * 100).toFixed(1) + '%' : '—';
    /* 网易云评论率展示（优先热门单曲，无则用总播放量） */
    const playsRef = nt.topSongPlays != null ? nt.topSongPlays : nt.totalPlays;
    const playsLabel = nt.topSongPlays != null ? '热门单曲播放量' : '总播放量';
    let commentRateDisplay = '—';
    if (nt.commentCount != null && playsRef != null && playsRef > 0) {
      const rate = (nt.commentCount / (playsRef * 100000000)) * 100;
      commentRateDisplay = rate.toFixed(3) + '%';
    }
    return '<section class="dim-section" id="section-fans">' +
      '<div class="section-header">' +
        '<div class="section-header-left"><span class="section-icon fans-icon"><i class="fa-solid fa-heart-pulse"></i></span>' +
        '<div><h2 class="section-title">粉丝粘性 ' + sectionRefreshBtn('fans') + '</h2><p class="section-desc">区分真实粉丝与路人 · 4 个子项独立计分，缺失互不影响</p></div></div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
          '<span class="section-badge stable"><i class="fa-solid fa-circle-check"></i> 稳定采集</span>' +
          '<span class="dim-score-chip fans" data-metainfo="原子-文字">本维度 ' + Math.round(a.dims.fans) + ' / 100</span>' +
        '</div>' +
      '</div>' +
      (function() {
        const parts = [];
        if (loyaltyDisplay !== '—') parts.push('忠诚转化率 <strong>' + loyaltyDisplay + '</strong>');
        if (nt.followers != null) parts.push('网易云粉丝 <strong>' + nt.followers + (nt.followersUnit || '万') + '</strong>');
        if (commentRateDisplay !== '—') parts.push('评论率 <strong>' + commentRateDisplay + '</strong>');
        const text = parts.length ? parts.join('，') : '粉丝数据待采集';
        return '<div class="section-conclusion" data-metainfo="分子-结论条"><i class="fa-solid fa-circle-info"></i><span>' + text + '</span></div>';
      })() +
      '<div class="stat-grid two-col">' +
        '<div class="stat-card highlight-gold"><div class="stat-label-primary">核心指标</div>' +
          '<div class="stat-main"><span class="stat-num gold">' + corePct + '</span></div>' +
          '<div class="stat-sub">核心粉丝密度</div><div class="stat-extra">超话粉丝 / 微博粉丝（主动订阅比例）</div>' +
          contrib(bd.coreFans) + '</div>' +
        '<div class="stat-card highlight">' +
          '<div class="stat-main"><span class="stat-num">' + loyaltyDisplay + '</span></div>' +
          '<div class="stat-sub">粉丝忠诚转化率</div>' +
          '<div class="stat-extra">网易云粉丝 ' + dash(nt.followers) + (nt.followersUnit||'万') + ' / 月听众 ' + dash(nt.monthlyListeners) + (nt.monthlyListenersUnit||'万') + '</div>' +
          contrib(bd.loyaltyRate) + '</div>' +
        '<div class="stat-card">' +
          '<div class="stat-main"><span class="stat-num">' + commentRateDisplay + '</span></div>' +
          '<div class="stat-sub">网易云评论率</div>' +
          '<div class="stat-extra">评论数 ' + dashNum(nt.commentCount) + ' / ' + playsLabel + ' ' + dash(playsRef) + '亿 · 情感投入度</div>' +
          '<div class="proxy-note"><i class="fa-solid fa-comment-dots"></i> 独立音乐人通常远高于流量歌手</div>' +
          contrib(bd.commentRate) + '</div>' +
        '<div class="stat-card"><div class="stat-main"><span class="stat-num">' + dash(f.chaohuaActive) + '</span><span class="stat-unit">%</span></div>' +
          '<div class="stat-sub">超话社区活跃度</div><div class="stat-extra">月发帖数 / 超话粉丝</div>' +
          contrib(bd.chaohuaActive) + '</div>' +
      '</div>' +
    '</section>';
  }

  /* ============================================================
     AI 综合判断（置于报告最后）
     ============================================================ */
  function insightSection(a) {
    const f = a.fans || {};
    const inner = f.insight
      ? '<div class="insight-box">' +
          '<div class="insight-header"><i class="fa-solid fa-lightbulb"></i> 商业合作可行性判断</div>' +
          '<p class="insight-text">' + f.insight + '</p>' +
        '</div>'
      : '<div class="pending-block"><i class="fa-solid fa-wand-magic-sparkles pending-icon"></i>' +
          '<div class="pending-text">AI 综合判断待生成</div>' +
          '<div class="pending-sub">数据采集与建议生成器接入后展示</div></div>';
    return '<section class="dim-section" id="section-insight" data-metainfo="组织-AI综合判断">' + inner + '</section>';
  }

  /* ============================================================
     周边消费 Section（独立参考维度，不参与评分）
     ============================================================ */
  function merchSection(a) {
    const m = a.merch;
    /* 未填写 merch 字段：显示「待采集」占位 */
    if (!m) {
      return '<section class="dim-section merch-section" id="section-merch" data-metainfo="组织-周边消费">' +
        '<div class="section-header">' +
          '<div class="section-header-left"><span class="section-icon merch-icon"><i class="fa-solid fa-bag-shopping"></i></span>' +
          '<div><h2 class="section-title">周边消费 ' + sectionRefreshBtn('merch') + '</h2><p class="section-desc">官方供给 · 粉丝讨论热度 · 闲鱼二手流通 · 独立参考维度，不参与评分</p></div></div>' +
          '<span class="section-badge gray" data-metainfo="原子-文字"><i class="fa-solid fa-clock"></i> 待采集</span>' +
        '</div>' +
        '<div class="pending-block"><i class="fa-solid fa-bag-shopping pending-icon"></i>' +
          '<div class="pending-text">周边消费数据尚未采集</div>' +
          '<div class="pending-sub">微博讨论度 + 闲鱼在售数量 · 接入后自动展示</div></div>' +
      '</section>';
    }

    const d = m.discussion || {};

    /* 官方周边状态标签 */
    const officialBadge = m.official
      ? '<span class="merch-badge official"><i class="fa-solid fa-circle-check"></i> 有官方周边</span>'
      : '<span class="merch-badge no-official"><i class="fa-solid fa-circle-xmark"></i> 暂无官方周边</span>';

    /* 官方渠道列表 */
    const shopList = (m.officialShops && m.officialShops.length)
      ? m.officialShops.map(function(s) { return '<span class="merch-shop-tag">' + s + '</span>'; }).join('')
      : '<span class="muted">—</span>';

    /* 周边品类 */
    const typeList = (m.types && m.types.length)
      ? m.types.map(function(t) { return '<span class="merch-type-tag">' + t + '</span>'; }).join('')
      : '<span class="muted">暂无记录</span>';

    /* 社媒讨论度卡片（微博） */
    const weiboBlock = (d.weiboTotal != null)
      ? '<div class="stat-grid three-col" data-metainfo="分子-卡片组">' +
          '<div class="stat-card" data-metainfo="分子-卡片">' +
            '<div class="stat-main"><span class="stat-num">' + mval(a, 'merch.discussion.weiboTotal', dashNum(d.weiboTotal)) + '</span></div>' +
            '<div class="stat-sub">近30天帖子总数</div>' +
            '<div class="stat-extra">微博「' + (d.keyword || (a.name + '周边')) + '」搜索' + (d.aliasBase && d.aliasBase !== a.name ? ' · 本名无结果时联想别名「' + d.aliasBase + '」' : '') + '</div>' +
          '</div>' +
          '<div class="stat-card" data-metainfo="分子-卡片">' +
            '<div class="stat-main"><span class="stat-num gold">' + mval(a, 'merch.discussion.weiboDemand', dashNum(d.weiboDemand)) + '</span></div>' +
            '<div class="stat-sub">求购讨论</div>' +
            '<div class="stat-extra">含「求/求购/哪里买」· 微博搜索</div>' +
          '</div>' +
          '<div class="stat-card" data-metainfo="分子-卡片">' +
            '<div class="stat-main"><span class="stat-num">' + mval(a, 'merch.discussion.weiboSupply', dashNum(d.weiboSupply)) + '</span></div>' +
            '<div class="stat-sub">开箱晒图</div>' +
            '<div class="stat-extra">含「晒/到了/入手」· 微博搜索</div>' +
          '</div>' +
        '</div>'
      : '<div class="pending-block small"><i class="fa-brands fa-weibo pending-icon"></i>' +
          '<div class="pending-text">微博周边讨论度待采集</div>' +
          '<div class="pending-sub">「' + a.name + '周边」关键词搜索</div></div>';

    /* 小红书卡片：周边最热讨论帖获赞（考虑反爬，小红书仅保留这一项） */
    const xhsTop = d.xhsTopLikes || (a.social && a.social.xiaohongshu && a.social.xiaohongshu.merchTopLikes);
    const xhsBlock = (xhsTop && xhsTop.likes != null)
      ? '<div class="stat-grid two-col" data-metainfo="分子-卡片组">' +
          '<div class="stat-card highlight" data-metainfo="分子-卡片">' +
            '<div class="stat-main"><span class="stat-num">' + mval(a, 'merch.discussion.xhsTopLikes.likes', (xhsTop.likes >= 10000 ? (xhsTop.likes / 10000).toFixed(1) + '万' : dashNum(xhsTop.likes))) + '</span><span class="stat-unit">赞</span></div>' +
            '<div class="stat-sub">周边最热讨论帖获赞</div>' +
            '<div class="stat-extra">小红书「' + (xhsTop.keyword || (a.name + ' 周边')) + '」搜索</div>' +
          '</div>' +
        '</div>'
      : '<div class="pending-block small"><i class="fa-solid fa-seedling pending-icon"></i>' +
          '<div class="pending-text">小红书周边讨论待采集</div>' +
          '<div class="pending-sub">「' + a.name + ' 周边」搜索 · 需登录态</div></div>';

    /* 闲鱼卡片 */
    const xianyuBlock = (d.xianyu != null)
      ? '<div class="stat-grid two-col" data-metainfo="分子-卡片组">' +
          '<div class="stat-card highlight" data-metainfo="分子-卡片">' +
            '<div class="stat-main"><span class="stat-num">' + dashNum(d.xianyu) + '</span><span class="stat-unit">件</span></div>' +
            '<div class="stat-sub">闲鱼在售商品数</div>' +
            '<div class="stat-extra">搜索「' + a.name + ' 周边」</div>' +
          '</div>' +
          '<div class="stat-card" data-metainfo="分子-卡片">' +
            '<div class="stat-main"><span class="stat-num">' + dashNum(d.xianyuAvgPrice) + '</span><span class="stat-unit">元</span></div>' +
            '<div class="stat-sub">闲鱼均价</div>' +
            '<div class="stat-extra">在售商品价格中位数 · 闲鱼搜索</div>' +
          '</div>' +
        '</div>'
      : '<div class="pending-block small"><i class="fa-solid fa-fish pending-icon"></i>' +
          '<div class="pending-text">闲鱼数据待采集</div>' +
          '<div class="pending-sub">在售商品数 · 价格区间</div></div>';

    const snapNote = d.snapshotTime
      ? '<div class="merch-snap-note" data-metainfo="原子-文字"><i class="fa-solid fa-clock"></i> 数据快照 · ' + d.snapshotTime + '</div>'
      : '';

    return '<section class="dim-section merch-section" id="section-merch" data-metainfo="组织-周边消费">' +
      '<div class="section-header">' +
        '<div class="section-header-left"><span class="section-icon merch-icon"><i class="fa-solid fa-bag-shopping"></i></span>' +
        '<div><h2 class="section-title">周边消费 ' + sectionRefreshBtn('merch') + '</h2><p class="section-desc">官方供给 · 粉丝讨论热度 · 闲鱼二手流通 · 独立参考维度，不参与评分</p></div></div>' +
        '<span class="section-badge merch-ref-badge" data-metainfo="原子-文字"><i class="fa-solid fa-info-circle"></i> 仅供参考</span>' +
      '</div>' +
      '<div class="subsection" data-metainfo="组织-官方周边">' +
        '<div class="subsection-title"><i class="fa-solid fa-store"></i> 官方供给</div>' +
        '<div class="merch-official-row" data-metainfo="分子-官方信息">' +
          officialBadge +
          '<div class="merch-detail">' +
            (m.official ? '<div class="merch-detail-row"><span class="merch-detail-label">售卖渠道</span>' + shopList + '</div>' : '') +
            '<div class="merch-detail-row"><span class="merch-detail-label">周边品类</span>' + typeList + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="subsection" data-metainfo="组织-社媒讨论">' +
        '<div class="subsection-title"><i class="fa-solid fa-globe"></i> 周边讨论热度 <span class="source-tag green">微博</span><span class="source-tag green">小红书</span></div>' +
        weiboBlock +
        xhsBlock +
      '</div>' +
      '<div class="subsection" data-metainfo="组织-闲鱼流通">' +
        '<div class="subsection-title"><i class="fa-solid fa-fish"></i> 闲鱼二手流通</div>' +
        xianyuBlock +
      '</div>' +
      snapNote +
    '</section>';
  }

  /* ---------- 按页面分发初始化 ---------- */
  const initMap = { home: initHome, artists: initArtists, tasks: initTasks, report: initReport };
  if (initMap[page]) initMap[page]();
})();
