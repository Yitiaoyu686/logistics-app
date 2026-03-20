import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, InputNumber, Alert, Tag, Typography, Descriptions, Select,
  Switch, Tabs, Radio, Space, Divider
} from 'antd';
import {
  RocketOutlined, CloudOutlined, InfoCircleOutlined, FileTextOutlined,
  WarningOutlined
} from '@ant-design/icons';
import {
  calcAirFreight, calcSeaLCLFreight, calcDocumentFee,
  DEFAULT_AIR_CONFIG, DEFAULT_SEA_LCL_CONFIG, DEFAULT_DOC_CONFIG,
  CARGO_CATEGORY_LABELS,
  type CargoCategory, type AirFreightConfig, type SeaLCLConfig, type DocumentFeeConfig,
  type AirFreightBreakdown, type SeaLCLBreakdown, type DocumentFeeResult,
} from '../../utils/freightCalc';

const { Text } = Typography;

type CalcMode = 'AIR' | 'SEA_LCL' | 'DOC';

// 品类选项（排除普货用于附加费展示，但选择列表包含全部）
const ALL_CATEGORY_OPTIONS: { value: CargoCategory; label: string }[] = Object.entries(CARGO_CATEGORY_LABELS)
  .map(([value, label]) => ({ value: value as CargoCategory, label }));

interface ChargeCalculatorProps {
  airConfig?: AirFreightConfig;
  seaConfig?: SeaLCLConfig;
  docConfig?: DocumentFeeConfig;
}

