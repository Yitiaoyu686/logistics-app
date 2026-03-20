import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Toast } from 'antd-mobile';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  type: 'ORIGIN' | 'DESTINATION' | 'TRANSIT';
  country: string;
  city: string;
}

const WarehouseSelect: React.FC = () => {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const warehouses: Warehouse[] = user?.warehouses || [];

  const handleSelect = (warehouse: Warehouse) => {
    localStorage.setItem('currentWarehouse', JSON.stringify(warehouse));
    localStorage.setItem('currentWarehouseId', warehouse.id);
    Toast.show({ content: `已选择${warehouse.name}`, icon: 'success' });
    // 根据角色跳转
    const role = user?.role;
    if (role === 'WAREHOUSE_US' || role === 'OPS_US' || role === 'DRIVER') {
      navigate('/warehouse-us/dashboard', { replace: true });
    } else if (role === 'SALES') {
      navigate('/sales/dashboard', { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  const typeLabels: Record<string, string> = {
    ORIGIN: '起运国',
    DESTINATION: '到达国',
    TRANSIT: '中转',
  };

  const typeColors: Record<string, string> = {
    ORIGIN: '#1890ff',
    DESTINATION: '#52c41a',
    TRANSIT: '#faad14',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '60px 20px 20px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ color: '#fff', fontSize: '24px', margin: 0 }}>选择工作仓库</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '8px', fontSize: '14px' }}>
          请选择您要操作的仓库
        </p>
      </div>
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        {warehouses.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.7)',
            padding: '40px 0',
            fontSize: '15px',
          }}>
            暂无可用仓库
          </div>
        )}
        {warehouses.map((w: Warehouse) => (
          <Card
            key={w.id}
            style={{
              marginBottom: '12px',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
            onClick={() => handleSelect(w)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{w.name}</div>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>
                  {w.country} · {w.city}
                </div>
                {w.nameEn && (
                  <div style={{ fontSize: '12px', color: '#bbb', marginTop: '2px' }}>
                    {w.nameEn}
                  </div>
                )}
              </div>
              <span style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#fff',
                background: typeColors[w.type] || '#999',
              }}>
                {typeLabels[w.type] || w.type}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default WarehouseSelect;
