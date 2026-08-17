import { ReactNode } from 'react';
import './ListItem.css';

interface ListItemProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}

export function ListItem({ leading, title, subtitle, trailing, onClick }: ListItemProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="list-item" onClick={onClick} type={onClick ? 'button' : undefined}>
      {leading && <div className="list-item-leading">{leading}</div>}
      <div className="list-item-body">
        <div className="list-item-title">{title}</div>
        {subtitle && <div className="list-item-subtitle">{subtitle}</div>}
      </div>
      {trailing && <div className="list-item-trailing">{trailing}</div>}
    </Tag>
  );
}
