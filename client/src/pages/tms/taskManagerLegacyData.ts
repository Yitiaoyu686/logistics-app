export interface LegacyOrderItem {
  seq: number;
  orderNo: string;
  thirdPartyTracking: string;
  city: string;
  salesPerson: string;
  userName: string;
  goodsName: string;
  description: string;
  pieces: number;
  volumeCbm: number;
  volumeWeightKgs: number;
  grossWeightKgs: number;
}

export interface LegacyNodeProgress {
  completedNodes: Array<{
    nodeCode: string;
    nodeName: string;
    isAbnormal?: boolean;
    date?: string;
    remark?: string;
  }>;
}

export interface LegacyContainer {
  id: string;
  containerNo: string;
  routeName: string;
  serviceType: string;
  orders: LegacyOrderItem[];
  pieces: number;
  volumeCbm: number;
  volumeWeightKgs: number;
  grossWeightKgs: number;
  nodeProgress: LegacyNodeProgress;
}

export interface LegacyJob {
  id: string;
  jobNo: string;
  stationName: string;
  routeId: string;
  routeName: string;
  serviceType: 'EXPRESS' | 'STANDARD';
  originPort: string;
  transitPort?: string;
  destPort: string;
  cargoFilter: 'GENERAL' | 'NON_GENERAL' | 'ALL';
  weightKg: number;
  pieces: number;
  volumeCbm?: number;
  executeDate: string;
  remark?: string;
  blNo?: string;
  carrier?: string;
  vesselVoyage?: string;
  containerNo?: string;
  containerType?: string;
  serviceMode?: string;
  cutoffDate?: string;
  etd?: string;
  eta?: string;
  mawbNo?: string;
  hawbNo?: string;
  flightNo?: string;
  containers: LegacyContainer[];
  stationSummary?: {
    orderCount: number;
    pieces: number;
    weightKgs: number;
    weightRatio: number;
    receivableRatio: number;
    payableRatio: number;
    recoveryRatio: number;
  };
}

export interface LegacyTask {
  id: string;
  jobs: LegacyJob[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    supplierName?: string;
    phone?: string;
    address?: string;
  };
  deliveryCompany?: {
    companyName?: string;
    trackingNo?: string;
    queryPhone?: string;
    driverName?: string;
    driverPhone?: string;
    plateNo?: string;
  };
}

