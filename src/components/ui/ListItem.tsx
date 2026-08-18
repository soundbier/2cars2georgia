import { ReactNode } from 'react';
import './ListItem.css';

interface ListItemProps {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}

export function ListItem({ leading, title, subtitle, trailing }: ListItemProps) {
  return (
    <div className="list-item">
      {leading && <div className="list-item-leading">{leading}</div>}
      <div className="list-item-body">
        <div className="list-item-title">{title}</div>
        {subtitle && <div className="list-item-subtitle">{subtitle}</div>}
      </div>
      {trailing && <div className="list-item-trailing">{trailing}</div>}
    </div>
  );
}