export const ChargeCalculator: React.FC<ChargeCalculatorProps> = ({
  airConfig = DEFAULT_AIR_CONFIG,
  seaConfig = DEFAULT_SEA_LCL_CONFIG,
  docConfig = DEFAULT_DOC_CONFIG,
}) => {
  const [calcMode, setCalcMode] = useState<CalcMode>('AIR');

  // ========== 空运状态 ==========
  const [airLength, setAirLength] = useState<number | null>(null);
  const [airWidth, setAirWidth] = useState<number | null>(null);
  const [airHeight, setAirHeight] = useState<number | null>(null);
  const [airActualWeight, setAirActualWeight] = useState<number | null>(null);
  const [airCategories, setAirCategories] = useState<CargoCategory[]>([]);
  const [hasWoodenBox, setHasWoodenBox] = useState(false);

  // ========== 海运拼箱状态 ==========
  const [seaVolume, setSeaVolume] = useState<number | null>(null);
  const [seaGrossWeight, setSeaGrossWeight] = useState<number | null>(null);

  // ========== 文件寄送状态 ==========
  const [docWeight, setDocWeight] = useState<number | null>(null);
  const [docPaymentType, setDocPaymentType] = useState<'PREPAID' | 'COLLECT'>('PREPAID');

  // ========== 空运计算 ==========
  const airResult: AirFreightBreakdown | null = useMemo(() => {
    if (airActualWeight == null || airActualWeight <= 0) return null;
    return calcAirFreight(
      airActualWeight, airLength, airWidth, airHeight,
      airCategories.length > 0 ? airCategories : ['NORMAL'],
      hasWoodenBox, airConfig,
    );
  }, [airActualWeight, airLength, airWidth, airHeight, airCategories, hasWoodenBox, airConfig]);

  // ========== 海运拼箱计算 ==========
  const seaResult: SeaLCLBreakdown | null = useMemo(() => {
    if (seaVolume == null || seaVolume <= 0 || seaGrossWeight == null || seaGrossWeight <= 0) return null;
    return calcSeaLCLFreight(seaVolume, seaGrossWeight, seaConfig);
  }, [seaVolume, seaGrossWeight, seaConfig]);

  // ========== 文件寄送计算 ==========
  const docResult: DocumentFeeResult | null = useMemo(() => {
    if (docWeight == null || docWeight <= 0) return null;
    return calcDocumentFee(docWeight, docPaymentType, docConfig);
  }, [docWeight, docPaymentType, docConfig]);

  // ========== 重置 ==========
  const handleReset = () => {
    setAirLength(null); setAirWidth(null); setAirHeight(null);
    setAirActualWeight(null); setAirCategories([]); setHasWoodenBox(false);
    setSeaVolume(null); setSeaGrossWeight(null);
    setDocWeight(null); setDocPaymentType('PREPAID');
  };

  // ========== 渲染空运 Tab ==========
  const renderAirTab = () => (
    <div>
      <Alert
        type="info" showIcon icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
        message="航空计费规则"
        description={
          <div>
            <div>1. 体积重量 = 长(cm) × 宽(cm) × 高(cm) ÷ {airConfig.volumetricDivisor}，与实际重量取大</div>
            <div>2. 首重{airConfig.firstWeightPrice}元/kg，续重阶梯：{airConfig.continuationTiers.map(t =>
              `≥${t.minWeight}kg ${t.unitPrice}元`).join('、')}</div>
            <div>3. 进位规则：首重整公斤，续重不足0.5按0.5计、超0.5不足1按1计</div>
          </div>
        }
      />

      {/* 输入区 */}
      <Row gutter={16}>
        <Col span={4}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>长(cm)</div>
          <InputNumber style={{ width: '100%' }} min={0} placeholder="长" value={airLength} onChange={v => setAirLength(v)} />
        </Col>
        <Col span={4}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>宽(cm)</div>
          <InputNumber style={{ width: '100%' }} min={0} placeholder="宽" value={airWidth} onChange={v => setAirWidth(v)} />
        </Col>
        <Col span={4}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>高(cm)</div>
          <InputNumber style={{ width: '100%' }} min={0} placeholder="高" value={airHeight} onChange={v => setAirHeight(v)} />
        </Col>
        <Col span={4}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>实际毛重(kg)</div>
          <InputNumber style={{ width: '100%' }} min={0} step={0.1} placeholder="毛重" value={airActualWeight} onChange={v => setAirActualWeight(v)} />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 12 }}>
        <Col span={12}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>货物品类</div>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="选择货物品类（可多选）"
            value={airCategories}
            onChange={setAirCategories}
            options={ALL_CATEGORY_OPTIONS}
          />
        </Col>
        <Col span={4}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>木箱包装</div>
          <Switch checked={hasWoodenBox} onChange={setHasWoodenBox} checkedChildren="是" unCheckedChildren="否" />
        </Col>
        <Col span={4}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>&nbsp;</div>
          <a onClick={handleReset} style={{ fontSize: 13 }}>重置</a>
        </Col>
      </Row>

      {/* 未提供尺寸提示 */}
      {airActualWeight != null && airActualWeight > 0 && airResult && airResult.chargeableWeight.basis === 'ACTUAL_ONLY' && (
        <Alert
          type="warning" showIcon
          style={{ marginTop: 12 }}
          message="未提供尺寸，按实际重量计费"
        />
      )}

      {/* 混装标记 */}
      {airResult && airResult.isMixedCargo && (
        <Alert
          type="warning" showIcon icon={<WarningOutlined />}
          style={{ marginTop: 12 }}
          message={
            <span>
              <Tag color="warning">混装计费</Tag>
              整票按最高附加费率 <Text strong>{(airResult.surchargeRate * 100).toFixed(0)}%</Text> 计费
              （适用品类：{airResult.surchargeCategory ? CARGO_CATEGORY_LABELS[airResult.surchargeCategory] : '-'}）
            </span>
          }
        />
      )}

      {/* 计费明细 */}
      {airResult && (
        <Card size="small" style={{ marginTop: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          {/* 计费重量判定 */}
          <Row gutter={24}>
            <Col span={6}>
              <div style={{ color: '#666', fontSize: 13 }}>实际毛重</div>
              <div style={{
                fontSize: 20, fontWeight: 600,
                color: airResult.chargeableWeight.basis === 'ACTUAL' ? '#ff4d4f' : undefined,
              }}>
                {airResult.chargeableWeight.actualWeight} kg
              </div>
              {airResult.chargeableWeight.basis === 'ACTUAL' && (
                <Tag color="red" style={{ marginTop: 4 }}>计费依据</Tag>
              )}
            </Col>
            <Col span={6}>
              <div style={{ color: '#666', fontSize: 13 }}>体积重量</div>
              <div style={{
                fontSize: 20, fontWeight: 600,
                color: airResult.chargeableWeight.basis === 'VOLUMETRIC' ? '#ff4d4f' : undefined,
              }}>
                {airResult.chargeableWeight.volumetricWeight != null
                  ? `${airResult.chargeableWeight.volumetricWeight} kg`
                  : '-'}
              </div>
              {airResult.chargeableWeight.basis === 'VOLUMETRIC' && (
                <Tag color="red" style={{ marginTop: 4 }}>计费依据</Tag>
              )}
              {airResult.chargeableWeight.volumetricWeight != null && (
                <div style={{ fontSize: 12, color: '#999' }}>
                  {airLength}×{airWidth}×{airHeight}÷{airConfig.volumetricDivisor}
                </div>
              )}
            </Col>
            <Col span={6}>
              <div style={{ color: '#666', fontSize: 13 }}>进位前</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>
                {airResult.roundedWeight.originalWeight} kg
              </div>
            </Col>
            <Col span={6}>
              <div style={{ color: '#666', fontSize: 13 }}>进位后计费重</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>
                {airResult.roundedWeight.roundedWeight} kg
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                首重 {airResult.roundedWeight.firstWeight}kg + 续重 {airResult.roundedWeight.continuationWeight}kg
              </div>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          {/* 费用明细 */}
          <Descriptions column={1} size="small" labelStyle={{ width: 160, fontWeight: 500 }}>
            <Descriptions.Item label="首重费用">
              {airResult.roundedWeight.firstWeight} kg × {airConfig.firstWeightPrice} 元/kg = <Text strong>{airResult.firstWeightFee} 元</Text>
            </Descriptions.Item>
            <Descriptions.Item label={`续重费用（阶梯${airResult.continuationTierIndex + 1}）`}>
              {airResult.roundedWeight.continuationWeight} kg × {airResult.continuationUnitPrice} 元/kg = <Text strong>{airResult.continuationWeightFee} 元</Text>
            </Descriptions.Item>
            <Descriptions.Item label="基础运费">
              <Text strong style={{ color: '#1890ff', fontSize: 16 }}>
                {airResult.baseFreight} 元
              </Text>
            </Descriptions.Item>

            {airResult.surchargeRate > 0 && (
              <Descriptions.Item label={
                <span>
                  品类附加费
                  <Tag color="orange" style={{ marginLeft: 4 }}>
                    {(airResult.surchargeRate * 100).toFixed(0)}%
                  </Tag>
                </span>
              }>
                {airResult.baseFreight} × {(airResult.surchargeRate * 100).toFixed(0)}% = <Text strong>{airResult.surchargeAmount} 元</Text>
                {airResult.surchargeCategory && (
                  <span style={{ marginLeft: 8, color: '#999' }}>
                    （{CARGO_CATEGORY_LABELS[airResult.surchargeCategory]}）
                  </span>
                )}
              </Descriptions.Item>
            )}

            {airResult.packagingSurcharge > 0 && (
              <Descriptions.Item label="木箱包装附加费">
                {airResult.roundedWeight.roundedWeight} kg × {airConfig.packagingSurchargePerKg} 元/kg = <Text strong>{airResult.packagingSurcharge} 元</Text>
              </Descriptions.Item>
            )}

            <Descriptions.Item label="总运费">
              <Text strong style={{ color: '#ff4d4f', fontSize: 20 }}>
                ¥ {airResult.totalFreight}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );

  // ========== 渲染海运拼箱 Tab ==========
  const renderSeaTab = () => (
    <div>
      <Alert
        type="info" showIcon icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
        message="海运拼箱计费规则"
        description={
          <div>
            <div>1. 体积重量比：1立方米 = {seaConfig.volumeWeightRatio} 公斤</div>
            <div>2. 密度 ≤ {seaConfig.volumeWeightRatio}kg/m³ → 轻货，按实际体积计费</div>
            <div>3. 密度 &gt; {seaConfig.volumeWeightRatio}kg/m³ → 重货，计费体积 = 毛重 ÷ {seaConfig.volumeWeightRatio}</div>
            <div>4. 最终计费体积取实际体积与换算体积的较大值</div>
            <div style={{ color: '#faad14', marginTop: 4 }}>提示：不规则包装请按最长/最宽/最高点测量</div>
          </div>
        }
      />

      <Row gutter={16}>
        <Col span={6}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>实际体积(m³)</div>
          <InputNumber style={{ width: '100%' }} min={0} step={0.01} placeholder="实际体积" value={seaVolume} onChange={v => setSeaVolume(v)} />
        </Col>
        <Col span={6}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>实际毛重(kg)</div>
          <InputNumber style={{ width: '100%' }} min={0} placeholder="毛重" value={seaGrossWeight} onChange={v => setSeaGrossWeight(v)} />
        </Col>
        <Col span={4}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>&nbsp;</div>
          <a onClick={handleReset} style={{ fontSize: 13 }}>重置</a>
        </Col>
      </Row>

      {seaResult && (
        <Card size="small" style={{ marginTop: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Row gutter={24}>
            <Col span={5}>
              <div style={{ color: '#666', fontSize: 13 }}>实际体积</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{seaResult.actualVolume} m³</div>
            </Col>
            <Col span={5}>
              <div style={{ color: '#666', fontSize: 13 }}>密度</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }}>{seaResult.density} kg/m³</div>
            </Col>
            <Col span={4}>
              <div style={{ color: '#666', fontSize: 13 }}>判定</div>
              <div style={{ marginTop: 4 }}>
                {seaResult.cargoType === 'LIGHT'
                  ? <Tag color="green">轻货</Tag>
                  : <Tag color="orange">重货</Tag>}
              </div>
            </Col>
            <Col span={5}>
              <div style={{ color: '#666', fontSize: 13 }}>换算体积</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {seaResult.convertedVolume} m³
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>{seaResult.grossWeight} ÷ {seaConfig.volumeWeightRatio}</div>
            </Col>
            <Col span={5}>
              <div style={{ color: '#666', fontSize: 13 }}>计费体积</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>{seaResult.chargeableVolume} m³</div>
              <div style={{ fontSize: 12, color: '#999' }}>取较大值</div>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }} />

          <Descriptions column={1} size="small" labelStyle={{ width: 120, fontWeight: 500 }}>
            <Descriptions.Item label="计费体积">
              {seaResult.chargeableVolume} m³
            </Descriptions.Item>
            <Descriptions.Item label="单价">
              {seaResult.unitPrice} 元/m³
            </Descriptions.Item>
            <Descriptions.Item label="总运费">
              <Text strong style={{ color: '#ff4d4f', fontSize: 20 }}>
                ¥ {seaResult.totalFreight}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );

  // ========== 渲染文件寄送 Tab ==========
  const renderDocTab = () => (
    <div>
      <Alert
        type="info" showIcon icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
        message="文件寄送收费标准"
        description={
          <div>
            <div>预付：{docConfig.prepaidCNY} 元/份（人民币）</div>
            <div>到付：{docConfig.collectUSD} 美元/份（USD）</div>
            <div>限重：{docConfig.maxWeightKg} 公斤以内</div>
          </div>
        }
      />

      <Row gutter={16}>
        <Col span={6}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>文件重量(kg)</div>
          <InputNumber
            style={{ width: '100%' }} min={0} step={0.1}
            placeholder={`限重${docConfig.maxWeightKg}kg`}
            value={docWeight}
            onChange={v => setDocWeight(v)}
          />
        </Col>
        <Col span={8}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>付费方式</div>
          <Radio.Group value={docPaymentType} onChange={e => setDocPaymentType(e.target.value)}>
            <Radio.Button value="PREPAID">预付（CNY）</Radio.Button>
            <Radio.Button value="COLLECT">到付（USD）</Radio.Button>
          </Radio.Group>
        </Col>
        <Col span={4}>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#666' }}>&nbsp;</div>
          <a onClick={handleReset} style={{ fontSize: 13 }}>重置</a>
        </Col>
      </Row>

      {docResult && docResult.overweight && (
        <Alert
          type="error" showIcon
          style={{ marginTop: 12 }}
          message="文件寄送限重0.5kg，超重请选择货物运输"
        />
      )}

      {docResult && (
        <Card size="small" style={{ marginTop: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Descriptions column={1} size="small" labelStyle={{ width: 120, fontWeight: 500 }}>
            <Descriptions.Item label="付费方式">
              {docResult.paymentType === 'PREPAID' ? '预付' : '到付'}
            </Descriptions.Item>
            <Descriptions.Item label="费用">
              <Text strong style={{ color: docResult.overweight ? '#999' : '#ff4d4f', fontSize: 20 }}>
                {docResult.currency === 'CNY' ? '¥' : '$'} {docResult.amount}
              </Text>
              <span style={{ marginLeft: 8, color: '#999' }}>
                ({docResult.currency})
              </span>
            </Descriptions.Item>
            {docResult.overweight && (
              <Descriptions.Item label="状态">
                <Tag color="error">超重</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}
    </div>
  );

  return (
    <Card size="small">
      <Tabs
        activeKey={calcMode}
        onChange={(key) => setCalcMode(key as CalcMode)}
        items={[
          {
            key: 'AIR',
            label: <span><RocketOutlined /> 航空运输</span>,
            children: renderAirTab(),
          },
          {
            key: 'SEA_LCL',
            label: <span><CloudOutlined /> 海运拼箱</span>,
            children: renderSeaTab(),
          },
          {
            key: 'DOC',
            label: <span><FileTextOutlined /> 文件寄送</span>,
            children: renderDocTab(),
          },
        ]}
      />
    </Card>
  );
};
