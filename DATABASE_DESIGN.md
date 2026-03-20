# 喵喵国际物流管理系统 - 数据库设计文档

**文档版本**: v1.0
**创建日期**: 2026-02-01
**数据库类型**: MySQL 8.0

---

## 📋 目录

1. [数据库概览](#数据库概览)
2. [核心表结构](#核心表结构)
3. [索引设计](#索引设计)
4. [数据字典](#数据字典)

---

## 数据库概览

### 数据库命名
- 数据库名称: `logistics_tms`
- 字符集: `utf8mb4`
- 排序规则: `utf8mb4_unicode_ci`

### 表分类

**核心业务表（16张）**:
1. users - 用户账户表
2. clients - 客户信息表
3. master_orders - 主订单表
4. sub_orders - 子订单表
5. order_items - 订单物品表
6. express_packages - 快递包裹表
7. jobs - 运输任务表
8. shipping_units - 集装箱/托盘表
9. inbound_records - 入库记录表
10. transfer_orders - 仓库调拨表
11. logistics_nodes - 物流节点表
12. fee_records - 费用记录表
13. payment_records - 支付记录表
14. suppliers - 供应商表
15. stations - 站点表
16. price_rules - 价格规则表

---

## 核心表结构

### 1. 用户账户表 (users)

```sql
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY COMMENT '用户ID',
  username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
  password VARCHAR(255) NOT NULL COMMENT '密码（加密）',
  real_name VARCHAR(100) COMMENT '真实姓名',
  role ENUM('ADMIN', 'SALES', 'WAREHOUSE_CN', 'OPS_CN',
            'WAREHOUSE_US', 'OPS_US', 'FINANCE', 'BOSS', 'DRIVER')
       NOT NULL COMMENT '角色',
  email VARCHAR(100) COMMENT '邮箱',
  phone VARCHAR(50) COMMENT '手机号',
  station_id VARCHAR(50) COMMENT '所属站点ID',
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE' COMMENT '状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  INDEX idx_username (username),
  INDEX idx_role (role),
  INDEX idx_station (station_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户账户表';
```

### 2. 客户信息表 (clients)

```sql
CREATE TABLE clients (
  id VARCHAR(50) PRIMARY KEY COMMENT '客户ID',
  short_code VARCHAR(10) UNIQUE NOT NULL COMMENT '客户简码',
  name VARCHAR(200) NOT NULL COMMENT '客户名称',
  country VARCHAR(50) COMMENT '所在国家',
  city VARCHAR(100) COMMENT '所在城市',
  address TEXT COMMENT '详细地址',
  industry VARCHAR(50) COMMENT '行业类型',

  -- 联系人信息
  contact_name VARCHAR(100) COMMENT '联系人姓名',
  contact_phone VARCHAR(50) COMMENT '联系电话',
  contact_email VARCHAR(100) COMMENT '联系邮箱',
  contact_social VARCHAR(100) COMMENT '社交账号',

  -- 业务信息
  source VARCHAR(50) COMMENT '客户来源',
  status ENUM('ACTIVE', 'DORMANT', 'FROZEN') DEFAULT 'ACTIVE' COMMENT '客户状态',
  pool_type ENUM('PRIVATE', 'PUBLIC') DEFAULT 'PUBLIC' COMMENT '池类型',
  sales_id VARCHAR(50) COMMENT '归属销售ID',
  former_sales_name VARCHAR(100) COMMENT '前销售姓名',
  return_reason TEXT COMMENT '退回公海原因',
  enter_pool_time DATETIME COMMENT '进入公海时间',

  -- 统计信息
  total_orders INT DEFAULT 0 COMMENT '总订单数',
  last_order_time DATETIME COMMENT '最后下单时间',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_short_code (short_code),
  INDEX idx_sales (sales_id),
  INDEX idx_pool_type (pool_type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户信息表';
```

### 3. 主订单表 (master_orders)

```sql
CREATE TABLE master_orders (
  id VARCHAR(50) PRIMARY KEY COMMENT '主订单ID',
  order_no VARCHAR(50) UNIQUE NOT NULL COMMENT '主订单号',
  customer_id VARCHAR(50) NOT NULL COMMENT '客户ID',
  customer_name VARCHAR(200) COMMENT '客户名称',

  -- 拆单信息
  split_status ENUM('NOT_SPLIT', 'PARTIAL', 'COMPLETED') DEFAULT 'NOT_SPLIT' COMMENT '拆单状态',
  split_type ENUM('MANUAL', 'AUTO') COMMENT '拆单方式',

  -- 收发货信息
  sender VARCHAR(100) COMMENT '发货人',
  sender_phone VARCHAR(50) COMMENT '发货人电话',
  sender_address TEXT COMMENT '发货地址',
  recipient VARCHAR(100) NOT NULL COMMENT '收货人',
  recipient_phone VARCHAR(50) NOT NULL COMMENT '收货人电话',
  recipient_address TEXT NOT NULL COMMENT '收货地址',
  dest_country VARCHAR(50) NOT NULL COMMENT '目的国家',
  dest_city VARCHAR(100) NOT NULL COMMENT '目的城市',

  -- 汇总数据
  total_pieces INT DEFAULT 0 COMMENT '总件数',
  total_weight DECIMAL(10,2) DEFAULT 0 COMMENT '总重量(kg)',
  total_volume DECIMAL(10,3) DEFAULT 0 COMMENT '总体积(m³)',
  total_value DECIMAL(10,2) DEFAULT 0 COMMENT '总货值',

  -- 费用信息
  payment_method ENUM('COD', 'PREPAID', 'CREDIT_CARD') COMMENT '支付方式',
  payment_status ENUM('UNPAID', 'PARTIAL_PAID', 'PAID') DEFAULT 'UNPAID' COMMENT '支付状态',
  total_amount DECIMAL(10,2) COMMENT '总金额',
  currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',

  -- 状态
  status VARCHAR(50) NOT NULL COMMENT '订单状态',

  -- 业务信息
  sales_person VARCHAR(50) COMMENT '销售人员',
  created_by VARCHAR(50) COMMENT '创建人',
  remark TEXT COMMENT '备注',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_order_no (order_no),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='主订单表';
```

### 4. 仓库调拨表 (transfer_orders)

```sql
CREATE TABLE transfer_orders (
  id VARCHAR(50) PRIMARY KEY,
  transfer_no VARCHAR(50) UNIQUE NOT NULL COMMENT '调拨单号',
  from_warehouse VARCHAR(50) NOT NULL COMMENT '源仓库',
  to_warehouse VARCHAR(50) NOT NULL COMMENT '目标仓库',
  transfer_type ENUM('ORIGIN', 'DESTINATION') NOT NULL COMMENT '调拨类型',
  status ENUM('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  total_pieces INT DEFAULT 0,
  total_weight DECIMAL(10,2) DEFAULT 0,
  reason TEXT COMMENT '调拨原因',
  created_by VARCHAR(50),
  outbound_at DATETIME COMMENT '出库时间',
  inbound_at DATETIME COMMENT '入库时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_transfer_no (transfer_no),
  INDEX idx_status (status),
  INDEX idx_from_warehouse (from_warehouse),
  INDEX idx_to_warehouse (to_warehouse)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仓库调拨表';
```

### 5. 费用记录表 (fee_records)

```sql
CREATE TABLE fee_records (
  id VARCHAR(50) PRIMARY KEY,
  fee_no VARCHAR(50) UNIQUE NOT NULL COMMENT '费用编号',
  related_type ENUM('ORDER', 'JOB', 'TRANSFER') COMMENT '关联类型',
  related_id VARCHAR(50) COMMENT '关联ID',
  fee_type VARCHAR(50) NOT NULL COMMENT '费用类型',
  fee_direction ENUM('PAYABLE', 'RECEIVABLE') NOT NULL COMMENT '费用方向',
  amount DECIMAL(10,2) NOT NULL COMMENT '金额',
  currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
  status ENUM('PENDING', 'APPROVED', 'REJECTED', 'PAID') DEFAULT 'PENDING',
  supplier_id VARCHAR(50) COMMENT '供应商ID',
  description TEXT COMMENT '费用说明',
  created_by VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_fee_no (fee_no),
  INDEX idx_status (status),
  INDEX idx_related (related_type, related_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='费用记录表';
```

### 6. 站点表 (stations)

```sql
CREATE TABLE stations (
  id VARCHAR(50) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL COMMENT '站点编码',
  name VARCHAR(100) NOT NULL COMMENT '站点名称',
  type ENUM('ORIGIN', 'DESTINATION') NOT NULL COMMENT '站点类型',
  country VARCHAR(50) NOT NULL COMMENT '所在国家',
  city VARCHAR(50) NOT NULL COMMENT '所在城市',
  address TEXT COMMENT '详细地址',
  contact VARCHAR(100) COMMENT '联系人',
  phone VARCHAR(50) COMMENT '联系电话',
  status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_code (code),
  INDEX idx_type (type),
  INDEX idx_country (country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站点表';
```

---

## 索引设计说明

### 主键索引
所有表都使用 VARCHAR(50) 作为主键，便于分布式系统生成唯一ID。

### 业务索引
- 订单号、客户编码等业务唯一标识建立唯一索引
- 状态字段建立普通索引，优化列表查询
- 时间字段建立索引，支持时间范围查询
- 外键关联字段建立索引，优化关联查询

---

**文档结束**
