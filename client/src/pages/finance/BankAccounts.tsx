import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Table, Space, Tag, Button, Typography, Divider
} from 'antd';
import {
  BankOutlined, ArrowUpOutlined, ArrowDownOutlined,
  EyeOutlined, WalletOutlined, SwapOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// --- 接口定义 ---

interface BankTransaction {
  id: string;
  time: string;
  direction: 'IN' | 'OUT';
  amount: number;
  counterparty: string;
  description: string;
  balance: number;
}

interface BankAccount {
  id: string;
  bankName: string;
  bankLogo?: string;
  accountNo: string;
  accountName: string;
  currency: 'CNY' | 'USD' | 'EUR' | 'GBP';
  balance: number;
  todayIn: number;
  todayOut: number;
  todayNet: number;
  transactions: BankTransaction[];
}

// --- 汇率与货币符号 ---

const EXCHANGE_RATES: Record<string, number> = {
  CNY: 1,
  USD: 7.25,
  EUR: 7.85,
  GBP: 9.15
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£'
};

const CURRENCY_COLORS: Record<string, string> = {
  CNY: 'red',
  USD: 'green',
  EUR: 'blue',
  GBP: 'purple'
};

// --- 数据状态（待接入API） ---

// --- 组件 ---

export const BankAccounts: React.FC = () => {
  const [accounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // 总资产折合人民币
  const totalAssetsCNY = useMemo(() => {
    return accounts.reduce((sum, account) => {
      return sum + account.balance * EXCHANGE_RATES[account.currency];
    }, 0);
  }, []);

  // 今日净变动折合人民币
  const todayNetCNY = useMemo(() => {
    return accounts.reduce((sum, account) => {
      return sum + account.todayNet * EXCHANGE_RATES[account.currency];
    }, 0);
  }, []);

  // 选中的账户
  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return accounts.find(a => a.id === selectedAccountId) || null;
  }, [selectedAccountId]);

  // 格式化金额
  const formatAmount = (amount: number, currency: string): string => {
    const symbol = CURRENCY_SYMBOLS[currency] || '';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // 交易明细表格列
  const transactionColumns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 180,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 80,
      render: (val: 'IN' | 'OUT') => (
        <Tag color={val === 'IN' ? 'success' : 'error'} style={{ minWidth: 48, textAlign: 'center' }}>
          {val === 'IN' ? '收入' : '支出'}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (val: number, record: BankTransaction) => {
        const currency = selectedAccount?.currency || 'CNY';
        const color = record.direction === 'IN' ? '#52c41a' : '#ff4d4f';
        const prefix = record.direction === 'IN' ? '+' : '-';
        return (
          <Text strong style={{ color, fontFamily: 'monospace' }}>
            {prefix}{CURRENCY_SYMBOLS[currency]}{val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        );
      },
    },
    {
      title: '对方',
      dataIndex: 'counterparty',
      key: 'counterparty',
      width: 240,
      ellipsis: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '交易后余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 180,
      align: 'right' as const,
      render: (val: number) => {
        const currency = selectedAccount?.currency || 'CNY';
        return (
          <Text style={{ fontFamily: 'monospace' }}>
            {formatAmount(val, currency)}
          </Text>
        );
      },
    }
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* 总资产概览卡片 */}
      <Card
        style={{
          marginBottom: 24,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          borderRadius: 12,
          border: 'none',
        }}
        styles={{ body: { padding: '28px 32px' } }}
      >
        <Row align="middle" gutter={48}>
          <Col flex="auto">
            <div style={{ marginBottom: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                <WalletOutlined style={{ marginRight: 8 }} />
                总资产（折合人民币）
              </Text>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text style={{ color: '#fff', fontSize: 36, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 1 }}>
                ¥{totalAssetsCNY.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </div>
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
              共 {accounts.length} 个银行账户 · {accounts.filter(a => a.currency === 'CNY').length} 个人民币账户 · {accounts.filter(a => a.currency !== 'CNY').length} 个外币账户
            </Text>
          </Col>
          <Col>
            <div style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '16px 24px',
              minWidth: 200,
            }}>
              <div style={{ marginBottom: 4 }}>
                <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                  <SwapOutlined style={{ marginRight: 6 }} />
                  今日净变动
                </Text>
              </div>
              <div>
                <Text style={{
                  color: todayNetCNY >= 0 ? '#52c41a' : '#ff4d4f',
                  fontSize: 24,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}>
                  {todayNetCNY >= 0 ? '+' : ''}¥{todayNetCNY.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                {todayNetCNY >= 0 ? (
                  <ArrowUpOutlined style={{ color: '#52c41a', marginLeft: 8, fontSize: 16 }} />
                ) : (
                  <ArrowDownOutlined style={{ color: '#ff4d4f', marginLeft: 8, fontSize: 16 }} />
                )}
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 银行账户卡片网格 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {accounts.map((account) => {
          const isSelected = selectedAccountId === account.id;
          return (
            <Col span={8} key={account.id}>
              <Card
                hoverable
                style={{
                  borderRadius: 10,
                  border: isSelected ? '2px solid #1677ff' : '1px solid #f0f0f0',
                  boxShadow: isSelected ? '0 2px 12px rgba(22,119,255,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s ease',
                }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                {/* 银行名称 + 币种 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Space size={8}>
                    <BankOutlined style={{ fontSize: 18, color: '#1677ff' }} />
                    <Text strong style={{ fontSize: 16 }}>{account.bankName}</Text>
                  </Space>
                  <Tag color={CURRENCY_COLORS[account.currency]}>{account.currency}</Tag>
                </div>

                {/* 账号 */}
                <div style={{ marginBottom: 4 }}>
                  <Text style={{ fontFamily: 'monospace', color: '#999', fontSize: 14, letterSpacing: 1 }}>
                    {account.accountNo}
                  </Text>
                </div>

                {/* 开户名 */}
                <div style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#bbb', fontSize: 12 }}>{account.accountName}</Text>
                </div>

                <Divider style={{ margin: '0 0 16px 0' }} />

                {/* 余额 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 2 }}>
                    <Text style={{ color: '#999', fontSize: 12 }}>账户余额</Text>
                  </div>
                  <Text strong style={{ fontSize: 24, fontFamily: 'monospace', color: '#262626' }}>
                    {formatAmount(account.balance, account.currency)}
                  </Text>
                </div>

                {/* 今日变动 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ color: '#999', fontSize: 12 }}>今日变动</Text>
                  <Space size={4}>
                    <Text style={{
                      color: account.todayNet >= 0 ? '#52c41a' : '#ff4d4f',
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                    }}>
                      {account.todayNet >= 0 ? '+' : ''}{formatAmount(account.todayNet, account.currency)}
                    </Text>
                    {account.todayNet > 0 && <ArrowUpOutlined style={{ color: '#52c41a', fontSize: 12 }} />}
                    {account.todayNet < 0 && <ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
                    {account.todayNet === 0 && <Text style={{ color: '#999', fontSize: 12 }}>--</Text>}
                  </Space>
                </div>

                {/* 今日收支明细 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  background: '#fafafa',
                  borderRadius: 6,
                  padding: '8px 12px',
                  marginBottom: 16,
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div><Text style={{ fontSize: 11, color: '#999' }}>今日收入</Text></div>
                    <div>
                      <Text style={{ color: '#52c41a', fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>
                        +{CURRENCY_SYMBOLS[account.currency]}{account.todayIn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div><Text style={{ fontSize: 11, color: '#999' }}>今日支出</Text></div>
                    <div>
                      <Text style={{ color: '#ff4d4f', fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>
                        -{CURRENCY_SYMBOLS[account.currency]}{account.todayOut.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </div>
                  </div>
                </div>

                {/* 查看交易按钮 */}
                <Button
                  type={isSelected ? 'primary' : 'default'}
                  icon={<EyeOutlined />}
                  block
                  onClick={() => {
                    setSelectedAccountId(isSelected ? null : account.id);
                  }}
                >
                  {isSelected ? '收起交易' : '查看交易'}
                </Button>
              </Card>
            </Col>
          );
        })}

        {/* 汇率参考卡片 */}
        <Col span={8}>
          <Card
            style={{
              borderRadius: 10,
              border: '1px dashed #d9d9d9',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
            styles={{
              body: {
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                flex: 1,
              }
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <SwapOutlined style={{ fontSize: 28, color: '#1677ff', marginBottom: 8 }} />
              <div>
                <Text strong style={{ fontSize: 15 }}>参考汇率</Text>
              </div>
              <Text style={{ color: '#999', fontSize: 12 }}>更新时间：{dayjs().format('YYYY-MM-DD')}</Text>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(EXCHANGE_RATES).filter(([k]) => k !== 'CNY').map(([currency, rate]) => (
                <div key={currency} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#fafafa',
                  borderRadius: 6,
                }}>
                  <Space size={6}>
                    <Tag color={CURRENCY_COLORS[currency]} style={{ margin: 0 }}>{currency}</Tag>
                    <Text style={{ fontSize: 13 }}>1 {currency}</Text>
                  </Space>
                  <Text strong style={{ fontFamily: 'monospace', fontSize: 14 }}>= ¥{rate.toFixed(2)}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 交易明细区域 */}
      {selectedAccount && (
        <Card
          title={
            <Space>
              <BankOutlined style={{ color: '#1677ff' }} />
              <span>{selectedAccount.bankName}</span>
              <Tag color={CURRENCY_COLORS[selectedAccount.currency]}>{selectedAccount.currency}</Tag>
              <Text style={{ color: '#999', fontSize: 13, fontWeight: 'normal' }}>
                {selectedAccount.accountNo}
              </Text>
              <Text style={{ color: '#999', fontSize: 13, fontWeight: 'normal' }}>
                · 近期交易记录
              </Text>
            </Space>
          }
          extra={
            <Space>
              <Statistic
                title="当前余额"
                value={selectedAccount.balance}
                precision={2}
                prefix={CURRENCY_SYMBOLS[selectedAccount.currency]}
                valueStyle={{ fontSize: 16, fontFamily: 'monospace' }}
                style={{ marginRight: 24 }}
              />
              <Button
                type="text"
                onClick={() => setSelectedAccountId(null)}
              >
                收起
              </Button>
            </Space>
          }
          style={{ borderRadius: 10 }}
        >
          <Table
            dataSource={selectedAccount.transactions}
            columns={transactionColumns}
            rowKey="id"
            pagination={false}
            size="middle"
            rowClassName={(record) =>
              record.direction === 'IN' ? '' : ''
            }
            style={{ marginTop: -8 }}
          />
        </Card>
      )}
    </div>
  );
};
