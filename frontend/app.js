const STORAGE_KEY = "dental-crm-records-v2";
const DM_STORAGE_KEY = "douyin-dm-workbench-v1";
const REPORT_DEMO_MARKER_KEY = "dental-crm-demo-records-v1";
const GLOBAL_SETTINGS_KEY = "growth-console-global-settings-v1";

const fieldGroups = [
  {
    title: "1. 基础客户信息区",
    fields: [
      ["serialNo", "序号", "text"],
      ["registeredDate", "登记日期", "date"],
      ["customerName", "客户姓名", "text"],
      ["phone", "联系电话", "tel"],
      ["gender", "性别", "select", ["", "男", "女", "未知"]],
      ["age", "年龄", "number"],
      ["region", "所在区域", "text"],
      ["customerType", "是否新客/老客", "select", ["", "新客", "老客"]]
    ]
  },
  {
    title: "2. 线上引流渠道来源区",
    fields: [
      ["sourcePlatform", "引流来源平台", "select", ["", "抖音", "美团", "大众点评", "小红书", "视频号", "私域转介绍", "短视频直播", "其他"]],
      ["accountName", "具体账号/达人名称", "text"],
      ["intentProject", "咨询项目意向", "select", ["", "洗牙", "补牙", "拔牙", "根管", "矫正", "种植", "镶牙", "儿童齿科", "美白", "其他"]],
      ["painPoint", "客户核心痛点", "textarea"],
      ["budgetRange", "客户预算区间", "select", ["", "500 以下", "500-2000", "2000-5000", "5000-10000", "10000 以上"]]
    ]
  },
  {
    title: "3. 线上咨询跟进信息区",
    fields: [
      ["firstConsultTime", "首次咨询时间", "datetime-local"],
      ["onlineService", "线上咨询客服", "text"],
      ["wechatAdded", "是否成功加企微/微信", "select", ["", "是", "否"]],
      ["wechatAddedTime", "加微信时间", "datetime-local"],
      ["intentLevel", "客户意向等级", "select", ["", "A高意向", "B中等", "C低意向", "D无意向"]],
      ["concern", "客户顾虑难点", "select", ["", "怕疼", "价格", "远", "没时间", "再对比", "其他"]]
    ]
  },
  {
    title: "4. 线下到店转化数据区",
    fields: [
      ["appointmentTime", "预约到店时间", "datetime-local"],
      ["arrivedOnTime", "是否准时到店", "select", ["", "是", "否", "爽约"]],
      ["noShowReason", "爽约原因备注", "textarea"],
      ["doctor", "到店接诊医生", "text"],
      ["examProject", "到店检测项目", "select", ["", "拍片", "CT", "口腔全面检查", "拍片+CT", "其他"]],
      ["planIssued", "到店是否出方案", "select", ["", "是", "否"]],
      ["initialQuote", "到店初步报价", "number"]
    ]
  },
  {
    title: "5. 成交业绩数据区",
    fields: [
      ["dealStatus", "是否成交", "select", ["", "已成交", "未成交"]],
      ["dealProject", "成交项目", "select", ["", "洗牙", "补牙", "拔牙", "根管", "矫正", "种植", "镶牙", "儿童齿科", "美白", "其他"]],
      ["dealAmount", "实际成交金额", "number"],
      ["installment", "是否办理分期", "select", ["", "是", "否"]],
      ["dealDate", "成交日期", "date"],
      ["consultant", "归属业绩顾问", "text"],
      ["invoice", "是否开发票", "select", ["", "是", "否"]]
    ]
  },
  {
    title: "6. 后续维护&复盘区",
    fields: [
      ["nextFollowTime", "下次跟进时间", "datetime-local"],
      ["followCount", "跟进次数", "number"],
      ["latestFollowRecord", "最新跟进记录", "textarea"],
      ["customerStatus", "客户状态标签", "select", ["", "待预约", "已预约", "已到店", "已成交", "流失", "沉睡"]],
      ["lossReason", "流失原因", "select", ["", "价格高", "距离远", "没时间", "怕疼", "再对比", "联系不上", "无真实需求", "其他"]],
      ["referralAvailable", "是否可做转介绍", "select", ["", "是", "否"]],
      ["remark", "备注", "textarea"]
    ]
  }
];

const simpleFieldKeys = [
  "serialNo",
  "registeredDate",
  "customerName",
  "phone",
  "age",
  "sourcePlatform",
  "intentProject",
  "painPoint",
  "intentLevel",
  "onlineService",
  "wechatAdded",
  "appointmentTime",
  "arrivedOnTime",
  "doctor",
  "dealStatus",
  "dealAmount",
  "consultant",
  "customerStatus",
  "remark"
];

const tableColumns = [
  "serialNo",
  "registeredDate",
  "customerName",
  "phone",
  "age",
  "sourcePlatform",
  "intentProject",
  "intentLevel",
  "wechatAdded",
  "appointmentTime",
  "arrivedOnTime",
  "dealStatus",
  "dealAmount",
  "customerStatus"
];

const fieldMap = Object.fromEntries(
  fieldGroups.flatMap((group) => group.fields.map((field) => [field[0], { label: field[1], type: field[2], options: field[3] || [] }]))
);
const allFieldKeys = Object.keys(fieldMap);

let formMode = "simple";
let editingId = null;
let records = loadRecords();
let dmStatus = "unread";
let selectedDmId = null;
let dmMessages = loadDmMessages();
let uploadedKnowledgeText = "";
let publishLocalImages = [];
let publishAiImages = [];
let publishMaterials = [];
let publishTasks = [];
let globalSettings = loadGlobalSettings();

function dmMessageKey(message) {
  return [message.nickname, message.time, message.content].map((item) => String(item || "").trim()).join("|");
}

function loadRecords() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return seedRecords();
    }
  }
  return seedRecords();
}

function loadDmMessages() {
  const saved = localStorage.getItem(DM_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }
  return [];
}

function loadGlobalSettings() {
  const saved = localStorage.getItem(GLOBAL_SETTINGS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return defaultGlobalSettings();
    }
  }
  return defaultGlobalSettings();
}

function defaultGlobalSettings() {
  return {
    deepseekApiKey: "",
    deepseekBaseUrl: "https://api.deepseek.com",
    deepseekModel: "deepseek-chat",
    imageApiKey: "",
    imageEndpoint: "https://api.ofox.ai/v1/images/generations",
    imageModel: "google/gemini-3.1-flash-image-preview"
  };
}

function persistRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function persistDm() {
  localStorage.setItem(DM_STORAGE_KEY, JSON.stringify(dmMessages));
}

function persistGlobalSettings() {
  localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(globalSettings));
}

