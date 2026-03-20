import React, { useCallback, useMemo } from 'react';
import { Table, InputNumber, Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

export interface DimensionRow {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  pieces: number;
}

export interface DimensionInputProps {
  value?: DimensionRow[];
  onChange?: (rows: DimensionRow[]) => void;
  mode: 'AIR' | 'SEA' | 'GENERIC';
  disabled?: boolean;
}

interface InternalRow extends DimensionRow {
  key: number;
  volumeCbm: number;
  volumeWeightKgs: number;
}

const FACTOR: Record<DimensionInputProps['mode'], number> = {
  AIR: 167,
  SEA: 1000,
  GENERIC: 0,
};

const DEFAULT_ROW: DimensionRow = {
  weightKg: 0,
  lengthCm: 0,
  widthCm: 0,
  heightCm: 0,
  pieces: 1,
};

const DimensionInput: React.FC<DimensionInputProps> = ({
  value = [],
  onChange,
  mode,
  disabled = false,
}) => {
  const factor = FACTOR[mode];

  const calcVolume = useCallback(
    (r: DimensionRow) => {
      const cbm = (r.lengthCm * r.widthCm * r.heightCm) / 1_000_000;
      return {
        volumeCbm: Math.round(cbm * 1_000_000) / 1_000_000,
        volumeWeightKgs: factor ? Math.round(cbm * factor * 100) / 100 : 0,
      };
    },
    [factor],
  );

  const dataSource: InternalRow[] = useMemo(
    () =>
      value.map((r, i) => ({
        ...r,
        key: i,
        ...calcVolume(r),
      })),
    [value, calcVolume],
  );

  const updateRow = useCallback(
    (index: number, field: keyof DimensionRow, val: number | null) => {
      const next = value.map((r, i) =>
        i === index ? { ...r, [field]: val ?? 0 } : r,
      );
      onChange?.(next);
    },
    [value, onChange],
  );

  const deleteRow = useCallback(
    (index: number) => {
      onChange?.(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const addRow = useCallback(() => {
    onChange?.([...value, { ...DEFAULT_ROW }]);
  }, [value, onChange]);

  const totals = useMemo(() => {
    let weightKg = 0;
    let pieces = 0;
    let volumeCbm = 0;
    let volumeWeightKgs = 0;
    for (const r of dataSource) {
      weightKg += r.weightKg;
      pieces += r.pieces;
      volumeCbm += r.volumeCbm;
      volumeWeightKgs += r.volumeWeightKgs;
    }
    return {
      weightKg: Math.round(weightKg * 100) / 100,
      pieces,
      volumeCbm: Math.round(volumeCbm * 1_000_000) / 1_000_000,
      volumeWeightKgs: Math.round(volumeWeightKgs * 100) / 100,
    };
  }, [dataSource]);

  const columns = useMemo<ColumnsType<InternalRow>>(() => {
    const cols: ColumnsType<InternalRow> = [
      {
        title: '重量KG',
        dataIndex: 'weightKg',
        width: 100,
        render: (_val: number, _record: InternalRow, index: number) => (
          <InputNumber
            min={0}
            value={_val}
            disabled={disabled}
            size="small"
            style={{ width: '100%' }}
            onChange={(v) => updateRow(index, 'weightKg', v)}
          />
        ),
      },
      {
        title: '长CM',
        dataIndex: 'lengthCm',
        width: 100,
        render: (_val: number, _record: InternalRow, index: number) => (
          <InputNumber
            min={0}
            value={_val}
            disabled={disabled}
            size="small"
            style={{ width: '100%' }}
            onChange={(v) => updateRow(index, 'lengthCm', v)}
          />
        ),
      },
      {
        title: '宽CM',
        dataIndex: 'widthCm',
        width: 100,
        render: (_val: number, _record: InternalRow, index: number) => (
          <InputNumber
            min={0}
            value={_val}
            disabled={disabled}
            size="small"
            style={{ width: '100%' }}
            onChange={(v) => updateRow(index, 'widthCm', v)}
          />
        ),
      },
      {
        title: '高CM',
        dataIndex: 'heightCm',
        width: 100,
        render: (_val: number, _record: InternalRow, index: number) => (
          <InputNumber
            min={0}
            value={_val}
            disabled={disabled}
            size="small"
            style={{ width: '100%' }}
            onChange={(v) => updateRow(index, 'heightCm', v)}
          />
        ),
      },
      {
        title: '件数',
        dataIndex: 'pieces',
        width: 80,
        render: (_val: number, _record: InternalRow, index: number) => (
          <InputNumber
            min={1}
            precision={0}
            value={_val}
            disabled={disabled}
            size="small"
            style={{ width: '100%' }}
            onChange={(v) => updateRow(index, 'pieces', v)}
          />
        ),
      },
      {
        title: '体积CBM',
        dataIndex: 'volumeCbm',
        width: 100,
        render: (val: number) => val.toFixed(6),
      },
    ];

    if (mode !== 'GENERIC') {
      cols.push({
        title: '体积重KGS',
        dataIndex: 'volumeWeightKgs',
        width: 110,
        render: (val: number) => val.toFixed(2),
      });
    }

    if (!disabled) {
      cols.push({
        title: '',
        key: 'action',
        width: 50,
        render: (_: unknown, _record: InternalRow, index: number) => (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => deleteRow(index)}
          />
        ),
      });
    }

    return cols;
  }, [mode, disabled, updateRow, deleteRow]);

  const summaryRow = useCallback(() => {
    const colCount = columns.length;
    return (
      <Table.Summary.Row>
        <Table.Summary.Cell index={0}>
          <strong>{totals.weightKg}</strong>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={1} colSpan={3}>
          <strong>合计</strong>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={4}>
          <strong>{totals.pieces}</strong>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={5}>
          <strong>{totals.volumeCbm.toFixed(6)}</strong>
        </Table.Summary.Cell>
        {mode !== 'GENERIC' && (
          <Table.Summary.Cell index={6}>
            <strong>{totals.volumeWeightKgs.toFixed(2)}</strong>
          </Table.Summary.Cell>
        )}
        {!disabled && (
          <Table.Summary.Cell index={colCount - 1} />
        )}
      </Table.Summary.Row>
    );
  }, [columns.length, totals, mode, disabled]);

  return (
    <div>
      <Table<InternalRow>
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        bordered
        summary={summaryRow}
      />
      {!disabled && (
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={addRow}
          style={{ marginTop: 8 }}
        >
          +添加
        </Button>
      )}
    </div>
  );
};

export default DimensionInput;
