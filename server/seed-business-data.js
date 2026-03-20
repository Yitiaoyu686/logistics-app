"use strict";
/**
 * 业务模拟数据生成脚本
 * 按真实业务流程：客户→订单→入库→装箱→运输任务→目的国→配送→财务
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const BASE = 'http://localhost:3001/api';
// 登录获取token
function login() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const res = yield fetch(`${BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' }),
        });
        const data = yield res.json();
        return ((_a = data.data) === null || _a === void 0 ? void 0 : _a.token) || data.token;
    });
}
function h(token) {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}
function api(token, method, path, body) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch(`${BASE}${path}`, {
            method,
            headers: h(token),
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = yield res.json();
        if (!res.ok) {
            console.error(`  ❌ ${method} ${path} -> ${res.status}`, data);
        }
        return data;
    });
}
// ==================== 1. 客户数据 ====================
const CLIENTS = [
    { name: '深圳鸿运达贸易有限公司', country: '中国', contact: { name: '张明华', phone: '13800001001', email: 'zhangmh@hongyunda.com' }, industry: '电子产品', source: '展会获客', companyType: 'ENTERPRISE', creditLevel: 'A' },
    { name: '广州新丝路国际货运', country: '中国', contact: { name: '李秀英', phone: '13800001002', email: 'lxy@xinsilk.com' }, industry: '跨境电商', source: '客户推荐', companyType: 'ENTERPRISE', creditLevel: 'A' },
    { name: '义乌百汇商贸', country: '中国', contact: { name: '王建国', phone: '13800001003', email: 'wjg@bh-trade.cn' }, industry: '小商品', source: '线上获客', companyType: 'SME', creditLevel: 'B' },
    { name: '宁波海之蓝进出口', country: '中国', contact: { name: '陈丽娜', phone: '13800001004', email: 'chenlina@seablue.cn' }, industry: '家居用品', source: '展会获客', companyType: 'ENTERPRISE', creditLevel: 'A' },
    { name: '上海优品供应链管理', country: '中国', contact: { name: '赵伟', phone: '13800001005', email: 'zhaowei@upin-scm.com' }, industry: '服装纺织', source: '电话营销', companyType: 'SME', creditLevel: 'B' },
    { name: '佛山顺德机械制造厂', country: '中国', contact: { name: '黄志强', phone: '13800001006', email: 'hzq@sd-machinery.cn' }, industry: '机械设备', source: '客户推荐', companyType: 'ENTERPRISE', creditLevel: 'A' },
    { name: '温州欧凯鞋业', country: '中国', contact: { name: '林小芳', phone: '13800001007', email: 'lin@oukai-shoes.com' }, industry: '鞋类', source: '线上获客', companyType: 'SME', creditLevel: 'B' },
    { name: '厦门光耀电子科技', country: '中国', contact: { name: '吴晓东', phone: '13800001008', email: 'wxd@guangyao.cn' }, industry: '电子元器件', source: '展会获客', companyType: 'ENTERPRISE', creditLevel: 'A' },
    { name: '杭州丝绸之家', country: '中国', contact: { name: '孙梅', phone: '13800001009', email: 'sunmei@silk-home.cn' }, industry: '丝绸工艺品', source: '客户推荐', companyType: 'SME', creditLevel: 'B' },
    { name: '东莞汇能新材料', country: '中国', contact: { name: '刘强', phone: '13800001010', email: 'liuq@huineng-mat.com' }, industry: '新材料', source: '电话营销', companyType: 'ENTERPRISE', creditLevel: 'A' },
];
// ==================== 2. 订单数据 ====================
const ORDERS = [
    {
        sender: '张明华', senderPhone: '13800001001', senderAddress: '深圳市南山区科技园',
        consignee: 'John Smith', consigneePhone: '+1-213-555-0101', consigneeEmail: 'john@example.com',
        destCountry: '美国', destCity: '洛杉矶', destAddress: '1234 Commerce Ave, Los Angeles, CA 90001',
        transportType: 'SEA', totalPieces: 50, totalWeight: 320.5, totalVolume: 4.2, totalValue: 15000,
        remark: '电子产品批次，轻拿轻放',
        expressPackages: [
            { expressCompany: 'SF', courier: '顺丰速运', trackingNo: 'SF1001000001', name: '电子手表', category: '电子产品', cargoType: '普货', weight: 160, pieces: 25, declaredValue: 7500 },
            { expressCompany: 'SF', courier: '顺丰速运', trackingNo: 'SF1001000002', name: '蓝牙耳机', category: '电子产品', cargoType: '普货', weight: 160.5, pieces: 25, declaredValue: 7500 },
        ],
    },
    {
        sender: '李秀英', senderPhone: '13800001002', senderAddress: '广州市白云区太和镇',
        consignee: 'Emily Davis', consigneePhone: '+1-718-555-0102', consigneeEmail: 'emily@example.com',
        destCountry: '美国', destCity: '纽约', destAddress: '456 Broadway, New York, NY 10013',
        transportType: 'AIR', totalPieces: 20, totalWeight: 85.2, totalVolume: 1.5, totalValue: 8500,
        remark: '跨境电商急件，空运优先',
        expressPackages: [
            { expressCompany: 'YTO', courier: '圆通速递', trackingNo: 'YT1002000001', name: '化妆品套装', category: '化妆品', cargoType: '普货', weight: 42.6, pieces: 10, declaredValue: 4250 },
            { expressCompany: 'YTO', courier: '圆通速递', trackingNo: 'YT1002000002', name: '护肤品', category: '化妆品', cargoType: '普货', weight: 42.6, pieces: 10, declaredValue: 4250 },
        ],
    },
    {
        sender: '王建国', senderPhone: '13800001003', senderAddress: '义乌市国际商贸城',
        consignee: 'James Wilson', consigneePhone: '+44-20-7946-0103', consigneeEmail: 'james@example.co.uk',
        destCountry: '英国', destCity: '伦敦', destAddress: '10 Downing Street, London, SW1A 2AA',
        transportType: 'SEA', totalPieces: 100, totalWeight: 650, totalVolume: 8.5, totalValue: 25000,
        remark: '小商品批发',
        expressPackages: [
            { expressCompany: 'ZTO', courier: '中通快递', trackingNo: 'ZT1003000001', name: '圣诞装饰品', category: '工艺品', cargoType: '普货', weight: 325, pieces: 50, declaredValue: 12500 },
            { expressCompany: 'ZTO', courier: '中通快递', trackingNo: 'ZT1003000002', name: '节日灯串', category: '电子产品', cargoType: '普货', weight: 325, pieces: 50, declaredValue: 12500 },
        ],
    },
    {
        sender: '陈丽娜', senderPhone: '13800001004', senderAddress: '宁波市北仑区保税南区',
        consignee: 'Tanaka Yuki', consigneePhone: '+81-3-1234-0104', consigneeEmail: 'tanaka@example.jp',
        destCountry: '日本', destCity: '东京', destAddress: '1-1 Marunouchi, Chiyoda-ku, Tokyo',
        transportType: 'SEA', totalPieces: 30, totalWeight: 220, totalVolume: 3.8, totalValue: 12000,
        remark: '家居用品，需防潮包装',
        expressPackages: [
            { expressCompany: 'STO', courier: '申通快递', trackingNo: 'ST1004000001', name: '陶瓷餐具', category: '家居用品', cargoType: '易碎品', weight: 110, pieces: 15, declaredValue: 6000 },
            { expressCompany: 'STO', courier: '申通快递', trackingNo: 'ST1004000002', name: '竹制收纳盒', category: '家居用品', cargoType: '普货', weight: 110, pieces: 15, declaredValue: 6000 },
        ],
    },
    {
        sender: '赵伟', senderPhone: '13800001005', senderAddress: '上海市松江区泗泾镇',
        consignee: 'Hans Mueller', consigneePhone: '+49-30-123-0105', consigneeEmail: 'hans@example.de',
        destCountry: '德国', destCity: '柏林', destAddress: 'Friedrichstr. 123, 10117 Berlin',
        transportType: 'AIR', totalPieces: 15, totalWeight: 42, totalVolume: 0.8, totalValue: 6500,
        remark: '服装样品，紧急空运',
        expressPackages: [
            { expressCompany: 'SF', courier: '顺丰速运', trackingNo: 'SF1005000001', name: '男装西装', category: '服装', cargoType: '普货', weight: 21, pieces: 8, declaredValue: 3200 },
            { expressCompany: 'SF', courier: '顺丰速运', trackingNo: 'SF1005000002', name: '女装连衣裙', category: '服装', cargoType: '普货', weight: 21, pieces: 7, declaredValue: 3300 },
        ],
    },
    {
        sender: '黄志强', senderPhone: '13800001006', senderAddress: '佛山市顺德区大良镇工业区',
        consignee: 'Ahmed Hassan', consigneePhone: '+971-4-123-0106', consigneeEmail: 'ahmed@example.ae',
        destCountry: '阿联酋', destCity: '迪拜', destAddress: 'Dubai Industrial City, Plot 598',
        transportType: 'SEA', totalPieces: 5, totalWeight: 2500, totalVolume: 15, totalValue: 85000,
        remark: '机械设备，超重件，需特殊装柜',
        expressPackages: [
            { expressCompany: 'DEPPON', courier: '德邦物流', trackingNo: 'DP1006000001', name: '数控机床零件', category: '机械设备', cargoType: '重货', weight: 1500, pieces: 3, declaredValue: 55000 },
            { expressCompany: 'DEPPON', courier: '德邦物流', trackingNo: 'DP1006000002', name: '液压组件', category: '机械设备', cargoType: '重货', weight: 1000, pieces: 2, declaredValue: 30000 },
        ],
    },
    {
        sender: '林小芳', senderPhone: '13800001007', senderAddress: '温州市鹿城区鞋都大道',
        consignee: 'Maria Garcia', consigneePhone: '+1-305-555-0107', consigneeEmail: 'maria@example.com',
        destCountry: '美国', destCity: '迈阿密', destAddress: '789 Ocean Drive, Miami, FL 33139',
        transportType: 'SEA', totalPieces: 80, totalWeight: 520, totalVolume: 6.2, totalValue: 18000,
        remark: '春季新款鞋类',
        expressPackages: [
            { expressCompany: 'YTO', courier: '圆通速递', trackingNo: 'YT1007000001', name: '运动鞋', category: '鞋类', cargoType: '普货', weight: 260, pieces: 40, declaredValue: 9000 },
            { expressCompany: 'YTO', courier: '圆通速递', trackingNo: 'YT1007000002', name: '皮鞋', category: '鞋类', cargoType: '普货', weight: 260, pieces: 40, declaredValue: 9000 },
        ],
    },
    {
        sender: '吴晓东', senderPhone: '13800001008', senderAddress: '厦门市集美区软件园',
        consignee: 'Park Min-jun', consigneePhone: '+82-2-1234-0108', consigneeEmail: 'park@example.kr',
        destCountry: '韩国', destCity: '首尔', destAddress: 'Gangnam-gu, Seoul, 135-090',
        transportType: 'AIR', totalPieces: 10, totalWeight: 28, totalVolume: 0.5, totalValue: 22000,
        remark: '电子元器件，高价值货物',
        expressPackages: [
            { expressCompany: 'SF', courier: '顺丰速运', trackingNo: 'SF1008000001', name: 'IC芯片', category: '电子元器件', cargoType: '普货', weight: 14, pieces: 5, declaredValue: 12000 },
            { expressCompany: 'SF', courier: '顺丰速运', trackingNo: 'SF1008000002', name: 'PCB电路板', category: '电子元器件', cargoType: '普货', weight: 14, pieces: 5, declaredValue: 10000 },
        ],
    },
    {
        sender: '孙梅', senderPhone: '13800001009', senderAddress: '杭州市上城区丝绸博物馆旁',
        consignee: 'Sophie Martin', consigneePhone: '+33-1-1234-0109', consigneeEmail: 'sophie@example.fr',
        destCountry: '法国', destCity: '巴黎', destAddress: '55 Rue du Faubourg Saint-Honoré, 75008 Paris',
        transportType: 'AIR', totalPieces: 12, totalWeight: 18, totalVolume: 0.6, totalValue: 9800,
        remark: '高档丝绸制品，需防潮',
        expressPackages: [
            { expressCompany: 'EMS', courier: 'EMS', trackingNo: 'EM1009000001', name: '真丝围巾', category: '丝绸制品', cargoType: '普货', weight: 9, pieces: 6, declaredValue: 5000 },
            { expressCompany: 'EMS', courier: 'EMS', trackingNo: 'EM1009000002', name: '丝绸旗袍', category: '丝绸制品', cargoType: '普货', weight: 9, pieces: 6, declaredValue: 4800 },
        ],
    },
    {
        sender: '刘强', senderPhone: '13800001010', senderAddress: '东莞市长安镇新材料产业园',
        consignee: 'David Brown', consigneePhone: '+61-2-1234-0110', consigneeEmail: 'david@example.com.au',
        destCountry: '澳大利亚', destCity: '悉尼', destAddress: '100 George Street, Sydney NSW 2000',
        transportType: 'SEA', totalPieces: 40, totalWeight: 380, totalVolume: 5.5, totalValue: 32000,
        remark: '新材料样品和批量订单',
        expressPackages: [
            { expressCompany: 'ZTO', courier: '中通快递', trackingNo: 'ZT1010000001', name: '碳纤维板材', category: '新材料', cargoType: '普货', weight: 190, pieces: 20, declaredValue: 16000 },
            { expressCompany: 'ZTO', courier: '中通快递', trackingNo: 'ZT1010000002', name: '高分子复合材料', category: '新材料', cargoType: '普货', weight: 190, pieces: 20, declaredValue: 16000 },
        ],
    },
];
// ==================== 运输任务配置 ====================
const JOBS = [
    { route: '深圳-洛杉矶', pol: '深圳蛇口港', pod: '洛杉矶长滩港', carrier: 'COSCO', transportType: 'SEA', vesselVoyage: 'COSCO GALAXY V.2401E', etd: '2026-02-15', eta: '2026-03-10', billOfLading: 'COSU6260001001' },
    { route: '广州-纽约', pol: '广州白云机场', pod: '纽约JFK机场', carrier: 'CZ南方航空', transportType: 'AIR', flightNo: 'CZ399', etd: '2026-02-14', eta: '2026-02-16', billOfLading: 'AIR0001002' },
    { route: '宁波-伦敦', pol: '宁波舟山港', pod: '费利克斯托港', carrier: 'EVERGREEN', transportType: 'SEA', vesselVoyage: 'EVER GIVEN V.2402W', etd: '2026-02-18', eta: '2026-03-22', billOfLading: 'EISU9260003' },
    { route: '宁波-东京', pol: '宁波舟山港', pod: '东京港', carrier: 'ONE', transportType: 'SEA', vesselVoyage: 'ONE HARMONY V.2401N', etd: '2026-02-16', eta: '2026-02-22', billOfLading: 'ONEY6260004' },
    { route: '上海-柏林', pol: '上海浦东机场', pod: '法兰克福机场', carrier: 'LH汉莎航空', transportType: 'AIR', flightNo: 'LH729', etd: '2026-02-15', eta: '2026-02-17', billOfLading: 'AIR0005006' },
    { route: '广州-迪拜', pol: '广州南沙港', pod: '迪拜杰贝阿里港', carrier: 'MSC', transportType: 'SEA', vesselVoyage: 'MSC ANNA V.2402E', etd: '2026-02-20', eta: '2026-03-05', billOfLading: 'MSCU6260006' },
    { route: '深圳-迈阿密', pol: '深圳蛇口港', pod: '迈阿密港', carrier: 'COSCO', transportType: 'SEA', vesselVoyage: 'COSCO STAR V.2403E', etd: '2026-02-22', eta: '2026-03-18', billOfLading: 'COSU6260007' },
    { route: '厦门-首尔', pol: '厦门高崎机场', pod: '仁川机场', carrier: 'KE大韩航空', transportType: 'AIR', flightNo: 'KE862', etd: '2026-02-14', eta: '2026-02-15', billOfLading: 'AIR0008009' },
    { route: '杭州-巴黎', pol: '杭州萧山机场', pod: '巴黎戴高乐机场', carrier: 'AF法国航空', transportType: 'AIR', flightNo: 'AF199', etd: '2026-02-16', eta: '2026-02-18', billOfLading: 'AIR0009010' },
    { route: '深圳-悉尼', pol: '深圳蛇口港', pod: '悉尼博塔尼港', carrier: 'OOCL', transportType: 'SEA', vesselVoyage: 'OOCL KOREA V.2402S', etd: '2026-02-25', eta: '2026-03-12', billOfLading: 'OOLU6260010' },
];
// ==================== 费用类型配置 ====================
const FEE_CONFIGS = [
    { feeType: 'FREIGHT', desc: '国际运费', min: 2000, max: 15000 },
    { feeType: 'CUSTOMS', desc: '清关费', min: 300, max: 2000 },
    { feeType: 'STORAGE', desc: '仓储费', min: 100, max: 800 },
    { feeType: 'HANDLING', desc: '操作费', min: 200, max: 1500 },
    { feeType: 'INSURANCE', desc: '保险费', min: 100, max: 3000 },
];
function randomBetween(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        console.log('🚀 开始生成业务模拟数据...\n');
        // 登录
        const token = yield login();
        if (!token) {
            console.error('登录失败');
            return;
        }
        console.log('✅ 登录成功\n');
        // ======= 阶段1: 创建客户 =======
        console.log('📋 === 阶段1: 创建客户 (10条) ===');
        const clientIds = [];
        for (let i = 0; i < CLIENTS.length; i++) {
            const c = CLIENTS[i];
            const res = yield api(token, 'POST', '/clients', c);
            const cid = ((_a = res.data) === null || _a === void 0 ? void 0 : _a.id) || res.id;
            clientIds.push(cid);
            console.log(`  ✅ 客户${i + 1}: ${c.name} -> ${cid}`);
        }
        // 认领前5个客户给销售（salesId 使用 USR-002）
        for (let i = 0; i < 5; i++) {
            yield api(token, 'POST', `/clients/${clientIds[i]}/claim`, { salesId: 'USR-002' });
        }
        console.log('  ✅ 已认领前5个客户\n');
        // ======= 阶段2: 创建主订单 =======
        console.log('📦 === 阶段2: 创建主订单 (10条) ===');
        const masterOrderIds = [];
        const masterOrderNos = [];
        for (let i = 0; i < ORDERS.length; i++) {
            const o = ORDERS[i];
            const res = yield api(token, 'POST', '/orders/master', Object.assign(Object.assign({}, o), { customerId: clientIds[i], customerName: CLIENTS[i].name, salesPerson: '管理员' }));
            const mid = ((_b = res.data) === null || _b === void 0 ? void 0 : _b.id) || res.id;
            const mno = ((_c = res.data) === null || _c === void 0 ? void 0 : _c.orderNo) || res.orderNo;
            masterOrderIds.push(mid);
            masterOrderNos.push(mno);
            console.log(`  ✅ 主订单${i + 1}: ${mno} (${CLIENTS[i].name}) -> ${mid}`);
        }
        console.log('');
        // ======= 阶段3: 拆分子订单 =======
        console.log('✂️  === 阶段3: 拆分子订单 (每个主订单2条) ===');
        const subOrderIds = [];
        const subOrderNos = [];
        for (let i = 0; i < ORDERS.length; i++) {
            const o = ORDERS[i];
            for (let j = 0; j < 2; j++) {
                const pkg = o.expressPackages[j];
                const res = yield api(token, 'POST', '/orders/sub', {
                    masterOrderId: masterOrderIds[i],
                    transportType: o.transportType,
                    destCountry: o.destCountry,
                    destCity: o.destCity,
                    destAddress: o.destAddress,
                    consignee: o.consignee,
                    consigneePhone: o.consigneePhone,
                    batchNo: j + 1,
                    pieces: pkg.pieces,
                    weight: pkg.weight,
                    volume: (o.totalVolume / 2),
                    value: pkg.declaredValue,
                    expressCompany: pkg.expressCompany,
                    expressTrackingNo: pkg.trackingNo,
                    goodsDescription: pkg.name,
                    route: JOBS[i].route,
                });
                const sid = ((_d = res.data) === null || _d === void 0 ? void 0 : _d.id) || res.id;
                const sno = ((_e = res.data) === null || _e === void 0 ? void 0 : _e.subOrderNo) || sid;
                subOrderIds.push(sid);
                subOrderNos.push(sno);
                console.log(`  ✅ 子订单 ${masterOrderNos[i]}-${j + 1}: ${pkg.name} (${pkg.pieces}件/${pkg.weight}kg) -> ${sid}`);
            }
        }
        console.log(`  总计 ${subOrderIds.length} 条子订单\n`);
        // ======= 阶段4: 入库扫码 =======
        console.log('📥 === 阶段4: 入库扫码 ===');
        for (let i = 0; i < ORDERS.length; i++) {
            for (let j = 0; j < 2; j++) {
                const idx = i * 2 + j;
                const pkg = ORDERS[i].expressPackages[j];
                yield api(token, 'POST', '/warehouse/inbound', {
                    subOrderId: subOrderIds[idx],
                    masterOrderId: masterOrderIds[i],
                    trackingNo: pkg.trackingNo,
                    expressCompany: pkg.expressCompany || pkg.courier,
                    clientCode: CLIENTS[i].name.substring(0, 4),
                    clientName: CLIENTS[i].name,
                    pieces: pkg.pieces,
                    actualWeight: pkg.weight,
                    actualVolume: ORDERS[i].totalVolume / 2,
                    packageCondition: 'GOOD',
                    inboundMethod: 'SCAN',
                    warehouse: 'CN',
                    operator: '仓管员张三',
                    remark: `${pkg.name} 入库`,
                });
                console.log(`  ✅ 入库: ${pkg.trackingNo} (${pkg.name})`);
            }
        }
        console.log('');
        // ======= 阶段5: 创建运输单元（集装箱/空运板） =======
        console.log('📦 === 阶段5: 创建运输单元 ===');
        const unitIds = [];
        const unitNos = [];
        for (let i = 0; i < JOBS.length; i++) {
            const j = JOBS[i];
            const unitType = j.transportType === 'SEA' ? '40HQ' : 'PALLET';
            const prefix = j.transportType === 'SEA' ? 'CNTR' : 'PLT';
            const unitNo = `${prefix}-2026-${String(i + 1).padStart(3, '0')}`;
            const res = yield api(token, 'POST', '/warehouse/units', {
                unitNo,
                unitType,
                transportMode: j.transportType,
                maxWeight: j.transportType === 'SEA' ? 25000 : 5000,
                maxVolume: j.transportType === 'SEA' ? 65 : 10,
                warehouse: 'CN',
            });
            const uid = ((_f = res.data) === null || _f === void 0 ? void 0 : _f.id) || res.id;
            unitIds.push(uid);
            unitNos.push(unitNo);
            console.log(`  ✅ 运输单元: ${unitNo} (${unitType}) -> ${uid}`);
        }
        console.log('');
        // ======= 阶段6: 装载子订单到运输单元 =======
        console.log('📦 === 阶段6: 装载订单到运输单元 ===');
        for (let i = 0; i < JOBS.length; i++) {
            const sub1 = subOrderIds[i * 2];
            const sub2 = subOrderIds[i * 2 + 1];
            yield api(token, 'POST', `/warehouse/units/${unitIds[i]}/load`, {
                subOrderIds: [sub1, sub2],
            });
            console.log(`  ✅ ${unitNos[i]} 装载: ${subOrderNos[i * 2]}, ${subOrderNos[i * 2 + 1]}`);
        }
        console.log('');
        // ======= 阶段7: 封箱 =======
        console.log('🔒 === 阶段7: 封箱 ===');
        for (let i = 0; i < unitIds.length; i++) {
            const sealNo = `SEAL-2026-${String(i + 1).padStart(4, '0')}`;
            yield api(token, 'POST', `/warehouse/units/${unitIds[i]}/seal`, { sealNo });
            console.log(`  ✅ 封箱: ${unitNos[i]} (${sealNo})`);
        }
        console.log('');
        // ======= 阶段8: 创建运输任务 =======
        console.log('🚢 === 阶段8: 创建运输任务 ===');
        const jobNos = [];
        for (let i = 0; i < JOBS.length; i++) {
            const j = JOBS[i];
            const res = yield api(token, 'POST', '/jobs', j);
            const jno = ((_g = res.data) === null || _g === void 0 ? void 0 : _g.jobNo) || res.jobNo;
            jobNos.push(jno);
            console.log(`  ✅ 任务: ${jno} (${j.route}, ${j.transportType === 'SEA' ? '海运' : '空运'})`);
        }
        console.log('');
        // ======= 阶段9: 绑定运输单元到任务 =======
        console.log('🔗 === 阶段9: 绑定运输单元到任务 ===');
        for (let i = 0; i < JOBS.length; i++) {
            yield api(token, 'POST', `/jobs/${jobNos[i]}/bind-units`, {
                unitIds: [unitIds[i]],
            });
            console.log(`  ✅ ${jobNos[i]} <- ${unitNos[i]}`);
        }
        console.log('');
        // ======= 阶段10: 更新任务状态（前6个已发运，后4个计划中） =======
        console.log('🚀 === 阶段10: 更新运输任务状态 ===');
        for (let i = 0; i < 6; i++) {
            yield api(token, 'PUT', `/jobs/${jobNos[i]}`, {
                status: 'IN_TRANSIT',
                currentPhase: 'IN_TRANSIT',
                originPhaseStatus: 'COMPLETED',
            });
            // 更新子订单状态
            yield api(token, 'PUT', `/orders/sub/${subOrderIds[i * 2]}/status`, { status: 'IN_TRANSIT', currentNode: '已发运' });
            yield api(token, 'PUT', `/orders/sub/${subOrderIds[i * 2 + 1]}/status`, { status: 'IN_TRANSIT', currentNode: '已发运' });
            console.log(`  ✅ ${jobNos[i]}: IN_TRANSIT (已发运)`);
        }
        // 前3个已到达
        for (let i = 0; i < 3; i++) {
            yield api(token, 'PUT', `/jobs/${jobNos[i]}`, {
                status: 'ARRIVED',
                currentPhase: 'DESTINATION',
                destPhaseStatus: 'ARRIVED',
            });
            yield api(token, 'PUT', `/orders/sub/${subOrderIds[i * 2]}/status`, { status: 'ARRIVED', currentNode: '已到达' });
            yield api(token, 'PUT', `/orders/sub/${subOrderIds[i * 2 + 1]}/status`, { status: 'ARRIVED', currentNode: '已到达' });
            console.log(`  ✅ ${jobNos[i]}: ARRIVED (已到达)`);
        }
        console.log('');
        // ======= 阶段11: 目的国入库（前3个任务的子订单） =======
        console.log('🏭 === 阶段11: 目的国入库 ===');
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {
                const idx = i * 2 + j;
                const pkg = ORDERS[i].expressPackages[j];
                yield api(token, 'POST', '/warehouse/inbound', {
                    subOrderId: subOrderIds[idx],
                    masterOrderId: masterOrderIds[i],
                    trackingNo: pkg.trackingNo,
                    expressCompany: pkg.expressCompany || pkg.courier,
                    clientCode: CLIENTS[i].name.substring(0, 4),
                    clientName: CLIENTS[i].name,
                    pieces: pkg.pieces,
                    actualWeight: pkg.weight,
                    warehouse: 'US',
                    operator: '美国仓管员',
                    remark: `目的国入库 - ${pkg.name}`,
                });
                console.log(`  ✅ 目的国入库: ${pkg.trackingNo}`);
            }
        }
        console.log('');
        // ======= 阶段12: 创建配送单（前3个任务） =======
        console.log('🚚 === 阶段12: 创建配送单 ===');
        const deliveryIds = [];
        for (let i = 0; i < 3; i++) {
            const o = ORDERS[i];
            const sub1 = subOrderIds[i * 2];
            const sub2 = subOrderIds[i * 2 + 1];
            const res = yield api(token, 'POST', '/delivery', {
                recipientName: o.consignee,
                recipientPhone: o.consigneePhone,
                recipientAddress: o.destAddress,
                city: o.destCity,
                country: o.destCountry,
                deliveryMethod: 'DELIVERY',
                totalPieces: o.totalPieces,
                totalWeight: o.totalWeight,
                deliveryFee: randomBetween(50, 200),
                currency: 'USD',
                createdBy: '美国配送员',
                subOrderIds: [sub1, sub2],
                remark: `配送到 ${o.destCity}`,
            });
            const did = ((_h = res.data) === null || _h === void 0 ? void 0 : _h.id) || res.id;
            deliveryIds.push(did);
            console.log(`  ✅ 配送单: ${o.consignee} (${o.destCity}) -> ${did}`);
        }
        // 第1个配送单：已分配司机并签收
        if (deliveryIds[0]) {
            yield api(token, 'POST', `/delivery/${deliveryIds[0]}/assign`, {
                driverId: 'DRV001',
                driverName: 'Mike Johnson',
                driverPhone: '+1-213-555-9001',
            });
            yield api(token, 'POST', `/delivery/${deliveryIds[0]}/sign`, {});
            console.log('  ✅ 配送单1: 已签收');
            // 更新子订单为已配送
            yield api(token, 'PUT', `/orders/sub/${subOrderIds[0]}/status`, { status: 'DELIVERED', currentNode: '已签收' });
            yield api(token, 'PUT', `/orders/sub/${subOrderIds[1]}/status`, { status: 'DELIVERED', currentNode: '已签收' });
        }
        // 第2个配送单：已分配司机
        if (deliveryIds[1]) {
            yield api(token, 'POST', `/delivery/${deliveryIds[1]}/assign`, {
                driverId: 'DRV002',
                driverName: 'Tom Williams',
                driverPhone: '+1-718-555-9002',
            });
            console.log('  ✅ 配送单2: 已分配司机');
        }
        console.log('');
        // ======= 阶段13: 财务费用录入 =======
        console.log('💰 === 阶段13: 财务费用录入 ===');
        const feeIds = [];
        for (let i = 0; i < ORDERS.length; i++) {
            // 每个订单录2-3笔费用
            const numFees = i < 5 ? 3 : 2;
            for (let f = 0; f < numFees; f++) {
                const fc = FEE_CONFIGS[f];
                const isReceivable = f === 0; // 第一笔是应收（运费）
                const amount = randomBetween(fc.min, fc.max);
                const res = yield api(token, 'POST', '/fees', {
                    relatedType: 'ORDER',
                    relatedId: masterOrderIds[i],
                    relatedNo: masterOrderNos[i],
                    feeType: fc.feeType,
                    feeDirection: isReceivable ? 'RECEIVABLE' : 'PAYABLE',
                    amount,
                    currency: 'CNY',
                    exchangeRate: 1.0,
                    customerId: isReceivable ? clientIds[i] : undefined,
                    customerName: isReceivable ? CLIENTS[i].name : undefined,
                    supplierName: !isReceivable ? JOBS[i].carrier : undefined,
                    description: `${masterOrderNos[i]} - ${fc.desc}`,
                    createdBy: '财务人员',
                });
                const fid = ((_j = res.data) === null || _j === void 0 ? void 0 : _j.id) || res.id;
                feeIds.push(fid);
                console.log(`  ✅ 费用: ${masterOrderNos[i]} ${fc.desc} ${isReceivable ? '应收' : '应付'} ¥${amount}`);
            }
        }
        console.log('');
        // ======= 阶段14: 费用审批（前15笔通过，后面的保持待审核） =======
        console.log('✅ === 阶段14: 费用审批 ===');
        for (let i = 0; i < Math.min(15, feeIds.length); i++) {
            yield api(token, 'POST', `/fees/${feeIds[i]}/approve`, {
                approver: '财务主管李四',
            });
            console.log(`  ✅ 审批通过: 费用${i + 1}`);
        }
        // 拒绝2笔
        if (feeIds.length > 15) {
            yield api(token, 'POST', `/fees/${feeIds[15]}/reject`, {
                approver: '财务主管李四',
                rejectReason: '金额异常，请核实后重新提交',
            });
            console.log('  ❌ 审批拒绝: 费用16 (金额异常)');
        }
        if (feeIds.length > 16) {
            yield api(token, 'POST', `/fees/${feeIds[16]}/reject`, {
                approver: '财务主管李四',
                rejectReason: '缺少附件，请补充后重新提交',
            });
            console.log('  ❌ 审批拒绝: 费用17 (缺少附件)');
        }
        console.log('');
        // ======= 完成 =======
        console.log('🎉 ==========================================');
        console.log('🎉  业务模拟数据生成完毕！');
        console.log('🎉 ==========================================');
        console.log(`   客户: ${clientIds.length} 条`);
        console.log(`   主订单: ${masterOrderIds.length} 条`);
        console.log(`   子订单: ${subOrderIds.length} 条`);
        console.log(`   入库记录: ${subOrderIds.length} 条 (起运国) + 6 条 (目的国)`);
        console.log(`   运输单元: ${unitIds.length} 条`);
        console.log(`   运输任务: ${jobNos.length} 条`);
        console.log(`   配送单: ${deliveryIds.length} 条`);
        console.log(`   费用记录: ${feeIds.length} 条`);
        console.log('');
    });
}
main().catch(console.error);