export const LEGACY_TASKS: LegacyTask[] = [
  {
    "id": "JOB26030001",
    "jobs": [
      {
        "id": "J001",
        "jobNo": "JOB100156",
        "stationName": "海珠区站点",
        "routeId": "R001",
        "routeName": "CAN.CHN→LOS.NGN",
        "serviceType": "STANDARD",
        "originPort": "CAN",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "GENERAL",
        "weightKg": 1500,
        "pieces": 25,
        "volumeCbm": 8.5,
        "executeDate": "2025-10-25",
        "blNo": "COSCO-LOS-260301",
        "carrier": "COSCO",
        "vesselVoyage": "COSCO FORTUNE V.025E",
        "containerNo": "CSLU2185436",
        "containerType": "40HQ",
        "serviceMode": "LCL",
        "cutoffDate": "2025-10-24",
        "etd": "2025-10-26",
        "eta": "2025-11-18",
        "remark": "请检查货物是否完整到达",
        "containers": [
          {
            "id": "AK-1",
            "containerNo": "CSLU2185436",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191136798 01",
                "thirdPartyTracking": "SF4048093798",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.38,
                "volumeWeightKgs": 230.46,
                "grossWeightKgs": 202.8
              },
              {
                "seq": 2,
                "orderNo": "191033815 02",
                "thirdPartyTracking": "SF4048093815",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.35,
                "volumeWeightKgs": 58.45,
                "grossWeightKgs": 43.84
              },
              {
                "seq": 3,
                "orderNo": "191050832 03",
                "thirdPartyTracking": "SF4048093832",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.52,
                "volumeWeightKgs": 86.84,
                "grossWeightKgs": 66.87
              },
              {
                "seq": 4,
                "orderNo": "191067849 04",
                "thirdPartyTracking": "SF4048093849",
                "city": "LAGOS",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.69,
                "volumeWeightKgs": 115.23,
                "grossWeightKgs": 91.03
              }
            ],
            "pieces": 4,
            "volumeCbm": 2.94,
            "volumeWeightKgs": 490.98,
            "grossWeightKgs": 404.53999999999996,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "AK-2",
            "containerNo": "CSLU2185437",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191137319 01",
                "thirdPartyTracking": "SF4049017319",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.39,
                "volumeWeightKgs": 232.13,
                "grossWeightKgs": 206.6
              },
              {
                "seq": 2,
                "orderNo": "191034336 02",
                "thirdPartyTracking": "SF4049017336",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.36,
                "volumeWeightKgs": 60.12,
                "grossWeightKgs": 45.69
              },
              {
                "seq": 3,
                "orderNo": "191051353 03",
                "thirdPartyTracking": "SF4049017353",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.53,
                "volumeWeightKgs": 88.51,
                "grossWeightKgs": 69.04
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.2800000000000002,
            "volumeWeightKgs": 380.76,
            "grossWeightKgs": 321.33,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "AK-3",
            "containerNo": "CSLU2185438",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191019161 01",
                "thirdPartyTracking": "SF0180071161",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.21,
                "volumeWeightKgs": 35.07,
                "grossWeightKgs": 26.65
              },
              {
                "seq": 2,
                "orderNo": "191036178 02",
                "thirdPartyTracking": "SF0180071178",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.38,
                "volumeWeightKgs": 63.46,
                "grossWeightKgs": 49.5
              }
            ],
            "pieces": 2,
            "volumeCbm": 0.59,
            "volumeWeightKgs": 98.53,
            "grossWeightKgs": 76.15,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "AK-4",
            "containerNo": "CSLU2185439",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191019361 01",
                "thirdPartyTracking": "SF4050864361",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.21,
                "volumeWeightKgs": 35.07,
                "grossWeightKgs": 26.65
              },
              {
                "seq": 2,
                "orderNo": "191036378 02",
                "thirdPartyTracking": "SF4050864378",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.38,
                "volumeWeightKgs": 63.46,
                "grossWeightKgs": 49.5
              }
            ],
            "pieces": 2,
            "volumeCbm": 0.59,
            "volumeWeightKgs": 98.53,
            "grossWeightKgs": 76.15,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "AK-5",
            "containerNo": "CSLU2185440",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191020882 01",
                "thirdPartyTracking": "SF4051787882",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.22,
                "volumeWeightKgs": 36.74,
                "grossWeightKgs": 28.29
              },
              {
                "seq": 2,
                "orderNo": "191037899 02",
                "thirdPartyTracking": "SF4051787899",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.39,
                "volumeWeightKgs": 65.13,
                "grossWeightKgs": 51.45
              }
            ],
            "pieces": 2,
            "volumeCbm": 0.61,
            "volumeWeightKgs": 101.87,
            "grossWeightKgs": 79.74000000000001,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "AK-6",
            "containerNo": "CSLU2185441",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191021403 01",
                "thirdPartyTracking": "SF4052711403",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.23,
                "volumeWeightKgs": 38.41,
                "grossWeightKgs": 29.96
              },
              {
                "seq": 2,
                "orderNo": "191038420 02",
                "thirdPartyTracking": "SF4052711420",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.4,
                "volumeWeightKgs": 66.8,
                "grossWeightKgs": 53.44
              }
            ],
            "pieces": 2,
            "volumeCbm": 0.63,
            "volumeWeightKgs": 105.21,
            "grossWeightKgs": 83.4,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 50,
          "pieces": 20,
          "weightKgs": 1300,
          "weightRatio": 0.52,
          "receivableRatio": 0.52,
          "payableRatio": 0.52,
          "recoveryRatio": 0.9
        }
      },
      {
        "id": "J002",
        "jobNo": "JOB100157",
        "stationName": "海珠区站点",
        "routeId": "R001",
        "routeName": "CAN.CHN→LOS.NGN",
        "serviceType": "STANDARD",
        "originPort": "CAN",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "GENERAL",
        "weightKg": 1000,
        "pieces": 20,
        "executeDate": "2025-10-25",
        "remark": "",
        "containers": [
          {
            "id": "BK-1",
            "containerNo": "MSKU7834521",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191121183 01",
                "thirdPartyTracking": "SF0640630183",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.23,
                "volumeWeightKgs": 205.41,
                "grossWeightKgs": 180.76
              },
              {
                "seq": 2,
                "orderNo": "191018200 02",
                "thirdPartyTracking": "SF0640630200",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.2,
                "volumeWeightKgs": 33.4,
                "grossWeightKgs": 25.05
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.43,
            "volumeWeightKgs": 238.81,
            "grossWeightKgs": 205.81,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "BK-2",
            "containerNo": "MSKU7834522",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191122704 01",
                "thirdPartyTracking": "SF0641553704",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.24,
                "volumeWeightKgs": 207.08,
                "grossWeightKgs": 184.3
              },
              {
                "seq": 2,
                "orderNo": "191019721 02",
                "thirdPartyTracking": "SF0641553721",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.21,
                "volumeWeightKgs": 35.07,
                "grossWeightKgs": 26.65
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.45,
            "volumeWeightKgs": 242.15,
            "grossWeightKgs": 210.95000000000002,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "BK-3",
            "containerNo": "MSKU7834523",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191123225 01",
                "thirdPartyTracking": "SF0642477225",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.25,
                "volumeWeightKgs": 208.75,
                "grossWeightKgs": 156.56
              },
              {
                "seq": 2,
                "orderNo": "191020242 02",
                "thirdPartyTracking": "SF0642477242",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.22,
                "volumeWeightKgs": 36.74,
                "grossWeightKgs": 28.29
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.47,
            "volumeWeightKgs": 245.49,
            "grossWeightKgs": 184.85,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "BK-4",
            "containerNo": "MSKU7834524",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191124746 01",
                "thirdPartyTracking": "SF0643400746",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.26,
                "volumeWeightKgs": 210.42,
                "grossWeightKgs": 159.92
              },
              {
                "seq": 2,
                "orderNo": "191021763 02",
                "thirdPartyTracking": "SF0643400763",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.23,
                "volumeWeightKgs": 38.41,
                "grossWeightKgs": 29.96
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.49,
            "volumeWeightKgs": 248.82999999999998,
            "grossWeightKgs": 189.88,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "BK-5",
            "containerNo": "MSKU7834525",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191125267 01",
                "thirdPartyTracking": "SF0644324267",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.27,
                "volumeWeightKgs": 212.09,
                "grossWeightKgs": 163.31
              },
              {
                "seq": 2,
                "orderNo": "191022284 02",
                "thirdPartyTracking": "SF0644324284",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.24,
                "volumeWeightKgs": 40.08,
                "grossWeightKgs": 31.66
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.51,
            "volumeWeightKgs": 252.17000000000002,
            "grossWeightKgs": 194.97,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 20,
          "pieces": 20,
          "weightKgs": 1000,
          "weightRatio": 0.4,
          "receivableRatio": 0.4,
          "payableRatio": 0.4,
          "recoveryRatio": 0.7
        }
      },
      {
        "id": "J003",
        "jobNo": "JOB100158",
        "stationName": "福田区站点",
        "routeId": "R003",
        "routeName": "SZX.CHN→LOS.NGN",
        "serviceType": "STANDARD",
        "originPort": "SZX",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "GENERAL",
        "weightKg": 200,
        "pieces": 5,
        "executeDate": "2025-10-25",
        "remark": "",
        "containers": [
          {
            "id": "CK-1",
            "containerNo": "CMAU4567890",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191124866 01",
                "thirdPartyTracking": "SF1528133866",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.26,
                "volumeWeightKgs": 210.42,
                "grossWeightKgs": 159.92
              },
              {
                "seq": 2,
                "orderNo": "191021883 02",
                "thirdPartyTracking": "SF1528133883",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.23,
                "volumeWeightKgs": 38.41,
                "grossWeightKgs": 29.96
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.49,
            "volumeWeightKgs": 248.82999999999998,
            "grossWeightKgs": 189.88,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "CK-2",
            "containerNo": "CMAU4567891",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191125387 01",
                "thirdPartyTracking": "SF1529057387",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.27,
                "volumeWeightKgs": 212.09,
                "grossWeightKgs": 163.31
              },
              {
                "seq": 2,
                "orderNo": "191022404 02",
                "thirdPartyTracking": "SF1529057404",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.24,
                "volumeWeightKgs": 40.08,
                "grossWeightKgs": 31.66
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.51,
            "volumeWeightKgs": 252.17000000000002,
            "grossWeightKgs": 194.97,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "CK-3",
            "containerNo": "CMAU4567892",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191126908 01",
                "thirdPartyTracking": "SF1529980908",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.28,
                "volumeWeightKgs": 213.76,
                "grossWeightKgs": 166.73
              },
              {
                "seq": 2,
                "orderNo": "191023925 02",
                "thirdPartyTracking": "SF1529980925",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.25,
                "volumeWeightKgs": 41.75,
                "grossWeightKgs": 33.4
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.53,
            "volumeWeightKgs": 255.51,
            "grossWeightKgs": 200.13,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "CK-4",
            "containerNo": "CMAU4567893",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191127429 01",
                "thirdPartyTracking": "SF1530904429",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.29,
                "volumeWeightKgs": 215.43,
                "grossWeightKgs": 170.19
              },
              {
                "seq": 2,
                "orderNo": "191024446 02",
                "thirdPartyTracking": "SF1530904446",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.26,
                "volumeWeightKgs": 43.42,
                "grossWeightKgs": 35.17
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.55,
            "volumeWeightKgs": 258.85,
            "grossWeightKgs": 205.36,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "CK-5",
            "containerNo": "CMAU4567894",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191128950 01",
                "thirdPartyTracking": "SF1531827950",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.3,
                "volumeWeightKgs": 217.1,
                "grossWeightKgs": 173.68
              },
              {
                "seq": 2,
                "orderNo": "191025967 02",
                "thirdPartyTracking": "SF1531827967",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.27,
                "volumeWeightKgs": 45.09,
                "grossWeightKgs": 36.97
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.57,
            "volumeWeightKgs": 262.19,
            "grossWeightKgs": 210.65,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 5,
          "pieces": 5,
          "weightKgs": 200,
          "weightRatio": 0.08,
          "receivableRatio": 0.08,
          "payableRatio": 0.08,
          "recoveryRatio": 0.5
        }
      }
    ],
    "supplier": {
      "supplierName": "广州喵喵国际货运代理有限公司",
      "phone": "+86 13570217212",
      "address": "广东省广州市白云区黄石路江夏北二路3号云商易城B栋110"
    },
    "deliveryCompany": {
      "companyName": "顺丰速运",
      "trackingNo": "SF1012605193752",
      "queryPhone": "95338",
      "driverName": "李先生",
      "driverPhone": "+86 13570217212",
      "plateNo": "粤A0T86A"
    },
    "status": "IN_PROGRESS",
    "createdBy": "CANSAMPAO",
    "createdAt": "2025-10-18 15:01:22",
    "updatedAt": "2025-10-25 23:50:56",
    "costItems": [
      {
        "id": "JOB26030001-COST-1",
        "feeType": "运费",
        "amount": 500,
        "currency": "CNY",
        "status": "PENDING",
        "createdAt": "2025-10-10 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030001-COST-2",
        "feeType": "报关费",
        "amount": 620,
        "currency": "USD",
        "status": "APPROVED",
        "createdAt": "2025-10-11 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030001-COST-3",
        "feeType": "仓储费",
        "amount": 740,
        "currency": "CNY",
        "status": "PAID",
        "createdAt": "2025-10-12 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030001-COST-4",
        "feeType": "装卸费",
        "amount": 860,
        "currency": "USD",
        "status": "PENDING",
        "createdAt": "2025-10-13 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030001-COST-5",
        "feeType": "运费",
        "amount": 980,
        "currency": "CNY",
        "status": "APPROVED",
        "createdAt": "2025-10-14 10:00:00",
        "createdBy": "CANSAMPAO"
      }
    ]
  },
  {
    "id": "JOB26030002",
    "jobs": [
      {
        "id": "J004",
        "jobNo": "JOB100145",
        "stationName": "海珠区站点",
        "routeId": "R002",
        "routeName": "CAN.CHN→ACC.GHA",
        "serviceType": "EXPRESS",
        "originPort": "CAN",
        "transitPort": "ADD",
        "destPort": "ACC",
        "cargoFilter": "ALL",
        "weightKg": 800,
        "pieces": 15,
        "executeDate": "2025-10-20",
        "remark": "",
        "containers": [
          {
            "id": "DK-1",
            "containerNo": "OOLU3456789",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191124546 01",
                "thirdPartyTracking": "SF2415637546",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.26,
                "volumeWeightKgs": 210.42,
                "grossWeightKgs": 159.92
              },
              {
                "seq": 2,
                "orderNo": "191021563 02",
                "thirdPartyTracking": "SF2415637563",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.23,
                "volumeWeightKgs": 38.41,
                "grossWeightKgs": 29.96
              },
              {
                "seq": 3,
                "orderNo": "191038580 03",
                "thirdPartyTracking": "SF2415637580",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.4,
                "volumeWeightKgs": 66.8,
                "grossWeightKgs": 53.44
              },
              {
                "seq": 4,
                "orderNo": "191055597 04",
                "thirdPartyTracking": "SF2415637597",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.57,
                "volumeWeightKgs": 95.19,
                "grossWeightKgs": 78.06
              }
            ],
            "pieces": 4,
            "volumeCbm": 2.46,
            "volumeWeightKgs": 410.82,
            "grossWeightKgs": 321.38,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "DK-2",
            "containerNo": "OOLU3456790",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191125067 01",
                "thirdPartyTracking": "SF2416561067",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.27,
                "volumeWeightKgs": 212.09,
                "grossWeightKgs": 163.31
              },
              {
                "seq": 2,
                "orderNo": "191022084 02",
                "thirdPartyTracking": "SF2416561084",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.24,
                "volumeWeightKgs": 40.08,
                "grossWeightKgs": 31.66
              },
              {
                "seq": 3,
                "orderNo": "191039101 03",
                "thirdPartyTracking": "SF2416561101",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.41,
                "volumeWeightKgs": 68.47,
                "grossWeightKgs": 55.46
              },
              {
                "seq": 4,
                "orderNo": "191056118 04",
                "thirdPartyTracking": "SF2416561118",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.58,
                "volumeWeightKgs": 96.86,
                "grossWeightKgs": 80.39
              }
            ],
            "pieces": 4,
            "volumeCbm": 2.5,
            "volumeWeightKgs": 417.5,
            "grossWeightKgs": 330.82,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "DK-3",
            "containerNo": "OOLU3456791",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191126588 01",
                "thirdPartyTracking": "SF2417484588",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.28,
                "volumeWeightKgs": 213.76,
                "grossWeightKgs": 166.73
              },
              {
                "seq": 2,
                "orderNo": "191023605 02",
                "thirdPartyTracking": "SF2417484605",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.25,
                "volumeWeightKgs": 41.75,
                "grossWeightKgs": 33.4
              },
              {
                "seq": 3,
                "orderNo": "191040622 03",
                "thirdPartyTracking": "SF2417484622",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.42,
                "volumeWeightKgs": 70.14,
                "grossWeightKgs": 57.51
              },
              {
                "seq": 4,
                "orderNo": "191057639 04",
                "thirdPartyTracking": "SF2417484639",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.59,
                "volumeWeightKgs": 98.53,
                "grossWeightKgs": 82.77
              }
            ],
            "pieces": 4,
            "volumeCbm": 2.54,
            "volumeWeightKgs": 424.17999999999995,
            "grossWeightKgs": 340.40999999999997,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "DK-4",
            "containerNo": "OOLU3456792",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191127109 01",
                "thirdPartyTracking": "SF2418408109",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.29,
                "volumeWeightKgs": 215.43,
                "grossWeightKgs": 170.19
              },
              {
                "seq": 2,
                "orderNo": "191024126 02",
                "thirdPartyTracking": "SF2418408126",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.26,
                "volumeWeightKgs": 43.42,
                "grossWeightKgs": 35.17
              },
              {
                "seq": 3,
                "orderNo": "191041143 03",
                "thirdPartyTracking": "SF2418408143",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.43,
                "volumeWeightKgs": 71.81,
                "grossWeightKgs": 59.6
              },
              {
                "seq": 4,
                "orderNo": "191058160 04",
                "thirdPartyTracking": "SF2418408160",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.6,
                "volumeWeightKgs": 100.2,
                "grossWeightKgs": 85.17
              }
            ],
            "pieces": 4,
            "volumeCbm": 2.58,
            "volumeWeightKgs": 430.86,
            "grossWeightKgs": 350.13000000000005,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "DK-5",
            "containerNo": "OOLU3456793",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191128630 01",
                "thirdPartyTracking": "SF2419331630",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.3,
                "volumeWeightKgs": 217.1,
                "grossWeightKgs": 173.68
              },
              {
                "seq": 2,
                "orderNo": "191025647 02",
                "thirdPartyTracking": "SF2419331647",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.27,
                "volumeWeightKgs": 45.09,
                "grossWeightKgs": 36.97
              },
              {
                "seq": 3,
                "orderNo": "191042664 03",
                "thirdPartyTracking": "SF2419331664",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.44,
                "volumeWeightKgs": 73.48,
                "grossWeightKgs": 61.72
              },
              {
                "seq": 4,
                "orderNo": "191059681 04",
                "thirdPartyTracking": "SF2419331681",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.61,
                "volumeWeightKgs": 101.87,
                "grossWeightKgs": 87.61
              }
            ],
            "pieces": 4,
            "volumeCbm": 2.62,
            "volumeWeightKgs": 437.54,
            "grossWeightKgs": 359.98,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 15,
          "pieces": 15,
          "weightKgs": 800,
          "weightRatio": 1,
          "receivableRatio": 1,
          "payableRatio": 1,
          "recoveryRatio": 0.95
        }
      }
    ],
    "supplier": {
      "supplierName": "广州喵喵国际货运代理有限公司",
      "phone": "+86 13570217212",
      "address": "广东省广州市白云区黄石路江夏北二路3号云商易城B栋110"
    },
    "deliveryCompany": {
      "companyName": "德邦物流",
      "trackingNo": "DB202510200001",
      "queryPhone": "95353",
      "driverName": "张师傅",
      "driverPhone": "+86 13600136001",
      "plateNo": "粤B12345"
    },
    "status": "COMPLETED",
    "createdBy": "CANSAMPAO",
    "createdAt": "2025-10-15 09:00:00",
    "updatedAt": "2025-10-22 18:30:00",
    "costItems": [
      {
        "id": "JOB26030002-COST-1",
        "feeType": "运费",
        "amount": 500,
        "currency": "CNY",
        "status": "PENDING",
        "createdAt": "2025-10-10 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030002-COST-2",
        "feeType": "报关费",
        "amount": 620,
        "currency": "USD",
        "status": "APPROVED",
        "createdAt": "2025-10-11 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030002-COST-3",
        "feeType": "仓储费",
        "amount": 740,
        "currency": "CNY",
        "status": "PAID",
        "createdAt": "2025-10-12 10:00:00",
        "createdBy": "CANSAMPAO"
      }
    ]
  },
  {
    "id": "JOB26030003",
    "jobs": [
      {
        "id": "J005",
        "jobNo": "JOB100137",
        "stationName": "海珠区站点",
        "routeId": "R001",
        "routeName": "CAN.CHN→LOS.NGN",
        "serviceType": "EXPRESS",
        "originPort": "CAN",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "NON_GENERAL",
        "weightKg": 350,
        "pieces": 8,
        "executeDate": "2025-11-01",
        "remark": "非普货特快",
        "containers": [
          {
            "id": "EK-1",
            "containerNo": "EGLV5678901",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191124226 01",
                "thirdPartyTracking": "SF3303141226",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.26,
                "volumeWeightKgs": 210.42,
                "grossWeightKgs": 159.92
              },
              {
                "seq": 2,
                "orderNo": "191021243 02",
                "thirdPartyTracking": "SF3303141243",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.23,
                "volumeWeightKgs": 38.41,
                "grossWeightKgs": 29.96
              },
              {
                "seq": 3,
                "orderNo": "191038260 03",
                "thirdPartyTracking": "SF3303141260",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.4,
                "volumeWeightKgs": 66.8,
                "grossWeightKgs": 53.44
              }
            ],
            "pieces": 3,
            "volumeCbm": 1.8900000000000001,
            "volumeWeightKgs": 315.63,
            "grossWeightKgs": 243.32,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "EK-2",
            "containerNo": "EGLV5678902",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191125747 01",
                "thirdPartyTracking": "SF3304064747",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.27,
                "volumeWeightKgs": 212.09,
                "grossWeightKgs": 163.31
              },
              {
                "seq": 2,
                "orderNo": "191022764 02",
                "thirdPartyTracking": "SF3304064764",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.24,
                "volumeWeightKgs": 40.08,
                "grossWeightKgs": 31.66
              },
              {
                "seq": 3,
                "orderNo": "191039781 03",
                "thirdPartyTracking": "SF3304064781",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.41,
                "volumeWeightKgs": 68.47,
                "grossWeightKgs": 55.46
              }
            ],
            "pieces": 3,
            "volumeCbm": 1.92,
            "volumeWeightKgs": 320.64,
            "grossWeightKgs": 250.43,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "EK-3",
            "containerNo": "EGLV5678903",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191126268 01",
                "thirdPartyTracking": "SF3304988268",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.28,
                "volumeWeightKgs": 213.76,
                "grossWeightKgs": 166.73
              },
              {
                "seq": 2,
                "orderNo": "191023285 02",
                "thirdPartyTracking": "SF3304988285",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.25,
                "volumeWeightKgs": 41.75,
                "grossWeightKgs": 33.4
              },
              {
                "seq": 3,
                "orderNo": "191040302 03",
                "thirdPartyTracking": "SF3304988302",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.42,
                "volumeWeightKgs": 70.14,
                "grossWeightKgs": 57.51
              }
            ],
            "pieces": 3,
            "volumeCbm": 1.95,
            "volumeWeightKgs": 325.65,
            "grossWeightKgs": 257.64,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "EK-4",
            "containerNo": "EGLV5678904",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191127789 01",
                "thirdPartyTracking": "SF3305911789",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.29,
                "volumeWeightKgs": 215.43,
                "grossWeightKgs": 170.19
              },
              {
                "seq": 2,
                "orderNo": "191024806 02",
                "thirdPartyTracking": "SF3305911806",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.26,
                "volumeWeightKgs": 43.42,
                "grossWeightKgs": 35.17
              },
              {
                "seq": 3,
                "orderNo": "191041823 03",
                "thirdPartyTracking": "SF3305911823",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.43,
                "volumeWeightKgs": 71.81,
                "grossWeightKgs": 59.6
              }
            ],
            "pieces": 3,
            "volumeCbm": 1.98,
            "volumeWeightKgs": 330.66,
            "grossWeightKgs": 264.96000000000004,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "EK-5",
            "containerNo": "EGLV5678905",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191128310 01",
                "thirdPartyTracking": "SF3306835310",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.3,
                "volumeWeightKgs": 217.1,
                "grossWeightKgs": 173.68
              },
              {
                "seq": 2,
                "orderNo": "191025327 02",
                "thirdPartyTracking": "SF3306835327",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.27,
                "volumeWeightKgs": 45.09,
                "grossWeightKgs": 36.97
              },
              {
                "seq": 3,
                "orderNo": "191042344 03",
                "thirdPartyTracking": "SF3306835344",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.44,
                "volumeWeightKgs": 73.48,
                "grossWeightKgs": 61.72
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.0100000000000002,
            "volumeWeightKgs": 335.67,
            "grossWeightKgs": 272.37,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 8,
          "pieces": 8,
          "weightKgs": 350,
          "weightRatio": 1,
          "receivableRatio": 1,
          "payableRatio": 1,
          "recoveryRatio": 0
        }
      }
    ],
    "supplier": {
      "supplierName": "深圳喵喵国际货运代理有限公司",
      "phone": "+86 13800138001",
      "address": "广东省深圳市福田区深南大道1001号"
    },
    "deliveryCompany": {
      "companyName": "中通快递",
      "trackingNo": "",
      "queryPhone": "95311",
      "driverName": "",
      "driverPhone": "",
      "plateNo": ""
    },
    "status": "PENDING",
    "createdBy": "CANSAMPAO",
    "createdAt": "2025-10-28 10:00:00",
    "updatedAt": "2025-10-28 10:00:00",
    "costItems": []
  },
  {
    "id": "JOB26030004",
    "jobs": [
      {
        "id": "J006",
        "jobNo": "JOB098678",
        "stationName": "白云区站点",
        "routeId": "R001",
        "routeName": "CAN.CHN→LOS.NGN",
        "serviceType": "EXPRESS",
        "originPort": "CAN",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "GENERAL",
        "weightKg": 2700,
        "pieces": 50,
        "executeDate": "2025-10-22",
        "remark": "",
        "containers": [
          {
            "id": "FK-1",
            "containerNo": "HLXU6789012",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191125907 01",
                "thirdPartyTracking": "SF4190644907",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.27,
                "volumeWeightKgs": 212.09,
                "grossWeightKgs": 163.31
              },
              {
                "seq": 2,
                "orderNo": "191022924 02",
                "thirdPartyTracking": "SF4190644924",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.24,
                "volumeWeightKgs": 40.08,
                "grossWeightKgs": 31.66
              },
              {
                "seq": 3,
                "orderNo": "191039941 03",
                "thirdPartyTracking": "SF4190644941",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.41,
                "volumeWeightKgs": 68.47,
                "grossWeightKgs": 55.46
              }
            ],
            "pieces": 3,
            "volumeCbm": 1.92,
            "volumeWeightKgs": 320.64,
            "grossWeightKgs": 250.43,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "FK-2",
            "containerNo": "HLXU6789013",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191126428 01",
                "thirdPartyTracking": "SF4191568428",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.28,
                "volumeWeightKgs": 213.76,
                "grossWeightKgs": 166.73
              },
              {
                "seq": 2,
                "orderNo": "191023445 02",
                "thirdPartyTracking": "SF4191568445",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.25,
                "volumeWeightKgs": 41.75,
                "grossWeightKgs": 33.4
              },
              {
                "seq": 3,
                "orderNo": "191040462 03",
                "thirdPartyTracking": "SF4191568462",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.42,
                "volumeWeightKgs": 70.14,
                "grossWeightKgs": 57.51
              }
            ],
            "pieces": 3,
            "volumeCbm": 1.95,
            "volumeWeightKgs": 325.65,
            "grossWeightKgs": 257.64,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "FK-3",
            "containerNo": "HLXU6789014",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191127949 01",
                "thirdPartyTracking": "SF4192491949",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.29,
                "volumeWeightKgs": 215.43,
                "grossWeightKgs": 170.19
              },
              {
                "seq": 2,
                "orderNo": "191024966 02",
                "thirdPartyTracking": "SF4192491966",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.26,
                "volumeWeightKgs": 43.42,
                "grossWeightKgs": 35.17
              },
              {
                "seq": 3,
                "orderNo": "191041983 03",
                "thirdPartyTracking": "SF4192491983",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.43,
                "volumeWeightKgs": 71.81,
                "grossWeightKgs": 59.6
              }
            ],
            "pieces": 3,
            "volumeCbm": 1.98,
            "volumeWeightKgs": 330.66,
            "grossWeightKgs": 264.96000000000004,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "FK-4",
            "containerNo": "HLXU6789015",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191128470 01",
                "thirdPartyTracking": "SF4193415470",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.3,
                "volumeWeightKgs": 217.1,
                "grossWeightKgs": 173.68
              },
              {
                "seq": 2,
                "orderNo": "191025487 02",
                "thirdPartyTracking": "SF4193415487",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.27,
                "volumeWeightKgs": 45.09,
                "grossWeightKgs": 36.97
              },
              {
                "seq": 3,
                "orderNo": "191042504 03",
                "thirdPartyTracking": "SF4193415504",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.44,
                "volumeWeightKgs": 73.48,
                "grossWeightKgs": 61.72
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.0100000000000002,
            "volumeWeightKgs": 335.67,
            "grossWeightKgs": 272.37,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "FK-5",
            "containerNo": "HLXU6789016",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191129991 01",
                "thirdPartyTracking": "SF4194338991",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.31,
                "volumeWeightKgs": 218.77,
                "grossWeightKgs": 177.2
              },
              {
                "seq": 2,
                "orderNo": "191026008 02",
                "thirdPartyTracking": "SF4194339008",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.28,
                "volumeWeightKgs": 46.76,
                "grossWeightKgs": 38.81
              },
              {
                "seq": 3,
                "orderNo": "191043025 03",
                "thirdPartyTracking": "SF4194339025",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.45,
                "volumeWeightKgs": 75.15,
                "grossWeightKgs": 63.88
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.04,
            "volumeWeightKgs": 340.68000000000006,
            "grossWeightKgs": 279.89,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "FK-6",
            "containerNo": "HLXU6789017",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191130512 01",
                "thirdPartyTracking": "SF4195262512",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.32,
                "volumeWeightKgs": 220.44,
                "grossWeightKgs": 180.76
              },
              {
                "seq": 2,
                "orderNo": "191027529 02",
                "thirdPartyTracking": "SF4195262529",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.29,
                "volumeWeightKgs": 48.43,
                "grossWeightKgs": 40.68
              },
              {
                "seq": 3,
                "orderNo": "191044546 03",
                "thirdPartyTracking": "SF4195262546",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.46,
                "volumeWeightKgs": 76.82,
                "grossWeightKgs": 66.07
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.0700000000000003,
            "volumeWeightKgs": 345.69,
            "grossWeightKgs": 287.51,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 50,
          "pieces": 50,
          "weightKgs": 2700,
          "weightRatio": 0.75,
          "receivableRatio": 0.7,
          "payableRatio": 0.72,
          "recoveryRatio": 0.8
        }
      },
      {
        "id": "J007",
        "jobNo": "JOB098679",
        "stationName": "白云区站点",
        "routeId": "R002",
        "routeName": "CAN.CHN→ACC.GHA",
        "serviceType": "EXPRESS",
        "originPort": "CAN",
        "transitPort": "",
        "destPort": "ACC",
        "cargoFilter": "NON_GENERAL",
        "weightKg": 900,
        "pieces": 18,
        "executeDate": "2025-10-22",
        "remark": "",
        "containers": [
          {
            "id": "GK-1",
            "containerNo": "MSCU8901234",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191111293 01",
                "thirdPartyTracking": "SF0783181293",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.13,
                "volumeWeightKgs": 188.71,
                "grossWeightKgs": 147.19
              },
              {
                "seq": 2,
                "orderNo": "191128310 02",
                "thirdPartyTracking": "SF0783181310",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.3,
                "volumeWeightKgs": 217.1,
                "grossWeightKgs": 173.68
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.4299999999999997,
            "volumeWeightKgs": 405.81,
            "grossWeightKgs": 320.87,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "GK-2",
            "containerNo": "MSCU8901235",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191112814 01",
                "thirdPartyTracking": "SF0784104814",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.14,
                "volumeWeightKgs": 190.38,
                "grossWeightKgs": 150.4
              },
              {
                "seq": 2,
                "orderNo": "191129831 02",
                "thirdPartyTracking": "SF0784104831",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.31,
                "volumeWeightKgs": 218.77,
                "grossWeightKgs": 177.2
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.45,
            "volumeWeightKgs": 409.15,
            "grossWeightKgs": 327.6,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "GK-3",
            "containerNo": "MSCU8901236",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191113335 01",
                "thirdPartyTracking": "SF0785028335",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.15,
                "volumeWeightKgs": 192.05,
                "grossWeightKgs": 153.64
              },
              {
                "seq": 2,
                "orderNo": "191130352 02",
                "thirdPartyTracking": "SF0785028352",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.32,
                "volumeWeightKgs": 220.44,
                "grossWeightKgs": 180.76
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.4699999999999998,
            "volumeWeightKgs": 412.49,
            "grossWeightKgs": 334.4,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "GK-4",
            "containerNo": "MSCU8901237",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191114856 01",
                "thirdPartyTracking": "SF0785951856",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.16,
                "volumeWeightKgs": 193.72,
                "grossWeightKgs": 156.91
              },
              {
                "seq": 2,
                "orderNo": "191131873 02",
                "thirdPartyTracking": "SF0785951873",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.33,
                "volumeWeightKgs": 222.11,
                "grossWeightKgs": 184.35
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.49,
            "volumeWeightKgs": 415.83000000000004,
            "grossWeightKgs": 341.26,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "GK-5",
            "containerNo": "MSCU8901238",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191115377 01",
                "thirdPartyTracking": "SF0786875377",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.17,
                "volumeWeightKgs": 195.39,
                "grossWeightKgs": 160.22
              },
              {
                "seq": 2,
                "orderNo": "191132394 02",
                "thirdPartyTracking": "SF0786875394",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.34,
                "volumeWeightKgs": 223.78,
                "grossWeightKgs": 187.98
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.51,
            "volumeWeightKgs": 419.16999999999996,
            "grossWeightKgs": 348.2,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 18,
          "pieces": 18,
          "weightKgs": 900,
          "weightRatio": 0.25,
          "receivableRatio": 0.3,
          "payableRatio": 0.28,
          "recoveryRatio": 0.6
        }
      }
    ],
    "supplier": {
      "supplierName": "广州喵喵国际货运代理有限公司",
      "phone": "+86 13570217212",
      "address": "广东省广州市白云区黄石路江夏北二路3号云商易城B栋110"
    },
    "deliveryCompany": {
      "companyName": "韵达快递",
      "trackingNo": "4301568788544",
      "queryPhone": "95546",
      "driverName": "王师傅",
      "driverPhone": "+86 13900139001",
      "plateNo": "粤A88888"
    },
    "status": "IN_PROGRESS",
    "createdBy": "CANSMILE",
    "createdAt": "2025-10-19 11:07:15",
    "updatedAt": "2025-10-25 11:55:35",
    "costItems": [
      {
        "id": "JOB26030004-COST-1",
        "feeType": "运费",
        "amount": 500,
        "currency": "CNY",
        "status": "PENDING",
        "createdAt": "2025-10-10 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030004-COST-2",
        "feeType": "报关费",
        "amount": 620,
        "currency": "USD",
        "status": "APPROVED",
        "createdAt": "2025-10-11 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030004-COST-3",
        "feeType": "仓储费",
        "amount": 740,
        "currency": "CNY",
        "status": "PAID",
        "createdAt": "2025-10-12 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030004-COST-4",
        "feeType": "装卸费",
        "amount": 860,
        "currency": "USD",
        "status": "PENDING",
        "createdAt": "2025-10-13 10:00:00",
        "createdBy": "CANSAMPAO"
      }
    ]
  },
  {
    "id": "JOB26030005",
    "jobs": [
      {
        "id": "J008",
        "jobNo": "JOB100146",
        "stationName": "福田区站点",
        "routeId": "R004",
        "routeName": "HKG.CHN→LOS.NGN",
        "serviceType": "EXPRESS",
        "originPort": "HKG",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "ALL",
        "weightKg": 1200,
        "pieces": 22,
        "executeDate": "2025-11-05",
        "remark": "香港出口",
        "containers": [
          {
            "id": "HK-1",
            "containerNo": "TCLU9012345",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191114976 01",
                "thirdPartyTracking": "SF1670684976",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.16,
                "volumeWeightKgs": 193.72,
                "grossWeightKgs": 156.91
              },
              {
                "seq": 2,
                "orderNo": "191131993 02",
                "thirdPartyTracking": "SF1670684993",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.33,
                "volumeWeightKgs": 222.11,
                "grossWeightKgs": 184.35
              },
              {
                "seq": 3,
                "orderNo": "191028010 03",
                "thirdPartyTracking": "SF1670685010",
                "city": "ACC",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.3,
                "volumeWeightKgs": 50.1,
                "grossWeightKgs": 42.59
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.79,
            "volumeWeightKgs": 465.93000000000006,
            "grossWeightKgs": 383.85,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "HK-2",
            "containerNo": "TCLU9012346",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191115497 01",
                "thirdPartyTracking": "SF1671608497",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.17,
                "volumeWeightKgs": 195.39,
                "grossWeightKgs": 160.22
              },
              {
                "seq": 2,
                "orderNo": "191132514 02",
                "thirdPartyTracking": "SF1671608514",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.34,
                "volumeWeightKgs": 223.78,
                "grossWeightKgs": 187.98
              },
              {
                "seq": 3,
                "orderNo": "191029531 03",
                "thirdPartyTracking": "SF1671608531",
                "city": "ACC",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.31,
                "volumeWeightKgs": 51.77,
                "grossWeightKgs": 44.52
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.82,
            "volumeWeightKgs": 470.93999999999994,
            "grossWeightKgs": 392.71999999999997,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "HK-3",
            "containerNo": "TCLU9012347",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191116018 01",
                "thirdPartyTracking": "SF1672532018",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.18,
                "volumeWeightKgs": 197.06,
                "grossWeightKgs": 163.56
              },
              {
                "seq": 2,
                "orderNo": "191133035 02",
                "thirdPartyTracking": "SF1672532035",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.35,
                "volumeWeightKgs": 225.45,
                "grossWeightKgs": 191.63
              },
              {
                "seq": 3,
                "orderNo": "191030052 03",
                "thirdPartyTracking": "SF1672532052",
                "city": "ACC",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.32,
                "volumeWeightKgs": 53.44,
                "grossWeightKgs": 46.49
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.85,
            "volumeWeightKgs": 475.95,
            "grossWeightKgs": 401.68,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "HK-4",
            "containerNo": "TCLU9012348",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191117539 01",
                "thirdPartyTracking": "SF1673455539",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.19,
                "volumeWeightKgs": 198.73,
                "grossWeightKgs": 166.93
              },
              {
                "seq": 2,
                "orderNo": "191134556 02",
                "thirdPartyTracking": "SF1673455556",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.36,
                "volumeWeightKgs": 227.12,
                "grossWeightKgs": 195.32
              },
              {
                "seq": 3,
                "orderNo": "191031573 03",
                "thirdPartyTracking": "SF1673455573",
                "city": "ACC",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.33,
                "volumeWeightKgs": 55.11,
                "grossWeightKgs": 48.5
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.88,
            "volumeWeightKgs": 480.96000000000004,
            "grossWeightKgs": 410.75,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "HK-5",
            "containerNo": "TCLU9012349",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191118060 01",
                "thirdPartyTracking": "SF1674379060",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.2,
                "volumeWeightKgs": 200.4,
                "grossWeightKgs": 170.34
              },
              {
                "seq": 2,
                "orderNo": "191135077 02",
                "thirdPartyTracking": "SF1674379077",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.37,
                "volumeWeightKgs": 228.79,
                "grossWeightKgs": 199.05
              },
              {
                "seq": 3,
                "orderNo": "191032094 03",
                "thirdPartyTracking": "SF1674379094",
                "city": "ACC",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.34,
                "volumeWeightKgs": 56.78,
                "grossWeightKgs": 50.53
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.91,
            "volumeWeightKgs": 485.97,
            "grossWeightKgs": 419.91999999999996,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 22,
          "pieces": 22,
          "weightKgs": 1200,
          "weightRatio": 1,
          "receivableRatio": 1,
          "payableRatio": 1,
          "recoveryRatio": 0
        }
      }
    ],
    "supplier": {
      "supplierName": "香港喵喵国际物流有限公司",
      "phone": "+852 23456789",
      "address": "香港九龙观塘道388号创业商场2楼"
    },
    "deliveryCompany": {
      "companyName": "顺丰速运",
      "trackingNo": "",
      "queryPhone": "95338",
      "driverName": "",
      "driverPhone": "",
      "plateNo": ""
    },
    "status": "PENDING",
    "createdBy": "HKGOPS01",
    "createdAt": "2025-10-30 09:30:00",
    "updatedAt": "2025-10-30 09:30:00",
    "costItems": [
      {
        "id": "JOB26030005-COST-1",
        "feeType": "运费",
        "amount": 500,
        "currency": "CNY",
        "status": "PENDING",
        "createdAt": "2025-10-10 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030005-COST-2",
        "feeType": "报关费",
        "amount": 620,
        "currency": "USD",
        "status": "APPROVED",
        "createdAt": "2025-10-11 10:00:00",
        "createdBy": "CANSAMPAO"
      }
    ]
  },
  {
    "id": "JOB26030006",
    "jobs": [
      {
        "id": "J009",
        "jobNo": "JOB100159",
        "stationName": "海珠区站点",
        "routeId": "R002",
        "routeName": "CAN.CHN→ACC.GHA",
        "serviceType": "STANDARD",
        "originPort": "CAN",
        "transitPort": "",
        "destPort": "ACC",
        "cargoFilter": "GENERAL",
        "weightKg": 600,
        "pieces": 12,
        "executeDate": "2025-10-15",
        "remark": "",
        "containers": [
          {
            "id": "IK-1",
            "containerNo": "APLU0123456",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191113655 01",
                "thirdPartyTracking": "SF2558188655",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.15,
                "volumeWeightKgs": 192.05,
                "grossWeightKgs": 153.64
              },
              {
                "seq": 2,
                "orderNo": "191130672 02",
                "thirdPartyTracking": "SF2558188672",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.32,
                "volumeWeightKgs": 220.44,
                "grossWeightKgs": 180.76
              },
              {
                "seq": 3,
                "orderNo": "191027689 03",
                "thirdPartyTracking": "SF2558188689",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.29,
                "volumeWeightKgs": 48.43,
                "grossWeightKgs": 40.68
              },
              {
                "seq": 4,
                "orderNo": "191044706 04",
                "thirdPartyTracking": "SF2558188706",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.46,
                "volumeWeightKgs": 76.82,
                "grossWeightKgs": 66.07
              }
            ],
            "pieces": 4,
            "volumeCbm": 3.2199999999999998,
            "volumeWeightKgs": 537.74,
            "grossWeightKgs": 441.15,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "IK-2",
            "containerNo": "APLU0123457",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191114176 01",
                "thirdPartyTracking": "SF2559112176",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.16,
                "volumeWeightKgs": 193.72,
                "grossWeightKgs": 156.91
              },
              {
                "seq": 2,
                "orderNo": "191131193 02",
                "thirdPartyTracking": "SF2559112193",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.33,
                "volumeWeightKgs": 222.11,
                "grossWeightKgs": 184.35
              },
              {
                "seq": 3,
                "orderNo": "191028210 03",
                "thirdPartyTracking": "SF2559112210",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.3,
                "volumeWeightKgs": 50.1,
                "grossWeightKgs": 42.59
              },
              {
                "seq": 4,
                "orderNo": "191045227 04",
                "thirdPartyTracking": "SF2559112227",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.47,
                "volumeWeightKgs": 78.49,
                "grossWeightKgs": 68.29
              }
            ],
            "pieces": 4,
            "volumeCbm": 3.26,
            "volumeWeightKgs": 544.4200000000001,
            "grossWeightKgs": 452.14000000000004,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "IK-3",
            "containerNo": "APLU0123458",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191115697 01",
                "thirdPartyTracking": "SF2560035697",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.17,
                "volumeWeightKgs": 195.39,
                "grossWeightKgs": 160.22
              },
              {
                "seq": 2,
                "orderNo": "191132714 02",
                "thirdPartyTracking": "SF2560035714",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.34,
                "volumeWeightKgs": 223.78,
                "grossWeightKgs": 187.98
              },
              {
                "seq": 3,
                "orderNo": "191029731 03",
                "thirdPartyTracking": "SF2560035731",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.31,
                "volumeWeightKgs": 51.77,
                "grossWeightKgs": 44.52
              },
              {
                "seq": 4,
                "orderNo": "191046748 04",
                "thirdPartyTracking": "SF2560035748",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.48,
                "volumeWeightKgs": 80.16,
                "grossWeightKgs": 70.54
              }
            ],
            "pieces": 4,
            "volumeCbm": 3.3,
            "volumeWeightKgs": 551.0999999999999,
            "grossWeightKgs": 463.26,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "IK-4",
            "containerNo": "APLU0123459",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191116218 01",
                "thirdPartyTracking": "SF2560959218",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.18,
                "volumeWeightKgs": 197.06,
                "grossWeightKgs": 163.56
              },
              {
                "seq": 2,
                "orderNo": "191133235 02",
                "thirdPartyTracking": "SF2560959235",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.35,
                "volumeWeightKgs": 225.45,
                "grossWeightKgs": 191.63
              },
              {
                "seq": 3,
                "orderNo": "191030252 03",
                "thirdPartyTracking": "SF2560959252",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.32,
                "volumeWeightKgs": 53.44,
                "grossWeightKgs": 46.49
              },
              {
                "seq": 4,
                "orderNo": "191047269 04",
                "thirdPartyTracking": "SF2560959269",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.49,
                "volumeWeightKgs": 81.83,
                "grossWeightKgs": 72.83
              }
            ],
            "pieces": 4,
            "volumeCbm": 3.34,
            "volumeWeightKgs": 557.78,
            "grossWeightKgs": 474.51,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "IK-5",
            "containerNo": "APLU0123460",
            "routeName": "CAN.CHN→ACC.GHA",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191117739 01",
                "thirdPartyTracking": "SF2561882739",
                "city": "ACCRA",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.19,
                "volumeWeightKgs": 198.73,
                "grossWeightKgs": 166.93
              },
              {
                "seq": 2,
                "orderNo": "191134756 02",
                "thirdPartyTracking": "SF2561882756",
                "city": "TEMA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.36,
                "volumeWeightKgs": 227.12,
                "grossWeightKgs": 195.32
              },
              {
                "seq": 3,
                "orderNo": "191031773 03",
                "thirdPartyTracking": "SF2561882773",
                "city": "KUMASI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.33,
                "volumeWeightKgs": 55.11,
                "grossWeightKgs": 48.5
              },
              {
                "seq": 4,
                "orderNo": "191048790 04",
                "thirdPartyTracking": "SF2561882790",
                "city": "ACCRA",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.5,
                "volumeWeightKgs": 83.5,
                "grossWeightKgs": 62.63
              }
            ],
            "pieces": 4,
            "volumeCbm": 3.38,
            "volumeWeightKgs": 564.46,
            "grossWeightKgs": 473.38,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 12,
          "pieces": 12,
          "weightKgs": 600,
          "weightRatio": 1,
          "receivableRatio": 1,
          "payableRatio": 1,
          "recoveryRatio": 1
        }
      }
    ],
    "supplier": {
      "supplierName": "广州喵喵国际货运代理有限公司",
      "phone": "+86 13570217212",
      "address": "广东省广州市白云区黄石路江夏北二路3号云商易城B栋110"
    },
    "deliveryCompany": {
      "companyName": "圆通速递",
      "trackingNo": "YT4144353928655",
      "queryPhone": "95554",
      "driverName": "陈师傅",
      "driverPhone": "+86 13700137001",
      "plateNo": "粤A66666"
    },
    "status": "COMPLETED",
    "createdBy": "CANSAMPAO",
    "createdAt": "2025-10-10 08:00:00",
    "updatedAt": "2025-10-18 20:30:00",
    "costItems": [
      {
        "id": "JOB26030006-COST-1",
        "feeType": "运费",
        "amount": 500,
        "currency": "CNY",
        "status": "PENDING",
        "createdAt": "2025-10-10 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030006-COST-2",
        "feeType": "报关费",
        "amount": 620,
        "currency": "USD",
        "status": "APPROVED",
        "createdAt": "2025-10-11 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030006-COST-3",
        "feeType": "仓储费",
        "amount": 740,
        "currency": "CNY",
        "status": "PAID",
        "createdAt": "2025-10-12 10:00:00",
        "createdBy": "CANSAMPAO"
      }
    ]
  },
  {
    "id": "JOB26030007",
    "jobs": [
      {
        "id": "J010",
        "jobNo": "JOB100148",
        "stationName": "海珠区站点",
        "routeId": "R003",
        "routeName": "SZX.CHN→LOS.NGN",
        "serviceType": "EXPRESS",
        "originPort": "SZX",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "NON_GENERAL",
        "weightKg": 450,
        "pieces": 10,
        "executeDate": "2025-10-28",
        "remark": "非普货加急",
        "containers": [
          {
            "id": "JK-1",
            "containerNo": "TRLU1234567",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191115337 01",
                "thirdPartyTracking": "SF3445692337",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.17,
                "volumeWeightKgs": 195.39,
                "grossWeightKgs": 160.22
              },
              {
                "seq": 2,
                "orderNo": "191132354 02",
                "thirdPartyTracking": "SF3445692354",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.34,
                "volumeWeightKgs": 223.78,
                "grossWeightKgs": 187.98
              },
              {
                "seq": 3,
                "orderNo": "191029371 03",
                "thirdPartyTracking": "SF3445692371",
                "city": "KANO",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.31,
                "volumeWeightKgs": 51.77,
                "grossWeightKgs": 44.52
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.82,
            "volumeWeightKgs": 470.93999999999994,
            "grossWeightKgs": 392.71999999999997,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "JK-2",
            "containerNo": "TRLU1234568",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191069571 01",
                "thirdPartyTracking": "SF1646837571",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.71,
                "volumeWeightKgs": 118.57,
                "grossWeightKgs": 96.04
              },
              {
                "seq": 2,
                "orderNo": "191086588 02",
                "thirdPartyTracking": "SF1646837588",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.88,
                "volumeWeightKgs": 146.96,
                "grossWeightKgs": 121.98
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.5899999999999999,
            "volumeWeightKgs": 265.53,
            "grossWeightKgs": 218.02,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "JK-3",
            "containerNo": "TRLU1234569",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191117379 01",
                "thirdPartyTracking": "SF3447539379",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.19,
                "volumeWeightKgs": 198.73,
                "grossWeightKgs": 166.93
              },
              {
                "seq": 2,
                "orderNo": "191134396 02",
                "thirdPartyTracking": "SF3447539396",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.36,
                "volumeWeightKgs": 227.12,
                "grossWeightKgs": 195.32
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.55,
            "volumeWeightKgs": 425.85,
            "grossWeightKgs": 362.25,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "JK-4",
            "containerNo": "TRLU1234570",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191118900 01",
                "thirdPartyTracking": "SF3448462900",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.2,
                "volumeWeightKgs": 200.4,
                "grossWeightKgs": 170.34
              },
              {
                "seq": 2,
                "orderNo": "191135917 02",
                "thirdPartyTracking": "SF3448462917",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.37,
                "volumeWeightKgs": 228.79,
                "grossWeightKgs": 199.05
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.5700000000000003,
            "volumeWeightKgs": 429.19,
            "grossWeightKgs": 369.39,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "JK-5",
            "containerNo": "TRLU1234571",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191119421 01",
                "thirdPartyTracking": "SF3449386421",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.21,
                "volumeWeightKgs": 202.07,
                "grossWeightKgs": 173.78
              },
              {
                "seq": 2,
                "orderNo": "191136438 02",
                "thirdPartyTracking": "SF3449386438",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.38,
                "volumeWeightKgs": 230.46,
                "grossWeightKgs": 202.8
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.59,
            "volumeWeightKgs": 432.53,
            "grossWeightKgs": 376.58000000000004,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 10,
          "pieces": 10,
          "weightKgs": 450,
          "weightRatio": 1,
          "receivableRatio": 1,
          "payableRatio": 1,
          "recoveryRatio": 0.4
        }
      }
    ],
    "supplier": {
      "supplierName": "深圳喵喵国际货运代理有限公司",
      "phone": "+86 13800138001",
      "address": "广东省深圳市福田区深南大道1001号"
    },
    "deliveryCompany": {
      "companyName": "申通快递",
      "trackingNo": "STO202510280001",
      "queryPhone": "95543",
      "driverName": "赵师傅",
      "driverPhone": "+86 13500135001",
      "plateNo": "粤B55555"
    },
    "status": "IN_PROGRESS",
    "createdBy": "CANANDI",
    "createdAt": "2025-10-26 14:00:00",
    "updatedAt": "2025-10-30 16:20:00",
    "costItems": [
      {
        "id": "JOB26030007-COST-1",
        "feeType": "运费",
        "amount": 500,
        "currency": "CNY",
        "status": "PENDING",
        "createdAt": "2025-10-10 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030007-COST-2",
        "feeType": "报关费",
        "amount": 620,
        "currency": "USD",
        "status": "APPROVED",
        "createdAt": "2025-10-11 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030007-COST-3",
        "feeType": "仓储费",
        "amount": 740,
        "currency": "CNY",
        "status": "PAID",
        "createdAt": "2025-10-12 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030007-COST-4",
        "feeType": "装卸费",
        "amount": 860,
        "currency": "USD",
        "status": "PENDING",
        "createdAt": "2025-10-13 10:00:00",
        "createdBy": "CANSAMPAO"
      }
    ]
  },
  {
    "id": "JOB26030008",
    "jobs": [
      {
        "id": "J011",
        "jobNo": "JOB100153",
        "stationName": "海珠区站点",
        "routeId": "R001",
        "routeName": "CAN.CHN→LOS.NGN",
        "serviceType": "STANDARD",
        "originPort": "CAN",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "GENERAL",
        "weightKg": 2000,
        "pieces": 40,
        "executeDate": "2025-11-10",
        "remark": "",
        "containers": [
          {
            "id": "KK-1",
            "containerNo": "BMOU2345678",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191098720 01",
                "thirdPartyTracking": "SF0038228720",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1,
                "volumeWeightKgs": 167,
                "grossWeightKgs": 133.6
              },
              {
                "seq": 2,
                "orderNo": "191115737 02",
                "thirdPartyTracking": "SF0038228737",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.17,
                "volumeWeightKgs": 195.39,
                "grossWeightKgs": 160.22
              },
              {
                "seq": 3,
                "orderNo": "191132754 03",
                "thirdPartyTracking": "SF0038228754",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.34,
                "volumeWeightKgs": 223.78,
                "grossWeightKgs": 187.98
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.51,
            "volumeWeightKgs": 586.17,
            "grossWeightKgs": 481.79999999999995,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "KK-2",
            "containerNo": "BMOU2345679",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191099241 01",
                "thirdPartyTracking": "SF0039152241",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.01,
                "volumeWeightKgs": 168.67,
                "grossWeightKgs": 136.62
              },
              {
                "seq": 2,
                "orderNo": "191116258 02",
                "thirdPartyTracking": "SF0039152258",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.18,
                "volumeWeightKgs": 197.06,
                "grossWeightKgs": 163.56
              },
              {
                "seq": 3,
                "orderNo": "191133275 03",
                "thirdPartyTracking": "SF0039152275",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.35,
                "volumeWeightKgs": 225.45,
                "grossWeightKgs": 191.63
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.54,
            "volumeWeightKgs": 591.1800000000001,
            "grossWeightKgs": 491.81,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "KK-3",
            "containerNo": "BMOU2345680",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191100762 01",
                "thirdPartyTracking": "SF0040075762",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.02,
                "volumeWeightKgs": 170.34,
                "grossWeightKgs": 139.68
              },
              {
                "seq": 2,
                "orderNo": "191117779 02",
                "thirdPartyTracking": "SF0040075779",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.19,
                "volumeWeightKgs": 198.73,
                "grossWeightKgs": 166.93
              },
              {
                "seq": 3,
                "orderNo": "191134796 03",
                "thirdPartyTracking": "SF0040075796",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.36,
                "volumeWeightKgs": 227.12,
                "grossWeightKgs": 195.32
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.5700000000000003,
            "volumeWeightKgs": 596.19,
            "grossWeightKgs": 501.93,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "KK-4",
            "containerNo": "BMOU2345681",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191101283 01",
                "thirdPartyTracking": "SF0040999283",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.03,
                "volumeWeightKgs": 172.01,
                "grossWeightKgs": 142.77
              },
              {
                "seq": 2,
                "orderNo": "191118300 02",
                "thirdPartyTracking": "SF0040999300",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.2,
                "volumeWeightKgs": 200.4,
                "grossWeightKgs": 170.34
              },
              {
                "seq": 3,
                "orderNo": "191135317 03",
                "thirdPartyTracking": "SF0040999317",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.37,
                "volumeWeightKgs": 228.79,
                "grossWeightKgs": 199.05
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.6,
            "volumeWeightKgs": 601.1999999999999,
            "grossWeightKgs": 512.1600000000001,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "KK-5",
            "containerNo": "BMOU2345682",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191102804 01",
                "thirdPartyTracking": "SF0041922804",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.04,
                "volumeWeightKgs": 173.68,
                "grossWeightKgs": 145.89
              },
              {
                "seq": 2,
                "orderNo": "191119821 02",
                "thirdPartyTracking": "SF0041922821",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.21,
                "volumeWeightKgs": 202.07,
                "grossWeightKgs": 173.78
              },
              {
                "seq": 3,
                "orderNo": "191136838 03",
                "thirdPartyTracking": "SF0041922838",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.38,
                "volumeWeightKgs": 230.46,
                "grossWeightKgs": 202.8
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.63,
            "volumeWeightKgs": 606.21,
            "grossWeightKgs": 522.47,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "KK-6",
            "containerNo": "BMOU2345683",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191103325 01",
                "thirdPartyTracking": "SF0042846325",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.05,
                "volumeWeightKgs": 175.35,
                "grossWeightKgs": 149.05
              },
              {
                "seq": 2,
                "orderNo": "191120342 02",
                "thirdPartyTracking": "SF0042846342",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.22,
                "volumeWeightKgs": 203.74,
                "grossWeightKgs": 177.25
              },
              {
                "seq": 3,
                "orderNo": "191137359 03",
                "thirdPartyTracking": "SF0042846359",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.39,
                "volumeWeightKgs": 232.13,
                "grossWeightKgs": 206.6
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.66,
            "volumeWeightKgs": 611.22,
            "grossWeightKgs": 532.9,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 40,
          "pieces": 40,
          "weightKgs": 2000,
          "weightRatio": 0.6,
          "receivableRatio": 0.55,
          "payableRatio": 0.58,
          "recoveryRatio": 0
        }
      },
      {
        "id": "J012",
        "jobNo": "JOB100154",
        "stationName": "福田区站点",
        "routeId": "R003",
        "routeName": "SZX.CHN→LOS.NGN",
        "serviceType": "EXPRESS",
        "originPort": "SZX",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "ALL",
        "weightKg": 1300,
        "pieces": 28,
        "executeDate": "2025-11-10",
        "remark": "",
        "containers": [
          {
            "id": "LK-1",
            "containerNo": "FCIU3456789",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191101403 01",
                "thirdPartyTracking": "SF0925732403",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.03,
                "volumeWeightKgs": 172.01,
                "grossWeightKgs": 142.77
              },
              {
                "seq": 2,
                "orderNo": "191118420 02",
                "thirdPartyTracking": "SF0925732420",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.2,
                "volumeWeightKgs": 200.4,
                "grossWeightKgs": 170.34
              },
              {
                "seq": 3,
                "orderNo": "191135437 03",
                "thirdPartyTracking": "SF0925732437",
                "city": "KANO",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.37,
                "volumeWeightKgs": 228.79,
                "grossWeightKgs": 199.05
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.6,
            "volumeWeightKgs": 601.1999999999999,
            "grossWeightKgs": 512.1600000000001,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "LK-2",
            "containerNo": "FCIU3456790",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191102924 01",
                "thirdPartyTracking": "SF0926655924",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.04,
                "volumeWeightKgs": 173.68,
                "grossWeightKgs": 145.89
              },
              {
                "seq": 2,
                "orderNo": "191119941 02",
                "thirdPartyTracking": "SF0926655941",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.21,
                "volumeWeightKgs": 202.07,
                "grossWeightKgs": 173.78
              },
              {
                "seq": 3,
                "orderNo": "191136958 03",
                "thirdPartyTracking": "SF0926655958",
                "city": "KANO",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.38,
                "volumeWeightKgs": 230.46,
                "grossWeightKgs": 202.8
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.63,
            "volumeWeightKgs": 606.21,
            "grossWeightKgs": 522.47,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "LK-3",
            "containerNo": "FCIU3456791",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191103445 01",
                "thirdPartyTracking": "SF0927579445",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.05,
                "volumeWeightKgs": 175.35,
                "grossWeightKgs": 149.05
              },
              {
                "seq": 2,
                "orderNo": "191120462 02",
                "thirdPartyTracking": "SF0927579462",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.22,
                "volumeWeightKgs": 203.74,
                "grossWeightKgs": 177.25
              },
              {
                "seq": 3,
                "orderNo": "191137479 03",
                "thirdPartyTracking": "SF0927579479",
                "city": "KANO",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.39,
                "volumeWeightKgs": 232.13,
                "grossWeightKgs": 206.6
              }
            ],
            "pieces": 3,
            "volumeCbm": 3.66,
            "volumeWeightKgs": 611.22,
            "grossWeightKgs": 532.9,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "LK-4",
            "containerNo": "FCIU3456792",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191104966 01",
                "thirdPartyTracking": "SF0928502966",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.06,
                "volumeWeightKgs": 177.02,
                "grossWeightKgs": 152.24
              },
              {
                "seq": 2,
                "orderNo": "191121983 02",
                "thirdPartyTracking": "SF0928502983",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.23,
                "volumeWeightKgs": 205.41,
                "grossWeightKgs": 180.76
              },
              {
                "seq": 3,
                "orderNo": "191018000 03",
                "thirdPartyTracking": "SF0928503000",
                "city": "KANO",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.2,
                "volumeWeightKgs": 33.4,
                "grossWeightKgs": 25.05
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.49,
            "volumeWeightKgs": 415.83,
            "grossWeightKgs": 358.05,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "LK-5",
            "containerNo": "FCIU3456793",
            "routeName": "SZX.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191105487 01",
                "thirdPartyTracking": "SF0929426487",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.07,
                "volumeWeightKgs": 178.69,
                "grossWeightKgs": 155.46
              },
              {
                "seq": 2,
                "orderNo": "191122504 02",
                "thirdPartyTracking": "SF0929426504",
                "city": "ABUJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.24,
                "volumeWeightKgs": 207.08,
                "grossWeightKgs": 184.3
              },
              {
                "seq": 3,
                "orderNo": "191019521 03",
                "thirdPartyTracking": "SF0929426521",
                "city": "KANO",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.21,
                "volumeWeightKgs": 35.07,
                "grossWeightKgs": 26.65
              }
            ],
            "pieces": 3,
            "volumeCbm": 2.52,
            "volumeWeightKgs": 420.84,
            "grossWeightKgs": 366.40999999999997,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 28,
          "pieces": 28,
          "weightKgs": 1300,
          "weightRatio": 0.4,
          "receivableRatio": 0.45,
          "payableRatio": 0.42,
          "recoveryRatio": 0
        }
      }
    ],
    "supplier": {
      "supplierName": "广州喵喵国际货运代理有限公司",
      "phone": "+86 13570217212",
      "address": "广东省广州市白云区黄石路江夏北二路3号云商易城B栋110"
    },
    "deliveryCompany": {
      "companyName": "",
      "trackingNo": "",
      "queryPhone": "",
      "driverName": "",
      "driverPhone": "",
      "plateNo": ""
    },
    "status": "PENDING",
    "createdBy": "CANYING",
    "createdAt": "2025-11-01 10:00:00",
    "updatedAt": "2025-11-01 10:00:00",
    "costItems": []
  },
  {
    "id": "JOB26030009",
    "jobs": [
      {
        "id": "J013",
        "jobNo": "JOB100136",
        "stationName": "海珠区站点",
        "routeId": "R001",
        "routeName": "CAN.CHN→LOS.NGN",
        "serviceType": "STANDARD",
        "originPort": "CAN",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "GENERAL",
        "weightKg": 1800,
        "pieces": 35,
        "executeDate": "2025-10-10",
        "remark": "",
        "containers": [
          {
            "id": "MK-1",
            "containerNo": "GESU4567890",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191100082 01",
                "thirdPartyTracking": "SF1813236082",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.02,
                "volumeWeightKgs": 170.34,
                "grossWeightKgs": 139.68
              },
              {
                "seq": 2,
                "orderNo": "191117099 02",
                "thirdPartyTracking": "SF1813236099",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.19,
                "volumeWeightKgs": 198.73,
                "grossWeightKgs": 166.93
              },
              {
                "seq": 3,
                "orderNo": "191134116 03",
                "thirdPartyTracking": "SF1813236116",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.36,
                "volumeWeightKgs": 227.12,
                "grossWeightKgs": 195.32
              },
              {
                "seq": 4,
                "orderNo": "191031133 04",
                "thirdPartyTracking": "SF1813236133",
                "city": "LAGOS",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.33,
                "volumeWeightKgs": 55.11,
                "grossWeightKgs": 48.5
              },
              {
                "seq": 5,
                "orderNo": "191048150 05",
                "thirdPartyTracking": "SF1813236150",
                "city": "IKEJA",
                "salesPerson": "Bella Chan",
                "userName": "Tom",
                "goodsName": "机械配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.5,
                "volumeWeightKgs": 83.5,
                "grossWeightKgs": 62.63
              },
              {
                "seq": 6,
                "orderNo": "191065167 06",
                "thirdPartyTracking": "SF1813236167",
                "city": "VI",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.67,
                "volumeWeightKgs": 111.89,
                "grossWeightKgs": 86.16
              }
            ],
            "pieces": 6,
            "volumeCbm": 5.07,
            "volumeWeightKgs": 846.69,
            "grossWeightKgs": 699.22,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEST_WAREHOUSE_IN",
                  "nodeName": "已入仓",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "MK-2",
            "containerNo": "GESU4567891",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191101603 01",
                "thirdPartyTracking": "SF1814159603",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.03,
                "volumeWeightKgs": 172.01,
                "grossWeightKgs": 142.77
              },
              {
                "seq": 2,
                "orderNo": "191118620 02",
                "thirdPartyTracking": "SF1814159620",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.2,
                "volumeWeightKgs": 200.4,
                "grossWeightKgs": 170.34
              },
              {
                "seq": 3,
                "orderNo": "191135637 03",
                "thirdPartyTracking": "SF1814159637",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.37,
                "volumeWeightKgs": 228.79,
                "grossWeightKgs": 199.05
              },
              {
                "seq": 4,
                "orderNo": "191032654 04",
                "thirdPartyTracking": "SF1814159654",
                "city": "LAGOS",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.34,
                "volumeWeightKgs": 56.78,
                "grossWeightKgs": 50.53
              },
              {
                "seq": 5,
                "orderNo": "191049671 05",
                "thirdPartyTracking": "SF1814159671",
                "city": "IKEJA",
                "salesPerson": "Bella Chan",
                "userName": "Tom",
                "goodsName": "机械配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.51,
                "volumeWeightKgs": 85.17,
                "grossWeightKgs": 64.73
              },
              {
                "seq": 6,
                "orderNo": "191066688 06",
                "thirdPartyTracking": "SF1814159688",
                "city": "VI",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.68,
                "volumeWeightKgs": 113.56,
                "grossWeightKgs": 88.58
              }
            ],
            "pieces": 6,
            "volumeCbm": 5.13,
            "volumeWeightKgs": 856.7099999999998,
            "grossWeightKgs": 716.0000000000001,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEST_WAREHOUSE_IN",
                  "nodeName": "已入仓",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "MK-3",
            "containerNo": "GESU4567892",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191102124 01",
                "thirdPartyTracking": "SF1815083124",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.04,
                "volumeWeightKgs": 173.68,
                "grossWeightKgs": 145.89
              },
              {
                "seq": 2,
                "orderNo": "191119141 02",
                "thirdPartyTracking": "SF1815083141",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.21,
                "volumeWeightKgs": 202.07,
                "grossWeightKgs": 173.78
              },
              {
                "seq": 3,
                "orderNo": "191136158 03",
                "thirdPartyTracking": "SF1815083158",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.38,
                "volumeWeightKgs": 230.46,
                "grossWeightKgs": 202.8
              },
              {
                "seq": 4,
                "orderNo": "191033175 04",
                "thirdPartyTracking": "SF1815083175",
                "city": "LAGOS",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.35,
                "volumeWeightKgs": 58.45,
                "grossWeightKgs": 43.84
              },
              {
                "seq": 5,
                "orderNo": "191050192 05",
                "thirdPartyTracking": "SF1815083192",
                "city": "IKEJA",
                "salesPerson": "Bella Chan",
                "userName": "Tom",
                "goodsName": "机械配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.52,
                "volumeWeightKgs": 86.84,
                "grossWeightKgs": 66.87
              },
              {
                "seq": 6,
                "orderNo": "191067209 06",
                "thirdPartyTracking": "SF1815083209",
                "city": "VI",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.69,
                "volumeWeightKgs": 115.23,
                "grossWeightKgs": 91.03
              }
            ],
            "pieces": 6,
            "volumeCbm": 5.1899999999999995,
            "volumeWeightKgs": 866.7300000000001,
            "grossWeightKgs": 724.21,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEST_WAREHOUSE_IN",
                  "nodeName": "已入仓",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "MK-4",
            "containerNo": "GESU4567893",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191103645 01",
                "thirdPartyTracking": "SF1816006645",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.05,
                "volumeWeightKgs": 175.35,
                "grossWeightKgs": 149.05
              },
              {
                "seq": 2,
                "orderNo": "191120662 02",
                "thirdPartyTracking": "SF1816006662",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.22,
                "volumeWeightKgs": 203.74,
                "grossWeightKgs": 177.25
              },
              {
                "seq": 3,
                "orderNo": "191137679 03",
                "thirdPartyTracking": "SF1816006679",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.39,
                "volumeWeightKgs": 232.13,
                "grossWeightKgs": 206.6
              },
              {
                "seq": 4,
                "orderNo": "191034696 04",
                "thirdPartyTracking": "SF1816006696",
                "city": "LAGOS",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.36,
                "volumeWeightKgs": 60.12,
                "grossWeightKgs": 45.69
              },
              {
                "seq": 5,
                "orderNo": "191051713 05",
                "thirdPartyTracking": "SF1816006713",
                "city": "IKEJA",
                "salesPerson": "Bella Chan",
                "userName": "Tom",
                "goodsName": "机械配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.53,
                "volumeWeightKgs": 88.51,
                "grossWeightKgs": 69.04
              },
              {
                "seq": 6,
                "orderNo": "191068730 06",
                "thirdPartyTracking": "SF1816006730",
                "city": "VI",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.7,
                "volumeWeightKgs": 116.9,
                "grossWeightKgs": 93.52
              }
            ],
            "pieces": 6,
            "volumeCbm": 5.250000000000001,
            "volumeWeightKgs": 876.75,
            "grossWeightKgs": 741.1499999999999,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEST_WAREHOUSE_IN",
                  "nodeName": "已入仓",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "MK-5",
            "containerNo": "GESU4567894",
            "routeName": "CAN.CHN→LOS.NGN",
            "serviceType": "普快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191104166 01",
                "thirdPartyTracking": "SF1816930166",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.06,
                "volumeWeightKgs": 177.02,
                "grossWeightKgs": 152.24
              },
              {
                "seq": 2,
                "orderNo": "191121183 02",
                "thirdPartyTracking": "SF1816930183",
                "city": "IKEJA",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.23,
                "volumeWeightKgs": 205.41,
                "grossWeightKgs": 180.76
              },
              {
                "seq": 3,
                "orderNo": "191018200 03",
                "thirdPartyTracking": "SF1816930200",
                "city": "VI",
                "salesPerson": "Karena",
                "userName": "Ying",
                "goodsName": "服装",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.2,
                "volumeWeightKgs": 33.4,
                "grossWeightKgs": 25.05
              },
              {
                "seq": 4,
                "orderNo": "191035217 04",
                "thirdPartyTracking": "SF1816930217",
                "city": "LAGOS",
                "salesPerson": "AkinGbolahan",
                "userName": "Daniel",
                "goodsName": "家居用品",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.37,
                "volumeWeightKgs": 61.79,
                "grossWeightKgs": 47.58
              },
              {
                "seq": 5,
                "orderNo": "191052234 05",
                "thirdPartyTracking": "SF1816930234",
                "city": "IKEJA",
                "salesPerson": "Bella Chan",
                "userName": "Tom",
                "goodsName": "机械配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.54,
                "volumeWeightKgs": 90.18,
                "grossWeightKgs": 71.24
              },
              {
                "seq": 6,
                "orderNo": "191069251 06",
                "thirdPartyTracking": "SF1816930251",
                "city": "VI",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.71,
                "volumeWeightKgs": 118.57,
                "grossWeightKgs": 96.04
              }
            ],
            "pieces": 6,
            "volumeCbm": 4.11,
            "volumeWeightKgs": 686.3699999999999,
            "grossWeightKgs": 572.91,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEPARTURE",
                  "nodeName": "已起运",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "ARRIVAL",
                  "nodeName": "已到港",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "DEST_WAREHOUSE_IN",
                  "nodeName": "已入仓",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 35,
          "pieces": 35,
          "weightKgs": 1800,
          "weightRatio": 1,
          "receivableRatio": 1,
          "payableRatio": 1,
          "recoveryRatio": 0.98
        }
      }
    ],
    "supplier": {
      "supplierName": "广州喵喵国际货运代理有限公司",
      "phone": "+86 13570217212",
      "address": "广东省广州市白云区黄石路江夏北二路3号云商易城B栋110"
    },
    "deliveryCompany": {
      "companyName": "德邦物流",
      "trackingNo": "DB202510100002",
      "queryPhone": "95353",
      "driverName": "林师傅",
      "driverPhone": "+86 13600136002",
      "plateNo": "粤A99999"
    },
    "status": "COMPLETED",
    "createdBy": "CANBELLA",
    "createdAt": "2025-10-05 08:30:00",
    "updatedAt": "2025-10-15 20:00:00",
    "costItems": [
      {
        "id": "JOB26030009-COST-1",
        "feeType": "运费",
        "amount": 500,
        "currency": "CNY",
        "status": "PENDING",
        "createdAt": "2025-10-10 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030009-COST-2",
        "feeType": "报关费",
        "amount": 620,
        "currency": "USD",
        "status": "APPROVED",
        "createdAt": "2025-10-11 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030009-COST-3",
        "feeType": "仓储费",
        "amount": 740,
        "currency": "CNY",
        "status": "PAID",
        "createdAt": "2025-10-12 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030009-COST-4",
        "feeType": "装卸费",
        "amount": 860,
        "currency": "USD",
        "status": "PENDING",
        "createdAt": "2025-10-13 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030009-COST-5",
        "feeType": "运费",
        "amount": 980,
        "currency": "CNY",
        "status": "APPROVED",
        "createdAt": "2025-10-14 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030009-COST-6",
        "feeType": "报关费",
        "amount": 1100,
        "currency": "USD",
        "status": "PAID",
        "createdAt": "2025-10-15 10:00:00",
        "createdBy": "CANSAMPAO"
      }
    ]
  },
  {
    "id": "JOB26030010",
    "jobs": [
      {
        "id": "J014",
        "jobNo": "JOB100115",
        "stationName": "福田区站点",
        "routeId": "R004",
        "routeName": "HKG.CHN→LOS.NGN",
        "serviceType": "EXPRESS",
        "originPort": "HKG",
        "transitPort": "",
        "destPort": "LOS",
        "cargoFilter": "NON_GENERAL",
        "weightKg": 3500,
        "pieces": 65,
        "executeDate": "2025-10-27",
        "remark": "高价值货物",
        "containers": [
          {
            "id": "NK-1",
            "containerNo": "SEGU5678901",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191104766 01",
                "thirdPartyTracking": "SF2700739766",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.06,
                "volumeWeightKgs": 177.02,
                "grossWeightKgs": 152.24
              },
              {
                "seq": 2,
                "orderNo": "191121783 02",
                "thirdPartyTracking": "SF2700739783",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.23,
                "volumeWeightKgs": 205.41,
                "grossWeightKgs": 180.76
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.29,
            "volumeWeightKgs": 382.43,
            "grossWeightKgs": 333,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                },
                {
                  "nodeCode": "CUSTOMS_EXPORT",
                  "nodeName": "出口报关",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "NK-2",
            "containerNo": "SEGU5678902",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191105287 01",
                "thirdPartyTracking": "SF2701663287",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.07,
                "volumeWeightKgs": 178.69,
                "grossWeightKgs": 155.46
              },
              {
                "seq": 2,
                "orderNo": "191122304 02",
                "thirdPartyTracking": "SF2701663304",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.24,
                "volumeWeightKgs": 207.08,
                "grossWeightKgs": 184.3
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.31,
            "volumeWeightKgs": 385.77,
            "grossWeightKgs": 339.76,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "NK-3",
            "containerNo": "SEGU5678903",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191075337 01",
                "thirdPartyTracking": "SF4195769337",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 0.77,
                "volumeWeightKgs": 128.59,
                "grossWeightKgs": 111.87
              },
              {
                "seq": 2,
                "orderNo": "191092354 02",
                "thirdPartyTracking": "SF4195769354",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 0.94,
                "volumeWeightKgs": 156.98,
                "grossWeightKgs": 139.71
              }
            ],
            "pieces": 2,
            "volumeCbm": 1.71,
            "volumeWeightKgs": 285.57,
            "grossWeightKgs": 251.58,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "NK-4",
            "containerNo": "SEGU5678904",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191107329 01",
                "thirdPartyTracking": "SF2703510329",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.09,
                "volumeWeightKgs": 182.03,
                "grossWeightKgs": 162.01
              },
              {
                "seq": 2,
                "orderNo": "191124346 02",
                "thirdPartyTracking": "SF2703510346",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.26,
                "volumeWeightKgs": 210.42,
                "grossWeightKgs": 159.92
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.35,
            "volumeWeightKgs": 392.45,
            "grossWeightKgs": 321.92999999999995,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "NK-5",
            "containerNo": "SEGU5678905",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191108850 01",
                "thirdPartyTracking": "SF2704433850",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.1,
                "volumeWeightKgs": 183.7,
                "grossWeightKgs": 137.78
              },
              {
                "seq": 2,
                "orderNo": "191125867 02",
                "thirdPartyTracking": "SF2704433867",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.27,
                "volumeWeightKgs": 212.09,
                "grossWeightKgs": 163.31
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.37,
            "volumeWeightKgs": 395.78999999999996,
            "grossWeightKgs": 301.09000000000003,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          },
          {
            "id": "NK-6",
            "containerNo": "SEGU5678906",
            "routeName": "HKG.CHN→LOS.NGN",
            "serviceType": "特快",
            "orders": [
              {
                "seq": 1,
                "orderNo": "191109371 01",
                "thirdPartyTracking": "SF2705357371",
                "city": "LAGOS",
                "salesPerson": "Smile",
                "userName": "Lena",
                "goodsName": "普货",
                "description": "普货",
                "pieces": 1,
                "volumeCbm": 1.11,
                "volumeWeightKgs": 185.37,
                "grossWeightKgs": 140.88
              },
              {
                "seq": 2,
                "orderNo": "191126388 02",
                "thirdPartyTracking": "SF2705357388",
                "city": "LOS",
                "salesPerson": "Andi",
                "userName": "Mike",
                "goodsName": "电子配件",
                "description": "其它",
                "pieces": 1,
                "volumeCbm": 1.28,
                "volumeWeightKgs": 213.76,
                "grossWeightKgs": 166.73
              }
            ],
            "pieces": 2,
            "volumeCbm": 2.39,
            "volumeWeightKgs": 399.13,
            "grossWeightKgs": 307.61,
            "nodeProgress": {
              "completedNodes": [
                {
                  "nodeCode": "WAREHOUSE_OUT",
                  "nodeName": "已离库",
                  "isAbnormal": false
                }
              ]
            }
          }
        ],
        "stationSummary": {
          "orderCount": 65,
          "pieces": 65,
          "weightKgs": 3500,
          "weightRatio": 1,
          "receivableRatio": 1,
          "payableRatio": 1,
          "recoveryRatio": 0.3
        }
      }
    ],
    "supplier": {
      "supplierName": "香港喵喵国际物流有限公司",
      "phone": "+852 23456789",
      "address": "香港九龙观塘道388号创业商场2楼"
    },
    "deliveryCompany": {
      "companyName": "顺丰速运",
      "trackingNo": "SF2025102700001",
      "queryPhone": "95338",
      "driverName": "黄先生",
      "driverPhone": "+852 98765432",
      "plateNo": "HK AB1234"
    },
    "status": "IN_PROGRESS",
    "createdBy": "HKGOPS01",
    "createdAt": "2025-10-24 11:00:00",
    "updatedAt": "2025-10-30 09:15:00",
    "costItems": [
      {
        "id": "JOB26030010-COST-1",
        "feeType": "运费",
        "amount": 500,
        "currency": "CNY",
        "status": "PENDING",
        "createdAt": "2025-10-10 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030010-COST-2",
        "feeType": "报关费",
        "amount": 620,
        "currency": "USD",
        "status": "APPROVED",
        "createdAt": "2025-10-11 10:00:00",
        "createdBy": "CANSAMPAO"
      },
      {
        "id": "JOB26030010-COST-3",
        "feeType": "仓储费",
        "amount": 740,
        "currency": "CNY",
        "status": "PAID",
        "createdAt": "2025-10-12 10:00:00",
        "createdBy": "CANSAMPAO"
      }
    ]
  }
];
