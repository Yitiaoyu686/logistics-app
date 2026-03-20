import React, { useRef } from 'react';
import { Modal, Button, Space, Divider, Typography, Row, Col, QRCode } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import type { MasterOrder } from '../../types/order';

const { Text, Title } = Typography;

interface ShippingLabelPrintProps {
  visible: boolean;
  order: MasterOrder | null;
  onClose: () => void;
}

export const ShippingLabelPrint: React.FC<ShippingLabelPrintProps> = ({
  visible,
  order,
  onClose
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>打印面单 - ${order.orderNo}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .label-container {
              width: 100mm;
              border: 2px solid #000;
              padding: 10px;
              page-break-after: always;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .section {
              margin-bottom: 10px;
              padding: 5px;
              border: 1px solid #ddd;
            }
            .section-title {
              font-weight: bold;
              font-size: 12px;
              margin-bottom: 5px;
              background: #f0f0f0;
              padding: 3px 5px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              margin: 3px 0;
            }
            .qr-code {
              text-align: center;
              margin: 10px 0;
            }
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Modal
      title="打印面单"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          打印
        </Button>
      ]}
    >
      <div ref={printRef}>
        <div className="label-container" style={{ border: '2px solid #000', padding: 16 }}>
          {/* Header */}
          <div className="header" style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 10 }}>
            <Title level={3} style={{ margin: 0 }}>跨境物流面单</Title>
            <Text strong style={{ fontSize: 16 }}>{order.orderNo}</Text>
          </div>

          {/* QR Code */}
          <div className="qr-code" style={{ textAlign: 'center', margin: '10px 0' }}>
            <QRCode value={order.orderNo} size={100} />
          </div>

          {/* Sender Info */}
          <div className="section" style={{ marginBottom: 10, padding: 8, border: '1px solid #ddd' }}>
            <div className="section-title" style={{ fontWeight: 'bold', background: '#f0f0f0', padding: '3px 5px', marginBottom: 5 }}>
              发件人信息
            </div>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, margin: '3px 0' }}>
              <Text>姓名: {order.sender}</Text>
              <Text>电话: {order.senderPhone}</Text>
            </div>
            <div className="info-row" style={{ fontSize: 12, margin: '3px 0' }}>
              <Text>地址: {order.senderAddress}</Text>
            </div>
          </div>

          {/* Receiver Info */}
          <div className="section" style={{ marginBottom: 10, padding: 8, border: '1px solid #ddd' }}>
            <div className="section-title" style={{ fontWeight: 'bold', background: '#f0f0f0', padding: '3px 5px', marginBottom: 5 }}>
              收件人信息
            </div>
            <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, margin: '3px 0' }}>
              <Text>姓名: {order.consignee}</Text>
              <Text>电话: {order.consigneePhone}</Text>
            </div>
            <div className="info-row" style={{ fontSize: 12, margin: '3px 0' }}>
              <Text>国家: {order.destCountry}</Text>
              <Text style={{ marginLeft: 20 }}>城市: {order.destCity}</Text>
            </div>
            <div className="info-row" style={{ fontSize: 12, margin: '3px 0' }}>
              <Text>地址: {order.destAddress}</Text>
            </div>
          </div>

          {/* Cargo Info */}
          <div className="section" style={{ marginBottom: 10, padding: 8, border: '1px solid #ddd' }}>
            <div className="section-title" style={{ fontWeight: 'bold', background: '#f0f0f0', padding: '3px 5px', marginBottom: 5 }}>
              货物信息
            </div>
            <Row gutter={8}>
              <Col span={8}>
                <Text style={{ fontSize: 12 }}>件数: {order.totalPieces}件</Text>
              </Col>
              <Col span={8}>
                <Text style={{ fontSize: 12 }}>重量: {order.totalWeight.toFixed(1)}kg</Text>
              </Col>
              <Col span={8}>
                <Text style={{ fontSize: 12 }}>体积: {order.totalVolume.toFixed(2)}m³</Text>
              </Col>
            </Row>
            <div style={{ marginTop: 5 }}>
              <Text style={{ fontSize: 12 }}>运输方式: {order.transportType === 'SEA' ? '海运' : '空运'}</Text>
            </div>
          </div>

          {/* Remarks */}
          {order.remark && (
            <div className="section" style={{ marginBottom: 10, padding: 8, border: '1px solid #ddd' }}>
              <div className="section-title" style={{ fontWeight: 'bold', background: '#f0f0f0', padding: '3px 5px', marginBottom: 5 }}>
                备注
              </div>
              <Text style={{ fontSize: 11 }}>{order.remark}</Text>
            </div>
          )}

          {/* Footer */}
          <Divider style={{ margin: '10px 0' }} />
          <div style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>
            <Text>请妥善保管此面单，如有问题请联系客服</Text>
          </div>
        </div>
      </div>

      <div className="no-print" style={{ marginTop: 16, padding: 12, background: '#e6f7ff', borderRadius: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          提示: 点击"打印"按钮将打开打印预览窗口。建议使用标签打印机打印面单。
        </Text>
      </div>
    </Modal>
  );
};