function createDemoCustomerRecords() {
  const rows = [
    ["004", "2026-05-06", "陈女士", "13600004001", "女", "29", "朝阳区", "新客", "抖音", "门店官方号", "矫正", "牙齿拥挤，想了解隐形矫正周期和价格", "10000 以上", "2026-05-06T09:18", "小林", "是", "2026-05-06T09:25", "A高意向", "价格", "2026-05-07T15:00", "是", "", "陈医生", "拍片+CT", "是", "25800", "已成交", "矫正", "19800", "是", "2026-05-07", "李顾问", "否", "2026-05-20T10:00", "4", "已确认矫正方案，等待复诊取模。", "已成交", "", "是", "抖音咨询转化"],
    ["005", "2026-05-06", "赵先生", "13600004002", "男", "41", "海淀区", "新客", "美团", "团购页面", "种植", "左下缺牙两年，担心费用过高", "10000 以上", "2026-05-06T11:12", "小周", "是", "2026-05-06T11:20", "B中等", "再对比", "2026-05-10T10:30", "否", "临时出差", "王医生", "CT", "否", "0", "未成交", "", "0", "否", "", "赵顾问", "否", "2026-05-14T16:00", "2", "客户表示对比其他门店后再确认。", "流失", "再对比", "否", ""],
    ["006", "2026-05-07", "吴女士", "13600004003", "女", "34", "东城区", "老客", "私域转介绍", "老客王女士", "洗牙", "牙结石明显，想周末洗牙", "500-2000", "2026-05-07T13:45", "小林", "是", "2026-05-07T13:50", "A高意向", "没时间", "2026-05-11T09:30", "是", "", "刘医生", "口腔全面检查", "是", "680", "已成交", "洗牙", "580", "否", "2026-05-11", "李顾问", "否", "2026-11-11T09:00", "3", "已完成洁牙，提醒半年复查。", "已成交", "", "是", "转介绍客户"],
    ["007", "2026-05-07", "刘先生", "13600004004", "男", "52", "丰台区", "新客", "大众点评", "点评门店页", "根管", "夜间牙疼，想尽快处理", "2000-5000", "2026-05-07T20:05", "小周", "是", "2026-05-07T20:10", "A高意向", "怕疼", "2026-05-08T09:00", "是", "", "陈医生", "拍片", "是", "3200", "已成交", "根管", "2800", "否", "2026-05-08", "赵顾问", "是", "2026-05-15T09:30", "5", "已完成首诊，预约复诊。", "已成交", "", "否", ""],
    ["008", "2026-05-08", "孙女士", "13600004005", "女", "26", "西城区", "新客", "小红书", "达人探店", "美白", "牙色偏黄，想拍照前美白", "2000-5000", "2026-05-08T15:22", "小林", "否", "", "C低意向", "价格", "", "", "", "", "", "", "0", "未成交", "", "0", "否", "", "李顾问", "否", "2026-05-13T14:00", "1", "询价后暂无回复。", "待预约", "", "否", ""],
    ["009", "2026-05-08", "何先生", "13600004006", "男", "38", "通州区", "新客", "视频号", "口腔科普号", "补牙", "龋齿黑洞，担心越拖越严重", "500-2000", "2026-05-08T16:40", "小陈", "是", "2026-05-08T16:46", "B中等", "没时间", "2026-05-12T19:00", "是", "", "王医生", "拍片", "是", "1200", "已成交", "补牙", "960", "否", "2026-05-12", "王顾问", "否", "2026-06-12T10:00", "3", "已补牙，提醒观察咬合。", "已成交", "", "是", ""],
    ["010", "2026-05-09", "周女士", "13600004007", "女", "31", "昌平区", "新客", "短视频直播", "直播间5月专场", "儿童齿科", "孩子乳牙龋坏，想周末检查", "500-2000", "2026-05-09T10:08", "小周", "是", "2026-05-09T10:12", "B中等", "怕疼", "2026-05-18T10:00", "否", "孩子发烧改期", "刘医生", "口腔全面检查", "否", "0", "未成交", "", "0", "否", "", "赵顾问", "否", "2026-05-16T12:00", "2", "已沟通改约下周。", "已预约", "", "是", ""],
    ["011", "2026-05-09", "郑先生", "13600004008", "男", "47", "朝阳区", "老客", "私域转介绍", "员工转介绍", "拔牙", "智齿反复发炎", "500-2000", "2026-05-09T12:30", "小陈", "是", "2026-05-09T12:33", "A高意向", "怕疼", "2026-05-10T11:00", "是", "", "陈医生", "拍片", "是", "900", "已成交", "拔牙", "780", "否", "2026-05-10", "王顾问", "否", "2026-05-17T10:30", "4", "已拔除智齿，术后回访正常。", "已成交", "", "是", ""],
    ["012", "2026-05-10", "马女士", "13600004009", "女", "56", "大兴区", "新客", "抖音", "医生个人号", "镶牙", "多颗牙松动，想了解活动义齿", "5000-10000", "2026-05-10T09:05", "小林", "是", "2026-05-10T09:18", "B中等", "价格", "2026-05-15T14:30", "爽约", "家里临时有事", "王医生", "CT", "否", "0", "未成交", "", "0", "否", "", "李顾问", "否", "2026-05-17T15:00", "3", "爽约后已重新邀约，待确认。", "流失", "没时间", "否", ""],
    ["013", "2026-05-10", "郭先生", "13600004010", "男", "33", "海淀区", "新客", "小红书", "矫正案例笔记", "矫正", "牙缝大，想对比隐形和金属", "10000 以上", "2026-05-10T17:35", "小周", "是", "2026-05-10T17:40", "B中等", "再对比", "2026-05-19T16:00", "否", "工作会议冲突", "陈医生", "拍片+CT", "否", "0", "未成交", "", "0", "否", "", "赵顾问", "否", "2026-05-18T18:00", "2", "客户需要与家人商量预算。", "已预约", "", "是", ""],
    ["014", "2026-05-11", "唐女士", "13600004011", "女", "24", "朝阳区", "新客", "抖音", "门店官方号", "洗牙", "口气和牙结石问题", "500-2000", "2026-05-11T08:50", "小陈", "是", "2026-05-11T08:55", "A高意向", "没时间", "2026-05-11T18:30", "是", "", "刘医生", "口腔全面检查", "是", "780", "已成交", "洗牙", "680", "否", "2026-05-11", "王顾问", "否", "2026-11-11T18:00", "2", "已洁牙并推荐日常护理。", "已成交", "", "是", ""],
    ["015", "2026-05-11", "蒋先生", "13600004012", "男", "44", "顺义区", "新客", "美团", "种植专题页", "种植", "后牙缺失影响咀嚼", "10000 以上", "2026-05-11T14:28", "小林", "否", "", "C低意向", "价格", "", "", "", "", "", "", "0", "未成交", "", "0", "否", "", "李顾问", "否", "2026-05-16T10:00", "1", "只询问价格，未愿意加微信。", "待预约", "", "否", ""],
    ["016", "2026-05-12", "董女士", "13600004013", "女", "39", "丰台区", "老客", "私域转介绍", "老客群", "补牙", "旧补牙材料脱落", "500-2000", "2026-05-12T10:15", "小周", "是", "2026-05-12T10:20", "A高意向", "没时间", "2026-05-13T12:00", "是", "", "王医生", "拍片", "是", "1500", "已成交", "补牙", "1280", "否", "2026-05-13", "赵顾问", "否", "2026-06-13T11:00", "3", "已完成修复，客户满意。", "已成交", "", "是", ""],
    ["017", "2026-05-12", "梁先生", "13600004014", "男", "58", "东城区", "新客", "大众点评", "口碑榜入口", "镶牙", "全口咀嚼差，想先评估", "10000 以上", "2026-05-12T11:42", "小陈", "是", "2026-05-12T11:46", "B中等", "价格", "2026-05-16T09:00", "是", "", "陈医生", "CT", "是", "16800", "未成交", "", "0", "否", "", "王顾问", "否", "2026-05-18T09:30", "4", "已出方案，客户考虑预算。", "已到店", "", "否", ""],
    ["018", "2026-05-12", "谢女士", "13600004015", "女", "27", "海淀区", "新客", "视频号", "直播回放", "美白", "婚礼前想改善牙色", "2000-5000", "2026-05-12T15:33", "小林", "是", "2026-05-12T15:38", "A高意向", "价格", "2026-05-14T17:00", "是", "", "刘医生", "口腔全面检查", "是", "2200", "已成交", "美白", "1880", "否", "2026-05-14", "李顾问", "否", "2026-06-14T17:00", "3", "已完成美白，预约复查。", "已成交", "", "是", ""],
    ["019", "2026-05-13", "叶先生", "13600004016", "男", "36", "西城区", "新客", "抖音", "直播间私信", "根管", "牙疼三天，晚上更明显", "2000-5000", "2026-05-13T09:20", "小周", "是", "2026-05-13T09:25", "A高意向", "怕疼", "2026-05-13T16:00", "否", "", "陈医生", "拍片", "否", "0", "未成交", "", "0", "否", "", "赵顾问", "否", "2026-05-13T13:30", "1", "已预约下午到店。", "已预约", "", "否", ""],
    ["020", "2026-05-13", "罗女士", "13600004017", "女", "49", "通州区", "新客", "短视频直播", "午间直播", "种植", "门牙缺失，想了解当天能否修复", "10000 以上", "2026-05-13T10:48", "小陈", "是", "2026-05-13T10:55", "B中等", "再对比", "2026-05-17T15:30", "否", "", "王医生", "CT", "否", "0", "未成交", "", "0", "否", "", "王顾问", "否", "2026-05-15T10:00", "1", "已发送种植注意事项和到店时间。", "已预约", "", "是", ""],
    ["021", "2026-05-13", "白先生", "13600004018", "男", "30", "昌平区", "新客", "小红书", "洗牙种草笔记", "洗牙", "第一次洗牙，担心疼", "500-2000", "2026-05-13T12:05", "小林", "否", "", "C低意向", "怕疼", "", "", "", "", "", "", "0", "未成交", "", "0", "否", "", "李顾问", "否", "2026-05-15T12:00", "1", "已解释洁牙流程，待加微信。", "待预约", "", "否", ""],
    ["022", "2026-05-13", "高女士", "13600004019", "女", "62", "大兴区", "老客", "私域转介绍", "家属推荐", "种植", "多颗缺牙，想带片咨询", "10000 以上", "2026-05-13T13:26", "小周", "是", "2026-05-13T13:31", "A高意向", "价格", "2026-05-14T09:30", "是", "", "陈医生", "CT", "是", "36000", "已成交", "种植", "30000", "是", "2026-05-14", "赵顾问", "是", "2026-05-21T09:30", "5", "已确定两颗种植方案。", "已成交", "", "是", "高客单客户"],
    ["023", "2026-05-13", "韩先生", "13600004020", "男", "22", "海淀区", "新客", "抖音", "校园投放号", "拔牙", "正畸前需要拔牙评估", "500-2000", "2026-05-13T14:10", "小陈", "是", "2026-05-13T14:15", "B中等", "没时间", "2026-05-18T18:30", "否", "", "刘医生", "拍片", "否", "0", "未成交", "", "0", "否", "", "王顾问", "否", "2026-05-16T18:00", "1", "学生时间有限，待确认晚间号。", "已预约", "", "是", ""]
  ];

  return rows.map((row) => ({
    id: `demo-${row[0]}`,
    serialNo: row[0],
    registeredDate: row[1],
    customerName: row[2],
    phone: row[3],
    gender: row[4],
    age: row[5],
    region: row[6],
    customerType: row[7],
    sourcePlatform: row[8],
    accountName: row[9],
    intentProject: row[10],
    painPoint: row[11],
    budgetRange: row[12],
    firstConsultTime: row[13],
    onlineService: row[14],
    wechatAdded: row[15],
    wechatAddedTime: row[16],
    intentLevel: row[17],
    concern: row[18],
    appointmentTime: row[19],
    arrivedOnTime: row[20],
    noShowReason: row[21],
    doctor: row[22],
    examProject: row[23],
    planIssued: row[24],
    initialQuote: row[25],
    dealStatus: row[26],
    dealProject: row[27],
    dealAmount: row[28],
    installment: row[29],
    dealDate: row[30],
    consultant: row[31],
    invoice: row[32],
    nextFollowTime: row[33],
    followCount: row[34],
    latestFollowRecord: row[35],
    customerStatus: row[36],
    lossReason: row[37],
    referralAvailable: row[38],
    remark: row[39]
  }));
}

