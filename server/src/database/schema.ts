import { getDb } from './connection';

function migrateDeliveryOrdersAddCancelledStatus(db: any) {
  const tableSqlRow = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'delivery_orders'
  `).get() as { sql?: string } | undefined;

  const tableSql = tableSqlRow?.sql || '';
  if (!tableSql || tableSql.includes("'CANCELLED'")) {
    return;
  }

  const columns = db.prepare(`PRAGMA table_info(delivery_orders)`).all() as Array<{ name: string }>;
  const hasWarehouseId = columns.some((c) => c.name === 'warehouseId');

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    db.exec(`
      CREATE TABLE IF NOT EXISTS delivery_orders_new (
        id TEXT PRIMARY KEY,
        dpnNo TEXT UNIQUE NOT NULL,
        recipientName TEXT NOT NULL,
        recipientPhone TEXT NOT NULL,
        recipientAddress TEXT NOT NULL,
        city TEXT,
        country TEXT,
        deliveryMethod TEXT CHECK(deliveryMethod IN ('SELF_PICKUP','DELIVERY','SATELLITE_STATION')),
        driverId TEXT,
        driverName TEXT,
        driverPhone TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','IN_TRANSIT','DELIVERED','SIGNED','CANCELLED')),
        totalPieces INTEGER NOT NULL DEFAULT 0,
        totalWeight REAL NOT NULL DEFAULT 0,
        deliveryFee REAL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        phoneNotified INTEGER DEFAULT 0,
        smsNotified INTEGER DEFAULT 0,
        paymentStatus TEXT DEFAULT 'UNPAID' CHECK(paymentStatus IN ('PAID','UNPAID')),
        photos TEXT,
        remark TEXT,
        createdBy TEXT,
        createdAt TEXT NOT NULL,
        acceptedAt TEXT,
        deliveredAt TEXT,
        signedAt TEXT,
        warehouseId TEXT
      )
    `);

    db.exec(`
      INSERT INTO delivery_orders_new (
        id, dpnNo, recipientName, recipientPhone, recipientAddress, city, country,
        deliveryMethod, driverId, driverName, driverPhone, status, totalPieces, totalWeight,
        deliveryFee, currency, phoneNotified, smsNotified, paymentStatus, photos, remark,
        createdBy, createdAt, acceptedAt, deliveredAt, signedAt, warehouseId
      )
      SELECT
        id, dpnNo, recipientName, recipientPhone, recipientAddress, city, country,
        deliveryMethod, driverId, driverName, driverPhone, status, totalPieces, totalWeight,
        deliveryFee, currency, phoneNotified, smsNotified, paymentStatus, photos, remark,
        createdBy, createdAt, acceptedAt, deliveredAt, signedAt,
        ${hasWarehouseId ? 'warehouseId' : 'NULL'}
      FROM delivery_orders
    `);

    db.exec('DROP TABLE delivery_orders');
    db.exec('ALTER TABLE delivery_orders_new RENAME TO delivery_orders');
    db.exec('CREATE INDEX IF NOT EXISTS idx_do_status ON delivery_orders(status)');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function migrateFeeRecordsAddUnitRelatedType(db: any) {
  const tableSqlRow = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'fee_records'
  `).get() as { sql?: string } | undefined;

  const tableSql = tableSqlRow?.sql || '';
  if (!tableSql || tableSql.includes("'UNIT'")) {
    return;
  }

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    db.exec(`
      CREATE TABLE IF NOT EXISTS fee_records_new (
        id TEXT PRIMARY KEY,
        feeNo TEXT UNIQUE NOT NULL,
        relatedType TEXT NOT NULL CHECK(relatedType IN ('ORDER','JOB','UNIT','TRANSFER')),
        relatedId TEXT NOT NULL,
        relatedNo TEXT NOT NULL,
        feeType TEXT NOT NULL,
        feeDirection TEXT NOT NULL CHECK(feeDirection IN ('PAYABLE','RECEIVABLE')),
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CNY' CHECK(currency IN ('CNY','USD','NGN','EUR','GBP','GHS')),
        exchangeRate REAL DEFAULT 1.0,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED')),
        supplierId TEXT,
        supplierName TEXT,
        customerId TEXT,
        customerName TEXT,
        approver TEXT,
        approvedAt TEXT,
        rejectReason TEXT,
        paidAt TEXT,
        description TEXT,
        remark TEXT,
        createdBy TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    db.exec(`
      INSERT INTO fee_records_new (
        id, feeNo, relatedType, relatedId, relatedNo, feeType, feeDirection, amount,
        currency, exchangeRate, status, supplierId, supplierName, customerId, customerName,
        approver, approvedAt, rejectReason, paidAt, description, remark,
        createdBy, createdAt, updatedAt
      )
      SELECT
        id, feeNo, relatedType, relatedId, relatedNo, feeType, feeDirection, amount,
        currency, exchangeRate, status, supplierId, supplierName, customerId, customerName,
        approver, approvedAt, rejectReason, paidAt, description, remark,
        createdBy, createdAt, updatedAt
      FROM fee_records
    `);

    db.exec('DROP TABLE fee_records');
    db.exec('ALTER TABLE fee_records_new RENAME TO fee_records');
    db.exec('CREATE INDEX IF NOT EXISTS idx_fr_status ON fee_records(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_fr_related ON fee_records(relatedType, relatedId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_fr_direction ON fee_records(feeDirection)');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function migrateFeeRecordsAddDpnRelatedType(db: any) {
  const tableSqlRow = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'fee_records'
  `).get() as { sql?: string } | undefined;

  const tableSql = tableSqlRow?.sql || '';
  if (!tableSql || tableSql.includes("'DPN'")) {
    return;
  }

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    db.exec(`
      CREATE TABLE IF NOT EXISTS fee_records_new (
        id TEXT PRIMARY KEY,
        feeNo TEXT UNIQUE NOT NULL,
        relatedType TEXT NOT NULL CHECK(relatedType IN ('ORDER','JOB','UNIT','TRANSFER','DPN')),
        relatedId TEXT NOT NULL,
        relatedNo TEXT NOT NULL,
        feeType TEXT NOT NULL,
        feeDirection TEXT NOT NULL CHECK(feeDirection IN ('PAYABLE','RECEIVABLE')),
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CNY' CHECK(currency IN ('CNY','USD','NGN','EUR','GBP','GHS')),
        exchangeRate REAL DEFAULT 1.0,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED')),
        supplierId TEXT,
        supplierName TEXT,
        customerId TEXT,
        customerName TEXT,
        approver TEXT,
        approvedAt TEXT,
        rejectReason TEXT,
        paidAt TEXT,
        paymentMethod TEXT,
        paymentChannel TEXT,
        paymentAccount TEXT,
        paymentVoucher TEXT,
        paymentOperator TEXT,
        description TEXT,
        remark TEXT,
        createdBy TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    db.exec(`
      INSERT INTO fee_records_new (
        id, feeNo, relatedType, relatedId, relatedNo, feeType, feeDirection, amount,
        currency, exchangeRate, status, supplierId, supplierName, customerId, customerName,
        approver, approvedAt, rejectReason, paidAt, description, remark,
        createdBy, createdAt, updatedAt
      )
      SELECT
        id, feeNo, relatedType, relatedId, relatedNo, feeType, feeDirection, amount,
        currency, exchangeRate, status, supplierId, supplierName, customerId, customerName,
        approver, approvedAt, rejectReason, paidAt, description, remark,
        createdBy, createdAt, updatedAt
      FROM fee_records
    `);

    db.exec('DROP TABLE fee_records');
    db.exec('ALTER TABLE fee_records_new RENAME TO fee_records');
    db.exec('CREATE INDEX IF NOT EXISTS idx_fr_status ON fee_records(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_fr_related ON fee_records(relatedType, relatedId)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_fr_direction ON fee_records(feeDirection)');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

export function createTables() {
  const db = getDb();

  db.exec(`
    -- 1. users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      realName TEXT NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      role TEXT NOT NULL CHECK(role IN (
        'ADMIN','SALES','WAREHOUSE_CN','OPS_CN','OPS_US','WAREHOUSE_US','FINANCE','BOSS','DRIVER'
      )),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE','LOCKED')),
      departmentId TEXT,
      department TEXT,
      warehouseId TEXT,
      warehouseName TEXT,
      createdAt TEXT NOT NULL,
      lastLoginAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    -- 2. code_sequences（短码/单号序列）
    CREATE TABLE IF NOT EXISTS code_sequences (
      scope TEXT PRIMARY KEY,
      lastValue INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL
    );

    -- 3. clients
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      shortCode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      address TEXT,
      industry TEXT,
      contact TEXT NOT NULL,
      logisticsInfo TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DORMANT','FROZEN')),
      poolType TEXT NOT NULL DEFAULT 'PUBLIC' CHECK(poolType IN ('PRIVATE','PUBLIC')),
      salesId TEXT REFERENCES users(id) ON DELETE SET NULL,
      source TEXT,
      formerSalesName TEXT,
      returnReason TEXT,
      enterPoolTime TEXT,
      totalOrders INTEGER NOT NULL DEFAULT 0,
      lastOrderTime TEXT,
      remark TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_clients_pool ON clients(poolType);
    CREATE INDEX IF NOT EXISTS idx_clients_sales ON clients(salesId);
    CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

    -- 3.1 client_pool_logs（客户公私海流转日志）
    CREATE TABLE IF NOT EXISTS client_pool_logs (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK(action IN ('CLAIM','RELEASE','TRANSFER','AUTO_RELEASE')),
      fromPoolType TEXT CHECK(fromPoolType IN ('PRIVATE','PUBLIC')),
      toPoolType TEXT CHECK(toPoolType IN ('PRIVATE','PUBLIC')),
      fromSalesId TEXT,
      toSalesId TEXT,
      operatorId TEXT,
      operatorName TEXT,
      reason TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cpl_customer ON client_pool_logs(customerId);
    CREATE INDEX IF NOT EXISTS idx_cpl_time ON client_pool_logs(createdAt);
  `);

  // Migration: add columns that may not exist yet
  try { db.exec('ALTER TABLE clients ADD COLUMN companyType TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE clients ADD COLUMN creditLevel TEXT'); } catch (_) { /* already exists */ }

  db.exec(`

    -- 4. master_orders
    CREATE TABLE IF NOT EXISTS master_orders (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL REFERENCES clients(id),
      customerName TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_INBOUND' CHECK(status IN (
        'PENDING_INBOUND','INBOUND',
        'PENDING_DEPARTURE','DEPARTED','IN_TRANSIT','ARRIVED',
        'PARTIAL_DELIVERED','COMPLETED','EXCEPTION','RETURN_APPLIED','CANCELLED'
      )),
      splitStatus TEXT NOT NULL DEFAULT 'PENDING' CHECK(splitStatus IN ('PENDING','PARTIAL','COMPLETED')),
      totalPieces INTEGER NOT NULL DEFAULT 0,
      totalWeight REAL NOT NULL DEFAULT 0,
      totalVolume REAL NOT NULL DEFAULT 0,
      totalValue REAL NOT NULL DEFAULT 0,
      sender TEXT NOT NULL,
      senderPhone TEXT,
      senderAddress TEXT,
      consignee TEXT NOT NULL,
      consigneePhone TEXT NOT NULL,
      consigneeEmail TEXT,
      destCountry TEXT NOT NULL,
      destCity TEXT NOT NULL,
      destAddress TEXT NOT NULL,
      transportType TEXT CHECK(transportType IN ('SEA','AIR')),
      totalFreight REAL,
      paidAmount REAL DEFAULT 0,
      paymentStatus TEXT NOT NULL DEFAULT 'UNPAID' CHECK(paymentStatus IN ('UNPAID','PARTIAL','PAID')),
      salesPerson TEXT,
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mo_status ON master_orders(status);
    CREATE INDEX IF NOT EXISTS idx_mo_customer ON master_orders(customerId);
    CREATE INDEX IF NOT EXISTS idx_mo_payment ON master_orders(paymentStatus);

    -- 4. sub_orders
    CREATE TABLE IF NOT EXISTS sub_orders (
      id TEXT PRIMARY KEY,
      masterOrderId TEXT NOT NULL REFERENCES master_orders(id) ON DELETE CASCADE,
      batchNo INTEGER NOT NULL DEFAULT 1,
      pieces INTEGER NOT NULL,
      weight REAL NOT NULL,
      volume REAL NOT NULL,
      value REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING_INBOUND' CHECK(status IN (
        'PENDING_INBOUND','INBOUND','PENDING_PACKING','PACKED',
        'PENDING_DEPARTURE','IN_TRANSIT','CUSTOMS_CLEARANCE','ARRIVED',
        'PENDING_DELIVERY','DELIVERING','DELIVERED','EXCEPTION','RETURN_APPLIED','CANCELLED'
      )),
      transportType TEXT NOT NULL CHECK(transportType IN ('SEA','AIR')),
      route TEXT,
      warehouseId TEXT,
      shippingUnitId TEXT REFERENCES shipping_units(id) ON DELETE SET NULL,
      jobNo TEXT REFERENCES jobs(jobNo) ON DELETE SET NULL,
      currentNode TEXT,
      freight REAL,
      totalFee REAL,
      consignee TEXT,
      consigneePhone TEXT,
      destCountry TEXT NOT NULL,
      destCity TEXT NOT NULL,
      destAddress TEXT,
      expressCompany TEXT,
      expressTrackingNo TEXT,
      goodsDescription TEXT,
      etd TEXT,
      eta TEXT,
      atd TEXT,
      ata TEXT,
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_so_master ON sub_orders(masterOrderId);
    CREATE INDEX IF NOT EXISTS idx_so_status ON sub_orders(status);
    CREATE INDEX IF NOT EXISTS idx_so_unit ON sub_orders(shippingUnitId);
    CREATE INDEX IF NOT EXISTS idx_so_job ON sub_orders(jobNo);
    CREATE INDEX IF NOT EXISTS idx_so_tracking ON sub_orders(expressTrackingNo);

    -- 5. order_items
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      masterOrderId TEXT NOT NULL REFERENCES master_orders(id) ON DELETE CASCADE,
      subOrderId TEXT REFERENCES sub_orders(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      nameEn TEXT,
      quantity INTEGER NOT NULL,
      unitPrice REAL,
      weight REAL NOT NULL,
      volume REAL NOT NULL,
      category TEXT,
      attributes TEXT,
      declaredValue REAL,
      hsCode TEXT,
      remark TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_oi_master ON order_items(masterOrderId);

    -- 6. express_packages
    CREATE TABLE IF NOT EXISTS express_packages (
      id TEXT PRIMARY KEY,
      masterOrderId TEXT NOT NULL REFERENCES master_orders(id) ON DELETE CASCADE,
      subOrderId TEXT REFERENCES sub_orders(id) ON DELETE SET NULL,
      expressCompany TEXT NOT NULL,
      trackingNo TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RECEIVED','INBOUND','DELETED')),
      name TEXT NOT NULL,
      category TEXT,
      cargoType TEXT,
      weight REAL NOT NULL,
      pieces INTEGER NOT NULL,
      value REAL NOT NULL,
      length REAL,
      width REAL,
      height REAL,
      photos TEXT,
      remark TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ep_master ON express_packages(masterOrderId);
    CREATE INDEX IF NOT EXISTS idx_ep_tracking ON express_packages(trackingNo);

    -- 7. jobs
    CREATE TABLE IF NOT EXISTS jobs (
      jobNo TEXT PRIMARY KEY,
      route TEXT NOT NULL,
      pol TEXT NOT NULL,
      pod TEXT NOT NULL,
      transitPort TEXT,
      carrier TEXT NOT NULL,
      billOfLading TEXT,
      vesselVoyage TEXT,
      flightNo TEXT,
      transportType TEXT NOT NULL CHECK(transportType IN ('SEA','AIR','TRUCK')),
      currentPhase TEXT NOT NULL DEFAULT 'ORIGIN' CHECK(currentPhase IN ('ORIGIN','IN_TRANSIT','DESTINATION')),
      originPhaseStatus TEXT NOT NULL DEFAULT 'PLANNED',
      destPhaseStatus TEXT NOT NULL DEFAULT 'IN_TRANSIT',
      originOperator TEXT,
      destOperator TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN (
        'PLANNED','IN_PROGRESS','DEPARTED','IN_TRANSIT','ARRIVED','CLEARED','COMPLETED','CANCELLED'
      )),
      cutoffDate TEXT,
      etd TEXT NOT NULL,
      eta TEXT NOT NULL,
      atd TEXT,
      ata TEXT,
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_transport ON jobs(transportType);

    -- 8. shipping_units
    CREATE TABLE IF NOT EXISTS shipping_units (
      id TEXT PRIMARY KEY,
      unitNo TEXT UNIQUE NOT NULL,
      unitType TEXT NOT NULL CHECK(unitType IN ('20GP','40GP','40HQ','45HQ','PALLET','CARTON','LOOSE')),
      transportMode TEXT NOT NULL CHECK(transportMode IN ('SEA','AIR')),
      maxWeight REAL NOT NULL,
      maxVolume REAL NOT NULL,
      currentWeight REAL NOT NULL DEFAULT 0,
      currentVolume REAL NOT NULL DEFAULT 0,
      loadedPieces INTEGER NOT NULL DEFAULT 0,
      loadedOrders INTEGER NOT NULL DEFAULT 0,
      sealNo TEXT,
      warehouse TEXT,
      location TEXT,
      route TEXT,
      jobNo TEXT REFERENCES jobs(jobNo) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'EMPTY' CHECK(status IN ('EMPTY','LOADING','SEALED','SHIPPED','ARRIVED')),
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_su_job ON shipping_units(jobNo);
    CREATE INDEX IF NOT EXISTS idx_su_status ON shipping_units(status);

    -- 9. inbound_records
    CREATE TABLE IF NOT EXISTS inbound_records (
      id TEXT PRIMARY KEY,
      subOrderId TEXT NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
      masterOrderId TEXT NOT NULL REFERENCES master_orders(id) ON DELETE CASCADE,
      trackingNo TEXT NOT NULL,
      expressCompany TEXT NOT NULL,
      clientCode TEXT NOT NULL,
      clientName TEXT NOT NULL,
      pieces INTEGER NOT NULL,
      actualWeight REAL,
      actualVolume REAL,
      packageCondition TEXT NOT NULL DEFAULT 'GOOD' CHECK(packageCondition IN ('GOOD','DAMAGED','WET','OPENED','INCOMPLETE')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','COMPLETED','ABNORMAL')),
      inboundTime TEXT,
      inboundMethod TEXT CHECK(inboundMethod IN ('SCAN','MANUAL')),
      warehouseLocation TEXT,
      warehouse TEXT DEFAULT 'CN',
      jobNo TEXT,
      transferNo TEXT,
      operator TEXT,
      photos TEXT,
      remark TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ir_sub ON inbound_records(subOrderId);
    CREATE INDEX IF NOT EXISTS idx_ir_status ON inbound_records(status);
    CREATE INDEX IF NOT EXISTS idx_ir_tracking ON inbound_records(trackingNo);
    CREATE INDEX IF NOT EXISTS idx_ir_warehouse ON inbound_records(warehouse);

    -- 10. stock_items
    CREATE TABLE IF NOT EXISTS stock_items (
      id TEXT PRIMARY KEY,
      masterOrderNo TEXT NOT NULL,
      subOrderNo TEXT NOT NULL,
      trackingNo TEXT,
      clientCode TEXT NOT NULL,
      clientName TEXT NOT NULL,
      pieces INTEGER NOT NULL,
      weight REAL NOT NULL,
      volume REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK(status IN ('IN_STOCK','ALLOCATED','PACKED','SHIPPED','RETURNED')),
      warehouseLocation TEXT,
      warehouse TEXT DEFAULT 'CN',
      location TEXT,
      inboundTime TEXT NOT NULL,
      shippingUnitId TEXT REFERENCES shipping_units(id) ON DELETE SET NULL,
      transportType TEXT CHECK(transportType IN ('SEA','AIR')),
      route TEXT,
      destination TEXT,
      productName TEXT,
      salesPerson TEXT,
      returnReason TEXT,
      returnTime TEXT,
      remark TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_si_sub ON stock_items(subOrderNo);
    CREATE INDEX IF NOT EXISTS idx_si_status ON stock_items(status);
    CREATE INDEX IF NOT EXISTS idx_si_warehouse ON stock_items(warehouse);

    -- 11. transfer_orders
    CREATE TABLE IF NOT EXISTS transfer_orders (
      id TEXT PRIMARY KEY,
      transferNo TEXT UNIQUE NOT NULL,
      fromWarehouse TEXT NOT NULL,
      toWarehouse TEXT NOT NULL,
      businessLine TEXT CHECK(businessLine IN ('SEA','AIR')),
      transferType TEXT DEFAULT 'ORIGIN' CHECK(transferType IN ('ORIGIN','DESTINATION')),
      itemType TEXT DEFAULT 'ORDER' CHECK(itemType IN ('ORDER','CONTAINER')),
      containerNo TEXT,
      totalPieces INTEGER NOT NULL DEFAULT 0,
      totalWeight REAL NOT NULL DEFAULT 0,
      totalVolume REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PACKED','SHIPPED','IN_TRANSIT','ARRIVED','RECEIVED','CANCELLED')),
      reason TEXT,
      remark TEXT,
      createdBy TEXT REFERENCES users(id),
      outboundAt TEXT,
      inboundAt TEXT,
      expectedArrival TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_to_status ON transfer_orders(status);

    -- 12. transfer_items
    CREATE TABLE IF NOT EXISTS transfer_items (
      id TEXT PRIMARY KEY,
      transferOrderId TEXT NOT NULL REFERENCES transfer_orders(id) ON DELETE CASCADE,
      subOrderNo TEXT,
      trackingNo TEXT,
      goodsName TEXT,
      pieces INTEGER NOT NULL,
      weight REAL NOT NULL,
      volume REAL DEFAULT 0,
      remark TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ti_transfer ON transfer_items(transferOrderId);

    -- 13. return_records
    CREATE TABLE IF NOT EXISTS return_records (
      id TEXT PRIMARY KEY,
      returnNo TEXT UNIQUE NOT NULL,
      orderNo TEXT,
      trackingNo TEXT,
      businessLine TEXT CHECK(businessLine IN ('SEA','AIR')),
      warehouse TEXT,
      warehouseId TEXT,
      route TEXT,
      serviceType TEXT,
      salesPerson TEXT,
      customerName TEXT NOT NULL,
      returnType TEXT NOT NULL,
      returnStage TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','RETURNING','RETURNED')),
      reason TEXT NOT NULL,
      pieces INTEGER NOT NULL,
      weight REAL NOT NULL,
      volume REAL DEFAULT 0,
      applicant TEXT NOT NULL,
      applyTime TEXT NOT NULL,
      approver TEXT,
      approveTime TEXT,
      currentLocation TEXT,
      estimatedArrival TEXT,
      photos TEXT,
      remark TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rr_status ON return_records(status);

    -- 14. delivery_orders
    CREATE TABLE IF NOT EXISTS delivery_orders (
      id TEXT PRIMARY KEY,
      dpnNo TEXT UNIQUE NOT NULL,
      recipientName TEXT NOT NULL,
      recipientPhone TEXT NOT NULL,
      recipientAddress TEXT NOT NULL,
      city TEXT,
      country TEXT,
      deliveryMethod TEXT CHECK(deliveryMethod IN ('SELF_PICKUP','DELIVERY','SATELLITE_STATION')),
      driverId TEXT,
      driverName TEXT,
      driverPhone TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','IN_TRANSIT','DELIVERED','SIGNED')),
      totalPieces INTEGER NOT NULL DEFAULT 0,
      totalWeight REAL NOT NULL DEFAULT 0,
      deliveryFee REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      phoneNotified INTEGER DEFAULT 0,
      smsNotified INTEGER DEFAULT 0,
      paymentStatus TEXT DEFAULT 'UNPAID' CHECK(paymentStatus IN ('PAID','UNPAID')),
      photos TEXT,
      remark TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      acceptedAt TEXT,
      deliveredAt TEXT,
      signedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_do_status ON delivery_orders(status);

    -- 15. delivery_order_items
    CREATE TABLE IF NOT EXISTS delivery_order_items (
      id TEXT PRIMARY KEY,
      deliveryOrderId TEXT NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
      subOrderId TEXT NOT NULL REFERENCES sub_orders(id),
      subOrderNo TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_doi_delivery ON delivery_order_items(deliveryOrderId);

    -- 16. fee_records
    CREATE TABLE IF NOT EXISTS fee_records (
      id TEXT PRIMARY KEY,
      feeNo TEXT UNIQUE NOT NULL,
      relatedType TEXT NOT NULL CHECK(relatedType IN ('ORDER','JOB','UNIT','TRANSFER','DPN')),
      relatedId TEXT NOT NULL,
      relatedNo TEXT NOT NULL,
      feeType TEXT NOT NULL,
      feeDirection TEXT NOT NULL CHECK(feeDirection IN ('PAYABLE','RECEIVABLE')),
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CNY' CHECK(currency IN ('CNY','USD','NGN','EUR','GBP','GHS')),
      exchangeRate REAL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED')),
      supplierId TEXT,
      supplierName TEXT,
      customerId TEXT,
      customerName TEXT,
      approver TEXT,
      approvedAt TEXT,
      rejectReason TEXT,
      paidAt TEXT,
      paymentMethod TEXT,
      paymentChannel TEXT,
      paymentAccount TEXT,
      paymentVoucher TEXT,
      paymentOperator TEXT,
      description TEXT,
      remark TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fr_status ON fee_records(status);
    CREATE INDEX IF NOT EXISTS idx_fr_related ON fee_records(relatedType, relatedId);
    CREATE INDEX IF NOT EXISTS idx_fr_direction ON fee_records(feeDirection);

    -- 17. suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      nameEn TEXT,
      type TEXT NOT NULL,
      country TEXT,
      city TEXT,
      address TEXT,
      contactPerson TEXT,
      phone TEXT,
      email TEXT,
      bankAccount TEXT,
      bankName TEXT,
      taxId TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      remark TEXT,
      createdAt TEXT NOT NULL
    );

    -- 18. payment_records
    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      paymentNo TEXT UNIQUE NOT NULL,
      feeIds TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      currency TEXT NOT NULL,
      paymentMethod TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED')),
      payerName TEXT,
      payeeName TEXT,
      bankAccount TEXT,
      transactionNo TEXT,
      paymentDate TEXT,
      remark TEXT,
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    -- 19. logistics_records
    CREATE TABLE IF NOT EXISTS logistics_records (
      id TEXT PRIMARY KEY,
      subOrderId TEXT NOT NULL REFERENCES sub_orders(id) ON DELETE CASCADE,
      step TEXT NOT NULL,
      status TEXT NOT NULL,
      operator TEXT,
      timestamp TEXT NOT NULL,
      location TEXT,
      remark TEXT,
      photos TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lr_sub ON logistics_records(subOrderId);
    CREATE INDEX IF NOT EXISTS idx_lr_time ON logistics_records(timestamp);

    -- 20. notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      warehouse TEXT NOT NULL CHECK(warehouse IN ('CN','US','SALES')),
      userId TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      urgent INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(userId);
    CREATE INDEX IF NOT EXISTS idx_notif_warehouse ON notifications(warehouse);

    -- 21. todo_items
    CREATE TABLE IF NOT EXISTS todo_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('HIGH','MEDIUM','LOW')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IN_PROGRESS','COMPLETED')),
      dueDate TEXT,
      relatedType TEXT,
      relatedId TEXT,
      assigneeId TEXT REFERENCES users(id),
      createdBy TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      completedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_todo_assignee ON todo_items(assigneeId);
    CREATE INDEX IF NOT EXISTS idx_todo_status ON todo_items(status);

    -- 22. alert_items
    CREATE TABLE IF NOT EXISTS alert_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('HIGH','MEDIUM','LOW')),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','RESOLVED','IGNORED')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      relatedType TEXT,
      relatedId TEXT,
      triggerTime TEXT NOT NULL,
      resolvedTime TEXT,
      resolvedBy TEXT,
      remark TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_alert_status ON alert_items(status);
    CREATE INDEX IF NOT EXISTS idx_alert_level ON alert_items(level);

    -- 23. routes_config
    CREATE TABLE IF NOT EXISTS routes_config (
      id TEXT PRIMARY KEY,
      originCountry TEXT NOT NULL,
      originCity TEXT NOT NULL,
      destCountry TEXT NOT NULL,
      destCity TEXT NOT NULL,
      transportType TEXT NOT NULL CHECK(transportType IN ('SEA','AIR')),
      transitDays TEXT,
      pricePerKg REAL,
      pricePerCbm REAL,
      freightDiscount REAL,
      volumeRatio REAL,
      firstWeightValue REAL,
      firstWeightCOD_USD REAL,
      firstWeightPrepaid_RMB REAL,
      arrivalStation TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );

    -- 24. route_logistics_nodes
    CREATE TABLE IF NOT EXISTS route_logistics_nodes (
      id TEXT PRIMARY KEY,
      routeId TEXT NOT NULL REFERENCES routes_config(id) ON DELETE CASCADE,
      nodeCode TEXT NOT NULL,
      nodeName TEXT NOT NULL,
      nodeNameEn TEXT,
      nodeType TEXT NOT NULL CHECK(nodeType IN (
        'PICKUP','WAREHOUSE_IN','CUSTOMS_EXPORT','DEPARTURE','IN_TRANSIT',
        'ARRIVAL','CUSTOMS_IMPORT','WAREHOUSE_OUT','DELIVERY','SIGNED'
      )),
      sortOrder INTEGER NOT NULL DEFAULT 1,
      isRequired INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(routeId, nodeCode)
    );
    CREATE INDEX IF NOT EXISTS idx_rln_route ON route_logistics_nodes(routeId, sortOrder);
    CREATE INDEX IF NOT EXISTS idx_rln_status ON route_logistics_nodes(status);

    -- 25. exchange_currencies
    CREATE TABLE IF NOT EXISTS exchange_currencies (
      id TEXT PRIMARY KEY,
      currencyCode TEXT UNIQUE NOT NULL,
      currencyName TEXT NOT NULL,
      currencyNameEn TEXT,
      symbol TEXT,
      manualRate REAL,
      liveRate REAL,
      rateDate TEXT,
      remark TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ec_code ON exchange_currencies(currencyCode);
    CREATE INDEX IF NOT EXISTS idx_ec_status ON exchange_currencies(status);

    -- 26. exchange_rate_history
    CREATE TABLE IF NOT EXISTS exchange_rate_history (
      id TEXT PRIMARY KEY,
      currencyCode TEXT NOT NULL,
      rate REAL NOT NULL,
      rateType TEXT NOT NULL DEFAULT 'MANUAL' CHECK(rateType IN ('MANUAL','LIVE')),
      recordDate TEXT NOT NULL,
      operator TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_erh_code_date ON exchange_rate_history(currencyCode, recordDate DESC);

    -- 27. freight_rate_rules
    CREATE TABLE IF NOT EXISTS freight_rate_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transportMode TEXT NOT NULL CHECK(transportMode IN ('AIR','SEA_LCL')),
      volumetricDivisor REAL,
      firstWeightPrice REAL,
      continuationTiers TEXT,
      surchargeRates TEXT,
      packagingSurchargePerKg REAL,
      volumeWeightRatio REAL,
      unitPricePerCBM REAL,
      currency TEXT NOT NULL DEFAULT 'CNY',
      unitPrice REAL NOT NULL DEFAULT 0,
      unitType TEXT NOT NULL DEFAULT '/kg',
      minCharge REAL,
      remark TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_frr_mode ON freight_rate_rules(transportMode);
    CREATE INDEX IF NOT EXISTS idx_frr_status ON freight_rate_rules(status);

    -- 28. countries
    CREATE TABLE IF NOT EXISTS countries (
      id TEXT PRIMARY KEY,
      countryCode TEXT UNIQUE NOT NULL,
      countryName TEXT NOT NULL,
      countryNameEn TEXT,
      continent TEXT NOT NULL CHECK(continent IN (
        'ASIA','EUROPE','NORTH_AMERICA','SOUTH_AMERICA','AFRICA','OCEANIA'
      )),
      phoneCode TEXT,
      currencyCode TEXT,
      currencyName TEXT,
      currencySymbol TEXT,
      timezone TEXT,
      flagImage TEXT,
      countryImage TEXT,
      isOrigin INTEGER NOT NULL DEFAULT 0,
      isDestination INTEGER NOT NULL DEFAULT 0,
      requiresMaterial INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_country_code ON countries(countryCode);
    CREATE INDEX IF NOT EXISTS idx_country_status ON countries(status);

    -- 29. cities
    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      countryId TEXT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
      cityCode TEXT NOT NULL,
      cityName TEXT NOT NULL,
      cityNameEn TEXT,
      provinceState TEXT,
      isPort INTEGER NOT NULL DEFAULT 0,
      isAirport INTEGER NOT NULL DEFAULT 0,
      timezone TEXT,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(countryId, cityCode)
    );
    CREATE INDEX IF NOT EXISTS idx_city_country ON cities(countryId);
    CREATE INDEX IF NOT EXISTS idx_city_name ON cities(cityName);

    -- 30. sites (站点组织)
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      countryId TEXT NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
      cityId TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
      siteCode TEXT NOT NULL,
      siteName TEXT NOT NULL,
      siteNameEn TEXT,
      district TEXT,
      siteType TEXT NOT NULL DEFAULT 'DISPATCH_CENTER' CHECK(siteType IN ('HQ','DISPATCH_CENTER','SATELLITE')),
      address TEXT,
      contactName TEXT,
      contactPhone TEXT,
      businessHours TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(cityId, siteCode)
    );
    CREATE INDEX IF NOT EXISTS idx_site_country ON sites(countryId);
    CREATE INDEX IF NOT EXISTS idx_site_city ON sites(cityId);
    CREATE INDEX IF NOT EXISTS idx_site_status ON sites(status);

    -- 31. site_bindings (站点捆绑关系)
    CREATE TABLE IF NOT EXISTS site_bindings (
      id TEXT PRIMARY KEY,
      siteId TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      boundSiteId TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      bindingType TEXT NOT NULL DEFAULT 'PEER' CHECK(bindingType IN ('DOMESTIC','INTERNATIONAL','PEER')),
      createdAt TEXT NOT NULL,
      UNIQUE(siteId, boundSiteId, bindingType)
    );
    CREATE INDEX IF NOT EXISTS idx_site_binding_site ON site_bindings(siteId);
    CREATE INDEX IF NOT EXISTS idx_site_binding_bound ON site_bindings(boundSiteId);

    -- 32. workflow_configs
    CREATE TABLE IF NOT EXISTS workflow_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      businessType TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('ACTIVE','INACTIVE','DRAFT')),
      nodes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wf_business_type ON workflow_configs(businessType);
    CREATE INDEX IF NOT EXISTS idx_wf_status ON workflow_configs(status);

    -- 33. no_order_express
    CREATE TABLE IF NOT EXISTS no_order_express (
      id TEXT PRIMARY KEY,
      trackingNo TEXT UNIQUE NOT NULL,
      company TEXT NOT NULL,
      companyName TEXT NOT NULL,
      pieces INTEGER NOT NULL,
      weight REAL,
      signTime TEXT NOT NULL,
      signOperator TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','MATCHED','RETURNED')),
      matchedOrderNo TEXT,
      matchedCustomer TEXT,
      matchedTime TEXT,
      storageLocation TEXT,
      remark TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_noe_status ON no_order_express(status);

    -- 34. warehouses
    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      nameEn TEXT,
      type TEXT NOT NULL CHECK(type IN ('ORIGIN','DESTINATION','TRANSIT')),
      country TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT,
      managerId TEXT,
      managerName TEXT,
      managerPhone TEXT,
      capacity INTEGER,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_wh_type ON warehouses(type);
    CREATE INDEX IF NOT EXISTS idx_wh_status ON warehouses(status);

    -- 35. user_warehouses
    CREATE TABLE IF NOT EXISTS user_warehouses (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      warehouseId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(userId, warehouseId)
    );
    CREATE INDEX IF NOT EXISTS idx_uw_user ON user_warehouses(userId);
    CREATE INDEX IF NOT EXISTS idx_uw_warehouse ON user_warehouses(warehouseId);

    -- 36. user_sites
    CREATE TABLE IF NOT EXISTS user_sites (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      siteId TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL,
      UNIQUE(userId, siteId)
    );
    CREATE INDEX IF NOT EXISTS idx_us_user ON user_sites(userId);
    CREATE INDEX IF NOT EXISTS idx_us_site ON user_sites(siteId);

    -- 37. departments
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      deptCode TEXT UNIQUE NOT NULL,
      deptName TEXT UNIQUE NOT NULL,
      parentId TEXT REFERENCES departments(id) ON DELETE SET NULL,
      managerUserId TEXT REFERENCES users(id) ON DELETE SET NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments(parentId);
    CREATE INDEX IF NOT EXISTS idx_departments_status ON departments(status);

    -- 38. base_data_items（基础设置统一字典）
    CREATE TABLE IF NOT EXISTS base_data_items (
      id TEXT PRIMARY KEY,
      dataType TEXT NOT NULL,
      dataCode TEXT NOT NULL,
      dataName TEXT NOT NULL,
      dataNameEn TEXT,
      transportMode TEXT NOT NULL DEFAULT 'ALL' CHECK(transportMode IN ('ALL','SEA','AIR')),
      sortOrder INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      extra TEXT,
      remark TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(dataType, dataCode)
    );
    CREATE INDEX IF NOT EXISTS idx_bdi_type ON base_data_items(dataType, status);
    CREATE INDEX IF NOT EXISTS idx_bdi_sort ON base_data_items(dataType, sortOrder, dataCode);

    -- 39. sys_roles
    CREATE TABLE IF NOT EXISTS sys_roles (
      id TEXT PRIMARY KEY,
      roleCode TEXT UNIQUE NOT NULL,
      roleName TEXT NOT NULL,
      description TEXT,
      siteScope TEXT NOT NULL DEFAULT 'ASSIGNED_SITE' CHECK(siteScope IN ('ALL_SITE','ASSIGNED_SITE','OWN_SITE')),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      isSystem INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sys_roles_code ON sys_roles(roleCode);
    CREATE INDEX IF NOT EXISTS idx_sys_roles_status ON sys_roles(status);

    -- 40. sys_permissions
    CREATE TABLE IF NOT EXISTS sys_permissions (
      id TEXT PRIMARY KEY,
      permissionCode TEXT UNIQUE NOT NULL,
      permissionName TEXT NOT NULL,
      moduleKey TEXT,
      permissionType TEXT NOT NULL DEFAULT 'MENU' CHECK(permissionType IN ('MENU','TAB','BUTTON','API')),
      path TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sys_perm_code ON sys_permissions(permissionCode);
    CREATE INDEX IF NOT EXISTS idx_sys_perm_module ON sys_permissions(moduleKey);

    -- 41. sys_role_permissions
    CREATE TABLE IF NOT EXISTS sys_role_permissions (
      id TEXT PRIMARY KEY,
      roleId TEXT NOT NULL REFERENCES sys_roles(id) ON DELETE CASCADE,
      permissionId TEXT NOT NULL REFERENCES sys_permissions(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL,
      UNIQUE(roleId, permissionId)
    );
    CREATE INDEX IF NOT EXISTS idx_sys_rp_role ON sys_role_permissions(roleId);
    CREATE INDEX IF NOT EXISTS idx_sys_rp_perm ON sys_role_permissions(permissionId);

    -- 42. sys_user_roles
    CREATE TABLE IF NOT EXISTS sys_user_roles (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      roleId TEXT NOT NULL REFERENCES sys_roles(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL,
      UNIQUE(userId, roleId)
    );
    CREATE INDEX IF NOT EXISTS idx_sys_ur_user ON sys_user_roles(userId);
    CREATE INDEX IF NOT EXISTS idx_sys_ur_role ON sys_user_roles(roleId);
  `);

  // Migration: add return-related columns to master_orders
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnType TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnReason TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnRefundAmount REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnRefundMethod TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN needReturn INTEGER DEFAULT 0'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnShippingNote TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnAppliedBy TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnAppliedAt TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN previousStatus TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnApprover TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnApprovedAt TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN returnRejectReason TEXT'); } catch (_) { /* already exists */ }

  // Migration: add warehouseId columns to existing tables
  try { db.exec('ALTER TABLE inbound_records ADD COLUMN warehouseId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE inbound_records ADD COLUMN jobNo TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE inbound_records ADD COLUMN transferNo TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE stock_items ADD COLUMN warehouseId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE stock_items ADD COLUMN returnReason TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE stock_items ADD COLUMN returnTime TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE shipping_units ADD COLUMN warehouseId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE shipping_units ADD COLUMN route TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE transfer_orders ADD COLUMN fromWarehouseId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE transfer_orders ADD COLUMN toWarehouseId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE transfer_orders ADD COLUMN businessLine TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_to_business_line ON transfer_orders(businessLine)'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE return_records ADD COLUMN businessLine TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE return_records ADD COLUMN warehouse TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE return_records ADD COLUMN warehouseId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE return_records ADD COLUMN route TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE return_records ADD COLUMN serviceType TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE return_records ADD COLUMN salesPerson TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_rr_business_line ON return_records(businessLine)'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE notifications ADD COLUMN warehouseId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE notifications ADD COLUMN relatedId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE notifications ADD COLUMN relatedType TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE delivery_orders ADD COLUMN warehouseId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE users ADD COLUMN departmentId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(departmentId)'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE warehouses ADD COLUMN siteId TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_wh_site ON warehouses(siteId)'); } catch (_) { /* already exists */ }
  migrateDeliveryOrdersAddCancelledStatus(db);
  migrateFeeRecordsAddUnitRelatedType(db);
  migrateFeeRecordsAddDpnRelatedType(db);
  try { db.exec('ALTER TABLE fee_records ADD COLUMN paymentMethod TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE fee_records ADD COLUMN paymentChannel TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE fee_records ADD COLUMN paymentAccount TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE fee_records ADD COLUMN paymentVoucher TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE fee_records ADD COLUMN paymentOperator TEXT'); } catch (_) { /* already exists */ }

  // Migration: 系统改造 - 添加空运/海运业务区分字段
  // master_orders 新增字段
  try { db.exec('ALTER TABLE master_orders ADD COLUMN warehouseEntryNo TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN containerType TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN invoiceInfo TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN routeCode TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN paymentMethod TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN paymentChannel TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN paymentTime TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN inboundDate TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN currency TEXT DEFAULT \'CNY\''); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE master_orders ADD COLUMN serviceType TEXT'); } catch (_) { /* already exists */ }

  // sub_orders 新增字段
  try { db.exec('ALTER TABLE sub_orders ADD COLUMN chargeableWeight REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE sub_orders ADD COLUMN volumeCbm REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE sub_orders ADD COLUMN cargoType TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE sub_orders ADD COLUMN serviceType TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE sub_orders ADD COLUMN containerNo TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE sub_orders ADD COLUMN dimensions TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE sub_orders ADD COLUMN volumeWeight REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE sub_orders ADD COLUMN actualWeight REAL'); } catch (_) { /* already exists */ }

  // inbound_records 新增尺寸字段
  try { db.exec('ALTER TABLE inbound_records ADD COLUMN length REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE inbound_records ADD COLUMN width REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE inbound_records ADD COLUMN height REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE inbound_records ADD COLUMN dpnNo TEXT'); } catch (_) { /* already exists */ }

  // Migration: routes_config 增加页面所需字段
  try { db.exec('ALTER TABLE routes_config ADD COLUMN freightDiscount REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE routes_config ADD COLUMN volumeRatio REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE routes_config ADD COLUMN firstWeightValue REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE routes_config ADD COLUMN firstWeightCOD_USD REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE routes_config ADD COLUMN firstWeightPrepaid_RMB REAL'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE routes_config ADD COLUMN arrivalStation TEXT'); } catch (_) { /* already exists */ }
  try { db.exec('ALTER TABLE routes_config ADD COLUMN updatedAt TEXT'); } catch (_) { /* already exists */ }
  db.exec(`
    UPDATE routes_config
    SET
      freightDiscount = COALESCE(freightDiscount, 100),
      volumeRatio = COALESCE(volumeRatio, CASE WHEN transportType = 'AIR' THEN 6000 ELSE 700 END),
      firstWeightValue = COALESCE(firstWeightValue, 1),
      firstWeightCOD_USD = COALESCE(firstWeightCOD_USD, pricePerKg),
      firstWeightPrepaid_RMB = COALESCE(firstWeightPrepaid_RMB, pricePerCbm),
      arrivalStation = COALESCE(arrivalStation, destCity),
      updatedAt = COALESCE(updatedAt, createdAt)
  `);

  // Init: exchange currency defaults (if empty)
  const exchangeCountRow = db.prepare('SELECT COUNT(*) as c FROM exchange_currencies').get() as any;
  if (Number(exchangeCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const defaults = [
      { id: 'CUR-USD', currencyCode: 'USD', currencyName: '美元', currencyNameEn: 'US Dollar', symbol: '$', manualRate: 7.1429 },
      { id: 'CUR-EUR', currencyCode: 'EUR', currencyName: '欧元', currencyNameEn: 'Euro', symbol: '€', manualRate: 7.6923 },
      { id: 'CUR-GBP', currencyCode: 'GBP', currencyName: '英镑', currencyNameEn: 'British Pound', symbol: '£', manualRate: 9.0909 },
      { id: 'CUR-NGN', currencyCode: 'NGN', currencyName: '尼日利亚奈拉', currencyNameEn: 'Nigerian Naira', symbol: '₦', manualRate: 0.0047 },
      { id: 'CUR-GHS', currencyCode: 'GHS', currencyName: '加纳塞地', currencyNameEn: 'Ghanaian Cedi', symbol: '₵', manualRate: 0.5814 },
    ];

    const insertCurrency = db.prepare(`
      INSERT INTO exchange_currencies
      (id, currencyCode, currencyName, currencyNameEn, symbol, manualRate, liveRate, rateDate, remark, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
    `);
    const insertHistory = db.prepare(`
      INSERT INTO exchange_rate_history
      (id, currencyCode, rate, rateType, recordDate, operator, createdAt)
      VALUES (?, ?, ?, 'MANUAL', ?, 'SYSTEM', ?)
    `);

    const tx = db.transaction(() => {
      for (const item of defaults) {
        insertCurrency.run(
          item.id,
          item.currencyCode,
          item.currencyName,
          item.currencyNameEn,
          item.symbol,
          item.manualRate,
          item.manualRate,
          now.slice(0, 10),
          null,
          now,
          now
        );
        insertHistory.run(`ERH-${item.currencyCode}-${Date.now()}-${Math.floor(Math.random() * 1000)}`, item.currencyCode, item.manualRate, now.slice(0, 10), now);
      }
    });
    tx();
  }

  // Init: freight rate rule defaults (if empty)
  const freightCountRow = db.prepare('SELECT COUNT(*) as c FROM freight_rate_rules').get() as any;
  if (Number(freightCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const insertRule = db.prepare(`
      INSERT INTO freight_rate_rules
      (id, name, transportMode, volumetricDivisor, firstWeightPrice, continuationTiers, surchargeRates, packagingSurchargePerKg,
       volumeWeightRatio, unitPricePerCBM, currency, unitPrice, unitType, minCharge, remark, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaults = [
      {
        id: 'FRR-001',
        name: '中国→美国 航空标准运费',
        transportMode: 'AIR',
        volumetricDivisor: 6000,
        firstWeightPrice: 63,
        continuationTiers: JSON.stringify([
          { minWeight: 1, maxWeight: 5, unitPrice: 60 },
          { minWeight: 5, maxWeight: 20, unitPrice: 57 },
          { minWeight: 20, maxWeight: null, unitPrice: 55 },
        ]),
        surchargeRates: JSON.stringify({
          SENSITIVE: 0.1,
          STRONG_MAGNETIC: 0.2,
          WEAK_MAGNETIC: 0.12,
          FOOD: 0.15,
          LIQUID: 0.6,
          POWDER: 0.6,
          BATTERY: 0.3,
          BRAND: 0.1
        }),
        packagingSurchargePerKg: 2,
        volumeWeightRatio: null,
        unitPricePerCBM: null,
        currency: 'CNY',
        unitPrice: 63,
        unitType: '/kg',
        minCharge: 150,
        remark: '首重63元/kg，续重阶梯60/57/55元',
        status: 'ACTIVE',
      },
      {
        id: 'FRR-002',
        name: '中国→美国 海运拼箱标准运费',
        transportMode: 'SEA_LCL',
        volumetricDivisor: null,
        firstWeightPrice: null,
        continuationTiers: null,
        surchargeRates: null,
        packagingSurchargePerKg: null,
        volumeWeightRatio: 700,
        unitPricePerCBM: 1800,
        currency: 'CNY',
        unitPrice: 1800,
        unitType: '/CBM',
        minCharge: 500,
        remark: '海运拼箱，1CBM=700kg',
        status: 'ACTIVE',
      }
    ];

    const tx = db.transaction(() => {
      for (const row of defaults) {
        insertRule.run(
          row.id, row.name, row.transportMode, row.volumetricDivisor, row.firstWeightPrice,
          row.continuationTiers, row.surchargeRates, row.packagingSurchargePerKg,
          row.volumeWeightRatio, row.unitPricePerCBM, row.currency, row.unitPrice, row.unitType,
          row.minCharge, row.remark, row.status, now, now
        );
      }
    });
    tx();
  }

  // Init: base data defaults (if empty)
  const baseDataCountRow = db.prepare('SELECT COUNT(*) as c FROM base_data_items').get() as any;
  if (Number(baseDataCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const insertBaseData = db.prepare(`
      INSERT INTO base_data_items
      (id, dataType, dataCode, dataName, dataNameEn, transportMode, sortOrder, status, isBuiltin, extra, remark, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `);

    type SeedRow = {
      id: string;
      dataType: string;
      dataCode: string;
      dataName: string;
      dataNameEn?: string;
      transportMode?: 'ALL' | 'SEA' | 'AIR';
      sortOrder: number;
      extra?: Record<string, any>;
      remark?: string;
    };

    const defaults: SeedRow[] = [
      { id: 'BDI-SVC-SEA-LCL', dataType: 'ORDER_SERVICE_TYPE', dataCode: 'LCL_SEA', dataName: '拼柜（海运）', dataNameEn: 'LCL Sea', transportMode: 'SEA', sortOrder: 10 },
      { id: 'BDI-SVC-SEA-FCL', dataType: 'ORDER_SERVICE_TYPE', dataCode: 'FCL_SEA', dataName: '整柜（海运）', dataNameEn: 'FCL Sea', transportMode: 'SEA', sortOrder: 20 },
      { id: 'BDI-SVC-AIR-STD', dataType: 'ORDER_SERVICE_TYPE', dataCode: 'STANDARD_AIR', dataName: '普快（空运）', dataNameEn: 'Standard Air', transportMode: 'AIR', sortOrder: 30 },
      { id: 'BDI-SVC-AIR-EXP', dataType: 'ORDER_SERVICE_TYPE', dataCode: 'EXPRESS_AIR', dataName: '特快（空运）', dataNameEn: 'Express Air', transportMode: 'AIR', sortOrder: 40 },
      { id: 'BDI-PM-PREPAID', dataType: 'PAYMENT_METHOD', dataCode: 'PREPAID', dataName: '预付', dataNameEn: 'Prepaid', sortOrder: 10 },
      { id: 'BDI-PM-COD', dataType: 'PAYMENT_METHOD', dataCode: 'COD', dataName: '到付', dataNameEn: 'Cash on Delivery', sortOrder: 20 },
      { id: 'BDI-PM-CARD', dataType: 'PAYMENT_METHOD', dataCode: 'CREDIT_CARD', dataName: '信用卡', dataNameEn: 'Credit Card', sortOrder: 30 },
      { id: 'BDI-PC-WECHAT', dataType: 'PAYMENT_CHANNEL', dataCode: 'WECHAT', dataName: '微信', dataNameEn: 'WeChat', sortOrder: 10 },
      { id: 'BDI-PC-BANK', dataType: 'PAYMENT_CHANNEL', dataCode: 'BANK', dataName: '公账', dataNameEn: 'Bank Transfer', sortOrder: 20 },
      { id: 'BDI-PC-CASH', dataType: 'PAYMENT_CHANNEL', dataCode: 'CASH', dataName: '现金', dataNameEn: 'Cash', sortOrder: 30 },
      { id: 'BDI-CT-LCL', dataType: 'CONTAINER_TYPE', dataCode: 'LCL', dataName: '拼柜 LCL', dataNameEn: 'LCL', transportMode: 'SEA', sortOrder: 10 },
      { id: 'BDI-CT-20GP', dataType: 'CONTAINER_TYPE', dataCode: '20GP', dataName: '20GP', dataNameEn: '20GP', transportMode: 'SEA', sortOrder: 20 },
      { id: 'BDI-CT-40GP', dataType: 'CONTAINER_TYPE', dataCode: '40GP', dataName: '40GP', dataNameEn: '40GP', transportMode: 'SEA', sortOrder: 30 },
      { id: 'BDI-CT-40HQ', dataType: 'CONTAINER_TYPE', dataCode: '40HQ', dataName: '40HQ', dataNameEn: '40HQ', transportMode: 'SEA', sortOrder: 40 },
      { id: 'BDI-EXP-SF', dataType: 'EXPRESS_COMPANY', dataCode: 'SF', dataName: '顺丰', dataNameEn: 'SF Express', sortOrder: 10 },
      { id: 'BDI-EXP-YD', dataType: 'EXPRESS_COMPANY', dataCode: 'YUNDA', dataName: '韵达', dataNameEn: 'Yunda', sortOrder: 20 },
      { id: 'BDI-EXP-YTO', dataType: 'EXPRESS_COMPANY', dataCode: 'YTO', dataName: '圆通', dataNameEn: 'YTO Express', sortOrder: 30 },
      { id: 'BDI-EXP-ZTO', dataType: 'EXPRESS_COMPANY', dataCode: 'ZTO', dataName: '中通', dataNameEn: 'ZTO Express', sortOrder: 40 },
      { id: 'BDI-EXP-STO', dataType: 'EXPRESS_COMPANY', dataCode: 'STO', dataName: '申通', dataNameEn: 'STO Express', sortOrder: 50 },
      { id: 'BDI-EXP-EMS', dataType: 'EXPRESS_COMPANY', dataCode: 'EMS', dataName: 'EMS', dataNameEn: 'EMS', sortOrder: 60 },
      { id: 'BDI-EXP-JT', dataType: 'EXPRESS_COMPANY', dataCode: 'JNT', dataName: '极兔', dataNameEn: 'J&T Express', sortOrder: 70 },
      { id: 'BDI-EXP-JD', dataType: 'EXPRESS_COMPANY', dataCode: 'JD', dataName: '京东', dataNameEn: 'JD Logistics', sortOrder: 80 },
      { id: 'BDI-EXP-DB', dataType: 'EXPRESS_COMPANY', dataCode: 'DEPPON', dataName: '德邦', dataNameEn: 'Deppon', sortOrder: 90 },
      { id: 'BDI-CAR-MSK', dataType: 'CARRIER', dataCode: 'MSK', dataName: '马士基', dataNameEn: 'Maersk', transportMode: 'SEA', sortOrder: 10 },
      { id: 'BDI-CAR-COSCO', dataType: 'CARRIER', dataCode: 'COSCO', dataName: '中远海运', dataNameEn: 'COSCO', transportMode: 'SEA', sortOrder: 20 },
      { id: 'BDI-CAR-ET', dataType: 'CARRIER', dataCode: 'ET', dataName: '埃塞俄比亚航空', dataNameEn: 'Ethiopian Airlines', transportMode: 'AIR', sortOrder: 30 },
      { id: 'BDI-CAR-CZ', dataType: 'CARRIER', dataCode: 'CZ', dataName: '中国南方航空', dataNameEn: 'China Southern', transportMode: 'AIR', sortOrder: 40 },
      { id: 'BDI-CAT-ELEC', dataType: 'CARGO_CATEGORY', dataCode: 'ELECTRONICS', dataName: '电子产品', dataNameEn: 'Electronics', sortOrder: 10 },
      { id: 'BDI-CAT-APPAREL', dataType: 'CARGO_CATEGORY', dataCode: 'APPAREL', dataName: '服装鞋帽', dataNameEn: 'Apparel', sortOrder: 20 },
      { id: 'BDI-CAT-FOOD', dataType: 'CARGO_CATEGORY', dataCode: 'FOOD', dataName: '食品', dataNameEn: 'Food', sortOrder: 30 },
      { id: 'BDI-CAT-DAILY', dataType: 'CARGO_CATEGORY', dataCode: 'DAILY_USE', dataName: '日用品', dataNameEn: 'Daily Use', sortOrder: 40 },
      { id: 'BDI-CAT-BEAUTY', dataType: 'CARGO_CATEGORY', dataCode: 'BEAUTY', dataName: '美妆个护', dataNameEn: 'Beauty', sortOrder: 50 },
      { id: 'BDI-CAT-MACHINE', dataType: 'CARGO_CATEGORY', dataCode: 'MACHINE_PARTS', dataName: '机械配件', dataNameEn: 'Machine Parts', sortOrder: 60 },
      { id: 'BDI-CAT-OTHER', dataType: 'CARGO_CATEGORY', dataCode: 'OTHER', dataName: '其他', dataNameEn: 'Other', sortOrder: 70 },
      { id: 'BDI-TYPE-GENERAL', dataType: 'CARGO_TYPE', dataCode: 'GENERAL', dataName: '普货', dataNameEn: 'General', sortOrder: 10 },
      { id: 'BDI-TYPE-SENSITIVE', dataType: 'CARGO_TYPE', dataCode: 'SENSITIVE', dataName: '敏感货', dataNameEn: 'Sensitive', sortOrder: 20 },
      { id: 'BDI-TYPE-BATTERY', dataType: 'CARGO_TYPE', dataCode: 'BATTERY', dataName: '带电', dataNameEn: 'Battery', sortOrder: 30 },
      { id: 'BDI-TYPE-LIQUID', dataType: 'CARGO_TYPE', dataCode: 'LIQUID', dataName: '液体', dataNameEn: 'Liquid', sortOrder: 40 },
      { id: 'BDI-TYPE-POWDER', dataType: 'CARGO_TYPE', dataCode: 'POWDER', dataName: '粉末', dataNameEn: 'Powder', sortOrder: 50 },
      { id: 'BDI-FEE-FREIGHT', dataType: 'FEE_TYPE', dataCode: 'FREIGHT', dataName: '运费', dataNameEn: 'Freight', sortOrder: 10 },
      { id: 'BDI-FEE-FIRST', dataType: 'FEE_TYPE', dataCode: 'FIRST_WEIGHT', dataName: '首重', dataNameEn: 'First Weight', sortOrder: 20 },
      { id: 'BDI-FEE-CONT', dataType: 'FEE_TYPE', dataCode: 'CONTINUATION_WEIGHT', dataName: '续重', dataNameEn: 'Continuation Weight', sortOrder: 30 },
      { id: 'BDI-FEE-CUSTOMS', dataType: 'FEE_TYPE', dataCode: 'CUSTOMS_IMPORT', dataName: '进口报关费', dataNameEn: 'Import Customs', sortOrder: 40 },
      { id: 'BDI-FEE-LASTMILE', dataType: 'FEE_TYPE', dataCode: 'LAST_MILE', dataName: '到门费用', dataNameEn: 'Last Mile', sortOrder: 50 },
      { id: 'BDI-FEE-DISCOUNT', dataType: 'FEE_TYPE', dataCode: 'FREIGHT_DISCOUNT', dataName: '运费折扣', dataNameEn: 'Freight Discount', sortOrder: 60 },
      { id: 'BDI-TAG-FRAGILE', dataType: 'ORDER_REMARK_TAG', dataCode: 'FRAGILE', dataName: '易碎品', dataNameEn: 'Fragile', sortOrder: 10 },
      { id: 'BDI-TAG-HIVALUE', dataType: 'ORDER_REMARK_TAG', dataCode: 'HIGH_VALUE', dataName: '高货值', dataNameEn: 'High Value', sortOrder: 20 },
      { id: 'BDI-TAG-REINF', dataType: 'ORDER_REMARK_TAG', dataCode: 'REINFORCE', dataName: '需加固', dataNameEn: 'Need Reinforcement', sortOrder: 30 },
      { id: 'BDI-TAG-PRIORITY', dataType: 'ORDER_REMARK_TAG', dataCode: 'PRIORITY', dataName: '优先处理', dataNameEn: 'Priority', sortOrder: 40 },
      { id: 'BDI-TAG-UPRIGHT', dataType: 'ORDER_REMARK_TAG', dataCode: 'KEEP_UPRIGHT', dataName: '禁止倒置', dataNameEn: 'Keep Upright', sortOrder: 50 },
    ];

    const tx = db.transaction(() => {
      for (const row of defaults) {
        insertBaseData.run(
          row.id,
          row.dataType,
          row.dataCode,
          row.dataName,
          row.dataNameEn || null,
          row.transportMode || 'ALL',
          row.sortOrder,
          'ACTIVE',
          row.extra ? JSON.stringify(row.extra) : null,
          row.remark || null,
          now,
          now
        );
      }
    });
    tx();
  }

  // Init: country/city defaults (if empty)
  const countryCountRow = db.prepare('SELECT COUNT(*) as c FROM countries').get() as any;
  if (Number(countryCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const insertCountry = db.prepare(`
      INSERT INTO countries
      (id, countryCode, countryName, countryNameEn, continent, phoneCode, currencyCode, currencyName, currencySymbol,
       timezone, flagImage, countryImage, isOrigin, isDestination, requiresMaterial, status, remark, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `);
    const insertCity = db.prepare(`
      INSERT INTO cities
      (id, countryId, cityCode, cityName, cityNameEn, provinceState, isPort, isAirport, timezone, latitude, longitude, status, remark, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      insertCountry.run(
        'COUNTRY-CN',
        'CN',
        '中国',
        'China',
        'ASIA',
        '+86',
        'CNY',
        '人民币',
        '¥',
        'UTC+8',
        null,
        null,
        1,
        0,
        0,
        '起运国默认配置',
        now,
        now
      );
      insertCountry.run(
        'COUNTRY-NG',
        'NGA',
        '尼日利亚',
        'Nigeria',
        'AFRICA',
        '+234',
        'NGN',
        '奈拉',
        '₦',
        'UTC+1',
        null,
        null,
        0,
        1,
        1,
        '到达国默认配置',
        now,
        now
      );
      insertCountry.run(
        'COUNTRY-GH',
        'GHA',
        '加纳',
        'Ghana',
        'AFRICA',
        '+233',
        'GHS',
        '塞地',
        '₵',
        'UTC+0',
        null,
        null,
        0,
        1,
        1,
        '到达国默认配置',
        now,
        now
      );

      insertCity.run('CITY-CAN', 'COUNTRY-CN', 'CAN', '广州', 'Guangzhou', '广东省', 1, 1, 'UTC+8', 23.1291, 113.2644, '起运港/机场', now, now);
      insertCity.run('CITY-SZX', 'COUNTRY-CN', 'SZX', '深圳', 'Shenzhen', '广东省', 1, 1, 'UTC+8', 22.5431, 114.0579, '起运港/机场', now, now);
      insertCity.run('CITY-SHA', 'COUNTRY-CN', 'SHA', '上海', 'Shanghai', '上海市', 1, 1, 'UTC+8', 31.2304, 121.4737, '起运港/机场', now, now);
      insertCity.run('CITY-LOS', 'COUNTRY-NG', 'LOS', '拉各斯', 'Lagos', null, 1, 1, 'UTC+1', 6.5244, 3.3792, '主要到达城市', now, now);
      insertCity.run('CITY-ABV', 'COUNTRY-NG', 'ABV', '阿布贾', 'Abuja', null, 0, 1, 'UTC+1', 9.0765, 7.3986, '主要到达城市', now, now);
      insertCity.run('CITY-KAN', 'COUNTRY-NG', 'KAN', '卡诺', 'Kano', null, 0, 1, 'UTC+1', 12.0022, 8.5920, '主要到达城市', now, now);
      insertCity.run('CITY-PHC', 'COUNTRY-NG', 'PHC', '哈科特港', 'Port Harcourt', null, 1, 1, 'UTC+1', 4.8156, 7.0498, '主要到达城市', now, now);
      insertCity.run('CITY-ACC', 'COUNTRY-GH', 'ACC', '阿克拉', 'Accra', null, 1, 1, 'UTC+0', 5.6037, -0.1870, '主要到达城市', now, now);
    });
    tx();
  }

  // Init: site defaults (if empty)
  const siteCountRow = db.prepare('SELECT COUNT(*) as c FROM sites').get() as any;
  if (Number(siteCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const insertSite = db.prepare(`
      INSERT INTO sites
      (id, countryId, cityId, siteCode, siteName, siteNameEn, district, siteType, address, contactName, contactPhone, businessHours, status, remark, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaults = [
      ['SITE-CAN-BY', 'CN', 'CAN', '广州', 'CAN_BY', '白云区站点', 'Baiyun Station', '白云区', 'HQ', '广州市白云区江夏北二路3号', '广州调度', '020-00000001', 'Week1-6 09:00-18:00', 'ACTIVE', '起运国总调度中心'],
      ['SITE-SZX-FT', 'CN', 'SZX', '深圳', 'SZX_FT', '福田区站点', 'Futian Station', '福田区', 'DISPATCH_CENTER', '深圳市福田区华强北', '深圳调度', '0755-00000001', 'Week1-6 09:00-18:00', 'ACTIVE', '起运国调度中心'],
      ['SITE-SHA-PD', 'CN', 'SHA', '上海', 'SHA_PD', '浦东站点', 'Pudong Station', '浦东新区', 'DISPATCH_CENTER', '上海市浦东新区', '上海调度', '021-00000001', 'Week1-6 09:00-18:00', 'ACTIVE', '起运国调度中心'],
      ['SITE-LOS-IKEJA', 'NGA', 'LOS', '拉各斯', 'LOS_IKEJA', '伊科贾站点', 'Ikeja Station', 'IKEJA', 'HQ', '5 Mojidi Street (by Eco Bank) Off Toyin Street', 'Sola', '+234-803-8321727', 'Week1-6 09:00-18:00', 'ACTIVE', '到达国总调度中心'],
      ['SITE-ABV-CENTER', 'NGA', 'ABV', '阿布贾', 'ABV_CENTER', '阿布贾站点', 'Abuja Station', 'Central District', 'DISPATCH_CENTER', 'Abuja Central District', 'Abuja Ops', '+234-800-111-2222', 'Week1-6 09:00-18:00', 'ACTIVE', '到达国调度中心'],
      ['SITE-KAN-SAT', 'NGA', 'KAN', '卡诺', 'KAN_SAT', '卡诺站点', 'Kano Station', 'Kano', 'SATELLITE', 'Kano', 'Kano Ops', '+234-800-111-3333', 'Week1-6 09:00-18:00', 'ACTIVE', '到达国卫星站点'],
      ['SITE-PHC-SAT', 'NGA', 'PHC', '哈科特港', 'PHC_SAT', '哈科特港站点', 'Port Harcourt Station', 'Port Harcourt', 'SATELLITE', 'Port Harcourt', 'PH Ops', '+234-800-111-4444', 'Week1-6 09:00-18:00', 'ACTIVE', '到达国卫星站点'],
      ['SITE-ACC-HQ', 'GHA', 'ACC', '阿克拉', 'ACC_HQ', '阿克拉站点', 'Accra Station', 'Osu', 'HQ', 'Oxford Street, Osu, Accra', 'Accra Ops', '+233-20-000-0000', 'Week1-6 09:00-18:00', 'ACTIVE', '到达国总调度中心'],
    ] as const;

    const getCountryByCode = db.prepare('SELECT id FROM countries WHERE countryCode = ?');
    const getCountryByName = db.prepare('SELECT id FROM countries WHERE countryName = ? OR countryNameEn = ?');
    const getCityByCode = db.prepare('SELECT id FROM cities WHERE countryId = ? AND cityCode = ?');
    const getCityByName = db.prepare('SELECT id FROM cities WHERE countryId = ? AND (cityName = ? OR cityNameEn = ?)');

    const tx = db.transaction(() => {
      for (const row of defaults) {
        const country = (getCountryByCode.get(row[1]) as any) || (getCountryByName.get(row[1], row[1]) as any);
        if (!country?.id) continue;

        const city = (getCityByCode.get(country.id, row[2]) as any) || (getCityByName.get(country.id, row[3], row[3]) as any);
        if (!city?.id) continue;

        insertSite.run(row[0], country.id, city.id, row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13], row[14], now, now);
      }
    });
    tx();
  }

  // Init: sync warehouse.siteId by city/name if empty
  db.exec(`
    UPDATE warehouses
    SET siteId = (
      SELECT s.id
      FROM sites s
      INNER JOIN cities ci ON ci.id = s.cityId
      WHERE ci.cityName = warehouses.city
        AND s.status = 'ACTIVE'
      ORDER BY
        CASE s.siteType
          WHEN 'HQ' THEN 1
          WHEN 'DISPATCH_CENTER' THEN 2
          ELSE 3
        END
      LIMIT 1
    )
    WHERE siteId IS NULL OR siteId = ''
  `);

  // Init: departments defaults + sync users.departmentId
  {
    const now = new Date().toISOString();
    const insertDepartment = db.prepare(`
      INSERT OR IGNORE INTO departments
      (id, deptCode, deptName, parentId, managerUserId, sortOrder, status, remark, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaults = [
      ['DEPT-MGMT', 'MGMT', '管理部', null, null, 10, 'ACTIVE', '系统默认部门'],
      ['DEPT-SALES', 'SALES', '销售部', null, null, 20, 'ACTIVE', '系统默认部门'],
      ['DEPT-WH-CN', 'WH_CN', '国内仓储部', null, null, 30, 'ACTIVE', '系统默认部门'],
      ['DEPT-OPS-CN', 'OPS_CN', '国内运营部', null, null, 40, 'ACTIVE', '系统默认部门'],
      ['DEPT-OPS-US', 'OPS_US', '海外运营部', null, null, 50, 'ACTIVE', '系统默认部门'],
      ['DEPT-WH-US', 'WH_US', '海外仓储部', null, null, 60, 'ACTIVE', '系统默认部门'],
      ['DEPT-FIN', 'FIN', '财务部', null, null, 70, 'ACTIVE', '系统默认部门'],
      ['DEPT-CEO', 'CEO', '总经办', null, null, 80, 'ACTIVE', '系统默认部门'],
      ['DEPT-DRIVER', 'DRIVER', '配送部', null, null, 90, 'ACTIVE', '系统默认部门'],
    ] as const;

    const tx = db.transaction(() => {
      for (const row of defaults) {
        insertDepartment.run(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], now, now);
      }

      const userDepartments = db.prepare(`
        SELECT DISTINCT TRIM(COALESCE(department, '')) AS deptName
        FROM users
        WHERE TRIM(COALESCE(department, '')) != ''
      `).all() as any[];

      let seq = 100;
      for (const row of userDepartments) {
        const deptName = String(row.deptName || '').trim();
        if (!deptName) continue;
        const exists = db.prepare('SELECT id FROM departments WHERE deptName = ?').get(deptName) as any;
        if (exists?.id) continue;
        seq += 1;
        const deptCode = `DEPT_${seq}`;
        insertDepartment.run(`DEPT-AUTO-${seq}`, deptCode, deptName, null, null, seq, 'ACTIVE', '由用户历史数据自动生成', now, now);
      }

      db.exec(`
        UPDATE users
        SET departmentId = (
          SELECT d.id
          FROM departments d
          WHERE d.deptName = users.department
          LIMIT 1
        )
        WHERE (departmentId IS NULL OR departmentId = '')
          AND TRIM(COALESCE(department, '')) != ''
      `);
    });
    tx();
  }

  // Init: RBAC defaults (role/permission/assignment)
  const roleCountRow = db.prepare('SELECT COUNT(*) as c FROM sys_roles').get() as any;
  if (Number(roleCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const insertRole = db.prepare(`
      INSERT INTO sys_roles
      (id, roleCode, roleName, description, siteScope, status, isSystem, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)
    `);

    const defaults = [
      ['ROLE-ADMIN', 'ADMIN', '系统管理员', '平台管理员，具备全局权限', 'ALL_SITE'],
      ['ROLE-BOSS', 'BOSS', '管理层', '管理层视角，具备全站点数据', 'ALL_SITE'],
      ['ROLE-SALES', 'SALES', '销售人员', '销售业务岗位', 'ASSIGNED_SITE'],
      ['ROLE-WH-CN', 'WAREHOUSE_CN', '起运国仓管', '起运国仓储岗位', 'ASSIGNED_SITE'],
      ['ROLE-OPS-CN', 'OPS_CN', '起运国操作', '起运国操作岗位', 'ASSIGNED_SITE'],
      ['ROLE-OPS-US', 'OPS_US', '到达国操作', '到达国操作岗位', 'ASSIGNED_SITE'],
      ['ROLE-WH-US', 'WAREHOUSE_US', '到达国仓管', '到达国仓储岗位', 'ASSIGNED_SITE'],
      ['ROLE-FIN', 'FINANCE', '财务人员', '财务岗位', 'ASSIGNED_SITE'],
      ['ROLE-DRIVER', 'DRIVER', '司机', '配送执行岗位', 'ASSIGNED_SITE'],
    ] as const;

    const tx = db.transaction(() => {
      for (const row of defaults) {
        insertRole.run(row[0], row[1], row[2], row[3], row[4], now, now);
      }
    });
    tx();
  }

  const permissionCountRow = db.prepare('SELECT COUNT(*) as c FROM sys_permissions').get() as any;
  if (Number(permissionCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const insertPermission = db.prepare(`
      INSERT INTO sys_permissions
      (id, permissionCode, permissionName, moduleKey, permissionType, path, description, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'MENU', ?, ?, 'ACTIVE', ?, ?)
    `);

    const defaults = [
      ['PERM-DASHBOARD', 'menu.dashboard', '工作台', 'dashboard', '/dashboard', '工作台菜单'],
      ['PERM-CRM', 'menu.crm', '客户中心', 'crm', '/crm', '客户中心菜单'],
      ['PERM-OMS', 'menu.oms', '订单中心', 'oms', '/oms', '订单中心菜单'],
      ['PERM-WMS-ORIGIN', 'menu.wms_origin', '起运国仓储', 'wms_origin', '/wms/origin', '起运国仓储菜单'],
      ['PERM-TMS-LINE', 'menu.tms_line', '起运国办', 'tms_line', '/tms/line', '起运国办菜单'],
      ['PERM-TMS-DEST', 'menu.tms_dest', '到达国办', 'tms_dest', '/tms/dest', '到达国办菜单'],
      ['PERM-WMS-DEST', 'menu.wms_dest', '到达国仓储', 'wms_dest', '/wms/dest', '到达国仓储菜单'],
      ['PERM-FINANCE', 'menu.finance', '财务中心', 'finance', '/finance', '财务中心菜单'],
      ['PERM-ANALYTICS', 'menu.analytics', '经营分析', 'analytics', '/analytics', '经营分析菜单'],
      ['PERM-SET-ORG', 'menu.set_org', '组织管理（站点）', 'set_org', '/system/org', '系统管理-组织管理'],
      ['PERM-SET-USER', 'menu.set_user', '用户管理', 'set_user', '/system/user', '系统管理-用户管理'],
      ['PERM-SET-AUTH', 'menu.set_auth', '角色权限', 'set_auth', '/system/auth', '系统管理-角色权限'],
      ['PERM-SET-BASE', 'menu.set_base', '基础设置', 'set_base', '/system/base', '系统管理-基础设置'],
      ['PERM-SET-WORKFLOW', 'menu.set_workflow', '流程管理', 'set_workflow', '/system/workflow', '系统管理-流程管理'],
      ['PERM-SET-MESSAGE', 'menu.set_message', '消息通知', 'set_message', '/system/message', '系统管理-消息通知'],
    ] as const;

    const tx = db.transaction(() => {
      for (const row of defaults) {
        insertPermission.run(row[0], row[1], row[2], row[3], row[4], row[5], now, now);
      }
    });
    tx();
  }

  const rolePermissionCountRow = db.prepare('SELECT COUNT(*) as c FROM sys_role_permissions').get() as any;
  if (Number(rolePermissionCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const getRoleIdByCode = db.prepare('SELECT id FROM sys_roles WHERE roleCode = ?');
    const getPermissionIdByCode = db.prepare('SELECT id FROM sys_permissions WHERE permissionCode = ?');
    const insertRolePermission = db.prepare(`
      INSERT OR IGNORE INTO sys_role_permissions
      (id, roleId, permissionId, createdAt)
      VALUES (?, ?, ?, ?)
    `);

    const allPermissionCodes = (db.prepare('SELECT permissionCode FROM sys_permissions').all() as any[]).map((row) => row.permissionCode);
    const grantMap: Record<string, string[]> = {
      ADMIN: allPermissionCodes,
      BOSS: ['menu.dashboard', 'menu.finance', 'menu.analytics'],
      SALES: ['menu.dashboard', 'menu.crm', 'menu.oms', 'menu.tms_line'],
      WAREHOUSE_CN: ['menu.dashboard', 'menu.oms', 'menu.wms_origin'],
      OPS_CN: ['menu.dashboard', 'menu.crm', 'menu.oms', 'menu.wms_origin', 'menu.tms_line'],
      OPS_US: ['menu.dashboard', 'menu.oms', 'menu.wms_dest', 'menu.tms_dest'],
      WAREHOUSE_US: ['menu.dashboard', 'menu.oms', 'menu.wms_dest'],
      FINANCE: ['menu.dashboard', 'menu.finance'],
      DRIVER: ['menu.dashboard'],
    };

    const tx = db.transaction(() => {
      for (const [roleCode, permissionCodes] of Object.entries(grantMap)) {
        const role = getRoleIdByCode.get(roleCode) as any;
        if (!role?.id) continue;
        for (const permissionCode of permissionCodes) {
          const permission = getPermissionIdByCode.get(permissionCode) as any;
          if (!permission?.id) continue;
          insertRolePermission.run(`RP-${role.id}-${permission.id}`, role.id, permission.id, now);
        }
      }
    });
    tx();
  }

  // Sync: map legacy users.role into sys_user_roles (idempotent)
  {
    const now = new Date().toISOString();
    const getRoleIdByCode = db.prepare('SELECT id FROM sys_roles WHERE roleCode = ?');
    const users = db.prepare('SELECT id, role FROM users').all() as any[];
    const insertUserRole = db.prepare(`
      INSERT OR IGNORE INTO sys_user_roles
      (id, userId, roleId, createdAt)
      VALUES (?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (const user of users) {
        const role = getRoleIdByCode.get(String(user.role || '').trim().toUpperCase()) as any;
        if (!role?.id) continue;
        insertUserRole.run(`UR-${user.id}-${role.id}`, user.id, role.id, now);
      }
    });
    tx();
  }

  // Init: workflow defaults (if empty)
  const workflowCountRow = db.prepare('SELECT COUNT(*) as c FROM workflow_configs').get() as any;
  if (Number(workflowCountRow?.c || 0) === 0) {
    const now = new Date().toISOString();
    const insertWorkflow = db.prepare(`
      INSERT INTO workflow_configs
      (id, name, code, businessType, description, status, nodes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaults = [
      {
        id: 'WF001',
        name: '费用审批流程',
        code: 'FEE_APPROVE',
        businessType: 'FEE_APPROVAL',
        description: '费用录入后需经过审批才能生效',
        status: 'ACTIVE',
        nodes: [
          { id: 'N1', name: '部门主管审批', approverType: 'ROLE', approverValue: 'OPS_CN', order: 1 },
          { id: 'N2', name: '财务审核', approverType: 'ROLE', approverValue: 'FINANCE', order: 2 },
        ],
      },
      {
        id: 'WF002',
        name: '退运审批流程',
        code: 'RETURN_APPROVE',
        businessType: 'RETURN_APPROVAL',
        description: '退运申请需经审批后执行',
        status: 'ACTIVE',
        nodes: [
          { id: 'N3', name: '仓库主管确认', approverType: 'ROLE', approverValue: 'WAREHOUSE_CN', order: 1 },
          { id: 'N4', name: '运营审批', approverType: 'ROLE', approverValue: 'OPS_CN', order: 2 },
        ],
      },
      {
        id: 'WF003',
        name: '备用金申请流程',
        code: 'PETTY_CASH_APPROVE',
        businessType: 'PETTY_CASH',
        description: '备用金申请需主管和财务双重审批',
        status: 'DRAFT',
        nodes: [
          { id: 'N5', name: '部门主管审批', approverType: 'ROLE', approverValue: 'OPS_CN', order: 1 },
          { id: 'N6', name: '财务审批', approverType: 'ROLE', approverValue: 'FINANCE', order: 2 },
          { id: 'N7', name: '管理层审批', approverType: 'ROLE', approverValue: 'BOSS', order: 3 },
        ],
      },
    ];

    const tx = db.transaction(() => {
      for (const row of defaults) {
        insertWorkflow.run(
          row.id,
          row.name,
          row.code,
          row.businessType,
          row.description,
          row.status,
          JSON.stringify(row.nodes),
          now,
          now
        );
      }
    });
    tx();
  }

  console.log('All 41 tables created successfully');
}
