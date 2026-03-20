// 非洲目的地（国家 → 城市级联）
export const DESTINATIONS = [
  { value: 'NG', label: '尼日利亚', cities: [
    { value: 'Lagos', label: '拉各斯' },
    { value: 'Abuja', label: '阿布贾' },
    { value: 'Kano', label: '卡诺' },
    { value: 'Port Harcourt', label: '哈科特港' },
    { value: 'Kaduna', label: '卡杜纳' },
    { value: 'Ibadan', label: '伊巴丹' },
    { value: 'Onitsha', label: '奥尼查' },
  ]},
  { value: 'GH', label: '加纳', cities: [
    { value: 'Accra', label: '阿克拉' },
    { value: 'Kumasi', label: '库马西' },
    { value: 'Tema', label: '特马' },
  ]},
  { value: 'KE', label: '肯尼亚', cities: [
    { value: 'Nairobi', label: '内罗毕' },
    { value: 'Mombasa', label: '蒙巴萨' },
  ]},
  { value: 'TZ', label: '坦桑尼亚', cities: [
    { value: 'Dar es Salaam', label: '达累斯萨拉姆' },
    { value: 'Dodoma', label: '多多马' },
  ]},
  { value: 'ZA', label: '南非', cities: [
    { value: 'Johannesburg', label: '约翰内斯堡' },
    { value: 'Cape Town', label: '开普敦' },
    { value: 'Durban', label: '德班' },
  ]},
];

// 快递公司
export const EXPRESS_COMPANIES = [
  '顺丰', '韵达', '圆通', '中通', '申通', 'EMS', '极兔', '京东', '德邦',
];

// 货物类别
export const CARGO_CATEGORIES = [
  '电子产品', '服装鞋帽', '食品', '日用品', '美妆个护', '机械配件', '其他',
];

// 货物属性
export const CARGO_TYPES = ['普货', '敏感货', '带电', '液体', '粉末'];