function ensureDemoReportRecords() {
  if (localStorage.getItem(REPORT_DEMO_MARKER_KEY) === "1") return;

  const demoRecords = createDemoCustomerRecords();
  const existingKeys = new Set(records.map((record) => record.phone || record.id));
  const additions = demoRecords.filter((record) => !existingKeys.has(record.phone) && !existingKeys.has(record.id));

  if (additions.length) {
    records = [...records, ...additions].sort((left, right) => String(left.serialNo).localeCompare(String(right.serialNo)));
    persistRecords();
  }

  localStorage.setItem(REPORT_DEMO_MARKER_KEY, "1");
}

function seedRecords() {
  return [
    {
      id: crypto.randomUUID(),
      serialNo: "001",
      registeredDate: "2026-05-01",
      customerName: "王女士",
      phone: "13800001111",
      gender: "女",
      age: "32",
      region: "东城区",
      customerType: "新客",
      sourcePlatform: "抖音",
      accountName: "门店官方号",
      intentProject: "矫正",
      painPoint: "牙齿不齐，想了解隐形矫正周期",
      budgetRange: "10000 以上",
      firstConsultTime: "2026-05-01T10:20",
      onlineService: "小林",
      wechatAdded: "是",
      wechatAddedTime: "2026-05-01T10:35",
      intentLevel: "A高意向",
      concern: "价格",
      appointmentTime: "2026-05-03T14:00",
      arrivedOnTime: "是",
      doctor: "陈医生",
      examProject: "口腔全面检查",
      planIssued: "是",
      initialQuote: "26800",
      dealStatus: "已成交",
      dealProject: "矫正",
      dealAmount: "19800",
      installment: "是",
      dealDate: "2026-05-03",
      consultant: "李顾问",
      invoice: "否",
      nextFollowTime: "2026-05-20T09:30",
      followCount: "3",
      latestFollowRecord: "已确认矫正方案，等待复诊。",
      customerStatus: "已成交",
      referralAvailable: "是",
      remark: "重点维护"
    },
    {
      id: crypto.randomUUID(),
      serialNo: "002",
      registeredDate: "2026-05-02",
      customerName: "张先生",
      phone: "13900002222",
      gender: "男",
      age: "45",
      region: "朝阳区",
      customerType: "老客",
      sourcePlatform: "美团",
      accountName: "团购页面",
      intentProject: "种植",
      painPoint: "缺牙多年，担心费用和恢复时间",
      budgetRange: "10000 以上",
      firstConsultTime: "2026-05-02T16:10",
      onlineService: "小周",
      wechatAdded: "是",
      intentLevel: "B中等",
      concern: "再对比",
      appointmentTime: "2026-05-08T10:00",
      arrivedOnTime: "爽约",
      noShowReason: "临时出差",
      doctor: "王医生",
      examProject: "CT",
      planIssued: "否",
      dealStatus: "未成交",
      dealAmount: "0",
      consultant: "赵顾问",
      nextFollowTime: "2026-05-12T15:00",
      followCount: "2",
      latestFollowRecord: "已二次邀约，客户表示下周确认。",
      customerStatus: "流失",
      lossReason: "没时间",
      referralAvailable: "否"
    },
    {
      id: crypto.randomUUID(),
      serialNo: "003",
      registeredDate: "2026-05-05",
      customerName: "刘女士",
      phone: "13700003333",
      gender: "女",
      age: "28",
      region: "海淀区",
      customerType: "新客",
      sourcePlatform: "小红书",
      accountName: "达人探店",
      intentProject: "洗牙",
      painPoint: "牙结石明显，想先做基础清洁",
      budgetRange: "500-2000",
      firstConsultTime: "2026-05-05T09:30",
      onlineService: "小林",
      wechatAdded: "否",
      intentLevel: "C低意向",
      concern: "价格",
      dealStatus: "未成交",
      dealAmount: "0",
      consultant: "李顾问",
      nextFollowTime: "2026-05-11T11:00",
      followCount: "1",
      latestFollowRecord: "客户询价后暂未回复。",
      customerStatus: "待预约"
    }
  ];
}

