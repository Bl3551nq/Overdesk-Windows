import React from 'react';

interface OverdeskLogoProps {
  className?: string;
  size?: number;
}

export const OverdeskLogo: React.FC<OverdeskLogoProps> = ({ className = '', size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      id="overdesk-logo-svg"
    >
      <defs>
        {/* Sphere gradient: premium cyber-blue to cobalt gradient */}
        <linearGradient id="sphereGrad_overdesk_unique" x1="0.15" y1="0.15" x2="0.85" y2="0.85">
          <stop offset="0%" stopColor="#00C0FF" />
          <stop offset="50%" stopColor="#005BFF" />
          <stop offset="100%" stopColor="#001B93" />
        </linearGradient>

        {/* Ring gradient: satin charcoal of the planet ring */}
        <linearGradient id="ringGrad_overdesk_unique" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2E2F37" />
          <stop offset="100%" stopColor="#131317" />
        </linearGradient>
      </defs>

      {/* 1. Back part of the ring (behind the sphere) */}
      <g transform="rotate(-15 50 50)">
        <path
          d="M 6 50 A 44 14 0 0 1 94 50 L 84 50 A 34 10 0 0 0 16 50 Z"
          fill="url(#ringGrad_overdesk_unique)"
        />
      </g>

      {/* 2. Blue Planet Sphere */}
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="url(#sphereGrad_overdesk_unique)"
      />

      {/* 3. Front part of the ring (in front of the sphere) */}
      <g transform="rotate(-15 50 50)">
        <path
          d="M 94 50 A 44 14 0 0 1 6 50 L 16 50 A 34 10 0 0 0 84 50 Z"
          fill="url(#ringGrad_overdesk_unique)"
        />
      </g>
    </svg>
  );
};
