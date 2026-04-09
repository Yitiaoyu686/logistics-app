/**
 * 快递包裹表单模态框
 * 用于添加或编辑单个快递包裹
 */

import { Modal, Form, Input, Select, InputNumber, Radio, Row, Col, message } from 'antd';
import { useEffect } from 'react';
import type { ExpressPackage } from '../../types/order';

const { TextArea } = Input;

interface ExpressPackageFormModalProps {
  open: boolean;
  package: ExpressPackage | null;
  existingTrackingNos: string[];
  onClose: () => void;
  onSave: (pkg: ExpressPackage) => void;
}

export default function ExpressPackageFormModal({
  open,
  package: pkg,
  existingTrackingNos,
  onClose,
  onSave,
}: ExpressPackageFormModalProps) {
  const [form] = Form.useForm();

  // 初始化表单数据
  useEffect(() => {
    if (open) {
      if (pkg) {
        // 编辑模式
        form.setFieldsValue(pkg);
      } else {
        // 新增模式
        form.resetFields();
        form.setFieldsValue({
          status: 'PENDING',
          description: '普货',
          pieces: 1,
          weight: 0,
          declaredValue: 0,
        });
      }
    }
  }, [open, pkg, form]);

  // 处理保存
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 检查运单号唯一性
      if (existingTrackingNos.includes(values.trackingNo)) {
        message.error('运单号已存在，请使用不同的运单号');
        return;
      }

      const packageData: ExpressPackage = {
        id: pkg?.id || `pkg-${Date.now()}`,
        courier: values.courier,
        trackingNo: values.trackingNo,
        status: values.status,
        itemName: values.itemName,
        category: values.category,
        description: values.description,
        weight: values.weight,
        pieces: values.pieces,
        length: values.length,
        width: values.width,
        height: values.height,
        declaredValue: values.declaredValue,
        remark: values.remark,
        receivedAt: pkg?.receivedAt,
        inboundAt: pkg?.inboundAt,
        photos: pkg?.photos || [],
      };

      onSave(packageData);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <Modal
      title={pkg ? '编辑包裹' : '添加包裹'}
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      width={600}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="快递公司"
          name="courier"
          rules={[{ required: true, message: '请选择快递公司' }]}
        >
          <Select placeholder="请选择快递公司">
            <Select.Option value="顺丰">顺丰</Select.Option>
            <Select.Option value="韵达">韵达</Select.Option>
            <Select.Option value="圆通">圆通</Select.Option>
            <Select.Option value="中通">中通</Select.Option>
            <Select.Option value="申通">申通</Select.Option>
            <Select.Option value="百世">百世</Select.Option>
            <Select.Option value="德邦">德邦</Select.Option>
            <Select.Option value="京东">京东</Select.Option>
            <Select.Option value="EMS">EMS</Select.Option>
            <Select.Option value="其他">其他</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="运单号"
          name="trackingNo"
          rules={[
            { required: true, message: '请输入运单号' },
            { pattern: /^[A-Za-z0-9]+$/, message: '运单号只能包含字母和数字' },
          ]}
        >
          <Input placeholder="请输入运单号" />
        </Form.Item>

        <Form.Item
          label="状态"
          name="status"
          rules={[{ required: true, message: '请选择状态' }]}
        >
          <Radio.Group>
            <Radio value="PENDING">未签收</Radio>
            <Radio value="RECEIVED">已签收</Radio>
            <Radio value="INBOUND">已入库</Radio>
            <Radio value="DELETED">已删除</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label="品名"
          name="itemName"
          rules={[{ required: true, message: '请输入品名' }]}
        >
          <Input placeholder="请输入品名" />
        </Form.Item>

        <Form.Item
          label="类别"
          name="category"
          rules={[{ required: true, message: '请选择类别' }]}
        >
          <Select placeholder="请选择类别">
            <Select.Option value="服装">服装</Select.Option>
            <Select.Option value="鞋类">鞋类</Select.Option>
            <Select.Option value="箱包">箱包</Select.Option>
            <Select.Option value="电子产品">电子产品</Select.Option>
            <Select.Option value="日用品">日用品</Select.Option>
            <Select.Option value="食品">食品</Select.Option>
            <Select.Option value="化妆品">化妆品</Select.Option>
            <Select.Option value="玩具">玩具</Select.Option>
            <Select.Option value="其他">其他</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="说明"
          name="description"
          rules={[{ required: true, message: '请选择说明' }]}
        >
          <Select placeholder="请选择说明">
            <Select.Option value="普货">普货</Select.Option>
            <Select.Option value="敏感货">敏感货</Select.Option>
            <Select.Option value="带电">带电</Select.Option>
            <Select.Option value="液体">液体</Select.Option>
            <Select.Option value="粉末">粉末</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="重量(kg)"
          name="weight"
          rules={[
            { required: true, message: '请输入重量' },
            { type: 'number', min: 0, message: '重量不能为负数' },
          ]}
        >
          <InputNumber
            placeholder="请输入重量"
            style={{ width: '100%' }}
            min={0}
            step={0.1}
            precision={2}
          />
        </Form.Item>

        <Form.Item
          label="件数"
          name="pieces"
          rules={[
            { required: true, message: '请输入件数' },
            { type: 'number', min: 1, message: '件数至少为1' },
          ]}
        >
          <InputNumber
            placeholder="请输入件数"
            style={{ width: '100%' }}
            min={1}
            step={1}
          />
        </Form.Item>

        <Form.Item label="外箱尺寸 (cm)" tooltip="用于体积重计算：体积重(kg) = 长×宽×高÷6000（空运）">
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item name="length" noStyle rules={[{ type: 'number', min: 0, message: '长度不能为负' }]}>
                <InputNumber placeholder="长" style={{ width: '100%' }} min={0} precision={1} addonAfter="cm" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="width" noStyle rules={[{ type: 'number', min: 0, message: '宽度不能为负' }]}>
                <InputNumber placeholder="宽" style={{ width: '100%' }} min={0} precision={1} addonAfter="cm" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="height" noStyle rules={[{ type: 'number', min: 0, message: '高度不能为负' }]}>
                <InputNumber placeholder="高" style={{ width: '100%' }} min={0} precision={1} addonAfter="cm" />
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>

        <Form.Item
          label="货值(USD)"
          name="declaredValue"
          rules={[
            { required: true, message: '请输入货值' },
            { type: 'number', min: 0, message: '货值不能为负数' },
          ]}
        >
          <InputNumber
            placeholder="请输入货值"
            style={{ width: '100%' }}
            min={0}
            step={1}
            precision={2}
          />
        </Form.Item>

        <Form.Item label="备注" name="remark">
          <TextArea rows={3} placeholder="请输入备注" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