function seedDmMessages() {
  return [
    {
      id: "dm-001",
      status: "unread",
      nickname: "想做牙齿矫正的小米",
      time: "今天 10:21",
      intent: "矫正咨询",
      content: "你好，我牙齿有点凸，想问隐形矫正大概多少钱？最近能约吗？",
      history: "看过门店矫正案例视频，点赞过两条隐形矫正内容。",
      draft: "",
      finalReply: ""
    },
    {
      id: "dm-002",
      status: "unread",
      nickname: "阿杰",
      time: "今天 11:08",
      intent: "洗牙咨询",
      content: "洗牙疼不疼？团购价还能用吗？",
      history: "来自抖音直播间，停留 3 分钟。",
      draft: "",
      finalReply: ""
    },
    {
      id: "dm-003",
      status: "read",
      nickname: "木木",
      time: "昨天 18:40",
      intent: "种植咨询",
      content: "家里老人缺牙，想先了解种牙流程。",
      history: "客服已读，未生成草稿。",
      draft: "",
      finalReply: ""
    },
    {
      id: "dm-004",
      status: "replied",
      nickname: "牙齿美白中",
      time: "昨天 15:12",
      intent: "美白咨询",
      content: "冷光美白做一次多久？",
      history: "已人工确认发送。",
      draft: "您好，冷光美白通常单次到店约 60-90 分钟，医生会先检查牙齿情况再判断是否适合。您方便留下微信或预约到店时间吗？",
      finalReply: "您好，冷光美白通常单次到店约 60-90 分钟，医生会先检查牙齿情况再判断是否适合。您方便留下微信或预约到店时间吗？"
    }
  ];
}

function createField([key, label, type, options = []]) {
  const wrapper = document.createElement("div");
  wrapper.className = `field ${type === "textarea" ? "full" : ""}`;
  wrapper.dataset.field = key;

  const labelEl = document.createElement("label");
  labelEl.setAttribute("for", key);
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  let control;
  if (type === "select") {
    control = document.createElement("select");
    options.forEach((option) => {
      const optionEl = document.createElement("option");
      optionEl.value = option;
      optionEl.textContent = option || "请选择";
      control.appendChild(optionEl);
    });
  } else if (type === "textarea") {
    control = document.createElement("textarea");
  } else {
    control = document.createElement("input");
    control.type = type;
  }

  control.id = key;
  control.name = key;
  wrapper.appendChild(control);
  return wrapper;
}

function renderForm() {
  const form = document.getElementById("customer-form");
  form.innerHTML = "";

  fieldGroups.forEach((group) => {
    const visibleFields = group.fields.filter(([key]) => formMode === "full" || simpleFieldKeys.includes(key));
    if (!visibleFields.length) return;
    const section = document.createElement("section");
    section.className = "form-section";
    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = group.title;
    const grid = document.createElement("div");
    grid.className = "field-grid";
    visibleFields.forEach((field) => grid.appendChild(createField(field)));
    section.append(title, grid);
    form.appendChild(section);
  });

  document.getElementById("form-mode-label").textContent = formMode === "simple" ? "精简快速登记" : "40 项完整登记";
  if (!editingId) setDefaultFormValues();
}

function setDefaultFormValues() {
  setFormValue("serialNo", String(records.length + 1).padStart(3, "0"));
  setFormValue("registeredDate", new Date().toISOString().slice(0, 10));
  setFormValue("dealAmount", "0");
  setFormValue("followCount", "0");
}

function setFormValue(key, value) {
  const control = document.getElementById(key);
  if (control) control.value = value || "";
}

function collectFormData() {
  const formData = new FormData(document.getElementById("customer-form"));
  const record = {};
  allFieldKeys.forEach((key) => {
    record[key] = formData.get(key)?.toString().trim() || "";
  });
  return record;
}

function fillForm(record) {
  allFieldKeys.forEach((key) => setFormValue(key, record[key]));
}

function clearForm() {
  editingId = null;
  document.getElementById("save-record-btn").textContent = "新增客户";
  renderForm();
}

function saveRecord() {
  const data = collectFormData();
  if (!data.customerName || !data.phone) {
    alert("客户姓名和联系电话必填。");
    return;
  }
  if (editingId) {
    records = records.map((record) => (record.id === editingId ? { ...record, ...data } : record));
  } else {
    records.unshift({ id: crypto.randomUUID(), ...data });
  }
  persistRecords();
  clearForm();
  renderReport();
}

function getFilteredRecords() {
  const keyword = document.getElementById("search-input").value.trim().toLowerCase();
  const channel = document.getElementById("channel-filter").value;
  const status = document.getElementById("status-filter").value;
  return records.filter((record) => {
    const matchedKeyword =
      !keyword ||
      [record.customerName, record.phone, record.sourcePlatform, record.intentProject, record.painPoint]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    return matchedKeyword && (!channel || record.sourcePlatform === channel) && (!status || record.customerStatus === status);
  });
}

