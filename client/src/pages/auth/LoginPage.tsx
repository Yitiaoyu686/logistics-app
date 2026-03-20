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

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res: any = await authApi.login(values.username, values.password);
      const { token, user } = res.data || res;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      message.success(`欢迎回来，${user.realName}`);
      onLoginSuccess(user, token);
    } catch (err: any) {
      message.error(err.message || '登录失败，请检查用户名和密码');
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
