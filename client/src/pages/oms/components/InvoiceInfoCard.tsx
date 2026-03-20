/**
 * 发票信息内容组件
 * 仅渲染内容，不包裹外层卡片
 */

import { Descriptions, Tag, Typography } from 'antd';
import type { InvoiceInfo } from '../../../types/order';

const { Text } = Typography;

interface InvoiceInfoCardProps {
  invoiceInfo?: InvoiceInfo;
}

export default function InvoiceInfoCard({ invoiceInfo }: InvoiceInfoCardProps) {
  if (!invoiceInfo) {
    return <Text type="secondary">暂无发票信息</Text>;
  }

  const statusConfig = {
    PENDING: { label: '待开票', color: 'warning' },
    ISSUED: { label: '已开票', color: 'success' },
    CANCELLED: { label: '已作废', color: 'default' },
  };

  const config = invoiceInfo.invoiceStatus
    ? statusConfig[invoiceInfo.invoiceStatus]
    : null;

  return (
    <Descriptions column={2} size="small" labelStyle={{ width: 100 }}>
      <Descriptions.Item label="公司名称" span={2}>
        {invoiceInfo.companyName}
      </Descriptions.Item>
      <Descriptions.Item label="信用代码">
        {invoiceInfo.taxNumber}
      </Descriptions.Item>
      <Descriptions.Item label="联系人">
        {invoiceInfo.contactPerson}
      </Descriptions.Item>
      <Descriptions.Item label="联系电话">
        {invoiceInfo.contactPhone}
      </Descriptions.Item>
      <Descriptions.Item label="开户行" span={2}>
        {invoiceInfo.bankName}
      </Descriptions.Item>
      <Descriptions.Item label="银行账号" span={2}>
        {invoiceInfo.bankAccount}
      </Descriptions.Item>
      <Descriptions.Item label="地址" span={2}>
        {invoiceInfo.address}
      </Descriptions.Item>

      {invoiceInfo.invoiceStatus && (
        <>
          <Descriptions.Item label="发票状态">
            {config && <Tag color={config.color}>{config.label}</Tag>}
          </Descriptions.Item>
          {invoiceInfo.invoiceNumber && (
            <Descriptions.Item label="发票号">
              {invoiceInfo.invoiceNumber}
            </Descriptions.Item>
          )}
          {invoiceInfo.invoiceDate && (
            <Descriptions.Item label="开票日期">
              {invoiceInfo.invoiceDate}
            </Descriptions.Item>
          )}
          {invoiceInfo.invoiceAmount && (
            <Descriptions.Item label="发票金额">
              <Text strong>¥{invoiceInfo.invoiceAmount.toFixed(2)}</Text>
            </Descriptions.Item>
          )}
        </>
      )}
    </Descriptions>
  );
}
