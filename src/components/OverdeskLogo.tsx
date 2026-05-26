import React from 'react';
import overdeskLogoUrl from '../overdesk.svg';

interface OverdeskLogoProps {
  className?: string;
  size?: number;
}

export const OverdeskLogo: React.FC<OverdeskLogoProps> = ({ className = '', size = 48 }) => {
  return (
    <img
      src={overdeskLogoUrl}
      width={size}
      height={size}
      className={className}
      id="overdesk-logo"
      alt="Overdesk"
      referrerPolicy="no-referrer"
    />
  );
};
