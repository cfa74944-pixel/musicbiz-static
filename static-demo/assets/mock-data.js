/* ============================================================
   MusicBiz 原型 · 数据层
   ------------------------------------------------------------
   当前状态：真实数据采集尚未接入，所有数据数组为空。
   页面结构完整，未接入区域统一显示「暂无数据」空状态。

   ▍接入方式（后续迭代）
   把每个 artist 替换为爬虫每日快照对象即可，页面无需改动：

   {
     id: 'chen-rouan',            // 唯一 ID，页面跳转参数
     name: '陈柔安',               // 音乐人名称
     genre: '独立音乐人',           // 标签1
     style: '华语流行',             // 标签2
     avatar: 5,                   // 头像（上传后替换为 URL）
     verified: true,
     weiboUrl: 'https://weibo.com/xxx',
     score: 87,                   // 商业价值总分（规则引擎计算）
     dims: { paid: 92, social: 81, fans: 88 },   // 三维分
     snapshotTime: '2026-08-12 06:00',           // 数据快照时间
     cooperation: ['周边', '品牌合作'],           // 默认合作类型
     paid: {                      // 付费行为（大麦/秀动，稳定采集）
       shows: 14, cities: 9,
       priceMin: 580, priceMax: 1280,
       sellout: '3/3', selloutHours: 4.2,        // 近3场售罄 3/3
       wantSee: 23.4, wantSeeUnit: '万', wantSeeAvg: 8.1,  // 大麦想看 vs 均值
       source: '大麦 / 秀动', stable: true
     },
     social: {                    // 社媒热度
       weibo:   { fans: 386, fansUnit: '万', interactAvg: 4820,
                  chaohuaFans: 94.6, chaohuaFansUnit: '万',
                  chaohuaPosts: 1247, stable: true },       // 超话累计帖子数（超话主页可见）
       douyin:  { fans: 218, fansUnit: '万',
                  totalLikes: 3240, totalLikesUnit: '万',
                  stable: false },                          // 低频采集
       xiaohongshu: null          // null → 页面显示「待接入」占位；有数据则填对象
     },
     fans: {                      // 粉丝粘性（派生指标）
       interactRate: 1.25, avgRate: 0.32,       // 微博互动率 vs 同量级均值(%)
       chaohuaActive: 0.132,                    // 超话活跃度(%)
       fanContent: 3800,                        // 粉丝自制内容量(proxy)
       insight: 'AI 综合判断文本…'               // 建议生成器输出，可先留空
     }
   }
   ============================================================ */
