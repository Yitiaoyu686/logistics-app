import React, { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Steps,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import {
  clientApi,
  v2FinanceApi,
  v2OmsApi,
  v2PodApi,
  v2TmsApi,
  v2WmsApi,
  v2WorkflowApi,
} from '../../api';

const { Text } = Typography;

type BusinessLine = 'SEA' | 'AIR';

interface FlowFormValues {
  businessLine: BusinessLine;
  originWarehouseId: string;
  destWarehouseId: string;
  feeAmount: number;
}

interface FlowLog {
  id: string;
  at: string;
  step: string;
  status: 'RUNNING' | 'SUCCESS' | 'ERROR';
  detail: string;
}

interface FlowArtifacts {
  customerId?: string;
  customerCode?: string;
  orderId?: string;
  orderNo?: string;
  subOrderId?: string;
  subOrderNo?: string;
  subOrderCount?: number;
  jobId?: string;
  jobNo?: string;
  dpnId?: string;
  dpnNo?: string;
  deliveryTaskId?: string;
  deliveryTaskNo?: string;
  feeId?: string;
  feeNo?: string;
  workflowTaskId?: string;
  finalOrderStatus?: string;
  finalSubStatus?: string;
  allSubDelivered?: boolean;
}

const FLOW_STEPS = [
  '创建客户',
  '创建主订单',
  '创建任务预置',
  '主单入库并生成子单',
  '绑定子单到任务',
  '推进运输节点',
  '创建DPN并签收',
  '费用提报审核收款',
  '回读最终状态',
];

const DEFAULT_FORM: FlowFormValues = {
  businessLine: 'SEA',
  originWarehouseId: 'WH-GZ-001',
  destWarehouseId: 'WH-LOS-001',
  feeAmount: 1200,
};

function unwrap<T>(raw: any): T {
  return (raw?.data ?? raw) as T;
}

function nowLabel(): string {
  return new Date().toLocaleString();
}

function shortId(prefix: string): string {
  return `${prefix}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
}

export const WebFullFlowRunner: React.FC = () => {
  const [form] = Form.useForm<FlowFormValues>();
  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<FlowLog[]>([]);
  const [artifacts, setArtifacts] = useState<FlowArtifacts>({});
  const [lastError, setLastError] = useState<string>('');
  const [completed, setCompleted] = useState(false);

  const stepItems = useMemo(
    () => FLOW_STEPS.map((title) => ({ title })),
    []
  );

  const pushLog = (step: string, status: FlowLog['status'], detail: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        at: nowLabel(),
        step,
        status,
        detail,
      },
    ]);
  };

  const updateArtifacts = (patch: Partial<FlowArtifacts>) => {
    setArtifacts((prev) => ({ ...prev, ...patch }));
  };

  const runAll = async () => {
    let values: FlowFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const runTag = shortId(values.businessLine === 'SEA' ? 'S' : 'A');
    const trackingNos = [`${values.businessLine}-${runTag}-01`, `${values.businessLine}-${runTag}-02`];
    const serviceTypeCode = values.businessLine === 'SEA' ? 'LCL_SEA' : 'STANDARD_AIR';
    const polSiteId = values.businessLine === 'SEA' ? 'SITE-SZ-ORIGIN' : 'SITE-GZ-ORIGIN';
    const carrierSupplierId = values.businessLine === 'SEA' ? 'SUP-MAERSK' : 'SUP-CZ';

    setRunning(true);
    setCurrentStep(0);
    setLogs([]);
    setArtifacts({});
    setLastError('');
    setCompleted(false);

    try {
      setCurrentStep(0);
      pushLog(FLOW_STEPS[0], 'RUNNING', '开始创建联调客户');
      const customerRes = await clientApi.create({
        name: `Web联调客户-${runTag}`,
        country: 'China',
        contact: {
          name: 'Web自动联调',
          phone: `138${Date.now().toString().slice(-8)}`,
          email: `web-flow-${runTag}@demo.local`,
        },
        poolType: 'PUBLIC',
        logisticsInfo: {
          senderContacts: [
            {
              senderName: '广州发货人',
              senderPhone: '13800000001',
              senderAddress: '广州市白云区示例路 1 号',
              senderCountry: 'China',
              senderCity: 'Guangzhou',
            },
          ],
          receiverContacts: [
            {
              consigneeName: 'Lagos Receiver',
              consigneePhone: '+2348001234567',
              consigneeEmail: `receiver-${runTag}@demo.local`,
              consigneeAddress: 'No.18 Allen Avenue, Ikeja, Lagos',
              consigneeCountry: 'Nigeria',
              consigneeCity: 'Lagos',
            },
          ],
        },
      });
      const customer = unwrap<any>(customerRes);
      if (!customer?.id) throw new Error('客户创建返回缺少 id');
      updateArtifacts({ customerId: customer.id, customerCode: customer.shortCode });
      pushLog(FLOW_STEPS[0], 'SUCCESS', `客户创建成功：${customer.shortCode || customer.id}`);

      setCurrentStep(1);
      pushLog(FLOW_STEPS[1], 'RUNNING', '开始创建主订单');
      const orderRes = await v2OmsApi.createOrder({
        customerId: customer.id,
        businessLine: values.businessLine,
        serviceTypeCode,
        routeCode: values.businessLine === 'SEA' ? 'SZ.CN→LOS.NGA' : 'GZ.CN→LOS.NGA',
        paymentMethod: 'PREPAID',
        paymentChannel: 'BANK',
        currencyCode: 'CNY',
        packages: trackingNos.map((trackingNo, idx) => ({
          trackingNo,
          expressCompany: 'SF',
          goodsName: `Web联调货物-${idx + 1}`,
          goodsCategory: 'GENERAL',
          cargoDesc: 'GENERAL',
          declaredWeightKg: idx === 0 ? 12.5 : 8.2,
          pieces: 1,
          declaredValueUsd: idx === 0 ? 200 : 120,
          remark: `Web闭环联调包裹-${idx + 1}`,
        })),
        creatorUserId: 'U-SALES-01',
        salesUserId: 'U-SALES-01',
        remark: 'Web全流程联调主单',
      });
      const orderPayload = unwrap<any>(orderRes);
      const order = orderPayload?.order || orderPayload;
      if (!order?.id) throw new Error('订单创建返回缺少 id');
      const orderNo = order.order_no || order.orderNo || order.display_order_no || order.id;
      updateArtifacts({ orderId: order.id, orderNo });
      pushLog(FLOW_STEPS[1], 'SUCCESS', `订单创建成功：${orderNo}`);

      setCurrentStep(2);
      pushLog(FLOW_STEPS[2], 'RUNNING', '创建任务（可先建后绑子单）');
      const jobRes = await v2TmsApi.createJob({
        businessLine: values.businessLine,
        polSiteId,
        podSiteId: 'SITE-LOS-DEST',
        carrierSupplierId,
        etd: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
        eta: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString(),
        remark: 'Web闭环联调任务',
        createdBy: 'U-OPS-CN-01',
      });
      const job = unwrap<any>(jobRes);
      if (!job?.id) throw new Error('任务创建返回缺少 id');
      const jobNo = job.job_no || job.jobNo || job.id;
      updateArtifacts({ jobId: job.id, jobNo });
      pushLog(FLOW_STEPS[2], 'SUCCESS', `任务创建成功：${jobNo}`);

      setCurrentStep(3);
      pushLog(FLOW_STEPS[3], 'RUNNING', '按主单入库，验证每包裹自动生成子单');
      const inboundRes = await v2WmsApi.createInbound({
        warehouseId: values.originWarehouseId,
        orderId: order.id,
        businessLine: values.businessLine,
        sourceType: 'THIRD_PARTY',
        operatorUserId: 'U-OPS-CN-01',
        remark: 'Web联调主单入库自动生子单',
        items: trackingNos.map((trackingNo, idx) => ({
          trackingNo,
          expressCompany: 'SF',
          senderName: '广州发货人',
          senderPhone: '13800000001',
          consigneeName: 'Lagos Receiver',
          consigneePhone: '+2348001234567',
          customerHint: customer.name || `Web联调客户-${runTag}`,
          pieces: 1,
          grossWeightKg: idx === 0 ? 12.5 : 8.2,
          lengthCm: idx === 0 ? 50 : 45,
          widthCm: idx === 0 ? 40 : 35,
          heightCm: idx === 0 ? 35 : 30,
          packageCondition: 'GOOD',
          locationCode: idx === 0 ? 'A-01' : 'A-02',
          remark: `入库包裹-${idx + 1}`,
        })),
      });
      const inboundPayload = unwrap<any>(inboundRes);
      const createdSubOrderIds = Array.isArray(inboundPayload?.createdSubOrderIds)
        ? inboundPayload.createdSubOrderIds.map(String)
        : [];
      const createdSubOrderNos = Array.isArray(inboundPayload?.createdSubOrderNos)
        ? inboundPayload.createdSubOrderNos.map(String)
        : [];

      const fullAfterInboundRes = await v2OmsApi.getOrderFull(order.id);
      const fullAfterInbound = unwrap<any>(fullAfterInboundRes);
      const subRows = Array.isArray(fullAfterInbound?.subOrders) ? fullAfterInbound.subOrders : [];
      const effectiveSubRows = createdSubOrderIds.length
        ? subRows.filter((row: any) => createdSubOrderIds.includes(String(row.id)))
        : subRows;
      if (!effectiveSubRows.length) throw new Error('入库完成但未读取到子单');

      const effectiveSubOrderIds = effectiveSubRows.map((row: any) => String(row.id));
      const effectiveSubOrderNos = effectiveSubRows.map((row: any) => String(row.sub_order_no || row.subOrderNo || row.id));
      if (effectiveSubOrderIds.length !== trackingNos.length) {
        throw new Error(`子单数量异常：期望 ${trackingNos.length}，实际 ${effectiveSubOrderIds.length}`);
      }

      updateArtifacts({
        subOrderId: effectiveSubOrderIds[0],
        subOrderNo: effectiveSubOrderNos.length > 1 ? `${effectiveSubOrderNos[0]} +${effectiveSubOrderNos.length - 1}` : effectiveSubOrderNos[0],
        subOrderCount: effectiveSubOrderIds.length,
      });
      pushLog(
        FLOW_STEPS[3],
        'SUCCESS',
        `主单入库成功，生成子单 ${effectiveSubOrderIds.length} 条（每包裹=1子单）`
      );

      setCurrentStep(4);
      pushLog(FLOW_STEPS[4], 'RUNNING', '将子单绑定到任务与集装号');
      await v2TmsApi.bindSubOrders(job.id, {
        subOrderIds: effectiveSubOrderIds,
        shippingUnitNo: `UNIT-${runTag}`,
        unitType: 'CONTAINER',
        containerType: values.businessLine === 'SEA' ? '40HQ' : 'AIR_PALLET',
        warehouseId: values.originWarehouseId,
        operatorUserId: 'U-OPS-CN-01',
      });
      pushLog(FLOW_STEPS[4], 'SUCCESS', `任务绑定完成：${jobNo}（子单 ${effectiveSubOrderIds.length} 条）`);

      setCurrentStep(5);
      pushLog(FLOW_STEPS[5], 'RUNNING', '推进所有子单运输节点到 ARRIVED');
      for (const subOrderId of effectiveSubOrderIds) {
        await v2TmsApi.createTrackingEvent({
          businessLine: values.businessLine,
          eventScope: 'SUB_ORDER',
          orderId: order.id,
          subOrderId,
          jobId: job.id,
          eventType: 'IMPORT',
          nodeCode: 'ARRIVE_DEST',
          nodeName: '到达目的地',
          statusCode: 'ARRIVED',
          location: 'Lagos',
          operatorUserId: 'U-OPS-US-01',
          remark: 'Web联调自动推进',
        });
      }
      pushLog(FLOW_STEPS[5], 'SUCCESS', `节点推进成功：${effectiveSubOrderIds.length} 条子单`);

      setCurrentStep(6);
      pushLog(FLOW_STEPS[6], 'RUNNING', '创建DPN并执行签收');
      const dpnRes = await v2PodApi.createDpn({
        businessLine: values.businessLine,
        customerId: customer.id,
        warehouseId: values.destWarehouseId,
        subOrderIds: effectiveSubOrderIds,
        recipientName: 'Lagos Receiver',
        recipientPhone: '+2348001234567',
        recipientAddress: 'No.18 Allen Avenue, Ikeja, Lagos',
        deliveryMethod: 'DELIVERY',
        currencyCode: 'NGN',
        totalReceivableAmount: values.feeAmount,
        createdBy: 'U-OPS-US-01',
        remark: 'Web联调DPN',
      });
      const dpnPayload = unwrap<any>(dpnRes);
      const dpn = dpnPayload?.dpn || dpnPayload;
      if (!dpn?.id) throw new Error('DPN创建返回缺少 id');
      const dpnNo = dpn.dpn_no || dpn.dpnNo || dpn.id;
      updateArtifacts({ dpnId: dpn.id, dpnNo });

      const deliveryTaskRes = await v2PodApi.createDeliveryTask({
        dpnId: dpn.id,
        driverUserId: 'U-OPS-US-01',
        driverName: '自动配送员',
        driverPhone: '+2348000009999',
        remark: 'Web联调自动派单',
      });
      const task = unwrap<any>(deliveryTaskRes);
      if (!task?.id) throw new Error('配送任务创建返回缺少 id');
      const taskNo = task.task_no || task.taskNo || task.id;
      updateArtifacts({ deliveryTaskId: task.id, deliveryTaskNo: taskNo });

      await v2PodApi.signDeliveryTask(task.id, {
        signProof: {
          from: 'web-full-flow',
          by: 'U-OPS-US-01',
          at: new Date().toISOString(),
        },
      });
      pushLog(FLOW_STEPS[6], 'SUCCESS', `DPN签收完成：${dpnNo}`);

      setCurrentStep(7);
      pushLog(FLOW_STEPS[7], 'RUNNING', '费用提报、审批并收款');
      const feeRes = await v2FinanceApi.createFee({
        businessLine: values.businessLine,
        feeLevel: 'ORDER',
        relatedId: order.id,
        relatedNo: orderNo,
        feeItemCode: 'FREIGHT',
        feeDirection: 'RECEIVABLE',
        unitPrice: values.feeAmount,
        quantity: 1,
        currencyCode: 'CNY',
        counterpartyType: 'CUSTOMER',
        counterpartyId: customer.id,
        counterpartyName: customer.name || `Web联调客户-${runTag}`,
        description: 'Web端全流程联调自动应收',
        createdBy: 'U-FIN-01',
      });
      const fee = unwrap<any>(feeRes);
      if (!fee?.id) throw new Error('费用创建返回缺少 id');
      const feeNo = fee.fee_no || fee.feeNo || fee.id;
      updateArtifacts({ feeId: fee.id, feeNo });

      const workflowRes = await v2WorkflowApi.createInstance({
        businessLine: values.businessLine,
        processCode: 'FEE_APPROVAL',
        businessType: 'FEE',
        businessId: fee.id,
        nodeCode: 'FIN_APPROVAL',
        nodeName: '财务审批',
        initiatorUserId: 'U-FIN-01',
        assigneeUserId: 'U-ADMIN',
      });
      const workflowPayload = unwrap<any>(workflowRes);
      const workflowTaskId = workflowPayload?.task?.id;
      if (!workflowTaskId) throw new Error('审批流创建成功但未返回 task id');
      updateArtifacts({ workflowTaskId });

      await v2WorkflowApi.actionTask(workflowTaskId, {
        action: 'APPROVE',
        comment: 'Web联调自动审批通过',
      });

      await v2FinanceApi.confirmPayment({
        feeId: fee.id,
        amount: values.feeAmount,
        paymentMethod: 'BANK',
        paymentChannel: 'AUTO',
        paymentAccount: 'AUTO-ACC',
        confirmedBy: 'U-FIN-01',
        remark: 'Web联调自动收款',
      });
      pushLog(FLOW_STEPS[7], 'SUCCESS', `费用闭环完成：${feeNo}`);

      setCurrentStep(8);
      pushLog(FLOW_STEPS[8], 'RUNNING', '回读订单最终状态');
      const fullRes = await v2OmsApi.getOrderFull(order.id);
      const full = unwrap<any>(fullRes);
      const finalOrderStatus = full?.order?.order_status || full?.order?.status || '-';
      const finalSubStatuses = Array.isArray(full?.subOrders)
        ? full.subOrders.map((row: any) => String(row?.sub_status || row?.status || '-'))
        : [];
      const uniqueSubStatuses = Array.from(new Set(finalSubStatuses));
      const allSubDelivered = finalSubStatuses.length > 0 && finalSubStatuses.every((status: string) => status === 'DELIVERED');
      const finalSubStatus = uniqueSubStatuses.join(',') || '-';
      updateArtifacts({ finalOrderStatus, finalSubStatus, allSubDelivered });
      pushLog(FLOW_STEPS[8], 'SUCCESS', `最终状态：主单=${finalOrderStatus}，子单=${finalSubStatus}`);

      setCompleted(true);
      message.success('Web 端全流程闭环已跑通');
    } catch (err: any) {
      const errMsg = String(err?.message || '执行失败');
      setLastError(errMsg);
      pushLog(FLOW_STEPS[Math.min(currentStep, FLOW_STEPS.length - 1)], 'ERROR', errMsg);
      message.error(errMsg);
    } finally {
      setRunning(false);
    }
  };

  const handleReset = () => {
    form.setFieldsValue(DEFAULT_FORM);
    setLogs([]);
    setArtifacts({});
    setLastError('');
    setCompleted(false);
    setCurrentStep(0);
  };

  return (
    <div>
      <Card
        title="Web 全流程联调（V2）"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={running}>
              重置
            </Button>
            <Button
              type="primary"
              icon={running ? <SyncOutlined spin /> : <PlayCircleOutlined />}
              onClick={runAll}
              loading={running}
            >
              一键跑通
            </Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="该页面用于 Web 端端到端闭环联调，统一走 /api/v2 链路。"
          description="流程包含：客户 -> 主订单 -> 主单入库自动生成子单（每包裹=1子单）-> 任务绑定 -> DPN签收 -> 费用审批收款。"
        />

        <Form
          form={form}
          layout="vertical"
          initialValues={DEFAULT_FORM}
          style={{ marginBottom: 8 }}
        >
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="businessLine" label="业务线" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '海运 SEA', value: 'SEA' },
                    { label: '空运 AIR', value: 'AIR' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="originWarehouseId" label="起运仓ID" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'WH-GZ-001（广州起运仓）', value: 'WH-GZ-001' },
                    { label: 'WH-SZ-001（深圳起运仓）', value: 'WH-SZ-001' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="destWarehouseId" label="到达仓ID" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: 'WH-LOS-001（拉各斯到达仓）', value: 'WH-LOS-001' },
                    { label: 'WH-ABV-001（阿布贾到达仓）', value: 'WH-ABV-001' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="feeAmount" label="联调应收金额(CNY)" rules={[{ required: true }]}>
                <InputNumber min={1} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <Steps current={completed ? FLOW_STEPS.length - 1 : currentStep} items={stepItems} />

        <div style={{ marginTop: 16 }}>
          {completed && (
            <Tag icon={<CheckCircleOutlined />} color="success">
              闭环执行完成
            </Tag>
          )}
          {!completed && running && (
            <Tag icon={<SyncOutlined spin />} color="processing">
              执行中
            </Tag>
          )}
          {lastError && (
            <Tag icon={<CloseCircleOutlined />} color="error">
              执行失败
            </Tag>
          )}
        </div>
      </Card>

      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={12}>
          <Card title="产物ID" size="small">
            <Descriptions size="small" column={1} labelStyle={{ width: 130 }}>
              <Descriptions.Item label="客户">{artifacts.customerCode || artifacts.customerId || '-'}</Descriptions.Item>
              <Descriptions.Item label="主单">{artifacts.orderNo || artifacts.orderId || '-'}</Descriptions.Item>
              <Descriptions.Item label="子单">{artifacts.subOrderNo || artifacts.subOrderId || '-'}</Descriptions.Item>
              <Descriptions.Item label="子单数量">{artifacts.subOrderCount ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="任务">{artifacts.jobNo || artifacts.jobId || '-'}</Descriptions.Item>
              <Descriptions.Item label="DPN">{artifacts.dpnNo || artifacts.dpnId || '-'}</Descriptions.Item>
              <Descriptions.Item label="配送任务">{artifacts.deliveryTaskNo || artifacts.deliveryTaskId || '-'}</Descriptions.Item>
              <Descriptions.Item label="费用单">{artifacts.feeNo || artifacts.feeId || '-'}</Descriptions.Item>
              <Descriptions.Item label="审批任务">{artifacts.workflowTaskId || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="最终状态" size="small">
            <Space direction="vertical" size={8}>
              <div>
                <Text type="secondary">主单状态：</Text>
                <Tag color={artifacts.finalOrderStatus === 'COMPLETED' ? 'success' : 'processing'}>
                  {artifacts.finalOrderStatus || '-'}
                </Tag>
              </div>
              <div>
                <Text type="secondary">子单状态：</Text>
                <Tag color={artifacts.allSubDelivered ? 'success' : 'processing'}>
                  {artifacts.finalSubStatus || '-'}
                </Tag>
              </div>
              {lastError ? (
                <Alert type="error" showIcon message={lastError} />
              ) : (
                <Alert
                  type={completed ? 'success' : 'info'}
                  showIcon
                  message={completed ? '闭环状态已回读完成' : '执行后将展示最终主单/子单状态'}
                />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="执行日志" size="small" style={{ marginTop: 12 }}>
        <Timeline
          items={logs.map((log) => ({
            color: log.status === 'SUCCESS' ? 'green' : log.status === 'ERROR' ? 'red' : 'blue',
            children: (
              <Space direction="vertical" size={2}>
                <Space size={8}>
                  <Tag
                    color={
                      log.status === 'SUCCESS'
                        ? 'success'
                        : log.status === 'ERROR'
                          ? 'error'
                          : 'processing'
                    }
                  >
                    {log.status}
                  </Tag>
                  <Text strong>{log.step}</Text>
                  <Text type="secondary">{log.at}</Text>
                </Space>
                <Text>{log.detail}</Text>
              </Space>
            ),
          }))}
        />
      </Card>
    </div>
  );
};
