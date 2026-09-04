/* ============================================================
   MusicBiz · 评分规则引擎（纯前端实时计算）
   ------------------------------------------------------------
   用法：ScoreEngine.calcScore(artist)
   计算后直接写入 artist.score / artist.dims / artist._breakdown，
   页面渲染时读取即可（无需手工填分）。

   规则：
   - 三维直加，满分 300（付费行为 100 + 社媒热度 100 + 粉丝粘性 100）
   - 每维满分 100，维度分 = 子项得分之和（子项满分见下）
   - 总分 = 三维分直接相加取整
   - 子项缺失（null / undefined）得 0 分，不影响其他子项
   - 阶梯线性：在给定节点间线性插值，低于首节点从 0 爬升，高于末节点封顶

  子项满分分配（2026-08-18 更新）：
   付费行为（100）：演出场次 20 + 城市覆盖 10 + 最高票价 35 + 售罄率 5 + 想看人数 10 + 演出讨论度 20
   社媒热度（100）：互动均值 50 + 超话粉丝 25 + 超话帖子 15 + 微博整体讨论帖 10
   粉丝粘性（100）：核心粉丝密度 25 + 粉丝忠诚转化率 25 + 网易云评论率 25 + 超话活跃度 25
   ============================================================ */
window.ScoreEngine = (function () {
  'use strict';

  var WEIGHTS = {};   // 评分改为三维直加（满分 300），权重保留空占位

  /* 保留一位小数 */
  function r1(v) { return Math.round(v * 10) / 10; }

  /* 阶梯线性插值（percent 0~100） */
  function stepLinear(x, points) {
    if (x == null || isNaN(x)) return 0;
    if (x <= 0) return 0;
    var first = points[0];
    if (x <= first[0]) return (x / first[0]) * first[1];
    for (var i = 1; i < points.length; i++) {
      if (x <= points[i][0]) {
        var x0 = points[i - 1][0], y0 = points[i - 1][1];
        var x1 = points[i][0], y1 = points[i][1];
        return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return 100;
  }

  /* 子项构造：collected 标记数据是否已采集，score 保留一位小数 */
  function item(label, max, value, points) {
    return {
      label: label,
      max: max,
      collected: value != null,
      score: value != null ? r1((stepLinear(value, points) / 100) * max) : 0
    };
  }

  /* ---------- 付费行为（100）----------
   * 子项满分：演出场次 20 + 城市覆盖 10 + 最高票价 35 + 售罄率 5 + 想看人数 10 + 演出讨论度 20 = 100
   *
   * 设计原则：
   * - 演出场次降至 20 分，仅作为"活跃度"参考信号，不等于商业价值
   * - 票价提至 35 分（最重要的付费意愿直接信号），阶梯按 Livehouse 市场真实分布细分：
   *   <100 低价（入门/新人场） → 100-200 基础 Livehouse → 200-300 中档 Livehouse
   *   → 300-500 品质 Livehouse/小剧场 → 500-800 中型场馆 → 800-1000 大型场馆 → 1000+ 满分
   * - 音乐节场次（festival: true）不计入演出场次、城市覆盖、票价，避免高额拼盘票价虚抬得分
   */
  function calcPaid(p, wb) {
    p = p || {};
    wb = wb || {};
    var selloutRaw = p.sellout != null ? String(p.sellout).split('/') : [0, 0];
    var sold = +selloutRaw[0] || 0, total = +selloutRaw[1] || 0;

    /* 从 showList 中过滤掉音乐节场次，用于重新计算场次/城市/票价 */
    var nonFestList = (p.showList || []).filter(function(s) { return !s.festival; });
    /* 从非音乐节场次的 priceRange 字段解析最高票价（取各场次最高值）*/
    function parseMaxPrice(priceRange) {
      if (!priceRange) return null;
      var nums = priceRange.match(/\d+/g);
      if (!nums || !nums.length) return null;
      return Math.max.apply(null, nums.map(Number));
    }
    /* 若有 showList，用非音乐节场次重新推导各指标；否则沿用 paid 字段原值 */
    var effectiveShows, effectiveCities, effectivePriceMax;
    if (p.showList && p.showList.length) {
      effectiveShows = nonFestList.length || null;
      var citySet = {};
      nonFestList.forEach(function(s) { if (s.city) citySet[s.city] = true; });
      effectiveCities = Object.keys(citySet).length || null;
      var maxP = null;
      nonFestList.forEach(function(s) {
        var v = parseMaxPrice(s.priceRange);
        if (v != null && (maxP == null || v > maxP)) maxP = v;
      });
      effectivePriceMax = maxP;
    } else {
      effectiveShows = p.shows;
      effectiveCities = p.cities;
      effectivePriceMax = p.priceMax;
    }

    var shows    = item('近12月演出场次（不含音乐节）', 20, effectiveShows,
      [[3, 20], [5, 40], [8, 60], [12, 80], [20, 100]]);
    var cities   = item('城市覆盖数（不含音乐节）', 10, effectiveCities,
      [[3, 20], [8, 50], [15, 80], [20, 100]]);
    var priceMax = item('最高票价档位（不含音乐节）', 35, effectivePriceMax,
      [[100, 15], [200, 35], [300, 55], [500, 70], [800, 85], [1000, 100]]);
    var sellout  = {
      label: '近3场售罄率', max: 5,
      collected: p.sellout != null,
      score: total > 0 ? r1((sold / total) * 5) : 0
    };

    /* 用户意愿：有想看优先用想看；没有想看但有许愿则用许愿兜底；两者不叠加，避免重复计分 */
    var wantSeeVal = null;
    var wantSeePoints;
    var wantSeeLabel = '大麦用户意愿人数';
    if (p.wantSee != null && p.wantSeeAvg != null) {
      wantSeeVal = p.wantSee / p.wantSeeAvg;
      wantSeePoints = [[1, 20], [2, 60], [5, 100]];
      wantSeeLabel = '想看人数 vs 均值倍数';
    } else if (p.wantSee != null) {
      wantSeeVal = p.wantSee;
      wantSeePoints = [[1, 20], [5, 50], [20, 80], [50, 100]];
      wantSeeLabel = '大麦想看人数';
    } else if (p.wish != null) {
      wantSeeVal = p.wish;
      wantSeePoints = [[100, 10], [500, 35], [2000, 65], [10000, 100]];
      wantSeeLabel = '大麦许愿人数';
    }
    var wantSee = item(
      wantSeeLabel,
      10, wantSeeVal, wantSeePoints || [[1, 20], [2, 60], [5, 100]]
    );

    /* 微博演出讨论度：近30天提到「演唱会/巡演/演出」相关帖子数 */
    var showDisc = (wb.showDiscussion && wb.showDiscussion.postCount30d != null)
      ? wb.showDiscussion.postCount30d : null;
    var showDiscItem = item('微博演出讨论帖数', 20, showDisc,
      [[50, 20], [200, 50], [500, 80], [2000, 100]]);

    return {
      shows:        shows,
      cities:       cities,
      priceMax:     priceMax,
      sellout:      sellout,
      wantSee:      wantSee,
      showDisc:     showDiscItem
    };
  }

  /* ---------- 社媒热度（100）----------
   * 子项满分（2026-08-24 三次调整）：互动均值 15 + 微博粉丝 5 + 超话粉丝 5 + 超话帖子 5
   *                + 微博整体讨论帖 5 + 小红书粉丝 20 + 小红书获赞收藏 15 + 抖音粉丝 20 + 抖音获赞 10 = 100
   * 变更说明：用户要求持续弱化微博互动、强化内容平台粉丝，小红书+抖音合计 65 分。
   */
  function calcSocial(a) {
    const wb = (a.social && a.social.weibo) || {};
    const xhs = (a.social && a.social.xiaohongshu) || {};
    const dy = (a.social && a.social.douyin) || {};
    return {
      weiboInteract: item('微博近30条互动均值', 15, wb.interactAvg, [[200, 15], [2000, 55], [10000, 95], [50000, 100]]),
      weiboFans:     item('微博粉丝量', 5, wb.fans, [[10, 15], [100, 50], [500, 80], [1000, 100]]),
      chaohuaFans:   item('超话粉丝量', 5, wb.chaohuaFans, [[0.3, 20], [5, 60], [30, 100]]),
      chaohuaPosts:  item('超话累计帖子数', 5, wb.chaohuaPosts, [[200, 25], [2000, 75], [10000, 100]]),
      weiboDiscussion: item('微博整体讨论帖数', 5,
        (wb.discussion && wb.discussion.postCount30d != null) ? wb.discussion.postCount30d : null,
        [[50, 20], [200, 50], [500, 80], [2000, 100]]),
      xhsFans:       item('小红书粉丝量', 20, xhs.fans, [[1, 10], [10, 40], [50, 80], [200, 100]]),
      xhsLikes:      item('小红书获赞收藏', 15, xhs.likesCollects, [[1, 10], [20, 40], [100, 80], [500, 100]]),
      douyinFans:    item('抖音粉丝量', 20, dy.fans, [[1, 10], [50, 40], [300, 80], [1000, 100]]),
      douyinLikes:   item('抖音获赞量', 10, dy.totalLikes, [[50, 10], [500, 40], [2000, 80], [5000, 100]])
    };
  }

  /* ---------- 粉丝粘性（100）----------
   * 子项满分：核心粉丝密度 25 + 粉丝忠诚转化率 25 + 网易云评论率 25 + 超话活跃度 25 = 100
   *
   * 设计原则：
   * - 删除"微博互动率"（interactRate 几乎全为 null，采集极难）
   * - 删除"互动率超额加成"和"粉丝自制内容量"（同上）
   * - 新增"粉丝忠诚转化率"= 网易云粉丝数 / 月听众数：高忠诚度意味着听众会主动关注，
   *   健康值 5%~15%；周深等大众歌手比值低，陈粒等独立音乐人比值高
   * - "网易云评论率"= 评论数 / 播放量，优先用 topSongPlays，无则用 totalPlays 作备用
   * - 超话社区活跃度 25pt，null 时不参与不惩罚
   * - 核心粉丝密度 25pt（超话粉丝/微博粉丝）
   */
  function calcFans(f, wb, nt) {
    f = f || {};
    wb = wb || {};
    nt = nt || {};

    /* 子项1：核心粉丝密度 = 超话粉丝 / 微博粉丝（25分） */
    var coreRatio = (wb.chaohuaFans != null && wb.fans != null && wb.fans > 0)
      ? wb.chaohuaFans / wb.fans : null;
    var coreFans = item('核心粉丝密度（超话/微博）', 25, coreRatio,
      [[0.01, 10], [0.05, 40], [0.15, 70], [0.30, 100]]);

    /* 子项2：粉丝忠诚转化率 = 网易云粉丝数 / 月听众数（25分）
     * 两者单位均为"万"；健康值：5%~15% 为忠实粉丝群；30%+ 说明超强粘性 */
    var loyaltyRate = (nt.followers != null && nt.monthlyListeners != null && nt.monthlyListeners > 0)
      ? (nt.followers / nt.monthlyListeners) * 100  /* 转为百分比 */
      : null;
    var loyaltyItem = item('粉丝忠诚转化率（网易云粉丝/月听众）', 25, loyaltyRate,
      [[1, 10], [5, 35], [15, 65], [30, 85], [50, 100]]);

    /* 子项3：网易云评论率 = 评论数 / 播放量（25分）
     * 优先用热门单曲播放量（最集中），无则用总播放量（单位均为亿）*/
    var commentRate = null;
    var playsRef = nt.topSongPlays != null ? nt.topSongPlays : nt.totalPlays;
    if (nt.commentCount != null && playsRef != null && playsRef > 0) {
      commentRate = (nt.commentCount / (playsRef * 100000000)) * 100;  /* 转为百分比 */
    }
    var commentRateItem = item('网易云评论率（情感投入度）', 25, commentRate,
      [[0.005, 10], [0.02, 30], [0.05, 55], [0.15, 80], [0.5, 100]]);

    /* 子项4：超话社区活跃度（25分，null 时不参与不惩罚） */
    var chaohuaActive = item('超话社区活跃度', 25, f.chaohuaActive,
      [[0.04, 20], [0.08, 50], [0.20, 80], [0.50, 100]]);

    return {
      coreFans:         coreFans,
      loyaltyRate:      loyaltyItem,
      commentRate:      commentRateItem,
      chaohuaActive:    chaohuaActive
    };
  }

  function sumDim(b) {
    var s = 0;
    for (var k in b) if (b.hasOwnProperty(k)) s += b[k].score;
    return r1(s);
  }

  /* ---------- 入口 ---------- */
  function calcScore(artist) {
    var wb = artist.social && artist.social.weibo;
    var nt = artist.social && artist.social.netease;
    var paid   = calcPaid(artist.paid, wb);
    var social = calcSocial(artist);
    var fans   = calcFans(artist.fans, wb, nt);
    var dims = { paid: sumDim(paid), social: sumDim(social), fans: sumDim(fans) };
    var breakdown = { paid: paid, social: social, fans: fans };

    artist.score = Math.round(dims.paid + dims.social + dims.fans);   // 三维直加，满分 300
    artist.dims = dims;
    artist._breakdown = breakdown;
    return { score: artist.score, dims: dims, breakdown: breakdown };
  }

  return { WEIGHTS: WEIGHTS, calcScore: calcScore, stepLinear: stepLinear };
})();