function renderTable() {
  document.getElementById("customer-table-head").innerHTML =
    tableColumns.map((key) => `<th>${fieldMap[key].label}</th>`).join("") + "<th>操作</th>";
  const filtered = getFilteredRecords();
  const body = document.getElementById("customer-table-body");
  if (!filtered.length) {
    body.innerHTML = `<tr><td class="empty-state" colspan="${tableColumns.length + 1}">暂无符合条件的客户记录</td></tr>`;
    return;
  }
  body.innerHTML = filtered
    .map((record) => {
      const cells = tableColumns.map((key) => `<td>${formatCell(key, record[key])}</td>`).join("");
      return `
        <tr>
          ${cells}
          <td>
            <div class="row-actions">
              <button class="table-button" data-action="edit" data-id="${record.id}" type="button">编辑</button>
              <button class="table-button danger" data-action="delete" data-id="${record.id}" type="button">删除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function formatCell(key, value) {
  const text = value || "-";
  if (key === "dealAmount" && value) return formatMoney(Number(value));
  if (key === "customerStatus") return `<span class="status-badge ${statusClass(value)}">${escapeHtml(text)}</span>`;
  if (key === "intentLevel") return `<span class="status-badge ${levelClass(value)}">${escapeHtml(text)}</span>`;
  return escapeHtml(text);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusClass(value) {
  if (value === "已成交") return "status-deal";
  if (value === "已预约" || value === "已到店") return "status-booked";
  if (value === "流失" || value === "沉睡") return "status-lost";
  return "";
}

function levelClass(value) {
  if (value?.startsWith("A")) return "status-a";
  if (value?.startsWith("B")) return "status-b";
  if (value?.startsWith("C")) return "status-c";
  if (value?.startsWith("D")) return "status-d";
  return "";
}

function renderFilters() {
  renderFilter("channel-filter", uniqueValues("sourcePlatform"), "全部渠道");
  renderFilter("status-filter", uniqueValues("customerStatus"), "全部状态");
}

function renderFilter(id, values, placeholder) {
  const select = document.getElementById(id);
  const current = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  select.value = values.includes(current) ? current : "";
}

function uniqueValues(key) {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))];
}

function isAffirmative(value) {
  return ["是", "鏄?"].includes(value);
}

function isDeal(value) {
  return ["已成交", "宸叉垚浜?"].includes(value);
}

function isLost(value) {
  return ["流失", "娴佸け"].includes(value);
}

function calcStats(source = records) {
  const total = source.length;
  const wechat = source.filter((record) => record.wechatAdded === "是").length;
  const booked = source.filter((record) => record.appointmentTime).length;
  const visited = source.filter((record) => record.arrivedOnTime === "是").length;
  const deals = source.filter((record) => record.dealStatus === "已成交").length;
  const amountTotal = source.reduce((sum, record) => sum + Number(record.dealAmount || 0), 0);
  return {
    total,
    wechatRate: rate(wechat, total),
    visitRate: rate(visited, booked || total),
    dealRate: rate(deals, total),
    avgAmount: deals ? amountTotal / deals : 0
  };
}

function calcStatsForReport(source = records) {
  const total = source.length;
  const yesValues = new Set(["\u662f", "\u93c4?"]);
  const dealValues = new Set(["\u5df2\u6210\u4ea4", "\u5b95\u53c9\u935a\u6d5c?"]);
  const wechat = source.filter((record) => yesValues.has(record.wechatAdded)).length;
  const booked = source.filter((record) => record.appointmentTime).length;
  const visited = source.filter((record) => yesValues.has(record.arrivedOnTime)).length;
  const deals = source.filter((record) => dealValues.has(record.dealStatus)).length;
  const amountTotal = source.reduce((sum, record) => sum + Number(record.dealAmount || 0), 0);
  return {
    total,
    wechatRate: rate(wechat, total),
    visitRate: rate(visited, booked || total),
    dealRate: rate(deals, total),
    avgAmount: deals ? amountTotal / deals : 0
  };
}

function rate(count, total) {
  return total ? Math.round((count / total) * 1000) / 10 : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value || 0);
}

function renderKpis() {
  const stats = calcStatsForReport(records);
  document.getElementById("kpi-total").textContent = stats.total;
  document.getElementById("kpi-wechat-rate").textContent = `${stats.wechatRate}%`;
  document.getElementById("kpi-visit-rate").textContent = `${stats.visitRate}%`;
  document.getElementById("kpi-deal-rate").textContent = `${stats.dealRate}%`;
  document.getElementById("kpi-avg").textContent = formatMoney(stats.avgAmount);
}

function groupBy(key) {
  return records.reduce((map, record) => {
    const name = record[key] || "未填写";
    if (!map[name]) map[name] = [];
    map[name].push(record);
    return map;
  }, {});
}

function renderAnalysis() {
  const channels = groupBy("sourcePlatform");
  document.getElementById("channel-analysis").innerHTML = Object.entries(channels)
    .map(([name, rows]) => {
      const stats = calcStatsForReport(rows);
      return `
        <div class="analysis-row">
          <strong>${escapeHtml(name)}</strong>
          <span>进线 ${stats.total}</span>
          <span>加微 ${stats.wechatRate}%</span>
          <span>到店 ${stats.visitRate}%</span>
          <span>成交 ${stats.dealRate}%</span>
        </div>
      `;
    })
    .join("");
  renderBars("project-analysis", groupBy("intentProject"));
  renderBars("loss-analysis", groupBy("lossReason"), (rows) => rows.filter((record) => record.customerStatus === "流失").length);
}

function renderBars(targetId, groups, countFn = (rows) => rows.length) {
  const rows = Object.entries(groups)
    .map(([name, groupRows]) => ({ name, count: countFn(groupRows) }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const max = Math.max(...rows.map((row) => row.count), 1);
  document.getElementById(targetId).innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <div class="bar-row">
              <strong>${escapeHtml(row.name)}</strong>
              <div class="bar-track"><div class="bar-fill" style="width:${(row.count / max) * 100}%"></div></div>
              <span>${row.count}</span>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">暂无统计数据</div>`;
}

function renderReport() {
  renderFilters();
  renderTable();
  renderKpis();
  renderAnalysis();
}

function exportCsv() {
  downloadFile("客户报表.csv", toCsv(records), "text/csv;charset=utf-8");
}

function exportExcel() {
  const header = allFieldKeys.map((key) => `<th>${fieldMap[key].label}</th>`).join("");
  const rows = records.map((record) => `<tr>${allFieldKeys.map((key) => `<td>${escapeHtml(record[key] || "")}</td>`).join("")}</tr>`).join("");
  const html = `<html><head><meta charset="UTF-8"></head><body><table border="1"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
  downloadFile("客户报表.xls", html, "application/vnd.ms-excel;charset=utf-8");
}

function exportJson() {
  downloadFile("客户报表.json", JSON.stringify(records, null, 2), "application/json;charset=utf-8");
}

function toCsv(rows) {
  const header = allFieldKeys.map((key) => fieldMap[key].label);
  const body = rows.map((record) => allFieldKeys.map((key) => csvCell(record[key] || "")).join(","));
  return "\uFEFF" + [header.join(","), ...body].join("\n");
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("JSON 必须是数组");
      records = imported.map((record) => ({ id: record.id || crypto.randomUUID(), ...record }));
      persistRecords();
      renderReport();
    } catch (error) {
      alert(`导入失败：${error.message}`);
    }
  };
  reader.readAsText(file, "utf-8");
}

function renderUploadedFiles() {
  const input = document.getElementById("knowledge-upload");
  const files = Array.from(input.files || []);
  document.getElementById("uploaded-files").innerHTML = files.length
    ? files.map((file) => `<div class="file-pill">${escapeHtml(file.name)} · ${Math.ceil(file.size / 1024)} KB</div>`).join("")
    : `<div class="file-pill">尚未上传资料</div>`;

  if (!files.length) {
    uploadedKnowledgeText = "";
    return;
  }

  Promise.all(files.map((file) => file.text().catch(() => ""))).then((texts) => {
    uploadedKnowledgeText = texts.join("\n\n").slice(0, 6000);
  });
}

function replyTemplate(message) {
  const policy = document.getElementById("reply-policy")?.value.trim() || "";
  const knowledgeHint = uploadedKnowledgeText
    ? `\n\n已参考上传资料摘要：${uploadedKnowledgeText.replace(/\s+/g, " ").slice(0, 180)}`
    : "";
  const base = `您好，看到您咨询的是“${message.intent}”。${message.content.includes("多少钱") || message.content.includes("价格") ? "费用会受牙齿情况和方案影响，建议先做一次到店检查后给您更准确报价。" : "我们可以先根据您的情况做初步判断，再帮您安排合适的到店时间。"}${message.content.includes("疼") ? "治疗前医生会评估情况并做好舒适化处理，您不用太担心疼痛。" : ""}`;
  return `${base} 您方便加一下企微或留下可预约时间吗？我这边可以帮您优先安排医生面诊。${policy ? `\n\n内部策略参考：${policy}` : ""}${knowledgeHint}`;
}

async function apiPost(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function getReplyProviderConfig() {
  return {
    apiKey: document.getElementById("client-api-key").value.trim() || globalSettings.deepseekApiKey,
    baseUrl: document.getElementById("client-api-base").value.trim() || globalSettings.deepseekBaseUrl || "https://api.deepseek.com",
    model: document.getElementById("client-api-model").value.trim() || globalSettings.deepseekModel || "deepseek-chat",
    knowledgeText: [
      uploadedKnowledgeText,
      document.getElementById("reply-policy").value.trim()
    ].filter(Boolean).join("\n\n")
  };
}

async function generateUnreadReplies() {
  const config = getReplyProviderConfig();
  const selected = dmMessages.find((message) => message.id === selectedDmId);
  const unread = dmMessages.filter((message) => message.status === "unread");
  const readWithoutDraft = dmMessages.filter((message) => message.status === "read" && !message.draft);
  const candidates = unread.length
    ? unread.slice(0, 2)
    : selected && selected.status === "read" && !selected.draft
      ? [selected]
      : readWithoutDraft.slice(0, 2);
  if (!candidates.length) {
    alert("没有未读私信需要生成。");
    return;
  }
  if (!config.apiKey) {
    alert("请先填写客户 API Key。");
    return;
  }

  document.getElementById("generate-replies-btn").disabled = true;
  try {
    for (const message of candidates) {
      let draft = "";
      try {
        const result = await apiPost("/api/douyin/reply/generate", {
          message,
          ...config
        });
        draft = result.reply || replyTemplate(message);
      } catch (error) {
        draft = `${replyTemplate(message)}\n\n生成接口异常，已使用本地兜底：${error.message}`;
      }
      dmMessages = dmMessages.map((item) => (item.id === message.id ? { ...item, draft, status: "read" } : item));
    }
  } finally {
    document.getElementById("generate-replies-btn").disabled = false;
  }
  dmStatus = "read";
  const firstDraft = dmMessages.find((message) => message.status === "read" && message.draft);
  selectedDmId = firstDraft?.id || selectedDmId;
  persistDm();
  renderDm();
}

async function refreshDm() {
  const button = document.getElementById("refresh-dm-btn");
  button.disabled = true;
  try {
    const result = await apiPost("/api/douyin/dm/read", { limit: 20 });
    const incoming = Array.isArray(result.messages) ? result.messages : [];
    if (!incoming.length) {
      dmMessages = [];
      dmStatus = "unread";
      selectedDmId = null;
      persistDm();
      renderDm();
      alert("没有读取到私信，可能页面结构变化或登录态失效。");
      return;
    }
    const existing = new Map(dmMessages.map((message) => [dmMessageKey(message), message]));
    dmMessages = incoming.map((message) => {
      const previous = existing.get(dmMessageKey(message));
      if (!previous) {
        return { ...message, status: message.status || "unread" };
      }
      return {
        ...message,
        history: previous.history || message.history,
        draft: previous.draft || "",
        finalReply: previous.finalReply || "",
        repliedAt: previous.repliedAt,
        status: previous.status === "replied" ? "replied" : message.status || previous.status || "read"
      };
    });
    dmStatus = "unread";
    selectedDmId = dmMessages.find((message) => message.status === "unread")?.id || dmMessages[0]?.id || null;
    persistDm();
    renderDm();
  } catch (error) {
    alert(`读取抖音私信失败：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function renderDm() {
  renderDmCounts();
  renderDmTabs();
  renderDmList();
  renderReplyReview();
}

function renderDmCounts() {
  ["unread", "read", "replied"].forEach((status) => {
    document.getElementById(`count-${status}`).textContent = dmMessages.filter((message) => message.status === status).length;
  });
}

function renderDmTabs() {
  document.querySelectorAll(".dm-tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.status === dmStatus);
  });
}

function renderDmList() {
  const list = document.getElementById("dm-list");
  const messages = dmMessages.filter((message) => message.status === dmStatus);
  if (!messages.length) {
    list.innerHTML = `<div class="empty-state">当前分类暂无私信</div>`;
    return;
  }
  list.innerHTML = messages
    .map(
      (message) => `
        <article class="dm-card ${message.id === selectedDmId ? "is-active" : ""}" data-id="${message.id}">
          <div class="dm-card-head">
            <strong>${escapeHtml(message.nickname)}</strong>
            <span class="dm-meta">${escapeHtml(message.time)}</span>
          </div>
          <p>${escapeHtml(message.content)}</p>
          <div class="dm-meta">${escapeHtml(message.intent)} · ${message.draft ? "已有草稿" : "未生成草稿"}</div>
        </article>
      `
    )
    .join("");
}

function renderReplyReview() {
  const box = document.getElementById("reply-review");
  const message = dmMessages.find((item) => item.id === selectedDmId);
  if (!message) {
    box.className = "reply-review empty-review";
    box.textContent = "请选择一条私信，或先点击“自动生成未读回复”。";
    return;
  }
  box.className = "reply-review";
  box.innerHTML = `
    <div class="review-block">
      <div>
        <strong>${escapeHtml(message.nickname)}</strong>
        <p class="dm-meta">${escapeHtml(message.history || "")}</p>
      </div>
      <label>
        原始私信
        <textarea readonly>${escapeHtml(message.content)}</textarea>
      </label>
      <label>
        回复草稿
        <textarea id="reply-draft-editor">${escapeHtml(message.draft || "尚未生成草稿，点击左上角自动生成。")}</textarea>
      </label>
      <div class="review-actions">
        <button class="action-button secondary" id="regenerate-current-btn" type="button">重新生成</button>
        <button class="action-button" id="confirm-reply-btn" type="button">确认并完成回复</button>
      </div>
    </div>
  `;
  document.getElementById("regenerate-current-btn").addEventListener("click", async () => {
    const config = getReplyProviderConfig();
    if (!config.apiKey) {
      updateDmMessage(message.id, { draft: replyTemplate(message), status: "read" });
      return;
    }
    try {
      const result = await apiPost("/api/douyin/reply/generate", { message, ...config });
      updateDmMessage(message.id, { draft: result.reply || replyTemplate(message), status: "read" });
    } catch (error) {
      updateDmMessage(message.id, { draft: `${replyTemplate(message)}\n\n生成接口异常，已使用本地兜底：${error.message}`, status: "read" });
    }
  });
  document.getElementById("confirm-reply-btn").addEventListener("click", async () => {
    const finalReply = document.getElementById("reply-draft-editor").value.trim();
    if (!finalReply) {
      alert("回复内容不能为空。");
      return;
    }
    const confirmButton = document.getElementById("confirm-reply-btn");
    confirmButton.disabled = true;
    try {
      await apiPost("/api/douyin/dm/send", {
        nickname: message.nickname,
        threadText: message.threadText || message.content,
        replyText: finalReply
      });
      updateDmMessage(message.id, {
        finalReply,
        draft: finalReply,
        status: "replied",
        repliedAt: new Date().toISOString()
      });
      dmStatus = "replied";
      selectedDmId = message.id;
      renderDm();
    } catch (error) {
      alert(`发送失败：${error.message}`);
      confirmButton.disabled = false;
    }
  });
}

function updateDmMessage(id, patch) {
  dmMessages = dmMessages.map((message) => (message.id === id ? { ...message, ...patch } : message));
  persistDm();
  renderDm();
}

function valueOf(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function setValue(id, value) {
  const node = document.getElementById(id);
  if (node) node.value = value || "";
}

function populateGlobalSettingsForm() {
  setValue("global-deepseek-key", globalSettings.deepseekApiKey);
  setValue("global-deepseek-base", globalSettings.deepseekBaseUrl);
  setValue("global-deepseek-model", globalSettings.deepseekModel);
  setValue("global-image-key", globalSettings.imageApiKey);
  setValue("global-image-endpoint", globalSettings.imageEndpoint);
  setValue("global-image-model", globalSettings.imageModel);
}

function saveGlobalSettings() {
  globalSettings = {
    deepseekApiKey: valueOf("global-deepseek-key"),
    deepseekBaseUrl: valueOf("global-deepseek-base") || "https://api.deepseek.com",
    deepseekModel: valueOf("global-deepseek-model") || "deepseek-chat",
    imageApiKey: valueOf("global-image-key"),
    imageEndpoint: valueOf("global-image-endpoint") || "https://api.ofox.ai/v1/images/generations",
    imageModel: valueOf("global-image-model") || "google/gemini-3.1-flash-image-preview"
  };
  persistGlobalSettings();
  alert("全局设置已保存。");
}

function resetGlobalSettings() {
  globalSettings = defaultGlobalSettings();
  persistGlobalSettings();
  populateGlobalSettingsForm();
  alert("全局设置已恢复默认。");
}

function tagList(text) {
  return String(text || "")
    .split(/[,，#\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderPublishResult(payload) {
  document.getElementById("publish-result").textContent = JSON.stringify(payload, null, 2);
}

function getPublishPostPayload() {
  return {
    platform: valueOf("publish-platform") || "douyin",
    topic: valueOf("publish-topic"),
    project: valueOf("publish-project"),
    audience: valueOf("publish-audience"),
    offer: valueOf("publish-offer"),
    leadKeyword: valueOf("publish-lead-keyword") || "预约",
    title: valueOf("publish-title"),
    body: valueOf("publish-copy"),
    hashtags: tagList(valueOf("publish-tags")),
    imagePrompt: valueOf("publish-image-prompt")
  };
}

function getDeepSeekPayload() {
  const replyKey = valueOf("client-api-key") || globalSettings.deepseekApiKey;
  return {
    apiKey: valueOf("publish-deepseek-key") || replyKey,
    baseUrl: valueOf("publish-deepseek-base") || valueOf("client-api-base") || globalSettings.deepseekBaseUrl || "https://api.deepseek.com",
    model: valueOf("publish-deepseek-model") || valueOf("client-api-model") || globalSettings.deepseekModel || "deepseek-chat"
  };
}

function renderLocalImagePreview() {
  const box = document.getElementById("publish-local-preview");
  if (!box) return;
  if (!publishLocalImages.length) {
    box.innerHTML = `<div class="file-pill">尚未选择本地图片</div>`;
    return;
  }
  box.innerHTML = publishLocalImages
    .map(
      (image) => `
        <figure class="media-tile">
          <img src="${image.previewUrl}" alt="${escapeHtml(image.name)}" />
          <figcaption>${escapeHtml(image.name)} · ${Math.ceil(image.size / 1024)} KB</figcaption>
        </figure>
      `
    )
    .join("");
}

function renderAiImagePreview() {
  const box = document.getElementById("publish-ai-preview");
  if (!box) return;
  if (!publishAiImages.length) {
    box.innerHTML = `<div class="file-pill">AI 图片尚未生成</div>`;
    return;
  }
  box.innerHTML = publishAiImages
    .map((image) => {
      const imageUrl = image.url || image.b64_json || image.base64 || "";
      const visual = imageUrl
        ? `<img src="${escapeHtml(imageUrl.startsWith("data:") || imageUrl.startsWith("http") ? imageUrl : `data:image/png;base64,${imageUrl}`)}" alt="AI generated" />`
        : `<div class="ai-placeholder">AI</div>`;
      return `
        <figure class="media-tile">
          ${visual}
          <figcaption>${escapeHtml(image.model || "nanobanana2")} · ${escapeHtml(image.status || image.type || "generated")}</figcaption>
        </figure>
      `;
    })
    .join("");
}

function handlePublishLocalImages(event) {
  publishLocalImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  publishLocalImages = Array.from(event.target.files || []).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    previewUrl: URL.createObjectURL(file),
    source: "local"
  }));
  renderLocalImagePreview();
}

async function generatePublishPost() {
  const button = document.getElementById("generate-post-btn");
  button.disabled = true;
  try {
    const result = await apiPost("/api/douyin/post/generate", {
      ...getPublishPostPayload(),
      ...getDeepSeekPayload(),
      knowledgeText: uploadedKnowledgeText,
      count: Number(valueOf("publish-image-count") || 6)
    });
    const post = result.post || {};
    setValue("publish-title", post.title || valueOf("publish-title"));
    setValue("publish-copy", post.body || valueOf("publish-copy"));
    setValue("publish-tags", Array.isArray(post.hashtags) ? post.hashtags.join(",") : valueOf("publish-tags"));
    setValue("publish-image-prompt", post.image_prompt || valueOf("publish-image-prompt"));
    renderPublishResult({ stage: "post_generated", ...result });
  } catch (error) {
    alert(`生成图文失败：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function generatePublishImages() {
  const button = document.getElementById("generate-image-btn");
  button.disabled = true;
  try {
    const result = await apiPost("/api/douyin/post/image-generate", {
      prompt: valueOf("publish-image-prompt"),
      endpoint: valueOf("publish-image-endpoint"),
      apiKey: valueOf("publish-image-key"),
      model: valueOf("publish-image-model") || "nanobanana2",
      count: Number(valueOf("publish-image-count") || 3),
      aspectRatio: "4:5"
    });
    publishAiImages = Array.isArray(result.images) ? result.images : [];
    renderAiImagePreview();
    renderPublishResult({ stage: "images_generated", ...result });
  } catch (error) {
    alert(`生成图片失败：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function simulatePublish() {
  const payload = getPublishPostPayload();
  const localImages = publishLocalImages.map(({ previewUrl, ...image }) => image);
  try {
    const result = await apiPost("/api/douyin/post/package", {
      ...payload,
      localImages,
      aiImages: publishAiImages,
      mode: "package"
    });
    renderPublishResult(result);
  } catch (error) {
    renderPublishResult({
      ok: false,
      error: error.message,
      fallback: {
        content_id: `douyin-note-${Date.now().toString(36)}`,
        platform: payload.platform,
        publish_type: "image_text",
        title: payload.title,
        body: payload.body,
        hashtags: payload.hashtags,
        local_images: localImages,
        ai_images: publishAiImages
      }
    });
  }
}

function tagList(text) {
  return String(text || "")
    .split(/[,，#\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function todayInputValue() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function defaultDateTimeValue(minutesFromNow = 60) {
  const date = new Date(Date.now() + minutesFromNow * 60000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function getPublishPostPayload() {
  return {
    platform: valueOf("publish-platform") || "douyin",
    topic: valueOf("publish-topic"),
    project: valueOf("publish-project"),
    audience: valueOf("publish-audience"),
    offer: valueOf("publish-offer"),
    leadKeyword: valueOf("publish-lead-keyword") || "预约",
    title: valueOf("publish-title"),
    body: valueOf("publish-copy"),
    hashtags: tagList(valueOf("publish-tags")),
    imagePrompt: valueOf("publish-image-prompt")
  };
}

function materialKey(material) {
  return material.file_path || material.previewUrl || material.name || material.id;
}

function mergeMaterials(items) {
  const map = new Map(publishMaterials.map((item) => [materialKey(item), item]));
  items.forEach((item) => {
    const key = materialKey(item);
    if (key) map.set(key, item);
  });
  publishMaterials = Array.from(map.values());
}

function materialPreviewUrl(material) {
  if (material.previewUrl) return material.previewUrl;
  if (material.public_path) return material.public_path;
  return "";
}

function renderLocalImagePreview() {
  const box = document.getElementById("publish-local-preview");
  if (!box) return;
  if (!publishMaterials.length) {
    box.innerHTML = `<div class="file-pill">尚未读取素材</div>`;
    return;
  }
  box.innerHTML = publishMaterials
    .map(
      (image) => `
        <figure class="media-tile">
          ${materialPreviewUrl(image) ? `<img src="${escapeHtml(materialPreviewUrl(image))}" alt="${escapeHtml(image.name || "material")}" />` : `<div class="ai-placeholder">IMG</div>`}
          <figcaption>${escapeHtml(image.name || image.file_path || "material")} · ${Math.ceil(Number(image.size || 0) / 1024)} KB</figcaption>
        </figure>
      `
    )
    .join("");
}

function handlePublishLocalImages(event) {
  publishLocalImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  publishLocalImages = Array.from(event.target.files || []).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    previewUrl: URL.createObjectURL(file),
    source: "local"
  }));
  mergeMaterials(publishLocalImages);
  renderLocalImagePreview();
}

async function generatePublishPost() {
  const button = document.getElementById("generate-post-btn");
  button.disabled = true;
  try {
    const result = await apiPost("/api/douyin/post/generate", {
      ...getPublishPostPayload(),
      ...getDeepSeekPayload(),
      knowledgeText: uploadedKnowledgeText,
      count: Number(valueOf("publish-image-count") || 6)
    });
    const post = result.post || {};
    setValue("publish-title", post.title || valueOf("publish-title"));
    setValue("publish-copy", post.body || valueOf("publish-copy"));
    setValue("publish-tags", Array.isArray(post.hashtags) ? post.hashtags.join(",") : valueOf("publish-tags"));
    const promptText = Array.isArray(result.prompts) && result.prompts.length
      ? result.prompts.join("\n\n")
      : result.prompt || post.image_prompt || valueOf("publish-image-prompt");
    setValue("publish-image-prompt", promptText);
    renderPublishResult({ stage: "prompt_generated", ...result });
  } catch (error) {
    alert(`生成提示词失败：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function generatePublishImages() {
  const button = document.getElementById("generate-image-btn");
  button.disabled = true;
  try {
    const promptLines = String(valueOf("publish-image-prompt") || "")
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const result = await apiPost("/api/douyin/post/image-generate", {
      prompt: promptLines[0] || valueOf("publish-image-prompt"),
      prompts: promptLines,
      endpoint: valueOf("publish-image-endpoint") || globalSettings.imageEndpoint,
      apiKey: valueOf("publish-image-key") || globalSettings.imageApiKey,
      model: valueOf("publish-image-model") || globalSettings.imageModel || "google/gemini-3.1-flash-image-preview",
      count: Number(valueOf("publish-image-count") || 6),
      aspectRatio: "4:5"
    });
    publishAiImages = Array.isArray(result.images) ? result.images : [];
    mergeMaterials(publishAiImages.map((image) => ({ ...image, source: "generated", name: image.name || image.file_path?.split(/[\\/]/).pop() || image.id })));
    if (result.output_dir) {
      setValue("publish-material-folder", result.output_dir);
      setValue("publish-material-date", result.output_dir.split(/[\\/]/).pop());
    }
    renderAiImagePreview();
    renderLocalImagePreview();
    renderPublishResult({ stage: "images_generated", ...result });
  } catch (error) {
    alert(`生成图片失败：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function loadPublishMaterials(useFolder = false) {
  if (useFolder && !valueOf("publish-material-folder")) {
    alert("请先填写本地素材文件夹路径。");
    return;
  }
  const payload = useFolder
    ? { sourceDir: valueOf("publish-material-folder") }
    : { date: valueOf("publish-material-date") || todayInputValue() };
  try {
    const result = await apiPost("/api/douyin/post/materials", payload);
    publishMaterials = Array.isArray(result.materials) ? result.materials : [];
    if (result.source_dir) {
      setValue("publish-material-folder", result.source_dir);
      const folderName = result.source_dir.split(/[\\/]/).pop();
      if (/^\d{4}-\d{2}-\d{2}$/.test(folderName || "")) {
        setValue("publish-material-date", folderName);
      }
    }
    renderLocalImagePreview();
    renderPublishResult({ stage: "materials_loaded", material_count: publishMaterials.length, ...result });
  } catch (error) {
    alert(`读取素材失败：${error.message}`);
  }
}

async function generatePublishCopy() {
  const button = document.getElementById("generate-copy-btn");
  button.disabled = true;
  try {
    const result = await apiPost("/api/douyin/post/copy", {
      ...getPublishPostPayload(),
      ...getDeepSeekPayload(),
      materials: publishMaterials
    });
    const post = result.post || {};
    setValue("publish-title", post.title || valueOf("publish-title"));
    setValue("publish-copy", post.body || valueOf("publish-copy"));
    setValue("publish-tags", Array.isArray(post.hashtags) ? post.hashtags.join(",") : valueOf("publish-tags"));
    renderPublishResult({ stage: "copy_generated", ...result });
  } catch (error) {
    alert(`生成发布文案失败：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function renderPublishTasks() {
  const box = document.getElementById("publish-task-list");
  if (!box) return;
  if (!publishTasks.length) {
    box.innerHTML = `<div class="empty-state">暂无发布任务</div>`;
    return;
  }
  box.innerHTML = publishTasks
    .map(
      (task, index) => `
        <article class="task-row">
          <strong>${index + 1}. ${escapeHtml(task.scheduled_at || "")}</strong>
          <span>${escapeHtml(task.title || "")}</span>
          <span>${(task.images || []).length} 张图 · ${escapeHtml(task.status || "scheduled")}</span>
        </article>
      `
    )
    .join("");
}

async function createPublishTasks() {
  const button = document.getElementById("create-publish-tasks-btn");
  button.disabled = true;
  try {
    const result = await apiPost("/api/douyin/post/tasks", {
      ...getPublishPostPayload(),
      materials: publishMaterials,
      startAt: valueOf("publish-start-at") || defaultDateTimeValue(60),
      intervalMinutes: Number(valueOf("publish-interval-minutes") || 120),
      imagesPerPost: Number(valueOf("publish-images-per-post") || 3)
    });
    publishTasks = Array.isArray(result.tasks) ? result.tasks : [];
    renderPublishTasks();
    renderPublishResult({ stage: "tasks_created", ...result });
  } catch (error) {
    alert(`创建发布任务失败：${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function simulatePublish() {
  const payload = getPublishPostPayload();
  const images = publishMaterials.map(({ previewUrl, ...image }) => image);
  try {
    const result = await apiPost("/api/douyin/post/package", {
      ...payload,
      images,
      mode: "package"
    });
    renderPublishResult(result);
  } catch (error) {
    renderPublishResult({
      ok: false,
      error: error.message,
      fallback: {
        content_id: `douyin-note-${Date.now().toString(36)}`,
        platform: payload.platform,
        publish_type: "image_text",
        title: payload.title,
        body: payload.body,
        hashtags: payload.hashtags,
        images
      }
    });
  }
}

function bindEvents() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(".page-view").forEach((view) => view.classList.toggle("is-active", view.dataset.pageView === button.dataset.page));
    });
  });

  document.querySelectorAll(".sub-nav-tab[data-report-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".sub-nav-tab[data-report-view]").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(".report-subview").forEach((view) => {
        view.classList.toggle("is-active", view.dataset.reportSubview === button.dataset.reportView);
      });
    });
  });

  document.querySelectorAll(".sub-nav-tab[data-publish-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".sub-nav-tab[data-publish-view]").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll(".publish-subview").forEach((view) => {
        view.classList.toggle("is-active", view.dataset.publishSubview === button.dataset.publishView);
      });
    });
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      const draft = collectFormData();
      formMode = button.dataset.mode;
      document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("is-active", item === button));
      renderForm();
      fillForm(draft);
    });
  });

  document.getElementById("save-record-btn").addEventListener("click", saveRecord);
  document.getElementById("clear-form-btn").addEventListener("click", clearForm);
  document.getElementById("search-input").addEventListener("input", renderTable);
  document.getElementById("channel-filter").addEventListener("change", renderTable);
  document.getElementById("status-filter").addEventListener("change", renderTable);
  document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
  document.getElementById("export-excel-btn").addEventListener("click", exportExcel);
  document.getElementById("export-json-btn").addEventListener("click", exportJson);
  document.getElementById("import-json-btn").addEventListener("click", () => document.getElementById("import-json-input").click());
  document.getElementById("import-json-input").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) importJsonFile(file);
    event.target.value = "";
  });

  document.getElementById("customer-table-body").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "edit") {
      const record = records.find((item) => item.id === id);
      if (!record) return;
      editingId = id;
      formMode = "full";
      document.querySelectorAll(".segment").forEach((item) => item.classList.toggle("is-active", item.dataset.mode === "full"));
      renderForm();
      fillForm(record);
      document.getElementById("save-record-btn").textContent = "保存修改";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (button.dataset.action === "delete") {
      if (!confirm("确认删除这条客户记录？")) return;
      records = records.filter((item) => item.id !== id);
      persistRecords();
      renderReport();
    }
  });

  document.getElementById("knowledge-upload").addEventListener("change", renderUploadedFiles);
  document.getElementById("refresh-dm-btn").addEventListener("click", refreshDm);
  document.getElementById("generate-replies-btn").addEventListener("click", generateUnreadReplies);
  document.querySelectorAll(".dm-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      dmStatus = tab.dataset.status;
      const first = dmMessages.find((message) => message.status === dmStatus);
      selectedDmId = first?.id || null;
      renderDm();
    });
  });
  document.getElementById("dm-list").addEventListener("click", (event) => {
    const card = event.target.closest(".dm-card");
    if (!card) return;
    selectedDmId = card.dataset.id;
    const current = dmMessages.find((message) => message.id === selectedDmId);
    if (current?.status === "unread") {
      updateDmMessage(current.id, { status: "read" });
      dmStatus = "read";
      selectedDmId = current.id;
      return;
    }
    renderDm();
  });
  document.getElementById("publish-local-images").addEventListener("change", handlePublishLocalImages);
  document.getElementById("generate-post-btn").addEventListener("click", generatePublishPost);
  document.getElementById("generate-image-btn").addEventListener("click", generatePublishImages);
  document.getElementById("load-generated-materials-btn").addEventListener("click", () => loadPublishMaterials(false));
  document.getElementById("load-folder-materials-btn").addEventListener("click", () => loadPublishMaterials(true));
  document.getElementById("generate-copy-btn").addEventListener("click", generatePublishCopy);
  document.getElementById("create-publish-tasks-btn").addEventListener("click", createPublishTasks);
  document.getElementById("simulate-publish-btn").addEventListener("click", simulatePublish);
  document.getElementById("save-global-settings-btn").addEventListener("click", saveGlobalSettings);
  document.getElementById("reset-global-settings-btn").addEventListener("click", resetGlobalSettings);
}

function boot() {
  ensureDemoReportRecords();
  setValue("publish-material-date", todayInputValue());
  setValue("publish-start-at", defaultDateTimeValue(60));
  populateGlobalSettingsForm();
  renderForm();
  bindEvents();
  renderReport();
  renderUploadedFiles();
  renderDm();
  renderLocalImagePreview();
  renderAiImagePreview();
  renderPublishTasks();
  simulatePublish();
}

boot();