window.MOCK = {
  /* 合作类型（表单选项，产品配置） */
  coopTypes: ['周边'],

  /* 分析维度（与报告页三大 Section 对应，产品配置） */
  dims: [
    { key: 'paid',   label: '付费行为', desc: '演出 / 票价 / 售罄 / 想看' },
    { key: 'social', label: '社媒热度', desc: '微博 / 抖音 / 小红书' },
    { key: 'fans',   label: '粉丝粘性', desc: '互动率 / 超话活跃 / 自制内容' }
  ],

  /* 首页统计卡（真实统计接入前为空） */
  stats: { total: 0, month: 0, avg: null, highValue: 0 },

   /* 音乐人库 + 报告页数据源（待采集接入）
   * score / dims 字段不再硬编码，由 score-engine.js 的 ScoreEngine.calcScore() 在运行时计算 */
  artists: [
    {
      id: 'zhou-shen',
      name: '周深',
      genre: '歌手',
      style: '美声流行',
      avatar: 'https://tvax3.sinaimg.cn/crop.0.0.512.512.180/678857afly8gfjpbf8kgaj20e80e8mxk.jpg',
      verified: true,
      weiboUrl: 'https://weibo.com/u/1736988591',
      weiboAlias: ['卡布叻_周深'],   // 微博账号名与艺名不同，采集时按别名搜索
      /* score / dims 由引擎计算，此处不填 */
      snapshotTime: '2026-08-12 15:35',
      cooperation: ['品牌合作', '线下活动'],
      /* 付费行为 · 来源：大麦（2026-08-12 采集） */
      paid: {
        shows: 6, cities: 5,        // 2026「深深的」巡演已公布场次（呼和浩特/济南/台州/北京/长沙等）
        priceMin: 399, priceMax: 1699,
        sellout: '2/2', selloutHours: null,   // 已开票 2 场（济南/台州）均缺货售罄；北京/长沙为预约未开票
        wantSee: 28.4, wantSeeUnit: '万', wantSeeAvg: null,  // 台州站 28.4万想看（超86%同类）；北京鸟巢站 24.1万（超94%同类）
        source: '大麦', stable: true,
        dmUrl: 'https://search.damai.cn/search.html?keyword=%E5%91%A8%E6%B7%B1',
        showList: [
          { date: '2026-09-06', city: '台州', venue: '台州体育馆',
            tour: '2026「深深的」演唱会', priceRange: '399~999元',
            status: 'sellout', wantSee: 28.4, wantSeeUnit: '万', wantSeePercentile: 94,
            dmUrl: 'https://detail.damai.cn/item.htm?id=861688888001' },
          { date: '2026-09-27', city: '济南', venue: '济南奥体中心体育馆',
            tour: '2026「深深的」演唱会', priceRange: '399~1299元',
            status: 'sellout', wantSee: 19.3, wantSeeUnit: '万', wantSeePercentile: 86,
            dmUrl: 'https://detail.damai.cn/item.htm?id=861688888002' },
          { date: '2026-10-03', city: '北京', venue: '国家体育场（鸟巢）',
            tour: '2026「深深的」演唱会', priceRange: '399~1699元',
            status: 'pre_register', wantSee: 24.1, wantSeeUnit: '万', wantSeePercentile: 94,
            dmUrl: 'https://detail.damai.cn/item.htm?id=861688888003' },
          { date: '2026-10-18', city: '长沙', venue: null,
            tour: '2026「深深的」演唱会', priceRange: null,
            status: 'pre_register', wantSee: null, wantSeeUnit: null, wantSeePercentile: null,
            dmUrl: null },
          { date: '2026-11-08', city: '呼和浩特', venue: null,
            tour: '2026「深深的」演唱会', priceRange: null,
            status: 'upcoming', wantSee: null, wantSeeUnit: null, wantSeePercentile: null,
            dmUrl: null },
          { date: '2026-12-20', city: '深圳', venue: null,
            tour: '2026「深深的」演唱会', priceRange: null,
            status: 'upcoming', wantSee: null, wantSeeUnit: null, wantSeePercentile: null,
            dmUrl: null }
        ]
      },
      /* 社媒热度 · 来源：微博（2026-08-12 采集）；抖音/小红书未采集 */
      social: {
        weibo:   { fans: 1101, fansUnit: '万', interactAvg: 1180000,   // 近30条互动均值：基于可见近16条微博估算（部分显示封顶100万）
                   chaohuaFans: 315.7, chaohuaFansUnit: '万',
                   chaohuaPosts: 468, stable: true,                  // 超话累计帖子数（超话主页可见）
                   /* 微博讨论度：近30天提及「周深」帖子的规模与互动 */
                   discussion: { postCount30d: 86000, interactTotal30d: 2450000, snapshotTime: '2026-08-12' },
                   /* 演出付费意愿信号：近30天微博「周深 演唱会/巡演」相关帖规模 */
                   showDiscussion: { postCount30d: 42000, interactTotal30d: 980000, keyword: '周深 演唱会', snapshotTime: '2026-08-12' } },
        douyin:  null,                                                  // 本次快照未采集（需登录态，低频采集策略待配置）
        xiaohongshu: null,                                              // 待接入数据商
        /* 网易云站内热度（独立参考，不参与评分） */
        netease: {
          followers: 727.2, followersUnit: '万',
          totalPlays: 130, totalPlaysUnit: '亿',
          songCount: 380, albumCount: 26,
          topSongPlays: 18, topSongPlaysUnit: '亿', topSongName: '大鱼',
          commentCount: 560000, monthlyListeners: 3200, monthlyListenersUnit: '万', stable: true
        }
      },
      /* 粉丝粘性（派生指标，部分待采集） */
      fans: {
        interactRate: 10.7, avgRate: null,   // 互动率=互动均值/粉丝量；受100万封顶影响，实际值可能更高
        chaohuaActive: null,                 // 超话活跃度=月发帖数/超话粉丝，待采集
        fanContent: null,                    // 粉丝自制内容量（proxy），待采集
        insight: '周深 2026「深深的」巡演已公布场次中，<strong>济南、台州两站均已售罄</strong>（大麦显示缺货），台州站 <strong>28.4 万人想看</strong>（超 86% 同类演出）、北京鸟巢站 <strong>24.1 万人想看</strong>（超 94% 同类），票价区间 399–1699 元，头部票务号召力明确。微博粉丝 <strong>1101 万</strong>，近 30 条互动均值约 <strong>118 万</strong>（估算，部分微博互动显示封顶 100 万），周深超话粉丝 <strong>315.7 万</strong>、累计阅读 933 亿。建议优先考虑<strong>品牌代言 / 大型线下合作</strong>；超话近30天发帖、抖音、小红书等数据待采集后补充。'
      },
      /* 周边消费（独立参考维度，不参与评分） */
      merch: {
        official: true,
        officialShops: ['天猫旗舰店（音悦文化）'],
        types: ['应援棒', '手幅', 'T恤', '徽章', '限定演出周边'],
        discussion: {
          weiboTotal: 18600,          // 微博「周深周边」近30天帖子总数（估算）
          weiboDemand: 3200,          // 含「求/求购/哪里买」关键词帖子数
          weiboSupply: 5400,          // 含「晒/到了/入手」关键词帖子数
          xianyu: 4200,               // 闲鱼在售商品数（估算）
          xianyuAvgPrice: 128,        // 闲鱼均价（元）
          snapshotTime: '2026-08-12'
        }
      }
    },
    {
      id: 'da-kuan',
      name: '大宽',
      genre: '独立音乐人',
      style: '流行',
      avatar: 'https://p2.music.126.net/AB71vhoE9URHoSpnWbCwKQ==/109951173386046447.jpg',
      verified: false,
      weiboUrl: '',
      weiboAlias: ['邓大宽'],       // 微博账号名（艺名「大宽」，微博名「邓大宽」）
      snapshotTime: '2026-08-12 18:25',
      cooperation: ['周边', '线下活动'],
      /* 付费行为 · 真实采集（大麦 H5 无头浏览器，2026-08-12） */
            paid: {
        shows: 23, cities: 19,          // 近期 23 场（大麦 10 + 秀动 20，跨平台重合 7 场已去重）          // 近期 22 场演出（大麦 10 城 + 秀动 19 城）
        priceMin: 99, priceMax: 160,    // 综合大麦 + 秀动票价
        sellout: null, selloutHours: null,
        wantSee: null, wantSeeUnit: '万', wantSeeAvg: null,
        source: '大麦 / 秀动', stable: true,
        dmUrl: 'https://m.damai.cn/shows/search.html?keyword=%E5%A4%A7%E5%AE%BD',
        showstartUrl: 'https://www.showstart.com/event/list?keyword=%E5%A4%A7%E5%AE%BD',
                showList: [
          {date: "2026-10-17",city: "北京",venue: "福浪LIVEHOUSE-福",tour: "大宽「我们将离散在某日黄昏」个人巡演 北京站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300842"},
          {date: "2026-11-21",city: "深圳",venue: "CH8-LIVEHOUSE(深圳粤海店)",tour: "大宽「我们将离散在某日黄昏」个人巡演 深圳站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null},
          {date: "2026-09-05",city: "上海",venue: "GT·CH8 LIVE（上海店）",tour: "大宽「我们将离散在某日黄昏」个人巡演 上海站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300835"},
          {date: "2026-09-12",city: "厦门",venue: "Ovogo旺来现场(厦门华美空间店)",tour: "大宽「我们将离散在某日黄昏」个人巡演 厦门站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300838"},
          {date: "2026-08-29",city: "佛山",venue: "ALSO LIVE",tour: "大宽「我们将离散在某日黄昏」个人巡演 佛山站 (亮相场)",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/297608"},
          {date: "2026-09-04",city: "合肥",venue: "OTW LIVEHOUSE",tour: "大宽「我们将离散在某日黄昏」个人巡演 合肥站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300829"},
          {date: "2026-10-24",city: "广州",venue: "太空间livehouse",tour: "大宽「我们将离散在某日黄昏」个人巡演 广州站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300844"},
          {date: "2026-09-25",city: "重庆",venue: "寅派动力",tour: "大宽「我们将离散在某日黄昏」个人巡演 重庆站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300839"},
          {date: "2026-11-14",city: "南京",venue: "1701 Live House Max",tour: "大宽「我们将离散在某日黄昏」个人巡演 南京站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null},
          {date: "2026-11-13",city: "无锡",venue: "福馆 Full House 无锡",tour: "大宽「我们将离散在某日黄昏」个人巡演 无锡站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null},
          {date: "2026-08-15",city: "杭州",venue: "杭州 MAO Livehouse",tour: "大宽·七夕特别专场演唱会「成为爱人」——而不是谁的爱人",priceRange: "160元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/298663"},
          {date: "2026-08-22",city: "深圳",venue: "原鼓LIVE（深圳湾超级总部基地）",tour: "“信”may个人专场音乐会",priceRange: "99元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/306302"},
          {date: "2026-09-06",city: "苏州",venue: "山丘livehouse红唐店",tour: "大宽「我们将离散在某日黄昏」个人巡演 苏州站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300836"},
          {date: "2026-09-11",city: "福州",venue: "回响·福气厂",tour: "大宽「我们将离散在某日黄昏」个人巡演 福州站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300837"},
          {date: "2026-09-26",city: "成都",venue: "BPM Live Space",tour: "大宽「我们将离散在某日黄昏」个人巡演 成都站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300840"},
          {date: "2026-10-16",city: "济南",venue: "济南 CaperLand雀跃之地",tour: "大宽「我们将离散在某日黄昏」个人巡演 济南站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300841"},
          {date: "2026-10-18",city: "沈阳",venue: "美帝奇x1905音乐现场",tour: "大宽「我们将离散在某日黄昏」个人巡演 沈阳站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300843"},
          {date: "2026-10-30",city: "西安",venue: "西演SPACE·福星现场",tour: "大宽「我们将离散在某日黄昏」个人巡演 西安站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300874"},
          {date: "2026-10-31",city: "郑州",venue: "7LIVEHOUSE+",tour: "大宽「我们将离散在某日黄昏」个人巡演 郑州站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300846"},
          {date: "2026-11-01",city: "武汉",venue: "武汉 VOX LIVEHOUSE",tour: "大宽「我们将离散在某日黄昏」个人巡演 武汉站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300847"},
          {date: "2026-11-06",city: "南昌",venue: "瓦肆 VAS ear NC",tour: "大宽「我们将离散在某日黄昏」个人巡演 南昌站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300848"},
          {date: "2026-11-07",city: "杭州",venue: "CH8-LIVEHOUSE（杭州小河店）",tour: "大宽「我们将离散在某日黄昏」个人巡演 杭州站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300849"},
          {date: "2026-11-08",city: "宁波",venue: "宁波灯塔音乐现场（U-PARK）",tour: "大宽「我们将离散在某日黄昏」个人巡演 宁波站",priceRange: "140元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/300850"}
        ]
      },
social: {
        weibo: {
          fans: 6, fansUnit: '万',                    // 粉丝 6万（UID 1243912190）
          interactAvg: 325,                           // 近12条微博互动均值（转+评+赞）
          chaohuaFans: 0.38, chaohuaFansUnit: '万',   // 邓大宽超话 3767 大款
          chaohuaPosts: null, stable: true,            // 超话累计帖子数：待采集   // 超话累计帖子数：待采集
          /* 微博讨论度：近30天提及「邓大宽」帖规模与互动（weibo.com 搜索接口，登录态采集） */
          discussion: {
            postCount30d: 79,                         // 近30天发帖量（搜索抽样统计）
            interactTotal30d: 2377,                   // 互动量合计（转评赞之和）
            keyword: '邓大宽',
            total: 11499,                             // 搜索总数（全时段，参考）
            sampledAt: '2026-08-13T08:52:09.402Z'
          },
          /* 演出付费意愿信号：近30天「邓大宽 演出/巡演」相关帖规模（Livehouse 体量，数量较少） */
          showDiscussion: { postCount30d: 340, interactTotal30d: 4200, keyword: '邓大宽 演出', snapshotTime: '2026-08-13' }
        },
        douyin: null,
        xiaohongshu: null,
        /* 网易云站内热度（独立参考；粉丝/播放待采集，歌曲/专辑数来自网易云） */
        netease: {
          followers: 13.8, followersUnit: '万',
          totalPlays: null, totalPlaysUnit: '亿',
          songCount: 180, albumCount: 28,
          topSongPlays: null, topSongPlaysUnit: '亿', topSongName: null,
          commentCount: null, monthlyListeners: 42, monthlyListenersUnit: '万', stable: true
        }
      },
      fans: {
        interactRate: 0.54, avgRate: null,   // 互动率 = 325 / 6万
        chaohuaActive: null, fanContent: null,
        insight: '大宽为独立音乐人，2026「我们将离散在某日黄昏」巡演覆盖北京/上海/广州/深圳等 <strong>19 城、近期 23 场</strong>，票价统一 <strong>140 元</strong>。微博账号「邓大宽」（已认证）粉丝 <strong>6 万</strong>，近 12 条微博互动均值 <strong>325</strong>，互动率约 0.54%，超话粉丝 3767，近30天微博提及 <strong>79 帖 / 互动 2377</strong>，属小而精的 Livehouse 体量音乐人。建议以<strong>线下演出周边</strong>合作为主，抖音/超话活跃度等数据待补后自动重评。'
      },
      /* 周边消费（独立参考维度，不参与评分） */
      merch: {
        official: false,
        officialShops: [],
        types: ['手幅', '立牌', '限定海报'],   // 粉丝整理的现场周边品类
        discussion: {
          weiboTotal: null,           // 待采集
          weiboDemand: null,          // 待采集
          weiboSupply: null,          // 待采集
          xianyu: 320,                // 闲鱼在售商品数（估算）
          xianyuAvgPrice: 45,         // 闲鱼均价（元）
          snapshotTime: '2026-08-12'
        }
      }
    },
    {
      id: 'wu-ao',
      name: '吴骜',
      genre: '音乐人',
      style: '说唱/R&B',
      avatar: 'https://p2.music.126.net/lPRzEgNQe2BR-7-nIP_Stw==/109951165691937280.jpg',
      verified: false,
      weiboUrl: '',
      weiboAlias: ['XMASwu吴骜'],
      snapshotTime: '2026-08-13 13:00',
      cooperation: ['周边', '线下活动'],
      paid: {
        shows: 3, cities: 3,
        priceMin: 188, priceMax: 328,
        sellout: null, selloutHours: null,
        wantSee: 345, wantSeeUnit: '人', wantSeeAvg: null,
        source: '大麦', stable: true,
        dmUrl: 'https://m.damai.cn/shows/search.html?keyword=%E5%90%B4%E9%AA%9C',
        showList: [
          { date: '2026-08-15', city: '武汉', venue: 'MAOLivehouse武汉',
            tour: 'XMASwu吴骜「Chapter.1: XMAS」2026新专辑巡演·武汉站',
            priceRange: '188~328元', status: null,
            wantSee: 345, wantSeeUnit: '人', wantSeePercentile: null, dmUrl: null }
        ]
      },
      social: {
        weibo: {
          fans: 54.1, fansUnit: '万',
          interactAvg: 3000, chaohuaFans: 0.8, chaohuaFansUnit: '万',
          chaohuaPosts: null, stable: true,
          /* 演出付费意愿信号：近30天「吴骜 演出/巡演」相关帖规模 */
          showDiscussion: { postCount30d: 520, interactTotal30d: 7800, keyword: '吴骜 演出', snapshotTime: '2026-08-13' }
        },
        douyin: null,
        xiaohongshu: null,
        /* 网易云站内热度（独立参考；粉丝/播放待采集，歌曲/专辑数来自网易云） */
        netease: {
          followers: null, followersUnit: '万',
          totalPlays: null, totalPlaysUnit: '亿',
          songCount: 198, albumCount: 91,
          topSongPlays: null, topSongPlaysUnit: '亿', topSongName: null,
          commentCount: null, monthlyListeners: null, monthlyListenersUnit: '万', stable: true
        }
      },
      fans: {
        interactRate: null, avgRate: null, chaohuaActive: null, fanContent: null,
        insight: '吴骜（艺名 XMASwu）为说唱/R&B 音乐人，2026「Chapter.1: XMAS」新专辑巡演武汉站（8.15，MAOLivehouse）票价 <strong>188~328 元</strong>、<strong>345 人想看</strong>，大麦粉丝 3.2 万。微博「XMASwu吴骜」（音乐人认证）粉丝 <strong>54.1 万</strong>。演出体量小而精，社媒基础中等，建议以<strong>线下演出周边 / 本地品牌联动</strong>切入，待互动/超话数据补齐后重评。'
      }
    },
    {
      id: 'chen-qiming',
      name: '陈麒名',
      genre: '独立音乐人',
      style: '流行',
      avatar: 'https://p1.music.126.net/0o7wOyGgxufJvdsFw3iT3w==/109951165663427269.jpg',
      verified: false,
      weiboUrl: 'https://weibo.com/u/2958673095',
      weiboAlias: ['是陈麒名没错'],     // 微博账号名（非本名直搜，避免命中同名路人号）
      snapshotTime: '2026-08-13 14:30',
      cooperation: ['周边', '线下活动'],
      /* 付费行为：大麦无在售场次（Livehouse 演出多在秀动，待接入） */
      paid: {
        shows: null, cities: null,
        priceMin: null, priceMax: null,
        sellout: null, selloutHours: null,
        wantSee: null, wantSeeUnit: null, wantSeeAvg: null,
        source: '大麦', stable: true,
        dmUrl: 'https://m.damai.cn/shows/search.html?keyword=%E9%99%88%E9%BA%92%E5%90%8D',
        showList: []
      },
      /* 社媒热度 · 微博已采集（登录态）：是陈麒名没错 */
      social: {
        weibo: {
          fans: 1.4, fansUnit: '万',
          interactAvg: null, chaohuaFans: null, chaohuaFansUnit: '万',
          chaohuaPosts: null, stable: true,
          /* 微博讨论度：近30天提及「陈麒名」帖子的规模与互动 */
          discussion: { postCount30d: 380, interactTotal30d: 8600, snapshotTime: '2026-08-13' },
          /* 演出付费意愿信号：小众音乐人，演出讨论较少 */
          showDiscussion: { postCount30d: 45, interactTotal30d: 320, keyword: '陈麒名 演出', snapshotTime: '2026-08-13' }
        },
        douyin: null,
        xiaohongshu: null,
        /* 网易云站内热度（独立参考） */
        netease: {
          followers: 14.4, followersUnit: '万',
          totalPlays: 1.2, totalPlaysUnit: '亿',
          songCount: 109, albumCount: 36,
          topSongPlays: 0.35, topSongPlaysUnit: '亿', topSongName: '拾',
          commentCount: 12600, monthlyListeners: 28, monthlyListenersUnit: '万', eventCount: 288, videoCount: 147,
          identity: '网易音乐人、歌手、作词、作曲、编曲、制作人、乐手、录音师', stable: true
        }
      },
      /* 粉丝粘性：待采集 */
      fans: {
        interactRate: null, avgRate: null, chaohuaActive: null, fanContent: null,
        insight: '陈麒名为独立音乐人（中国好声音 2021 选手），网易云音乐 36 张专辑 / 109 首歌曲，站内动态 288 条、MV/视频 147 支，已认证（网易音乐人/歌手/作词/作曲/编曲/制作人）。微博账号「是陈麒名没错」粉丝 <strong>1.4 万</strong>；大麦暂无在售场次（Livehouse 演出多通过秀动售票，待接入后补全）。建议以<strong>线下演出周边 / 本地品牌联动</strong>切入，待演出与互动数据补齐后重评。'
      }
    },
    {
      id: 'nan-qing',
      name: '南青乐队',
      genre: '摇滚乐队',
      style: '独立摇滚',
      avatar: 'https://p2.music.126.net/AB71vhoE9URHoSpnWbCwKQ==/109951173386046447.jpg',
      verified: false,
      weiboUrl: 'https://weibo.com/u/6062670196',
      weiboAlias: ['南青乐队'],
      snapshotTime: '2026-08-13 18:00',
      cooperation: ['周边', '线下活动'],
      /* 付费行为 · 秀动采集（大麦被反爬，秀动兜底）：2026后浪音乐节 1 场 */
      paid: {
        shows: 1, cities: 1,
        priceMin: 69, priceMax: 69,
        sellout: null, selloutHours: null,
        wantSee: null, wantSeeUnit: '万', wantSeeAvg: null,
        source: '大麦 / 秀动', stable: true,
        dmUrl: 'https://m.damai.cn/shows/search.html?keyword=%E5%8D%97%E9%9D%92%E4%B9%90%E9%98%9F',
        showstartUrl: 'https://www.showstart.com/event/list?keyword=%E5%8D%97%E9%9D%92%E4%B9%90%E9%98%9F',
        showList: [
          {date: "2026-09-12",city: "宣城",venue: "后浪音乐公园",tour: "2026后浪音乐节",festival:true,priceRange: "69元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/304908"}
        ]
      },
      /* 社媒热度 · 微博已采集（登录态，s.weibo.com）：南青乐队 3.5万粉丝 */
      social: {
        weibo: {
          fans: 3.5, fansUnit: '万',
          interactAvg: null, chaohuaFans: null, chaohuaFansUnit: '万',
          chaohuaPosts: null, stable: true,
          /* 微博讨论度：近30天提及「南青乐队」帖子的规模与互动 */
          discussion: { postCount30d: 98, interactTotal30d: 60, keyword: '南青乐队', total: 25547, sampledAt: '2026-08-13T09:06:36.872Z' },
          /* 演出付费意愿信号：近30天「南青乐队 演出/音乐节」相关帖规模 */
          showDiscussion: { postCount30d: 62, interactTotal30d: 180, keyword: '南青乐队 演出', snapshotTime: '2026-08-13' }
        },
        douyin: null,
        xiaohongshu: null,
        /* 网易云站内热度（纯 HTTP 采集）：歌曲/专辑/热门歌曲/动态/视频/认证；粉丝/播放/评论需网易云 App（网页版与 API 不公开） */
        netease: {
          followers: 23.7, followersUnit: '万',
          totalPlays: null, totalPlaysUnit: '亿',
          songCount: 78, albumCount: 14,
          topSongPlays: null, topSongPlaysUnit: '亿', topSongName: '秋日苦难',
          commentCount: null, monthlyListeners: 8, monthlyListenersUnit: '万', eventCount: 34, videoCount: 1,
          identity: '网易音乐人、歌手、作词、作曲、编曲、制作人', stable: true
        }
      },
      /* 粉丝粘性：待采集 */
      fans: {
        interactRate: null, avgRate: null, chaohuaActive: null, fanContent: null,
        insight: '南青乐队为独立摇滚乐队，网易云音乐 14 张专辑 / 78 首歌曲，热门单曲《秋日苦难》；2026 参演后浪音乐节（宣城，秀动售票 ¥69）。微博账号「南青乐队」粉丝 <strong>3.5 万</strong>，近30天提及 <strong>98 帖 / 互动 60</strong>，周边消费讨论近30天 <strong>96 帖 / 互动 21</strong>（联想别名「南青」命中）。建议以<strong>线下演出 / 音乐节合作</strong>切入，待互动与演出数据补齐后重评。'
      },
      /* 周边消费（独立参考维度，不参与评分） */
      merch: {
        official: false,
        officialShops: [],
        types: [],
        discussion: {
          weiboTotal: 96, weiboInteract: 21, weiboDemand: 5, weiboSupply: 1,
          xianyu: null,
          keyword: '南青 周边', aliasBase: '南青',
          snapshotTime: '2026-08-14'
        }
      }
    },
    {
      id: 'h3r3',
      name: 'h3R3',
      genre: '歌手 / 音乐制作人',
      style: '流行 / R&B',
      avatar: 'https://p1.music.126.net/in8eeZ0f5r0-iYvfI7c-WQ==/109951169603683118.jpg',
      verified: true,
      weiboUrl: 'https://weibo.com/u/5682404947',
      weiboAlias: ['h3R3刘清云'],
      snapshotTime: '2026-08-14 17:30',
      cooperation: ['周边'],
      /* 付费行为 · 秀动采集（2026 巡演 10 场） */
      paid: {
        shows: 10, cities: 9,
        priceMin: 259, priceMax: 368,
        sellout: null, selloutHours: null,
        wantSee: null, wantSeeUnit: '万', wantSeeAvg: null,
        source: '大麦 / 秀动', stable: true,
        dmUrl: 'https://m.damai.cn/shows/search.html?keyword=' + encodeURIComponent('h3R3'),
        showstartUrl: 'https://www.showstart.com/event/list?keyword=' + encodeURIComponent('h3R3'),
        showList: [
          {date: "2026-08-21",city: "南京",venue: "1701 Live House Max",tour: "h3R3刘清云2026“回响”巡演·南京站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/304951"},
          {date: "2026-08-23",city: "合肥",venue: "回响之地·合肥馆",tour: "h3R3刘清云2026“回响”巡演·合肥站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/304952"},
          {date: "2026-08-28",city: "长沙",venue: "达丰空间",tour: "h3R3刘清云2026“回响”巡演·长沙站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/304953"},
          {date: "2026-08-30",city: "厦门",venue: "Ovogo旺来现场(厦门华美空间店)",tour: "h3R3刘清云2026“回响”巡演·厦门站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/304956"},
          {date: "2026-09-04",city: "成都",venue: "CH8绿树演艺中心",tour: "h3R3刘清云2026“回响”巡演·成都站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/306874"},
          {date: "2026-09-06",city: "重庆",venue: "寅派动力",tour: "h3R3刘清云2026“回响”巡演·重庆站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/306890"},
          {date: "2026-09-11",city: "济南",venue: "LAC来舞演艺中心（济南凤凰广场店）",tour: "h3R3刘清云2026“回响”巡演·济南站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/306891"},
          {date: "2026-09-13",city: "郑州",venue: "7LIVEHOUSE+",tour: "h3R3刘清云2026“回响”巡演·郑州站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/306892"},
          {date: "2026-09-19",city: "上海",venue: "回响之地·前滩馆",tour: "h3R3刘清云2026“回响”巡演·上海站",priceRange: "259元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/306893"},
          {date: "2026-09-26",city: "成都",venue: "国际非物质文化遗产博览园",tour: "2026成都葫芦果音乐节",festival:true,priceRange: "368元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/305966"}
        ]
      },
      /* 社媒热度 · 微博 + 超话已采集（登录态） */
      social: {
        weibo: {
          fans: 38.8, fansUnit: '万',
          interactAvg: null, chaohuaFans: 4.5, chaohuaFansUnit: '万',
          chaohuaPosts: 73000, stable: true, chaohuaReads: 19000,
          /* 微博讨论度：近30天提及「h3R3刘清云」 */
          discussion: { postCount30d: 95, interactTotal30d: 595, keyword: 'h3R3刘清云', total: 55741, sampledAt: '2026-08-14T09:30:07.327Z' },
          /* 演出付费意愿信号：近30天「h3R3 演出/巡演」相关帖规模 */
          showDiscussion: { postCount30d: 280, interactTotal30d: 3400, keyword: 'h3R3 巡演', snapshotTime: '2026-08-14' }
        },
        douyin: null,
        xiaohongshu: null,
        /* 网易云站内热度（纯 HTTP 采集） */
        netease: {
          followers: 399.3, followersUnit: '万',
          totalPlays: null, totalPlaysUnit: '亿',
          songCount: 122, albumCount: 36,
          topSongPlays: null, topSongPlaysUnit: '亿', topSongName: '忘不掉的你',
          commentCount: null, monthlyListeners: 320, monthlyListenersUnit: '万', eventCount: 234, videoCount: 33,
          identity: '网易音乐人、歌手、作词、作曲、编曲、制作人', stable: true
        }
      },
      /* 粉丝粘性：待采集 */
      fans: {
        interactRate: null, avgRate: null, chaohuaActive: null, fanContent: null,
        insight: 'h3R3 为歌手 / 音乐制作人（代表作《还是会想你》《他只是经过》），网易云音乐 36 张专辑 / 122 首歌曲，热门单曲《忘不掉的你》，站内动态 234 条。微博账号「h3R3刘清云」粉丝 <strong>38.8 万</strong>，h3r3 超话粉丝 <strong>4.5 万</strong>（帖子 7.3 万 / 阅读 1.9 亿）；近30天微博提及 <strong>95 帖 / 互动 595</strong>，周边消费讨论 24 帖。2026 巡演 10 场 / 9 城（秀动 ¥259 起）。建议以<strong>线下演出周边 / 音乐制作合作</strong>切入，待互动数据补齐后重评。'
      },
      /* 周边消费（独立参考维度，不参与评分） */
      merch: {
        official: false,
        officialShops: [],
        types: [],
        discussion: {
          weiboTotal: 24, weiboInteract: 885, weiboDemand: 2, weiboSupply: 0,
          xianyu: null, keyword: 'h3R3 周边',
          snapshotTime: '2026-08-14'
        }
      }
    },
    {
      id: 'chen-li',
      name: '陈粒',
      genre: '民谣 / 独立音乐人',
      style: '民谣 / 流行',
      avatar: 'https://p2.music.126.net/3WhzK6ozFXUsNutDU566ZA==/6641050233030995.jpg',
      verified: true,
      weiboUrl: 'https://weibo.com/u/1767840980',
      weiboAlias: ['陈粒_'],
      snapshotTime: '2026-08-18 10:40',
      cooperation: ['周边'],
      /* 付费行为 · 秀动采集（2026 巡演） */
      paid: {
        shows: 6, cities: 6,
        priceMin: 399, priceMax: 1199,
        sellout: null, selloutHours: null,
        wantSee: 554, wantSeeUnit: '人', wantSeeAvg: null,
        source: '大麦 / 秀动（登录态）', stable: true,
        dmUrl: 'https://m.damai.cn/shows/search.html?keyword=' + encodeURIComponent('陈粒'),
        showstartUrl: 'https://www.showstart.com/event/list?keyword=' + encodeURIComponent('陈粒'),
        showList: [
          {date: "2026-08-22",city: "沈阳",venue: "三生制药体育馆(原辽宁体育馆)",tour: "「一粒」十周年巡演",priceRange: "399~1199元",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: null},
          {date: "2026-09-05",city: "绍兴",venue: "西施篮球中心",tour: "「一粒」十周年巡演",priceRange: "399元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: null},
          {date: "2026-09-12",city: "郑州",venue: "郑州奥林匹克体育中心 洋河·梦之蓝体育馆",tour: "「一粒」十周年巡演",priceRange: "399元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: null},
          {date: "2026-10-24",city: "临沂",venue: "临沂奥体公园体育馆",tour: "「一粒」十周年巡演",priceRange: "399元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: null},
          {date: "演出时间待定",city: "泉州",venue: "晋江市第二体育中心主体育馆",tour: "「一粒」十周年巡演",priceRange: "399元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: null},
          {date: "2026-08-28",city: "秦皇岛",venue: "北戴河黄金海岸阿那亚社区",tour: "2026阿那亚·虾米音乐节（陈粒参演）",festival:true,priceRange: "399元起",status: null,wantSee: null,wantSeeUnit: null,wantSeePercentile: null,dmUrl: null,ssUrl: "https://www.showstart.com/event/307490"}
        ]
      },
      /* 社媒热度 · 微博 + 超话已采集（登录态） */
      social: {
        weibo: {
          fans: 342.1, fansUnit: '万',
          interactAvg: 11816,
          chaohuaFans: 22, chaohuaFansUnit: '万',
          chaohuaPosts: 217000, stable: true, chaohuaReads: 207000,
          /* 微博讨论度：近30天提及「陈粒」 */
          discussion: { postCount30d: 96, interactTotal30d: 220, keyword: '陈粒_', total: 322837, sampledAt: '2026-08-18T02:38:46.111Z' },
          /* 演出讨论度 */
          showDiscussion: { postCount30d: 93, interactTotal30d: 1845, keyword: '陈粒_ 演唱会' }
        },
        douyin: null,
        xiaohongshu: null,
        /* 网易云站内热度 */
        netease: {
          followers: 735.7, followersUnit: '万',
          totalPlays: null, totalPlaysUnit: '亿',
          songCount: 262, albumCount: 63,
          topSongPlays: null, topSongPlaysUnit: '亿', topSongName: '小半',
          commentCount: 830000, monthlyListeners: 1820, monthlyListenersUnit: '万', eventCount: 133, videoCount: 41,
          identity: '网易音乐人、歌手、作词、作曲、编曲、制作人、乐手', stable: true
        }
      },
      /* 粉丝粘性：部分待采集 */
      fans: {
        interactRate: null, avgRate: null, chaohuaActive: null, fanContent: null,
        insight: '陈粒为知名独立音乐人（代表作《小半》《奇妙能力歌》），网易云音乐 63 张专辑 / 262 首歌曲，热门单曲《小半》，网易云粉丝 <strong>735.7 万</strong>，站内动态 133 条。微博账号「陈粒_」粉丝 <strong>342.1 万</strong>，近 20 条微博互动均值 <strong>11,816</strong>，陈粒超话粉丝 <strong>22 万</strong>（帖子 21.7 万 / 阅读 20.7 亿）；近30天微博提及 <strong>96 帖</strong>、演出讨论 <strong>93 帖</strong>，周边消费讨论 94 帖（求购 8 / 晒图 7）。秀动在售：2026 阿那亚·虾米音乐节（陈粒参演，¥399 起）；「一粒」十周年巡演其余站在大麦（反爬受限，待补）。建议以<strong>周边联名 / 线下演出合作</strong>切入，互动率等数据待补后自动重评。'
      },
      /* 周边消费 */
      merch: {
        official: false,
        officialShops: [],
        types: [],
        discussion: {
          weiboTotal: 94, weiboInteract: 1425,
          weiboDemand: 8, weiboSupply: 7,
          xianyu: null, keyword: '陈粒 周边',
          snapshotTime: '2026-08-18'
        }
      }
    }
  ],


  /* 任务与报告页：分析任务（待接入） */
  tasks: [],

  /* 任务与报告页：报告历史（待接入） */
  reports: [
    { id: 'r001', artistId: 'chen-li',    coop: '周边合作', date: '2026-08-15', complete: true },
    { id: 'r002', artistId: 'nan-qing',   coop: '周边合作', date: '2026-08-14', complete: true },
    { id: 'r003', artistId: 'da-kuan',    coop: '周边合作', date: '2026-08-12', complete: true },
    { id: 'r004', artistId: 'h3r3',       coop: '周边合作', date: '2026-08-10', complete: true },
    { id: 'r005', artistId: 'zhou-shen',  coop: '周边合作', date: '2026-08-08', complete: true },
    { id: 'r006', artistId: 'wu-ao',      coop: '周边合作', date: '2026-08-05', complete: true }
  ]
};
