import React from 'react';
import { Card } from 'antd';
import type { CardProps } from 'antd';
import type { CSSProperties, PropsWithChildren } from 'react';

interface ToolbarSectionProps extends PropsWithChildren {
  style?: CSSProperties;
}

interface ToolbarFieldProps extends PropsWithChildren {
  flex?: CSSProperties['flex'];
  minWidth?: CSSProperties['minWidth'];
  style?: CSSProperties;
}

export function ListPageToolbarCard({ children, size = 'small', bordered = false, style, styles, ...rest }: CardProps) {
  return (
    <Card
      size={size}
      bordered={bordered}
      style={{ marginBottom: 16, background: '#fafafa', ...style }}
      styles={{
        body: {
          padding: 12,
          ...styles?.body,
        },
        ...styles,
      }}
      {...rest}
    >
      {children}
    </Card>
  );
}

export function ListPageToolbar({ children, style }: ToolbarSectionProps) {
  return (
    <div className="list-page-toolbar" style={style}>
      {children}
    </div>
  );
}

export function ListPageToolbarFilters({ children, style }: ToolbarSectionProps) {
  return (
    <div className="list-page-toolbar__filters" style={style}>
      {children}
    </div>
  );
}

export function ListPageToolbarActions({ children, style }: ToolbarSectionProps) {
  return (
    <div className="list-page-toolbar__actions" style={style}>
      {children}
    </div>
  );
}

export function ListPageToolbarField({ children, flex = '0 1 auto', minWidth, style }: ToolbarFieldProps) {
  return (
    <div
      className="list-page-toolbar__field"
      style={{
        flex,
        minWidth,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
