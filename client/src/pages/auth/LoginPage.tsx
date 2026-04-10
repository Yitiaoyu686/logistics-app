import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, GlobalOutlined } from '@ant-design/icons';
import { authApi } from '../../api';

const { Title, Text } = Typography;

interface LoginPageProps {
  onLoginSuccess: (user: any, token: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);

  // Mock 用户数据（后端待重建，登录走前端 Mock）
  const MOCK_USERS: Record<string, { password: string; user: any }> = {
    admin: { password: 'admin123', user: { id: '1', username: 'admin', realName: '系统管理员', role: 'ADMIN', roles: ['ADMIN'], roleDetails: [{ id: '1', roleCode: 'ADMIN', roleName: '系统管理员' }], email: 'admin@logistics.com', status: 'ACTIVE' } },
    sales1: { password: '123456', user: { id: '2', username: 'sales1', realName: 'AkinGbolahan', role: 'SALES', roles: ['SALES'], roleDetails: [{ id: '2', roleCode: 'SALES', roleName: '销售人员' }], email: 'akin@logistics.com', status: 'ACTIVE' } },
    warehouse_cn1: { password: '123456', user: { id: '3', username: 'warehouse_cn1', realName: '李仓管', role: 'WAREHOUSE_CN', roles: ['WAREHOUSE_CN'], roleDetails: [{ id: '3', roleCode: 'WAREHOUSE_CN', roleName: '起运国仓管' }], email: 'licg@logistics.com', status: 'ACTIVE' } },
    ops_cn1: { password: '123456', user: { id: '4', username: 'ops_cn1', realName: '张运营', role: 'OPS_CN', roles: ['OPS_CN'], roleDetails: [{ id: '4', roleCode: 'OPS_CN', roleName: '起运国操作' }], email: 'zhangops@logistics.com', status: 'ACTIVE' } },
    ops_us1: { password: '123456', user: { id: '5', username: 'ops_us1', realName: '赵运营', role: 'OPS_US', roles: ['OPS_US'], roleDetails: [{ id: '5', roleCode: 'OPS_US', roleName: '到达国操作' }], email: 'zhaoops@logistics.com', status: 'ACTIVE' } },
    warehouse_us1: { password: '123456', user: { id: '6', username: 'warehouse_us1', realName: '王仓管', role: 'WAREHOUSE_US', roles: ['WAREHOUSE_US'], roleDetails: [{ id: '6', roleCode: 'WAREHOUSE_US', roleName: '到达国仓管' }], email: 'wangcg@logistics.com', status: 'ACTIVE' } },
    finance1: { password: '123456', user: { id: '7', username: 'finance1', realName: '钱财务', role: 'FINANCE', roles: ['FINANCE'], roleDetails: [{ id: '7', roleCode: 'FINANCE', roleName: '财务人员' }], email: 'qian@logistics.com', status: 'ACTIVE' } },
    boss1: { password: '123456', user: { id: '8', username: 'boss1', realName: '孙总', role: 'BOSS', roles: ['BOSS'], roleDetails: [{ id: '8', roleCode: 'BOSS', roleName: '管理层' }], email: 'sun@logistics.com', status: 'ACTIVE' } },
  };

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      // 优先尝试后端登录
      const res: any = await authApi.login(values.username, values.password);
      const { token, user } = res.data || res;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      message.success(`欢迎回来，${user.realName}`);
      onLoginSuccess(user, token);
    } catch {
      // 后端不可用时走前端 Mock 登录
      const mockEntry = MOCK_USERS[values.username];
      if (mockEntry && mockEntry.password === values.password) {
        const token = 'mock-token-' + Date.now();
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(mockEntry.user));
        message.success(`欢迎回来，${mockEntry.user.realName}`);
        onLoginSuccess(mockEntry.user, token);
      } else {
        message.error('用户名或密码错误');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <GlobalOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 12 }} />
          <Title level={3} style={{ margin: 0, marginBottom: 4 }}>跨境物流管理系统</Title>
          <Text type="secondary">请登录您的账号</Text>
        </div>

        <Form onFinish={handleSubmit} size="large" autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            管理员账号: admin / admin123
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
